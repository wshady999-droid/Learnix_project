import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult, UserRole } from "@/types";

export interface SharedNotificationItem {
  recipientId: string;
  notificationId: string;
  title: string;
  body: string;
  category: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export async function getMyNotificationsData(): Promise<
  ServiceResult<{
    userId: string;
    unreadCount: number;
    items: SharedNotificationItem[];
  }>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const userId = auth.data.userId;

  const { data: recipients, error: recErr } = await supabase
    .from("notification_recipients")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (recErr) return { ok: false, error: recErr.message };

  const notifIds = (recipients ?? []).map((r) => r.notification_id);
  const { data: notifications } =
    notifIds.length > 0
      ? await supabase.from("notifications").select("*").in("id", notifIds)
      : { data: [] as Array<TableRow<"notifications">> };

  const notifMap = new Map((notifications ?? []).map((n) => [n.id, n]));
  const items: SharedNotificationItem[] = (recipients ?? [])
    .map((nr) => {
      const n = notifMap.get(nr.notification_id);
      if (!n) return null;
      return {
        recipientId: nr.id,
        notificationId: n.id,
        title: n.title,
        body: n.body,
        category: n.notification_type,
        actionUrl: n.action_url,
        isRead: nr.is_read,
        createdAt: nr.created_at,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  return {
    ok: true,
    data: {
      userId,
      unreadCount: items.filter((i) => !i.isRead).length,
      items,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. SMART CALENDAR DATA (Schedules, Exams, Assignment Deadlines, Study Events)
// -----------------------------------------------------------------------------
export interface SmartCalendarEvent {
  id: string;
  kind: "class" | "exam" | "assignment" | "study";
  title: string;
  subtitle: string;
  dateLabel: string;
  timeLabel: string;
  courseTitle: string;
}

export async function getSmartCalendarData(): Promise<
  ServiceResult<{
    role: UserRole;
    events: SmartCalendarEvent[];
  }>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const userId = auth.data.userId;
  const role = auth.data.role;

  const DAY_NAMES = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];

  // Determine visible course IDs based on role
  let courseIds: string[] = [];
  if (role === "admin") {
    const { data } = await supabase.from("courses").select("id");
    courseIds = (data ?? []).map((c) => c.id);
  } else if (role === "teacher") {
    const { data } = await supabase
      .from("courses")
      .select("id")
      .eq("teacher_id", userId);
    courseIds = (data ?? []).map((c) => c.id);
  } else {
    const { data } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("student_id", userId);
    courseIds = (data ?? []).map((e) => e.course_id);
  }

  const [coursesRes, schedulesRes, examsRes, assignmentsRes, studyRes] =
    await Promise.all([
      courseIds.length > 0
        ? supabase.from("courses").select("id, code, title").in("id", courseIds)
        : Promise.resolve({
            data: [] as Array<{ id: string; code: string; title: string }>,
          }),
      courseIds.length > 0
        ? supabase
            .from("class_schedules")
            .select("*")
            .in("course_id", courseIds)
            .eq("is_active", true)
        : Promise.resolve({ data: [] as Array<TableRow<"class_schedules">> }),
      courseIds.length > 0
        ? supabase
            .from("exams")
            .select("*")
            .in("course_id", courseIds)
            .eq("status", "published")
        : Promise.resolve({ data: [] as Array<TableRow<"exams">> }),
      courseIds.length > 0
        ? supabase
            .from("assignments")
            .select("*")
            .in("course_id", courseIds)
            .eq("is_published", true)
        : Promise.resolve({ data: [] as Array<TableRow<"assignments">> }),
      supabase
        .from("study_sessions")
        .select("*")
        .eq("student_id", userId)
        .order("started_at", { ascending: false })
        .limit(12),
    ]);

  const courseMap = new Map(
    (coursesRes.data ?? []).map((c) => [c.id, `${c.code} — ${c.title}`]),
  );

  const events: SmartCalendarEvent[] = [
    ...(schedulesRes.data ?? []).map((s) => ({
      id: `class-${s.id}`,
      kind: "class" as const,
      title: `Class Session (${DAY_NAMES[s.day_of_week] ?? "Weekly"})`,
      subtitle: s.room ? `Room ${s.room}` : s.notes || "Scheduled class",
      dateLabel: `Every ${DAY_NAMES[s.day_of_week] ?? "Week"}`,
      timeLabel: `${s.start_time.slice(0, 5)} – ${s.end_time.slice(0, 5)}`,
      courseTitle: courseMap.get(s.course_id) || "Course",
    })),
    ...(examsRes.data ?? []).map((e) => ({
      id: `exam-${e.id}`,
      kind: "exam" as const,
      title: e.title,
      subtitle: `${e.duration_minutes} min • ${Number(e.total_points)} pts`,
      dateLabel: e.available_from ? e.available_from.slice(0, 10) : "Open Window",
      timeLabel: e.available_until
        ? `Until ${e.available_until.slice(0, 16).replace("T", " ")}`
        : "Published",
      courseTitle: courseMap.get(e.course_id) || "Course",
    })),
    ...(assignmentsRes.data ?? []).map((a) => ({
      id: `asg-${a.id}`,
      kind: "assignment" as const,
      title: a.title,
      subtitle: `Max ${Number(a.max_points)} pts`,
      dateLabel: a.due_at ? a.due_at.slice(0, 10) : "No due date",
      timeLabel: a.due_at ? a.due_at.slice(11, 16) : "Open",
      courseTitle: courseMap.get(a.course_id) || "Course",
    })),
    ...(studyRes.data ?? []).map((st) => ({
      id: `study-${st.id}`,
      kind: "study" as const,
      title: "Focused Study Session",
      subtitle: `${Math.max(1, Math.round((st.duration_seconds ?? 0) / 60))} min logged`,
      dateLabel: st.started_at.slice(0, 10),
      timeLabel: st.started_at.slice(11, 16),
      courseTitle: st.course_id
        ? courseMap.get(st.course_id) || "Course"
        : "Self Study",
    })),
  ];

  return { ok: true, data: { role, events } };
}

// -----------------------------------------------------------------------------
// 3. INTERNAL MESSAGING DATA (Authorized Student-Teacher Conversations)
// -----------------------------------------------------------------------------
export interface MessagingConversationItem {
  id: string;
  subject: string;
  courseTitle: string | null;
  lastMessageAt: string;
  participantNames: string[];
  messages: Array<{
    id: string;
    senderId: string;
    senderName: string;
    body: string;
    createdAt: string;
    attachments: Array<{
      id: string;
      fileName: string;
      storagePath: string;
    }>;
  }>;
}

export interface MessagingContactsData {
  userId: string;
  role: UserRole;
  conversations: MessagingConversationItem[];
  authorizedContacts: Array<{
    id: string;
    fullName: string;
    email: string;
    role: string;
    courseId: string | null;
    courseTitle: string | null;
  }>;
}

export async function getMessagingData(): Promise<
  ServiceResult<MessagingContactsData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const userId = auth.data.userId;
  const role = auth.data.role;

  const [myPartsRes, profilesRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", userId),
    supabase.from("profiles").select("id, full_name, email, role"),
  ]);

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const convIds = (myPartsRes.data ?? []).map((p) => p.conversation_id);

  const [convsRes, allPartsRes, msgsRes, coursesRes] = await Promise.all([
    convIds.length > 0
      ? supabase
          .from("conversations")
          .select("*")
          .in("id", convIds)
          .order("last_message_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"conversations">> }),
    convIds.length > 0
      ? supabase
          .from("conversation_participants")
          .select("*")
          .in("conversation_id", convIds)
      : Promise.resolve({
          data: [] as Array<TableRow<"conversation_participants">>,
        }),
    convIds.length > 0
      ? supabase
          .from("messages")
          .select("*")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"messages">> }),
    supabase.from("courses").select("id, title, teacher_id"),
  ]);

  const messages = msgsRes.data ?? [];
  const msgIds = messages.map((m) => m.id);
  const attachmentsRes =
    msgIds.length > 0
      ? await supabase
          .from("message_attachments")
          .select("*")
          .in("message_id", msgIds)
      : { data: [] as Array<TableRow<"message_attachments">> };

  const courseMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));

  // Compute authorized contacts (students can message teachers of enrolled courses; teachers can message enrolled/assigned students)
  const contactMap = new Map<
    string,
    MessagingContactsData["authorizedContacts"][number]
  >();

  if (role === "student") {
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("student_id", userId);
    for (const enr of enrollments ?? []) {
      const course = courseMap.get(enr.course_id);
      if (!course) continue;
      const teacher = profileMap.get(course.teacher_id);
      if (teacher && teacher.id !== userId) {
        contactMap.set(teacher.id, {
          id: teacher.id,
          fullName: teacher.full_name || teacher.email,
          email: teacher.email,
          role: teacher.role,
          courseId: course.id,
          courseTitle: course.title,
        });
      }
    }
  } else if (role === "teacher") {
    const myCourses = (coursesRes.data ?? []).filter(
      (c) => c.teacher_id === userId,
    );
    const myCourseIds = myCourses.map((c) => c.id);
    if (myCourseIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("student_id, course_id")
        .in("course_id", myCourseIds);
      for (const enr of enrollments ?? []) {
        const stu = profileMap.get(enr.student_id);
        const course = courseMap.get(enr.course_id);
        if (stu && stu.id !== userId) {
          contactMap.set(stu.id, {
            id: stu.id,
            fullName: stu.full_name || stu.email,
            email: stu.email,
            role: stu.role,
            courseId: course?.id ?? null,
            courseTitle: course?.title ?? null,
          });
        }
      }
    }
  } else {
    for (const p of profilesRes.data ?? []) {
      if (p.id !== userId) {
        contactMap.set(p.id, {
          id: p.id,
          fullName: p.full_name || p.email,
          email: p.email,
          role: p.role,
          courseId: null,
          courseTitle: null,
        });
      }
    }
  }

  const conversations: MessagingConversationItem[] = (convsRes.data ?? []).map(
    (conv) => {
      const parts = (allPartsRes.data ?? []).filter(
        (p) => p.conversation_id === conv.id,
      );
      const participantNames = parts.map((p) => {
        const prof = profileMap.get(p.user_id);
        return prof?.full_name || prof?.email || "User";
      });
      const convMsgs = messages
        .filter((m) => m.conversation_id === conv.id)
        .map((m) => {
          const sender = profileMap.get(m.sender_id);
          const atts = (attachmentsRes.data ?? [])
            .filter((a) => a.message_id === m.id)
            .map((a) => ({
              id: a.id,
              fileName: a.file_name,
              storagePath: a.storage_path,
            }));
          return {
            id: m.id,
            senderId: m.sender_id,
            senderName: sender?.full_name || sender?.email || "User",
            body: m.body,
            createdAt: m.created_at,
            attachments: atts,
          };
        });

      return {
        id: conv.id,
        subject: conv.subject || "Direct Conversation",
        courseTitle: conv.course_id
          ? courseMap.get(conv.course_id)?.title ?? null
          : null,
        lastMessageAt: conv.last_message_at,
        participantNames,
        messages: convMsgs,
      };
    },
  );

  return {
    ok: true,
    data: {
      userId,
      role,
      conversations,
      authorizedContacts: Array.from(contactMap.values()),
    },
  };
}

// -----------------------------------------------------------------------------
// 4. STUDENT ATTENDANCE HISTORY DATA
// -----------------------------------------------------------------------------
export interface StudentAttendanceViewData {
  totalSessions: number;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  attendanceRatePercent: number;
  records: Array<{
    id: string;
    courseTitle: string;
    topic: string;
    sessionDate: string;
    status: string;
    remarks: string | null;
  }>;
}

export async function getStudentAttendanceViewData(): Promise<
  ServiceResult<StudentAttendanceViewData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { data: records, error } = await supabase
    .from("attendance_records")
    .select("*")
    .eq("student_id", auth.data.userId)
    .order("recorded_at", { ascending: false });

  if (error) return { ok: false, error: error.message };

  const rows = records ?? [];
  const attIds = Array.from(new Set(rows.map((r) => r.attendance_id)));

  const { data: sessions } =
    attIds.length > 0
      ? await supabase.from("attendance").select("*").in("id", attIds)
      : { data: [] as Array<TableRow<"attendance">> };

  const sessionMap = new Map((sessions ?? []).map((s) => [s.id, s]));
  const courseIds = Array.from(
    new Set((sessions ?? []).map((s) => s.course_id)),
  );
  const { data: courses } =
    courseIds.length > 0
      ? await supabase.from("courses").select("id, title").in("id", courseIds)
      : { data: [] as Array<{ id: string; title: string }> };
  const courseMap = new Map((courses ?? []).map((c) => [c.id, c.title]));

  const presentCount = rows.filter((r) => r.status === "present").length;
  const lateCount = rows.filter((r) => r.status === "late").length;
  const excusedCount = rows.filter((r) => r.status === "excused").length;
  const absentCount = rows.filter((r) => r.status === "absent").length;
  const attended = presentCount + lateCount + excusedCount;
  const rate =
    rows.length > 0 ? Number(((attended / rows.length) * 100).toFixed(1)) : 100;

  return {
    ok: true,
    data: {
      totalSessions: rows.length,
      presentCount,
      lateCount,
      excusedCount,
      absentCount,
      attendanceRatePercent: rate,
      records: rows.map((r) => {
        const sess = sessionMap.get(r.attendance_id);
        return {
          id: r.id,
          courseTitle: sess
            ? courseMap.get(sess.course_id) || "Course"
            : "Course",
          topic: sess?.topic || "Class Session",
          sessionDate: sess?.session_date || r.recorded_at.slice(0, 10),
          status: r.status,
          remarks: r.remarks,
        };
      }),
    },
  };
}
