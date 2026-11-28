import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export interface TeacherOverviewData {
  teacherId: string;
  assignedCoursesCount: number;
  publishedCoursesCount: number;
  draftCoursesCount: number;
  enrolledStudentsCount: number;
  pendingSubmissionsCount: number;
  activeQuizzesCount: number;
  upcomingClassesCount: number;
  upcomingExamsCount: number;
  recentSubmissionsCount: number;
  averageStudentPerformance: number;
  unreadNotificationsCount: number;
  courses: Array<
    TableRow<"courses"> & {
      enrolledCount: number;
      averageExamScore: number;
    }
  >;
  upcomingSchedules: Array<
    TableRow<"class_schedules"> & {
      courseTitle: string;
    }
  >;
  upcomingExams: Array<TableRow<"exams">>;
  recentSubmissions: Array<{
    id: string;
    kind: "exam" | "assignment";
    title: string;
    studentName: string;
    submittedAt: string;
    status: string;
    scoreLabel: string;
  }>;
  recentMessages: Array<{
    id: string;
    conversationId: string;
    senderName: string;
    body: string;
    createdAt: string;
  }>;
  notifications: Array<{
    recipientId: string;
    notificationId: string;
    title: string;
    body: string;
    category: string;
    isRead: boolean;
    createdAt: string;
  }>;
}

export async function getTeacherOverviewData(): Promise<ServiceResult<TeacherOverviewData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const [coursesRes, schedulesRes, notifRecipientsRes, myParticipationsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("class_schedules")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase
      .from("notification_recipients")
      .select("*")
      .eq("recipient_id", teacherId)
      .order("created_at", { ascending: false })
      .limit(15),
    supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", teacherId),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (schedulesRes.error) return { ok: false, error: schedulesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));
  const schedules = schedulesRes.data ?? [];
  const notifRecipients = notifRecipientsRes.data ?? [];
  const notifIds = notifRecipients.map((n) => n.notification_id);
  const convIds = (myParticipationsRes.data ?? []).map((p) => p.conversation_id);

  const [
    enrollmentsRes,
    examsRes,
    resultsRes,
    assignmentsRes,
    notificationsRes,
    recentMsgsRes,
  ] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("course_enrollments").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"course_enrollments">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("exams")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exams">>, error: null }),
    courseIds.length > 0
      ? supabase.from("results").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"results">>, error: null }),
    courseIds.length > 0
      ? supabase.from("assignments").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"assignments">>, error: null }),
    notifIds.length > 0
      ? supabase.from("notifications").select("*").in("id", notifIds)
      : Promise.resolve({ data: [] as Array<TableRow<"notifications">>, error: null }),
    convIds.length > 0
      ? supabase
          .from("messages")
          .select("id, conversation_id, sender_id, body, created_at")
          .in("conversation_id", convIds)
          .neq("sender_id", teacherId)
          .order("created_at", { ascending: false })
          .limit(6)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            conversation_id: string;
            sender_id: string;
            body: string;
            created_at: string;
          }>,
          error: null,
        }),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (examsRes.error) return { ok: false, error: examsRes.error.message };
  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };

  const enrollments = enrollmentsRes.data ?? [];
  const exams = examsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const recentRawMessages = recentMsgsRes.data ?? [];

  const examIds = exams.map((e) => e.id);
  const examTitleMap = new Map(exams.map((e) => [e.id, e.title]));
  const resultByAttemptMap = new Map(results.map((r) => [r.attempt_id, r]));

  const assignmentIds = assignments.map((a) => a.id);
  const assignmentTitleMap = new Map(assignments.map((a) => [a.id, a.title]));
  const assignmentMaxPointsMap = new Map(assignments.map((a) => [a.id, Number(a.max_points ?? 100)]));

  const [attemptsRes, assignmentSubmissionsRes] = await Promise.all([
    examIds.length > 0
      ? supabase
          .from("exam_attempts")
          .select("*")
          .in("exam_id", examIds)
          .order("started_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] as Array<TableRow<"exam_attempts">>, error: null }),
    assignmentIds.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .neq("status", "draft")
          .order("submitted_at", { ascending: false })
          .limit(60)
      : Promise.resolve({ data: [] as Array<TableRow<"assignment_submissions">>, error: null }),
  ]);

  const teacherAttempts = attemptsRes.data ?? [];
  const assignmentSubmissions = assignmentSubmissionsRes.data ?? [];

  const profileIdsToFetch = Array.from(
    new Set([
      ...teacherAttempts.slice(0, 15).map((a) => a.student_id),
      ...assignmentSubmissions.slice(0, 15).map((s) => s.student_id),
      ...recentRawMessages.map((m) => m.sender_id),
    ]),
  );

  const profilesRes =
    profileIdsToFetch.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", profileIdsToFetch)
      : {
          data: [] as Array<{ id: string; full_name: string | null; email: string }>,
          error: null,
        };

  const profileNameMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const notificationMap = new Map((notificationsRes.data ?? []).map((n) => [n.id, n]));

  const uniqueStudents = new Set(enrollments.map((e) => e.student_id));

  // Combine quiz score % and graded assignment % for overall average grades
  const gradedAssignments = assignmentSubmissions.filter((s) => s.grade_points !== null);
  const allGradePercents: number[] = [
    ...results.map((r) => Number(r.score_percent ?? 0)),
    ...gradedAssignments.map((s) => {
      const maxPts = Math.max(1, assignmentMaxPointsMap.get(s.assignment_id) ?? 100);
      return (Number(s.grade_points ?? 0) / maxPts) * 100;
    }),
  ];

  const averageStudentPerformance =
    allGradePercents.length > 0
      ? Number(
          (
            allGradePercents.reduce((sum, v) => sum + v, 0) / allGradePercents.length
          ).toFixed(1),
        )
      : 0;

  const pendingAssignmentsCount = assignmentSubmissions.filter(
    (s) => s.status !== "graded" || !s.is_grade_published,
  ).length;
  const pendingQuizAttemptsCount = teacherAttempts.filter(
    (a) => a.status === "submitted" && !resultByAttemptMap.get(a.id)?.is_published,
  ).length;
  const pendingSubmissionsCount = pendingAssignmentsCount + pendingQuizAttemptsCount;

  const coursesWithMetrics = courses.map((course) => {
    const courseEnrollments = enrollments.filter((e) => e.course_id === course.id);
    const courseResults = results.filter((r) => r.course_id === course.id);
    const avgScore =
      courseResults.length > 0
        ? Number(
            (
              courseResults.reduce((s, r) => s + Number(r.score_percent ?? 0), 0) /
              courseResults.length
            ).toFixed(1),
          )
        : 0;
    return {
      ...course,
      enrolledCount: courseEnrollments.length,
      averageExamScore: avgScore,
    };
  });

  const combinedSubmissions: TeacherOverviewData["recentSubmissions"] = [
    ...teacherAttempts.slice(0, 10).map((att) => {
      const resRow = resultByAttemptMap.get(att.id);
      return {
        id: att.id,
        kind: "exam" as const,
        title: examTitleMap.get(att.exam_id) ?? "Quiz",
        studentName: profileNameMap.get(att.student_id) ?? att.student_id.slice(0, 8),
        submittedAt: att.submitted_at ?? att.started_at,
        status: att.status,
        scoreLabel: resRow ? `${Number(resRow.score_percent ?? 0).toFixed(1)}%` : att.status,
      };
    }),
    ...assignmentSubmissions.slice(0, 10).map((sub) => ({
      id: sub.id,
      kind: "assignment" as const,
      title: assignmentTitleMap.get(sub.assignment_id) ?? "Assignment",
      studentName: profileNameMap.get(sub.student_id) ?? sub.student_id.slice(0, 8),
      submittedAt: sub.submitted_at,
      status: sub.status,
      scoreLabel: sub.grade_points !== null ? `${Number(sub.grade_points)} pts` : "Pending",
    })),
  ]
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    .slice(0, 12);

  const notificationsList: TeacherOverviewData["notifications"] = notifRecipients
    .map((nr) => {
      const notif = notificationMap.get(nr.notification_id);
      if (!notif) return null;
      return {
        recipientId: nr.id,
        notificationId: notif.id,
        title: notif.title,
        body: notif.body,
        category: notif.notification_type,
        isRead: nr.is_read,
        createdAt: nr.created_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const recentMessages: TeacherOverviewData["recentMessages"] = recentRawMessages.map((m) => ({
    id: m.id,
    conversationId: m.conversation_id,
    senderName: profileNameMap.get(m.sender_id) ?? "Student",
    body: m.body,
    createdAt: m.created_at,
  }));

  const activeQuizzesCount = exams.filter((e) => e.status === "published").length;

  return {
    ok: true,
    data: {
      teacherId,
      assignedCoursesCount: courses.length,
      publishedCoursesCount: courses.filter((c) => c.status === "published").length,
      draftCoursesCount: courses.filter((c) => c.status === "draft").length,
      enrolledStudentsCount: uniqueStudents.size,
      pendingSubmissionsCount,
      activeQuizzesCount,
      upcomingClassesCount: schedules.length,
      upcomingExamsCount: activeQuizzesCount,
      recentSubmissionsCount: teacherAttempts.length + assignmentSubmissions.length,
      averageStudentPerformance,
      unreadNotificationsCount: notificationsList.filter((n) => !n.isRead).length,
      courses: coursesWithMetrics,
      upcomingSchedules: schedules.map((s) => ({
        ...s,
        courseTitle: courseTitleMap.get(s.course_id) ?? s.notes ?? "Class Session",
      })),
      upcomingExams: exams.slice(0, 10),
      recentSubmissions: combinedSubmissions,
      recentMessages,
      notifications: notificationsList,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. COURSE & LESSON MANAGEMENT DATA
// -----------------------------------------------------------------------------
export interface TeacherCoursesData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  categories: Array<TableRow<"categories">>;
  chapters: Array<TableRow<"chapters">>;
  lessons: Array<TableRow<"lessons">>;
  learningResources: Array<TableRow<"learning_resources">>;
  enrollments: Array<
    TableRow<"course_enrollments"> & {
      studentName: string;
      studentEmail: string;
    }
  >;
  departments: Array<TableRow<"departments">>;
  educationalLevels: Array<TableRow<"educational_levels">>;
}

export async function getTeacherCoursesData(): Promise<ServiceResult<TeacherCoursesData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const [coursesRes, categoriesRes, departmentsRes, levelsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("categories")
      .select("*")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase.from("departments").select("*").order("name", { ascending: true }),
    supabase.from("educational_levels").select("*").order("rank_order", { ascending: true }),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (departmentsRes.error) return { ok: false, error: departmentsRes.error.message };
  if (levelsRes.error) return { ok: false, error: levelsRes.error.message };

  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);

  const [chaptersRes, lessonsRes, resourcesRes, enrollmentsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("chapters")
          .select("*")
          .in("course_id", courseIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"chapters">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("lessons")
          .select("*")
          .in("course_id", courseIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"lessons">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("learning_resources")
          .select("*")
          .in("course_id", courseIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"learning_resources">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("course_enrollments")
          .select("*")
          .in("course_id", courseIds)
          .order("enrolled_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"course_enrollments">>, error: null }),
  ]);

  if (chaptersRes.error) return { ok: false, error: chaptersRes.error.message };
  if (lessonsRes.error) return { ok: false, error: lessonsRes.error.message };
  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };

  const enrolledStudentIds = Array.from(
    new Set((enrollmentsRes.data ?? []).map((e) => e.student_id)),
  );
  const profilesRes =
    enrolledStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", enrolledStudentIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const enrichedEnrollments = (enrollmentsRes.data ?? []).map((enr) => {
    const profile = profileMap.get(enr.student_id);
    return {
      ...enr,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
    };
  });

  return {
    ok: true,
    data: {
      teacherId,
      courses,
      categories: categoriesRes.data ?? [],
      chapters: chaptersRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      learningResources: resourcesRes.data ?? [],
      enrollments: enrichedEnrollments,
      departments: departmentsRes.data ?? [],
      educationalLevels: levelsRes.data ?? [],
    },
  };
}

// -----------------------------------------------------------------------------
// 3. SMART EXAM & AI QUIZ BUILDER DATA
// -----------------------------------------------------------------------------
export interface TeacherExamRosterEntry {
  studentId: string;
  fullName: string;
  email: string;
  courseId: string;
  attemptsCount: number;
  latestStatus: string | null;
  bestScorePercent: number | null;
  submittedAt: string | null;
}

export interface TeacherExamBuilderData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  chapters: Array<TableRow<"chapters">>;
  classes: Array<TableRow<"classes">>;
  assignedStudents: Array<{ id: string; fullName: string; email: string }>;
  exams: Array<TableRow<"exams">>;
  questions: Array<TableRow<"questions">>;
  questionOptions: Array<TableRow<"question_options">>;
  enrollments: Array<{ courseId: string; studentId: string; fullName: string; email: string }>;
  examAttemptsSummary: Array<{
    examId: string;
    studentId: string;
    status: string;
    submittedAt: string | null;
    scorePercent: number | null;
  }>;
  learningResources: Array<TableRow<"learning_resources">>;
  lessons: Array<TableRow<"lessons">>;
  assignmentMaterials: Array<TableRow<"assignment_materials">>;
}

export async function getTeacherExamBuilderData(): Promise<ServiceResult<TeacherExamBuilderData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const [coursesRes, classesRes, assignmentsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase.from("classes").select("*").order("name", { ascending: true }),
    supabase
      .from("student_teacher_assignments")
      .select("*")
      .eq("teacher_id", teacherId),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);

  const [chaptersRes, enrollmentsRes, examsRes, resourcesRes, lessonsRes, assignmentMatsRes] =
    await Promise.all([
      courseIds.length > 0
        ? supabase
            .from("chapters")
            .select("*")
            .in("course_id", courseIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as Array<TableRow<"chapters">>, error: null }),
      courseIds.length > 0
        ? supabase.from("course_enrollments").select("*").in("course_id", courseIds)
        : Promise.resolve({ data: [] as Array<TableRow<"course_enrollments">>, error: null }),
      courseIds.length > 0
        ? supabase
            .from("exams")
            .select("*")
            .in("course_id", courseIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<TableRow<"exams">>, error: null }),
      courseIds.length > 0
        ? supabase
            .from("learning_resources")
            .select("*")
            .in("course_id", courseIds)
            .eq("is_published", true)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as Array<TableRow<"learning_resources">>, error: null }),
      courseIds.length > 0
        ? supabase
            .from("lessons")
            .select("*")
            .in("course_id", courseIds)
            .order("position", { ascending: true })
        : Promise.resolve({ data: [] as Array<TableRow<"lessons">>, error: null }),
      courseIds.length > 0
        ? supabase
            .from("assignment_materials")
            .select("*")
            .in("course_id", courseIds)
            .order("created_at", { ascending: false })
        : Promise.resolve({ data: [] as Array<TableRow<"assignment_materials">>, error: null }),
    ]);

  if (examsRes.error) return { ok: false, error: examsRes.error.message };
  if (resourcesRes.error) return { ok: false, error: resourcesRes.error.message };
  const exams = examsRes.data ?? [];
  const examIds = exams.map((e) => e.id);

  const [questionsRes, attemptsRes, resultsRes] = await Promise.all([
    examIds.length > 0
      ? supabase
          .from("questions")
          .select("*")
          .in("exam_id", examIds)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"questions">>, error: null }),
    examIds.length > 0
      ? supabase
          .from("exam_attempts")
          .select("id, exam_id, student_id, status, submitted_at, started_at")
          .in("exam_id", examIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            exam_id: string;
            student_id: string;
            status: string;
            submitted_at: string | null;
            started_at: string;
          }>,
          error: null,
        }),
    examIds.length > 0
      ? supabase
          .from("results")
          .select("attempt_id, score_percent")
          .in("exam_id", examIds)
      : Promise.resolve({
          data: [] as Array<{ attempt_id: string; score_percent: number }>,
          error: null,
        }),
  ]);

  if (questionsRes.error) return { ok: false, error: questionsRes.error.message };
  const questions = questionsRes.data ?? [];
  const questionIds = questions.map((q) => q.id);

  const optionsRes =
    questionIds.length > 0
      ? await supabase
          .from("question_options")
          .select("*")
          .in("question_id", questionIds)
          .order("position", { ascending: true })
      : { data: [] as Array<TableRow<"question_options">>, error: null };

  if (optionsRes.error) return { ok: false, error: optionsRes.error.message };

  const assignedStudentIds = Array.from(
    new Set<string>([
      ...(enrollmentsRes.data ?? []).map((e) => e.student_id),
      ...(assignmentsRes.data ?? []).map((a) => a.student_id),
      ...(attemptsRes.data ?? []).map((att) => att.student_id),
    ]),
  );

  const profilesRes =
    assignedStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedStudentIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [
      p.id,
      { fullName: p.full_name || p.email, email: p.email },
    ]),
  );

  const assignedStudents = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email,
    email: p.email,
  }));

  const enrollments = (enrollmentsRes.data ?? []).map((e) => {
    const prof = profileMap.get(e.student_id);
    return {
      courseId: e.course_id,
      studentId: e.student_id,
      fullName: prof?.fullName ?? "Student",
      email: prof?.email ?? "",
    };
  });

  const scoreByAttempt = new Map(
    (resultsRes.data ?? []).map((r) => [r.attempt_id, Number(r.score_percent ?? 0)]),
  );

  const examAttemptsSummary = (attemptsRes.data ?? []).map((att) => ({
    examId: att.exam_id,
    studentId: att.student_id,
    status: att.status,
    submittedAt: att.submitted_at ?? att.started_at,
    scorePercent: scoreByAttempt.has(att.id) ? scoreByAttempt.get(att.id)! : null,
  }));

  return {
    ok: true,
    data: {
      teacherId,
      courses,
      chapters: chaptersRes.data ?? [],
      classes: classesRes.data ?? [],
      assignedStudents,
      exams,
      questions,
      questionOptions: optionsRes.data ?? [],
      enrollments,
      examAttemptsSummary,
      learningResources: resourcesRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      assignmentMaterials: assignmentMatsRes.data ?? [],
    },
  };
}

// -----------------------------------------------------------------------------
// 4. STUDENT MANAGEMENT & ATTENDANCE DATA
// -----------------------------------------------------------------------------
export interface StudentCourseMetric {
  courseId: string;
  courseTitle: string;
  progressPercent: number;
  status: string;
  assignmentAveragePercent: number;
  quizAveragePercent: number;
  overallPerformancePercent: number;
  lastActivityAt: string | null;
}

export interface AssignedStudentRow {
  studentId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  enrolledCourses: Array<StudentCourseMetric>;
  averageProgressPercent: number;
  assignmentAveragePercent: number;
  examAveragePercent: number;
  overallPerformancePercent: number;
  examsTakenCount: number;
  assignmentsSubmittedCount: number;
  attendanceRatePercent: number;
  totalStudyMinutes: number;
  lastActivityAt: string | null;
  isFallingBehind: boolean;
  recentActivity: Array<{
    id: string;
    title: string;
    timestamp: string;
    detail: string;
  }>;
}

export interface TeacherStudentsData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  students: Array<AssignedStudentRow>;
  attendanceSessions: Array<TableRow<"attendance">>;
  attendanceRecords: Array<TableRow<"attendance_records">>;
}

export async function getTeacherStudentsData(): Promise<ServiceResult<TeacherStudentsData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const [coursesRes, directAssignmentsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase
      .from("student_teacher_assignments")
      .select("*")
      .eq("teacher_id", teacherId),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const [
    enrollmentsRes,
    resultsRes,
    assignmentsRes,
    attendanceSessionsRes,
    studySessionsRes,
    lessonProgressRes,
  ] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("course_enrollments").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"course_enrollments">>, error: null }),
    courseIds.length > 0
      ? supabase.from("results").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"results">>, error: null }),
    courseIds.length > 0
      ? supabase.from("assignments").select("id, course_id, max_points").in("course_id", courseIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; course_id: string; max_points: number }>,
          error: null,
        }),
    courseIds.length > 0
      ? supabase
          .from("attendance")
          .select("*")
          .in("course_id", courseIds)
          .order("session_date", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"attendance">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("study_sessions")
          .select("*")
          .in("course_id", courseIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"study_sessions">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("lesson_progress")
          .select("*")
          .in("course_id", courseIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"lesson_progress">>, error: null }),
  ]);

  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((a) => a.id);
  const assignmentMetaMap = new Map(
    assignments.map((a) => [a.id, { courseId: a.course_id, maxPoints: Number(a.max_points ?? 100) }]),
  );

  const attendanceSessions = attendanceSessionsRes.data ?? [];
  const attendanceSessionIds = attendanceSessions.map((a) => a.id);

  const [attendanceRecordsRes, assignmentSubsRes] = await Promise.all([
    attendanceSessionIds.length > 0
      ? supabase
          .from("attendance_records")
          .select("*")
          .in("attendance_id", attendanceSessionIds)
      : Promise.resolve({ data: [] as Array<TableRow<"attendance_records">>, error: null }),
    assignmentIds.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("id, assignment_id, student_id, grade_points, status, submitted_at")
          .in("assignment_id", assignmentIds)
          .neq("status", "draft")
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            assignment_id: string;
            student_id: string;
            grade_points: number | null;
            status: string;
            submitted_at: string;
          }>,
          error: null,
        }),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const attendanceRecords = attendanceRecordsRes.data ?? [];
  const assignmentSubs = assignmentSubsRes.data ?? [];
  const studySessions = studySessionsRes.data ?? [];
  const lessonProgress = lessonProgressRes.data ?? [];

  const assignedStudentIds = Array.from(
    new Set<string>([
      ...enrollments.map((e) => e.student_id),
      ...(directAssignmentsRes.data ?? []).map((a) => a.student_id),
    ]),
  );

  const profilesRes =
    assignedStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("*")
          .in("id", assignedStudentIds)
      : { data: [] as Array<TableRow<"profiles">> };

  const studentProfiles = profilesRes.data ?? [];

  const students: Array<AssignedStudentRow> = studentProfiles.map((profile) => {
    const stuEnrollments = enrollments.filter((e) => e.student_id === profile.id);
    const stuResults = results.filter((r) => r.student_id === profile.id);
    const stuAssignmentSubs = assignmentSubs.filter((s) => s.student_id === profile.id);
    const stuGradedSubs = stuAssignmentSubs.filter((s) => s.grade_points !== null);
    const stuAttendance = attendanceRecords.filter((a) => a.student_id === profile.id);
    const stuStudy = studySessions.filter((s) => s.student_id === profile.id);
    const stuLessons = lessonProgress.filter((lp) => lp.student_id === profile.id);

    const avgProgress =
      stuEnrollments.length > 0
        ? Number(
            (
              stuEnrollments.reduce((sum, e) => sum + Number(e.progress_percent ?? 0), 0) /
              stuEnrollments.length
            ).toFixed(1),
          )
        : 0;

    const avgExam =
      stuResults.length > 0
        ? Number(
            (
              stuResults.reduce((sum, r) => sum + Number(r.score_percent ?? 0), 0) /
              stuResults.length
            ).toFixed(1),
          )
        : 0;

    const avgAssignment =
      stuGradedSubs.length > 0
        ? Number(
            (
              stuGradedSubs.reduce((sum, s) => {
                const maxPts = Math.max(1, assignmentMetaMap.get(s.assignment_id)?.maxPoints ?? 100);
                return sum + (Number(s.grade_points ?? 0) / maxPts) * 100;
              }, 0) / stuGradedSubs.length
            ).toFixed(1),
          )
        : 0;

    const gradeBuckets: number[] = [];
    if (stuResults.length > 0) gradeBuckets.push(avgExam);
    if (stuGradedSubs.length > 0) gradeBuckets.push(avgAssignment);
    const overallPerformancePercent =
      gradeBuckets.length > 0
        ? Number(
            (
              gradeBuckets.reduce((a, b) => a + b, 0) / gradeBuckets.length
            ).toFixed(1),
          )
        : avgProgress;

    const attendedCount = stuAttendance.filter(
      (a) => a.status === "present" || a.status === "late" || a.status === "excused",
    ).length;

    const attendanceRate =
      stuAttendance.length > 0
        ? Number(((attendedCount / stuAttendance.length) * 100).toFixed(1))
        : 100;

    const totalStudyMinutes = Math.round(
      stuStudy.reduce((sum, s) => sum + Number(s.duration_seconds ?? 0), 0) / 60,
    );

    const allTimestamps = [
      ...stuLessons.map((l) => l.updated_at),
      ...stuStudy.map((s) => s.started_at),
      ...stuAssignmentSubs.map((s) => s.submitted_at),
      ...stuResults.map((r) => r.graded_at),
      ...stuEnrollments.map((e) => e.last_accessed_at ?? e.enrolled_at),
    ].filter((ts): ts is string => Boolean(ts));
    allTimestamps.sort((a, b) => b.localeCompare(a));
    const lastActivityAt = allTimestamps[0] ?? null;

    const isFallingBehind =
      (stuEnrollments.length > 0 && avgProgress < 35) ||
      (stuResults.length > 0 && avgExam < 60) ||
      (stuGradedSubs.length > 0 && avgAssignment < 60);

    const recentActivity: AssignedStudentRow["recentActivity"] = [
      ...stuLessons.slice(0, 5).map((lp) => ({
        id: `lp-${lp.id}`,
        title: `Lesson progress (${lp.is_completed ? "completed" : "in progress"})`,
        timestamp: lp.updated_at,
        detail: `${courseTitleMap.get(lp.course_id) ?? "Course"} — ${Math.round(lp.watched_seconds / 60)} min`,
      })),
      ...stuAssignmentSubs.slice(0, 4).map((sub) => ({
        id: `as-${sub.id}`,
        title: `Assignment submitted (${sub.status})`,
        timestamp: sub.submitted_at,
        detail:
          sub.grade_points !== null
            ? `Graded: ${Number(sub.grade_points)} pts`
            : "Awaiting review",
      })),
      ...stuStudy.slice(0, 4).map((ss) => ({
        id: `ss-${ss.id}`,
        title: "Focused Study Session",
        timestamp: ss.started_at,
        detail: `${Math.round((ss.duration_seconds ?? 0) / 60)} min active`,
      })),
    ]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);

    const enrolledCoursesMetrics: Array<StudentCourseMetric> = stuEnrollments.map((e) => {
      const cResults = stuResults.filter((r) => r.course_id === e.course_id);
      const cGradedSubs = stuGradedSubs.filter(
        (s) => assignmentMetaMap.get(s.assignment_id)?.courseId === e.course_id,
      );
      const cAllSubs = stuAssignmentSubs.filter(
        (s) => assignmentMetaMap.get(s.assignment_id)?.courseId === e.course_id,
      );
      const cLessons = stuLessons.filter((l) => l.course_id === e.course_id);

      const cQuizAvg =
        cResults.length > 0
          ? Number(
              (
                cResults.reduce((sum, r) => sum + Number(r.score_percent ?? 0), 0) /
                cResults.length
              ).toFixed(1),
            )
          : 0;
      const cAssignAvg =
        cGradedSubs.length > 0
          ? Number(
              (
                cGradedSubs.reduce((sum, s) => {
                  const maxPts = Math.max(
                    1,
                    assignmentMetaMap.get(s.assignment_id)?.maxPoints ?? 100,
                  );
                  return sum + (Number(s.grade_points ?? 0) / maxPts) * 100;
                }, 0) / cGradedSubs.length
              ).toFixed(1),
            )
          : 0;
      const cBuckets: number[] = [];
      if (cResults.length > 0) cBuckets.push(cQuizAvg);
      if (cGradedSubs.length > 0) cBuckets.push(cAssignAvg);
      const cOverall =
        cBuckets.length > 0
          ? Number((cBuckets.reduce((a, b) => a + b, 0) / cBuckets.length).toFixed(1))
          : Number(e.progress_percent ?? 0);

      const cTimestamps = [
        ...cLessons.map((l) => l.updated_at),
        ...cAllSubs.map((s) => s.submitted_at),
        ...cResults.map((r) => r.graded_at),
        e.last_accessed_at ?? e.enrolled_at,
      ].filter((ts): ts is string => Boolean(ts));
      cTimestamps.sort((a, b) => b.localeCompare(a));

      return {
        courseId: e.course_id,
        courseTitle: courseTitleMap.get(e.course_id) ?? "Course",
        progressPercent: Number(e.progress_percent ?? 0),
        status: e.status,
        assignmentAveragePercent: cAssignAvg,
        quizAveragePercent: cQuizAvg,
        overallPerformancePercent: cOverall,
        lastActivityAt: cTimestamps[0] ?? null,
      };
    });

    return {
      studentId: profile.id,
      fullName: profile.full_name || profile.email,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      enrolledCourses: enrolledCoursesMetrics,
      averageProgressPercent: avgProgress,
      assignmentAveragePercent: avgAssignment,
      examAveragePercent: avgExam,
      overallPerformancePercent,
      examsTakenCount: stuResults.length,
      assignmentsSubmittedCount: stuAssignmentSubs.length,
      attendanceRatePercent: attendanceRate,
      totalStudyMinutes,
      lastActivityAt,
      isFallingBehind,
      recentActivity,
    };
  });

  return {
    ok: true,
    data: {
      teacherId,
      courses,
      students,
      attendanceSessions,
      attendanceRecords,
    },
  };
}

// -----------------------------------------------------------------------------
// 5. GRADING, ASSIGNMENTS, AI GRADING & RESULTS DATA
// -----------------------------------------------------------------------------
export interface TeacherGradingData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  exams: Array<TableRow<"exams">>;
  questions: Array<TableRow<"questions">>;
  courseEnrollments: Array<{
    courseId: string;
    studentId: string;
    studentName: string;
    studentEmail: string;
  }>;
  attempts: Array<
    TableRow<"exam_attempts"> & {
      studentName: string;
      studentEmail: string;
      examTitle: string;
      courseTitle: string;
      scorePercent: number;
      passed: boolean;
    }
  >;
  results: Array<TableRow<"results">>;
  studentAnswers: Array<
    TableRow<"student_answers"> & {
      studentName: string;
      examId: string;
      examTitle: string;
      questionPrompt: string;
      questionType: string;
      maxPoints: number;
    }
  >;
  violations: Array<
    TableRow<"exam_violations"> & {
      studentName: string;
      examTitle: string;
      courseId: string;
      isAttemptPaused: boolean;
      attemptResumeStatus: string;
    }
  >;
  assignments: Array<TableRow<"assignments">>;
  assignmentMaterials: Array<TableRow<"assignment_materials">>;
  assignmentSubmissions: Array<
    TableRow<"assignment_submissions"> & {
      studentName: string;
      studentEmail: string;
      assignmentTitle: string;
      courseId: string;
      courseTitle: string;
      maxPoints: number;
      dueAt: string | null;
      aiSuggestedGrade: number | null;
      aiExplanation: string | null;
      aiSuggestedFeedback: string | null;
      gradePublished: boolean;
      versionCount: number;
    }
  >;
}

export async function getTeacherGradingData(): Promise<ServiceResult<TeacherGradingData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const coursesRes = await supabase
    .from("courses")
    .select("*")
    .eq("teacher_id", teacherId)
    .is("deleted_at", null)
    .order("title", { ascending: true });

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const [examsRes, resultsRes, assignmentsRes, enrollmentsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase
          .from("exams")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exams">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("results")
          .select("*")
          .in("course_id", courseIds)
          .order("graded_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"results">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"assignments">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("course_enrollments")
          .select("course_id, student_id")
          .in("course_id", courseIds)
      : Promise.resolve({
          data: [] as Array<{ course_id: string; student_id: string }>,
          error: null,
        }),
  ]);

  const exams = examsRes.data ?? [];
  const examIds = exams.map((e) => e.id);
  const examMap = new Map(exams.map((e) => [e.id, e]));
  const results = resultsRes.data ?? [];
  const resultByAttemptMap = new Map(results.map((r) => [r.attempt_id, r]));

  const [questionsRes, attemptsRes] = await Promise.all([
    examIds.length > 0
      ? supabase.from("questions").select("*").in("exam_id", examIds)
      : Promise.resolve({ data: [] as Array<TableRow<"questions">>, error: null }),
    examIds.length > 0
      ? supabase
          .from("exam_attempts")
          .select("*")
          .in("exam_id", examIds)
          .order("started_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exam_attempts">>, error: null }),
  ]);

  const questions = questionsRes.data ?? [];
  const questionMap = new Map(questions.map((q) => [q.id, q]));
  const attempts = attemptsRes.data ?? [];
  const attemptIds = attempts.map((a) => a.id);
  const attemptMap = new Map(attempts.map((a) => [a.id, a]));

  const [answersRes, violationsRes] = await Promise.all([
    attemptIds.length > 0
      ? supabase
          .from("student_answers")
          .select("*")
          .in("attempt_id", attemptIds)
          .order("updated_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"student_answers">>, error: null }),
    attemptIds.length > 0
      ? supabase
          .from("exam_violations")
          .select("*")
          .in("attempt_id", attemptIds)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exam_violations">>, error: null }),
  ]);

  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((a) => a.id);
  const assignmentMap = new Map(assignments.map((a) => [a.id, a]));

  const [assignmentSubsRes, assignmentMaterialsRes] = await Promise.all([
    assignmentIds.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .neq("status", "draft")
          .order("submitted_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<TableRow<"assignment_submissions">>,
          error: null,
        }),
    assignmentIds.length > 0
      ? supabase
          .from("assignment_materials")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({
          data: [] as Array<TableRow<"assignment_materials">>,
          error: null,
        }),
  ]);

  const submissionIds = (assignmentSubsRes.data ?? []).map((s) => s.id);
  const [assignmentGradesRes, submissionVersionsRes] = await Promise.all([
    submissionIds.length > 0
      ? supabase
          .from("assignment_grades")
          .select("*")
          .in("submission_id", submissionIds)
      : Promise.resolve({
          data: [] as Array<TableRow<"assignment_grades">>,
          error: null,
        }),
    submissionIds.length > 0
      ? supabase
          .from("assignment_submission_versions")
          .select("submission_id")
          .in("submission_id", submissionIds)
      : Promise.resolve({
          data: [] as Array<{ submission_id: string }>,
          error: null,
        }),
  ]);

  const versionCountBySubMap = new Map<string, number>();
  for (const v of submissionVersionsRes.data ?? []) {
    versionCountBySubMap.set(
      v.submission_id,
      (versionCountBySubMap.get(v.submission_id) ?? 0) + 1,
    );
  }

  const aiGradeBySubmissionMap = new Map(
    (assignmentGradesRes.data ?? []).map((g) => [g.submission_id, g]),
  );

  const studentIdsToResolve = Array.from(
    new Set([
      ...attempts.map((a) => a.student_id),
      ...(assignmentSubsRes.data ?? []).map((s) => s.student_id),
      ...(violationsRes.data ?? []).map((v) => v.student_id),
      ...(enrollmentsRes.data ?? []).map((e) => e.student_id),
    ]),
  );

  const profilesRes =
    studentIdsToResolve.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", studentIdsToResolve)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };
  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const courseEnrollments = (enrollmentsRes.data ?? []).map((e) => {
    const profile = profileMap.get(e.student_id);
    return {
      courseId: e.course_id,
      studentId: e.student_id,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
    };
  });

  const enrichedAttempts = attempts.map((att) => {
    const profile = profileMap.get(att.student_id);
    const exam = examMap.get(att.exam_id);
    const resRow = resultByAttemptMap.get(att.id);
    return {
      ...att,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
      examTitle: exam?.title || "Quiz",
      courseTitle: exam ? courseTitleMap.get(exam.course_id) || "Course" : "Course",
      scorePercent: Number(resRow?.score_percent ?? 0),
      passed: Boolean(resRow?.passed),
    };
  });

  const enrichedAnswers = (answersRes.data ?? []).map((ans) => {
    const attempt = attemptMap.get(ans.attempt_id);
    const question = questionMap.get(ans.question_id);
    const exam = attempt ? examMap.get(attempt.exam_id) : undefined;
    const profile = attempt ? profileMap.get(attempt.student_id) : undefined;
    return {
      ...ans,
      studentName: profile?.full_name || "Student",
      examId: exam?.id || "",
      examTitle: exam?.title || "Quiz",
      questionPrompt: question?.prompt || "Question",
      questionType: question?.question_type || "essay",
      maxPoints: Number(question?.points ?? 1),
    };
  });

  const enrichedAssignmentSubs = (assignmentSubsRes.data ?? []).map((sub) => {
    const profile = profileMap.get(sub.student_id);
    const assignment = assignmentMap.get(sub.assignment_id);
    const aiGrade = aiGradeBySubmissionMap.get(sub.id);
    return {
      ...sub,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
      assignmentTitle: assignment?.title || "Assignment",
      courseId: assignment?.course_id || "",
      courseTitle: assignment
        ? courseTitleMap.get(assignment.course_id) || "Course"
        : "Course",
      maxPoints: Number(assignment?.max_points ?? 100),
      dueAt: assignment?.due_at ?? null,
      aiSuggestedGrade:
        aiGrade?.ai_suggested_points !== null && aiGrade?.ai_suggested_points !== undefined
          ? Number(aiGrade.ai_suggested_points)
          : null,
      aiExplanation: aiGrade?.ai_suggested_explanation ?? null,
      aiSuggestedFeedback: aiGrade?.ai_suggested_feedback ?? null,
      gradePublished: Boolean(sub.is_grade_published || aiGrade?.is_published),
      versionCount: (versionCountBySubMap.get(sub.id) ?? 0) + (sub.attachment_storage_path ? 1 : 0),
    };
  });

  const enrichedViolations = (violationsRes.data ?? []).map((v) => {
    const attempt = attemptMap.get(v.attempt_id);
    const exam = attempt ? examMap.get(attempt.exam_id) : undefined;
    const profile = profileMap.get(v.student_id);
    return {
      ...v,
      studentName: profile?.full_name || "Student",
      examTitle: exam?.title || "Quiz",
      courseId: exam?.course_id || "",
      isAttemptPaused: Boolean(attempt?.is_paused),
      attemptResumeStatus: attempt?.resume_status ?? "none",
    };
  });

  return {
    ok: true,
    data: {
      teacherId,
      courses,
      exams,
      questions,
      courseEnrollments,
      attempts: enrichedAttempts,
      results,
      studentAnswers: enrichedAnswers,
      violations: enrichedViolations,
      assignments,
      assignmentMaterials: assignmentMaterialsRes.data ?? [],
      assignmentSubmissions: enrichedAssignmentSubs,
    },
  };
}

// -----------------------------------------------------------------------------
// 6. COURSE & TEACHER RATINGS DATA (STRICTLY READ-ONLY)
// -----------------------------------------------------------------------------
export interface TeacherRatingsData {
  teacherId: string;
  teacherFullName: string;
  publicProfile: TableRow<"teacher_public_profiles"> | null;
  averageCourseRating: number;
  averageTeacherRating: number;
  courseReviews: Array<
    TableRow<"course_reviews"> & {
      courseTitle: string;
      studentName: string;
    }
  >;
  teacherReviews: Array<
    TableRow<"teacher_reviews"> & {
      courseTitle: string;
      studentName: string;
    }
  >;
}

export async function getTeacherRatingsData(): Promise<ServiceResult<TeacherRatingsData>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const teacherId = auth.data.userId;

  const [coursesRes, teacherReviewsRes, publicProfileRes] = await Promise.all([
    supabase
      .from("courses")
      .select("id, title")
      .eq("teacher_id", teacherId)
      .is("deleted_at", null),
    supabase
      .from("teacher_reviews")
      .select("*")
      .eq("teacher_id", teacherId)
      .eq("moderation_status", "approved")
      .order("created_at", { ascending: false }),
    supabase
      .from("teacher_public_profiles")
      .select("*")
      .eq("teacher_id", teacherId)
      .maybeSingle(),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (teacherReviewsRes.error) return { ok: false, error: teacherReviewsRes.error.message };

  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const courseReviewsRes =
    courseIds.length > 0
      ? await supabase
          .from("course_reviews")
          .select("*")
          .in("course_id", courseIds)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
      : { data: [] as Array<TableRow<"course_reviews">>, error: null };

  if (courseReviewsRes.error) return { ok: false, error: courseReviewsRes.error.message };

  const reviewerStudentIds = Array.from(
    new Set([
      ...(teacherReviewsRes.data ?? []).map((r) => r.student_id),
      ...(courseReviewsRes.data ?? []).map((r) => r.student_id),
    ]),
  );

  const profilesRes =
    reviewerStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", reviewerStudentIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };

  const profileNameMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const courseReviews = (courseReviewsRes.data ?? []).map((rev) => ({
    ...rev,
    courseTitle: courseTitleMap.get(rev.course_id) || "Course",
    studentName: profileNameMap.get(rev.student_id) || "Verified Student",
  }));

  const teacherReviews = (teacherReviewsRes.data ?? []).map((rev) => ({
    ...rev,
    courseTitle: rev.course_id ? courseTitleMap.get(rev.course_id) || "Course" : "General",
    studentName: profileNameMap.get(rev.student_id) || "Verified Student",
  }));

  const averageCourseRating =
    courseReviews.length > 0
      ? Number(
          (
            courseReviews.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) /
            courseReviews.length
          ).toFixed(2),
        )
      : 0;

  const averageTeacherRating =
    teacherReviews.length > 0
      ? Number(
          (
            teacherReviews.reduce((sum, r) => sum + Number(r.rating ?? 0), 0) /
            teacherReviews.length
          ).toFixed(2),
        )
      : 0;

  return {
    ok: true,
    data: {
      teacherId,
      teacherFullName: auth.data.fullName || auth.data.email || "Instructor",
      publicProfile: publicProfileRes.data ?? null,
      averageCourseRating,
      averageTeacherRating,
      courseReviews,
      teacherReviews,
    },
  };
}

// -----------------------------------------------------------------------------
// 7. TEACHER ANALYTICS DATA
// -----------------------------------------------------------------------------
export interface TeacherAnalyticsCourseSummary {
  courseId: string;
  code: string;
  title: string;
  status: string;
  enrolledCount: number;
  completedCount: number;
  completionRatePercent: number;
  assignmentAvgPercent: number;
  quizAvgPercent: number;
  overallAvgPercent: number;
  studyMinutes: number;
}

export interface TeacherAnalyticsData {
  teacherId: string;
  coursesSummary: Array<TeacherAnalyticsCourseSummary>;
  students: Array<AssignedStudentRow>;
  overallCompletionPercent: number;
  overallAssignmentAvgPercent: number;
  overallQuizAvgPercent: number;
  totalStudyMinutes: number;
  engagementByDay: Array<{
    date: string;
    studyMinutes: number;
    submissions: number;
  }>;
}

export async function getTeacherAnalyticsData(): Promise<ServiceResult<TeacherAnalyticsData>> {
  const studentsRes = await getTeacherStudentsData();
  if (!studentsRes.ok) return studentsRes;

  const supabase = await createSupabaseServerClient();
  const { teacherId, courses, students } = studentsRes.data;
  const courseIds = courses.map((c) => c.id);

  const [enrollmentsRes, resultsRes, assignmentsRes, studySessionsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("course_enrollments").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"course_enrollments">>, error: null }),
    courseIds.length > 0
      ? supabase.from("results").select("*").in("course_id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"results">>, error: null }),
    courseIds.length > 0
      ? supabase.from("assignments").select("id, course_id, max_points").in("course_id", courseIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; course_id: string; max_points: number }>,
          error: null,
        }),
    courseIds.length > 0
      ? supabase
          .from("study_sessions")
          .select("course_id, duration_seconds, started_at")
          .in("course_id", courseIds)
          .order("started_at", { ascending: false })
          .limit(400)
      : Promise.resolve({
          data: [] as Array<{
            course_id: string | null;
            duration_seconds: number;
            started_at: string;
          }>,
          error: null,
        }),
  ]);

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];
  const assignmentIds = assignments.map((a) => a.id);
  const assignmentMap = new Map(
    assignments.map((a) => [a.id, { courseId: a.course_id, maxPoints: Number(a.max_points ?? 100) }]),
  );

  const subsRes =
    assignmentIds.length > 0
      ? await supabase
          .from("assignment_submissions")
          .select("assignment_id, grade_points, submitted_at, status")
          .in("assignment_id", assignmentIds)
          .neq("status", "draft")
      : {
          data: [] as Array<{
            assignment_id: string;
            grade_points: number | null;
            submitted_at: string;
            status: string;
          }>,
        };

  const subs = subsRes.data ?? [];
  const studySessions = studySessionsRes.data ?? [];

  const coursesSummary: Array<TeacherAnalyticsCourseSummary> = courses.map((course) => {
    const cEnr = enrollments.filter((e) => e.course_id === course.id);
    const cCompleted = cEnr.filter(
      (e) => e.status === "completed" || Number(e.progress_percent ?? 0) >= 100,
    ).length;
    const completionRatePercent =
      cEnr.length > 0
        ? Number(
            (
              cEnr.reduce((s, e) => s + Number(e.progress_percent ?? 0), 0) / cEnr.length
            ).toFixed(1),
          )
        : 0;

    const cResults = results.filter((r) => r.course_id === course.id);
    const quizAvgPercent =
      cResults.length > 0
        ? Number(
            (
              cResults.reduce((s, r) => s + Number(r.score_percent ?? 0), 0) /
              cResults.length
            ).toFixed(1),
          )
        : 0;

    const cGradedSubs = subs.filter(
      (s) =>
        s.grade_points !== null &&
        assignmentMap.get(s.assignment_id)?.courseId === course.id,
    );
    const assignmentAvgPercent =
      cGradedSubs.length > 0
        ? Number(
            (
              cGradedSubs.reduce((sum, s) => {
                const maxPts = Math.max(
                  1,
                  assignmentMap.get(s.assignment_id)?.maxPoints ?? 100,
                );
                return sum + (Number(s.grade_points ?? 0) / maxPts) * 100;
              }, 0) / cGradedSubs.length
            ).toFixed(1),
          )
        : 0;

    const buckets: number[] = [];
    if (cResults.length > 0) buckets.push(quizAvgPercent);
    if (cGradedSubs.length > 0) buckets.push(assignmentAvgPercent);
    const overallAvgPercent =
      buckets.length > 0
        ? Number((buckets.reduce((a, b) => a + b, 0) / buckets.length).toFixed(1))
        : completionRatePercent;

    const cStudyMinutes = Math.round(
      studySessions
        .filter((s) => s.course_id === course.id)
        .reduce((sum, s) => sum + Number(s.duration_seconds ?? 0), 0) / 60,
    );

    return {
      courseId: course.id,
      code: course.code,
      title: course.title,
      status: course.status,
      enrolledCount: cEnr.length,
      completedCount: cCompleted,
      completionRatePercent,
      assignmentAvgPercent,
      quizAvgPercent,
      overallAvgPercent,
      studyMinutes: cStudyMinutes,
    };
  });

  const overallCompletionPercent =
    enrollments.length > 0
      ? Number(
          (
            enrollments.reduce((s, e) => s + Number(e.progress_percent ?? 0), 0) /
            enrollments.length
          ).toFixed(1),
        )
      : 0;

  const overallQuizAvgPercent =
    results.length > 0
      ? Number(
          (
            results.reduce((s, r) => s + Number(r.score_percent ?? 0), 0) / results.length
          ).toFixed(1),
        )
      : 0;

  const allGradedSubs = subs.filter((s) => s.grade_points !== null);
  const overallAssignmentAvgPercent =
    allGradedSubs.length > 0
      ? Number(
          (
            allGradedSubs.reduce((sum, s) => {
              const maxPts = Math.max(
                1,
                assignmentMap.get(s.assignment_id)?.maxPoints ?? 100,
              );
              return sum + (Number(s.grade_points ?? 0) / maxPts) * 100;
            }, 0) / allGradedSubs.length
          ).toFixed(1),
        )
      : 0;

  const totalStudyMinutes = Math.round(
    studySessions.reduce((sum, s) => sum + Number(s.duration_seconds ?? 0), 0) / 60,
  );

  // Build last 14 days engagement timeline
  const dayMap = new Map<string, { studyMinutes: number; submissions: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    dayMap.set(d, { studyMinutes: 0, submissions: 0 });
  }
  for (const s of studySessions) {
    const day = s.started_at.slice(0, 10);
    const entry = dayMap.get(day);
    if (entry) {
      entry.studyMinutes += Math.round(Number(s.duration_seconds ?? 0) / 60);
    }
  }
  for (const sub of subs) {
    const day = sub.submitted_at.slice(0, 10);
    const entry = dayMap.get(day);
    if (entry) {
      entry.submissions += 1;
    }
  }
  for (const r of results) {
    const day = r.graded_at.slice(0, 10);
    const entry = dayMap.get(day);
    if (entry) {
      entry.submissions += 1;
    }
  }

  const engagementByDay = Array.from(dayMap.entries()).map(([date, vals]) => ({
    date: date.slice(5),
    studyMinutes: vals.studyMinutes,
    submissions: vals.submissions,
  }));

  return {
    ok: true,
    data: {
      teacherId,
      coursesSummary,
      students,
      overallCompletionPercent,
      overallAssignmentAvgPercent,
      overallQuizAvgPercent,
      totalStudyMinutes,
      engagementByDay,
    },
  };
}
