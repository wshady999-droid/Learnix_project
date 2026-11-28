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
  isAnnouncement: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationPreferencesMap {
  email_updates: boolean;
  course_alerts: boolean;
  exam_reminders: boolean;
  grade_notifications: boolean;
  security_alerts: boolean;
}

export async function getMyNotificationsData(): Promise<
  ServiceResult<{
    userId: string;
    role: UserRole;
    unreadCount: number;
    preferences: NotificationPreferencesMap;
    items: SharedNotificationItem[];
  }>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const userId = auth.data.userId;

  const [recipientsRes, profileRes] = await Promise.all([
    supabase
      .from("notification_recipients")
      .select(
        "id, notification_id, is_read, created_at, notifications(id, title, body, notification_type, action_url, is_announcement)",
      )
      .eq("recipient_id", userId)
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("profiles")
      .select("notification_preferences")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  if (recipientsRes.error) {
    return { ok: false, error: recipientsRes.error.message };
  }

  const rawPrefs = (profileRes.data?.notification_preferences ??
    {}) as Record<string, unknown>;
  const preferences: NotificationPreferencesMap = {
    email_updates:
      typeof rawPrefs.email_updates === "boolean" ? rawPrefs.email_updates : true,
    course_alerts:
      typeof rawPrefs.course_alerts === "boolean" ? rawPrefs.course_alerts : true,
    exam_reminders:
      typeof rawPrefs.exam_reminders === "boolean"
        ? rawPrefs.exam_reminders
        : true,
    grade_notifications:
      typeof rawPrefs.grade_notifications === "boolean"
        ? rawPrefs.grade_notifications
        : true,
    security_alerts:
      typeof rawPrefs.security_alerts === "boolean"
        ? rawPrefs.security_alerts
        : true,
  };

  const items: SharedNotificationItem[] = (recipientsRes.data ?? [])
    .map((nr) => {
      const rawNotif = nr.notifications;
      const n = Array.isArray(rawNotif) ? rawNotif[0] : rawNotif;
      if (!n) return null;
      return {
        recipientId: nr.id,
        notificationId: n.id,
        title: n.title,
        body: n.body,
        category: n.notification_type,
        actionUrl: n.action_url,
        isAnnouncement: Boolean(n.is_announcement),
        isRead: nr.is_read,
        createdAt: nr.created_at,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  return {
    ok: true,
    data: {
      userId,
      role: auth.data.role,
      unreadCount: items.filter((i) => !i.isRead).length,
      preferences,
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

  let courseIds: string[] = [];
  if (role === "admin") {
    const { data } = await supabase
      .from("courses")
      .select("id")
      .is("deleted_at", null);
    courseIds = (data ?? []).map((c) => c.id);
  } else if (role === "teacher") {
    const { data } = await supabase
      .from("courses")
      .select("id")
      .eq("teacher_id", userId)
      .is("deleted_at", null);
    courseIds = (data ?? []).map((c) => c.id);
  } else {
    const { data } = await supabase
      .from("course_enrollments")
      .select("course_id")
      .eq("student_id", userId);
    courseIds = (data ?? []).map((e) => e.course_id);
  }

  const [coursesRes, examsRes, assignmentsRes, studyRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("courses").select("id, title").in("id", courseIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; title: string }>,
        }),
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
    (coursesRes.data ?? []).map((c) => [c.id, c.title]),
  );

  const events: SmartCalendarEvent[] = [
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
// 3. INTERNAL MESSAGING DATA (WhatsApp-Style Student-Teacher Realtime Chat)
// -----------------------------------------------------------------------------
export interface MessagingAttachmentView {
  id: string;
  fileName: string;
  mimeType: string;
  storagePath: string;
  signedUrl: string | null;
}

export interface MessagingMessageView {
  id: string;
  senderId: string;
  senderName: string;
  body: string;
  messageType: "text" | "voice" | "file" | "system";
  voiceDurationSeconds: number | null;
  createdAt: string;
  isReadByPeer: boolean;
  attachments: MessagingAttachmentView[];
}

export interface MessagingConversationItem {
  id: string;
  isGroup: boolean;
  subject: string;
  courseId: string | null;
  courseTitle: string | null;
  lastMessageAt: string;
  lastMessagePreview: string;
  unreadCount: number;
  peerUserId: string | null;
  peerName: string;
  peerAvatarUrl: string | null;
  peerRole: string;
  peerLastReadAt: string | null;
  participantNames: string[];
  messages: MessagingMessageView[];
}

export interface MessagingAnnouncementItem {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  isRead: boolean;
  recipientRowId: string;
}

export interface MessagingContactsData {
  userId: string;
  userName: string;
  role: UserRole;
  conversations: MessagingConversationItem[];
  announcements: MessagingAnnouncementItem[];
  teacherCourses: Array<{ id: string; title: string }>;
  authorizedContacts: Array<{
    id: string;
    fullName: string;
    avatarUrl: string | null;
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

  // 1. Fetch caller's conversation memberships + read-only platform announcements in parallel
  const [myPartsRes, announcementsRes] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at")
      .eq("user_id", userId),
    supabase
      .from("notification_recipients")
      .select(
        "id, is_read, created_at, notifications!inner(id, title, body, is_announcement, created_at)",
      )
      .eq("recipient_id", userId)
      .eq("notifications.is_announcement", true)
      .order("created_at", { ascending: false })
      .limit(25),
  ]);

  const myLastReadMap = new Map(
    (myPartsRes.data ?? []).map((p) => [p.conversation_id, p.last_read_at]),
  );
  const convIds = (myPartsRes.data ?? []).map((p) => p.conversation_id);

  // 2. Fetch authorized contacts cleanly based on role
  const contactIds = new Set<string>();
  const contactCourseRef = new Map<
    string,
    { courseId: string | null; courseTitle: string | null }
  >();
  const courseTitleById = new Map<string, string>();
  const teacherCourses: Array<{ id: string; title: string }> = [];

  if (role === "student") {
    const { data: enrollments } = await supabase
      .from("course_enrollments")
      .select("course_id, courses(id, title, teacher_id, deleted_at)")
      .eq("student_id", userId);

    for (const enr of enrollments ?? []) {
      const rawCourse = enr.courses;
      const c = Array.isArray(rawCourse) ? rawCourse[0] : rawCourse;
      if (!c || c.deleted_at) continue;
      courseTitleById.set(c.id, c.title);
      if (c.teacher_id && c.teacher_id !== userId) {
        contactIds.add(c.teacher_id);
        if (!contactCourseRef.has(c.teacher_id)) {
          contactCourseRef.set(c.teacher_id, {
            courseId: c.id,
            courseTitle: c.title,
          });
        }
      }
    }
  } else if (role === "teacher") {
    const { data: myCourses } = await supabase
      .from("courses")
      .select("id, title")
      .eq("teacher_id", userId)
      .is("deleted_at", null)
      .order("title", { ascending: true });

    const myCourseIds = (myCourses ?? []).map((c) => {
      courseTitleById.set(c.id, c.title);
      teacherCourses.push({ id: c.id, title: c.title });
      return c.id;
    });

    if (myCourseIds.length > 0) {
      const { data: enrollments } = await supabase
        .from("course_enrollments")
        .select("student_id, course_id")
        .in("course_id", myCourseIds);

      for (const enr of enrollments ?? []) {
        if (enr.student_id !== userId) {
          contactIds.add(enr.student_id);
          if (!contactCourseRef.has(enr.student_id)) {
            contactCourseRef.set(enr.student_id, {
              courseId: enr.course_id,
              courseTitle: courseTitleById.get(enr.course_id) ?? null,
            });
          }
        }
      }
    }
  } else {
    const { data: allProfiles } = await supabase
      .from("profiles")
      .select("id")
      .eq("status", "active")
      .neq("id", userId)
      .limit(200);
    for (const p of allProfiles ?? []) {
      contactIds.add(p.id);
    }
  }

  // 3. Load conversations, participants, and recent messages
  const [convsRes, allPartsRes, msgsRes] = await Promise.all([
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
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(500)
      : Promise.resolve({ data: [] as Array<TableRow<"messages">> }),
  ]);

  for (const part of allPartsRes.data ?? []) {
    if (part.user_id !== userId) {
      contactIds.add(part.user_id);
    }
  }

  const missingCourseIds = Array.from(
    new Set(
      (convsRes.data ?? [])
        .map((c) => c.course_id)
        .filter((id): id is string => Boolean(id) && !courseTitleById.has(id!)),
    ),
  );

  const neededProfileIds = Array.from(new Set([userId, ...contactIds]));
  const messages = msgsRes.data ?? [];
  const msgIds = messages.map((m) => m.id);

  const [profilesRes, extraCoursesRes, attachmentsRes] = await Promise.all([
    neededProfileIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url, role")
          .in("id", neededProfileIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
            avatar_url: string | null;
            role: string;
          }>,
        }),
    missingCourseIds.length > 0
      ? supabase
          .from("courses")
          .select("id, title")
          .in("id", missingCourseIds)
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }> }),
    msgIds.length > 0
      ? supabase
          .from("message_attachments")
          .select("*")
          .in("message_id", msgIds)
      : Promise.resolve({ data: [] as Array<TableRow<"message_attachments">> }),
  ]);

  for (const c of extraCoursesRes.data ?? []) {
    courseTitleById.set(c.id, c.title);
  }

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  // Generate signed URLs in one batch for all message attachments
  const rawAttachments = attachmentsRes.data ?? [];
  const signedUrlMap = new Map<string, string>();
  if (rawAttachments.length > 0) {
    const paths = Array.from(
      new Set(rawAttachments.map((a) => a.storage_path).filter(Boolean)),
    );
    if (paths.length > 0) {
      const { data: signedList } = await supabase.storage
        .from("message-attachments")
        .createSignedUrls(paths, 60 * 60 * 6);
      for (const item of signedList ?? []) {
        if (item.path && item.signedUrl) {
          signedUrlMap.set(item.path, item.signedUrl);
        }
      }
    }
  }

  const authorizedContacts: MessagingContactsData["authorizedContacts"] = [];
  for (const cid of contactIds) {
    const prof = profileMap.get(cid);
    if (!prof || prof.id === userId) continue;
    // Students primarily message associated teachers; teachers message enrolled students
    if (role === "student" && prof.role !== "teacher" && prof.role !== "admin") {
      continue;
    }
    const courseRef = contactCourseRef.get(cid);
    authorizedContacts.push({
      id: prof.id,
      fullName: prof.full_name?.trim() || prof.email,
      avatarUrl: prof.avatar_url,
      email: prof.email,
      role: prof.role,
      courseId: courseRef?.courseId ?? null,
      courseTitle: courseRef?.courseTitle ?? null,
    });
  }
  authorizedContacts.sort((a, b) => a.fullName.localeCompare(b.fullName));

  const conversations: MessagingConversationItem[] = (convsRes.data ?? []).map(
    (conv) => {
      const parts = (allPartsRes.data ?? []).filter(
        (p) => p.conversation_id === conv.id,
      );
      const otherPart = parts.find((p) => p.user_id !== userId) ?? parts[0];
      const peerProf = otherPart ? profileMap.get(otherPart.user_id) : undefined;
      const peerLastReadAt = otherPart?.last_read_at ?? null;
      const myLastReadAt = myLastReadMap.get(conv.id) ?? null;

      const participantNames = parts.map((p) => {
        const prof = profileMap.get(p.user_id);
        return prof?.full_name?.trim() || prof?.email || "User";
      });

      const convMsgs = messages
        .filter((m) => m.conversation_id === conv.id)
        .map((m) => {
          const sender = profileMap.get(m.sender_id);
          const atts: MessagingAttachmentView[] = rawAttachments
            .filter((a) => a.message_id === m.id)
            .map((a) => ({
              id: a.id,
              fileName: a.file_name,
              mimeType: a.mime_type,
              storagePath: a.storage_path,
              signedUrl: signedUrlMap.get(a.storage_path) ?? null,
            }));

          const isReadByPeer = Boolean(
            peerLastReadAt &&
              new Date(peerLastReadAt).getTime() >=
                new Date(m.created_at).getTime(),
          );

          return {
            id: m.id,
            senderId: m.sender_id,
            senderName: sender?.full_name?.trim() || sender?.email || "User",
            body: m.body,
            messageType:
              (m.message_type as MessagingMessageView["messageType"]) || "text",
            voiceDurationSeconds: m.voice_duration_seconds ?? null,
            createdAt: m.created_at,
            isReadByPeer,
            attachments: atts,
          };
        });

      const unreadCount = convMsgs.filter(
        (m) =>
          m.senderId !== userId &&
          (!myLastReadAt ||
            new Date(m.createdAt).getTime() > new Date(myLastReadAt).getTime()),
      ).length;

      const lastMsg = convMsgs[convMsgs.length - 1];
      const isGroup = Boolean(conv.is_group);

      return {
        id: conv.id,
        isGroup,
        subject:
          conv.subject || (isGroup ? "Course Group Chat" : "Direct Conversation"),
        courseId: conv.course_id,
        courseTitle: conv.course_id
          ? courseTitleById.get(conv.course_id) ?? null
          : null,
        lastMessageAt: conv.last_message_at,
        lastMessagePreview:
          lastMsg?.messageType === "voice"
            ? "🎤 Voice message"
            : lastMsg?.body || conv.subject || "No messages yet",
        unreadCount,
        peerUserId: isGroup ? null : peerProf?.id ?? null,
        peerName: isGroup
          ? conv.subject || "Course Group Chat"
          : peerProf?.full_name?.trim() ||
            peerProf?.email ||
            conv.subject ||
            "Conversation",
        peerAvatarUrl: isGroup ? null : peerProf?.avatar_url ?? null,
        peerRole: isGroup ? `Group (${parts.length} members)` : peerProf?.role ?? "user",
        peerLastReadAt,
        participantNames,
        messages: convMsgs,
      };
    },
  );

  const announcements: MessagingAnnouncementItem[] = (
    announcementsRes.data ?? []
  )
    .map((nr) => {
      const rawNotif = nr.notifications;
      const n = Array.isArray(rawNotif) ? rawNotif[0] : rawNotif;
      if (!n) return null;
      return {
        id: n.id,
        title: n.title,
        body: n.body,
        createdAt: n.created_at,
        isRead: nr.is_read,
        recipientRowId: nr.id,
      };
    })
    .filter((a): a is NonNullable<typeof a> => a !== null);

  return {
    ok: true,
    data: {
      userId,
      userName: auth.data.fullName?.trim() || auth.data.email || "Me",
      role,
      conversations,
      announcements,
      teacherCourses,
      authorizedContacts,
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

// -----------------------------------------------------------------------------
// 5. PUBLIC TEACHER PROFILE DATA (Accessible to Visitors & Authenticated Users)
// -----------------------------------------------------------------------------
export interface PublicTeacherProfileView {
  teacherId: string;
  fullName: string;
  avatarUrl: string | null;
  headline: string;
  biography: string;
  experienceYears: number | null;
  education: string | null;
  certifications: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  averageTeacherRating: number;
  averageCourseRating: number;
  totalReviews: number;
  courses: Array<{
    id: string;
    title: string;
    category: string;
    subtitle: string | null;
    description: string | null;
    thumbnailUrl: string | null;
    estimatedHours: number;
    durationUnit: string;
    ratingAvg: number;
    reviewCount: number;
  }>;
  reviews: Array<{
    id: string;
    kind: "teacher" | "course";
    courseTitle: string;
    studentName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
}

export async function getPublicTeacherProfileData(
  teacherId: string,
): Promise<ServiceResult<PublicTeacherProfileView>> {
  const supabase = await createSupabaseServerClient();

  const [profileRes, publicProfRes, coursesRes, teacherRevsRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, bio, role, status")
        .eq("id", teacherId)
        .eq("role", "teacher")
        .maybeSingle(),
      supabase
        .from("teacher_public_profiles")
        .select("*")
        .eq("teacher_id", teacherId)
        .maybeSingle(),
      supabase
        .from("courses")
        .select(
          "id, title, category, subtitle, description, thumbnail_url, estimated_hours, duration_unit",
        )
        .eq("teacher_id", teacherId)
        .eq("status", "published")
        .is("deleted_at", null)
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_reviews")
        .select("id, course_id, student_id, rating, comment, created_at")
        .eq("teacher_id", teacherId)
        .eq("moderation_status", "approved")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const prof = profileRes.data;
  const pubProf = publicProfRes.data;

  if (!prof && !pubProf) {
    return { ok: false, error: "Instructor profile not found." };
  }

  if (pubProf && pubProf.is_public_visible === false) {
    return {
      ok: false,
      error: "This instructor profile is currently set to private.",
    };
  }

  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const courseRevsRes =
    courseIds.length > 0
      ? await supabase
          .from("course_reviews")
          .select("id, course_id, student_id, rating, comment, created_at")
          .in("course_id", courseIds)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
          .limit(60)
      : {
          data: [] as Array<{
            id: string;
            course_id: string;
            student_id: string;
            rating: number;
            comment: string | null;
            created_at: string;
          }>,
        };

  const courseRevs = courseRevsRes.data ?? [];
  const teacherRevs = teacherRevsRes.data ?? [];

  const reviewerIds = Array.from(
    new Set([
      ...courseRevs.map((r) => r.student_id),
      ...teacherRevs.map((r) => r.student_id),
    ]),
  );

  const reviewerProfilesRes =
    reviewerIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", reviewerIds)
      : { data: [] as Array<{ id: string; full_name: string | null }> };

  const reviewerMap = new Map(
    (reviewerProfilesRes.data ?? []).map((p) => [
      p.id,
      p.full_name?.trim() || "Verified Student",
    ]),
  );

  const averageTeacherRating =
    teacherRevs.length > 0
      ? Number(
          (
            teacherRevs.reduce((s, r) => s + Number(r.rating ?? 0), 0) /
            teacherRevs.length
          ).toFixed(2),
        )
      : 0;

  const averageCourseRating =
    courseRevs.length > 0
      ? Number(
          (
            courseRevs.reduce((s, r) => s + Number(r.rating ?? 0), 0) /
            courseRevs.length
          ).toFixed(2),
        )
      : 0;

  const mappedCourses = courses.map((c) => {
    const cRevs = courseRevs.filter((r) => r.course_id === c.id);
    const rAvg =
      cRevs.length > 0
        ? Number(
            (
              cRevs.reduce((s, r) => s + Number(r.rating ?? 0), 0) /
              cRevs.length
            ).toFixed(1),
          )
        : 0;
    return {
      id: c.id,
      title: c.title,
      category: c.category || "General",
      subtitle: c.subtitle,
      description: c.description,
      thumbnailUrl: c.thumbnail_url,
      estimatedHours: Number(c.estimated_hours ?? 0),
      durationUnit: c.duration_unit || "hours",
      ratingAvg: rAvg,
      reviewCount: cRevs.length,
    };
  });

  const combinedReviews = [
    ...teacherRevs.map((r) => ({
      id: `tr-${r.id}`,
      kind: "teacher" as const,
      courseTitle: r.course_id
        ? courseTitleMap.get(r.course_id) || "Published Course"
        : "Instructor Review",
      studentName: reviewerMap.get(r.student_id) ?? "Verified Student",
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
    ...courseRevs.map((r) => ({
      id: `cr-${r.id}`,
      kind: "course" as const,
      courseTitle: courseTitleMap.get(r.course_id) || "Published Course",
      studentName: reviewerMap.get(r.student_id) ?? "Verified Student",
      rating: r.rating,
      comment: r.comment,
      createdAt: r.created_at,
    })),
  ].sort(
    (a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const fullName =
    pubProf?.display_name?.trim() ||
    prof?.full_name?.trim() ||
    "Learnix Instructor";

  return {
    ok: true,
    data: {
      teacherId,
      fullName,
      avatarUrl: prof?.avatar_url ?? null,
      headline:
        pubProf?.headline?.trim() || "Academic Instructor at Learnix LMS",
      biography:
        pubProf?.biography?.trim() ||
        prof?.bio?.trim() ||
        `${fullName} teaches structured academic courses on Learnix.`,
      experienceYears: pubProf?.experience_years ?? null,
      education: pubProf?.education ?? null,
      certifications: pubProf?.certifications ?? null,
      websiteUrl: pubProf?.website_url ?? null,
      linkedinUrl: pubProf?.linkedin_url ?? null,
      averageTeacherRating,
      averageCourseRating,
      totalReviews: teacherRevs.length + courseRevs.length,
      courses: mappedCourses,
      reviews: combinedReviews,
    },
  };
}
