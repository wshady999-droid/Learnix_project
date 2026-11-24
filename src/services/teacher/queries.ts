import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export interface TeacherOverviewData {
  teacherId: string;
  assignedCoursesCount: number;
  enrolledStudentsCount: number;
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

  const [coursesRes, schedulesRes, notifRecipientsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
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
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (schedulesRes.error) return { ok: false, error: schedulesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));
  const schedules = schedulesRes.data ?? [];
  const notifRecipients = notifRecipientsRes.data ?? [];
  const notifIds = notifRecipients.map((n) => n.notification_id);

  const [
    enrollmentsRes,
    examsRes,
    resultsRes,
    assignmentsRes,
    notificationsRes,
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
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (examsRes.error) return { ok: false, error: examsRes.error.message };
  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };

  const enrollments = enrollmentsRes.data ?? [];
  const exams = examsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const assignments = assignmentsRes.data ?? [];

  const examIds = exams.map((e) => e.id);
  const examTitleMap = new Map(exams.map((e) => [e.id, e.title]));
  const resultByAttemptMap = new Map(results.map((r) => [r.attempt_id, r]));

  const assignmentIds = assignments.map((a) => a.id);
  const assignmentTitleMap = new Map(assignments.map((a) => [a.id, a.title]));

  const [attemptsRes, assignmentSubmissionsRes] = await Promise.all([
    examIds.length > 0
      ? supabase
          .from("exam_attempts")
          .select("*")
          .in("exam_id", examIds)
          .order("started_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] as Array<TableRow<"exam_attempts">>, error: null }),
    assignmentIds.length > 0
      ? supabase
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] as Array<TableRow<"assignment_submissions">>, error: null }),
  ]);

  const teacherAttempts = attemptsRes.data ?? [];
  const assignmentSubmissions = assignmentSubmissionsRes.data ?? [];

  const submissionStudentIds = Array.from(
    new Set([
      ...teacherAttempts.slice(0, 10).map((a) => a.student_id),
      ...assignmentSubmissions.slice(0, 10).map((s) => s.student_id),
    ]),
  );

  const profilesRes =
    submissionStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", submissionStudentIds)
      : {
          data: [] as Array<{ id: string; full_name: string | null; email: string }>,
          error: null,
        };

  const profileNameMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const notificationMap = new Map((notificationsRes.data ?? []).map((n) => [n.id, n]));

  const uniqueStudents = new Set(enrollments.map((e) => e.student_id));
  const averageStudentPerformance =
    results.length > 0
      ? Number(
          (
            results.reduce((sum, r) => sum + Number(r.score_percent ?? 0), 0) / results.length
          ).toFixed(1),
        )
      : 0;

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
        title: examTitleMap.get(att.exam_id) ?? "Examination",
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

  return {
    ok: true,
    data: {
      teacherId,
      assignedCoursesCount: courses.length,
      enrolledStudentsCount: uniqueStudents.size,
      upcomingClassesCount: schedules.length,
      upcomingExamsCount: exams.filter((e) => e.status === "published" || e.status === "draft")
        .length,
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
  chapters: Array<TableRow<"chapters">>;
  lessons: Array<TableRow<"lessons">>;
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

  const [coursesRes, departmentsRes, levelsRes] = await Promise.all([
    supabase
      .from("courses")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false }),
    supabase.from("departments").select("*").order("name", { ascending: true }),
    supabase.from("educational_levels").select("*").order("rank_order", { ascending: true }),
  ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (departmentsRes.error) return { ok: false, error: departmentsRes.error.message };
  if (levelsRes.error) return { ok: false, error: levelsRes.error.message };

  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);

  const [chaptersRes, lessonsRes, enrollmentsRes] = await Promise.all([
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
      chapters: chaptersRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      enrollments: enrichedEnrollments,
      departments: departmentsRes.data ?? [],
      educationalLevels: levelsRes.data ?? [],
    },
  };
}

// -----------------------------------------------------------------------------
// 3. SMART EXAM BUILDER DATA
// -----------------------------------------------------------------------------
export interface TeacherExamBuilderData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  chapters: Array<TableRow<"chapters">>;
  classes: Array<TableRow<"classes">>;
  assignedStudents: Array<{ id: string; fullName: string; email: string }>;
  exams: Array<TableRow<"exams">>;
  questions: Array<TableRow<"questions">>;
  questionOptions: Array<TableRow<"question_options">>;
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

  const [chaptersRes, enrollmentsRes, examsRes] = await Promise.all([
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
  ]);

  if (examsRes.error) return { ok: false, error: examsRes.error.message };
  const exams = examsRes.data ?? [];
  const examIds = exams.map((e) => e.id);

  const questionsRes =
    examIds.length > 0
      ? await supabase
          .from("questions")
          .select("*")
          .in("exam_id", examIds)
          .order("position", { ascending: true })
      : { data: [] as Array<TableRow<"questions">>, error: null };

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
    ]),
  );

  const profilesRes =
    assignedStudentIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", assignedStudentIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };

  const assignedStudents = (profilesRes.data ?? []).map((p) => ({
    id: p.id,
    fullName: p.full_name || p.email,
    email: p.email,
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
    },
  };
}

// -----------------------------------------------------------------------------
// 4. STUDENT MANAGEMENT & ATTENDANCE DATA
// -----------------------------------------------------------------------------
export interface AssignedStudentRow {
  studentId: string;
  fullName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  enrolledCourses: Array<{
    courseId: string;
    courseTitle: string;
    progressPercent: number;
    status: string;
  }>;
  averageProgressPercent: number;
  examAveragePercent: number;
  examsTakenCount: number;
  attendanceRatePercent: number;
  totalStudyMinutes: number;
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

  const attendanceSessions = attendanceSessionsRes.data ?? [];
  const attendanceSessionIds = attendanceSessions.map((a) => a.id);

  const attendanceRecordsRes =
    attendanceSessionIds.length > 0
      ? await supabase
          .from("attendance_records")
          .select("*")
          .in("attendance_id", attendanceSessionIds)
      : { data: [] as Array<TableRow<"attendance_records">>, error: null };

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const attendanceRecords = attendanceRecordsRes.data ?? [];
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

    const isFallingBehind =
      (stuEnrollments.length > 0 && avgProgress < 35) ||
      (stuResults.length > 0 && avgExam < 60) ||
      (stuAttendance.length > 0 && attendanceRate < 70);

    const recentActivity: AssignedStudentRow["recentActivity"] = [
      ...stuLessons.slice(0, 5).map((lp) => ({
        id: `lp-${lp.id}`,
        title: `Lesson progress (${lp.is_completed ? "completed" : "in_progress"})`,
        timestamp: lp.updated_at,
        detail: `${courseTitleMap.get(lp.course_id) ?? "Course"} — ${Math.round(lp.watched_seconds / 60)} min`,
      })),
      ...stuStudy.slice(0, 5).map((ss) => ({
        id: `ss-${ss.id}`,
        title: "Focused Study Session",
        timestamp: ss.started_at,
        detail: `${Math.round((ss.duration_seconds ?? 0) / 60)} min active`,
      })),
    ]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);

    return {
      studentId: profile.id,
      fullName: profile.full_name || profile.email,
      email: profile.email,
      phone: profile.phone,
      avatarUrl: profile.avatar_url,
      enrolledCourses: stuEnrollments.map((e) => ({
        courseId: e.course_id,
        courseTitle: courseTitleMap.get(e.course_id) ?? "Course",
        progressPercent: Number(e.progress_percent ?? 0),
        status: e.status,
      })),
      averageProgressPercent: avgProgress,
      examAveragePercent: avgExam,
      examsTakenCount: stuResults.length,
      attendanceRatePercent: attendanceRate,
      totalStudyMinutes,
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
// 5. GRADING, AI ESSAY REVIEW & RESULTS DATA
// -----------------------------------------------------------------------------
export interface TeacherGradingData {
  teacherId: string;
  courses: Array<TableRow<"courses">>;
  exams: Array<TableRow<"exams">>;
  questions: Array<TableRow<"questions">>;
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
    }
  >;
  assignments: Array<TableRow<"assignments">>;
  assignmentSubmissions: Array<
    TableRow<"assignment_submissions"> & {
      studentName: string;
      studentEmail: string;
      assignmentTitle: string;
      courseTitle: string;
      maxPoints: number;
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
    .order("title", { ascending: true });

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  const courses = coursesRes.data ?? [];
  const courseIds = courses.map((c) => c.id);
  const courseTitleMap = new Map(courses.map((c) => [c.id, c.title]));

  const [examsRes, resultsRes, assignmentsRes] = await Promise.all([
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
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"results">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select("*")
          .in("course_id", courseIds)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"assignments">>, error: null }),
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

  const assignmentSubsRes =
    assignmentIds.length > 0
      ? await supabase
          .from("assignment_submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false })
      : { data: [] as Array<TableRow<"assignment_submissions">>, error: null };

  const studentIdsToResolve = Array.from(
    new Set([
      ...attempts.map((a) => a.student_id),
      ...(assignmentSubsRes.data ?? []).map((s) => s.student_id),
      ...(violationsRes.data ?? []).map((v) => v.student_id),
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

  const enrichedAttempts = attempts.map((att) => {
    const profile = profileMap.get(att.student_id);
    const exam = examMap.get(att.exam_id);
    const resRow = resultByAttemptMap.get(att.id);
    return {
      ...att,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
      examTitle: exam?.title || "Examination",
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
      examTitle: exam?.title || "Examination",
      questionPrompt: question?.prompt || "Question",
      questionType: question?.question_type || "essay",
      maxPoints: Number(question?.points ?? 1),
    };
  });

  const enrichedAssignmentSubs = (assignmentSubsRes.data ?? []).map((sub) => {
    const profile = profileMap.get(sub.student_id);
    const assignment = assignmentMap.get(sub.assignment_id);
    return {
      ...sub,
      studentName: profile?.full_name || "Student",
      studentEmail: profile?.email || "",
      assignmentTitle: assignment?.title || "Assignment",
      courseTitle: assignment
        ? courseTitleMap.get(assignment.course_id) || "Course"
        : "Course",
      maxPoints: Number(assignment?.max_points ?? 100),
    };
  });

  const enrichedViolations = (violationsRes.data ?? []).map((v) => {
    const attempt = attemptMap.get(v.attempt_id);
    const exam = attempt ? examMap.get(attempt.exam_id) : undefined;
    const profile = profileMap.get(v.student_id);
    return {
      ...v,
      studentName: profile?.full_name || "Student",
      examTitle: exam?.title || "Examination",
    };
  });

  return {
    ok: true,
    data: {
      teacherId,
      courses,
      exams,
      questions,
      attempts: enrichedAttempts,
      results,
      studentAnswers: enrichedAnswers,
      violations: enrichedViolations,
      assignments,
      assignmentSubmissions: enrichedAssignmentSubs,
    },
  };
}

// -----------------------------------------------------------------------------
// 6. COURSE & TEACHER RATINGS DATA (STRICTLY READ-ONLY)
// -----------------------------------------------------------------------------
export interface TeacherRatingsData {
  teacherId: string;
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

  const [coursesRes, teacherReviewsRes] = await Promise.all([
    supabase.from("courses").select("id, title").eq("teacher_id", teacherId),
    supabase
      .from("teacher_reviews")
      .select("*")
      .eq("teacher_id", teacherId)
      .order("created_at", { ascending: false }),
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
      averageCourseRating,
      averageTeacherRating,
      courseReviews,
      teacherReviews,
    },
  };
}
