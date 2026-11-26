import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSignedDownloadUrl } from "@/services/db/storage";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export interface StudentOverviewData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentAvatarUrl: string | null;
  enrolledCoursesCount: number;
  averageCompletionPercent: number;
  upcomingExamsCount: number;
  upcomingAssignmentsCount: number;
  latestGradePercent: number;
  totalStudyHours: number;
  unreadNotificationsCount: number;
  enrolledCourses: Array<
    TableRow<"courses"> & {
      progressPercent: number;
      enrollmentStatus: string;
      teacherName: string;
      averageExamScore: number;
    }
  >;
  upcomingExams: Array<
    TableRow<"exams"> & {
      courseTitle: string;
    }
  >;
  upcomingAssignments: Array<
    TableRow<"assignments"> & {
      courseTitle: string;
    }
  >;
  recentGrades: Array<
    TableRow<"results"> & {
      courseTitle: string;
      examTitle: string;
    }
  >;
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

export async function getStudentOverviewData(): Promise<
  ServiceResult<StudentOverviewData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  // Reuse profile attributes already resolved and cached by requireRole() -> getCachedCallerProfile()
  const [
    enrollmentsRes,
    resultsRes,
    studyRes,
    notifRecipientsRes,
  ] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("*")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("results")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true)
      .order("graded_at", { ascending: false }),
    supabase
      .from("study_sessions")
      .select("duration_seconds")
      .eq("student_id", studentId),
    supabase
      .from("notification_recipients")
      .select("*")
      .eq("recipient_id", studentId)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const studySessions = studyRes.data ?? [];
  const notifRecipients = notifRecipientsRes.data ?? [];

  const courseIds = enrollments.map((e) => e.course_id);
  const notifIds = notifRecipients.map((n) => n.notification_id);

  // Batch Wave 2 queries in parallel (including notifications!) instead of 3 sequential steps
  const [coursesRes, examsRes, assignmentsRes, notificationsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("courses").select("*").in("id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"courses">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("exams")
          .select("*")
          .in("course_id", courseIds)
          .eq("status", "published")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exams">>, error: null }),
    courseIds.length > 0
      ? supabase
          .from("assignments")
          .select("*")
          .in("course_id", courseIds)
          .eq("is_published", true)
          .order("due_at", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"assignments">>, error: null }),
    notifIds.length > 0
      ? supabase.from("notifications").select("*").in("id", notifIds)
      : Promise.resolve({ data: [] as Array<TableRow<"notifications">>, error: null }),
  ]);

  const courses = coursesRes.data ?? [];
  const teacherIds = Array.from(new Set(courses.map((c) => c.teacher_id)));
  const teacherProfilesRes =
    teacherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };
  const profileNameMap = new Map(
    (teacherProfilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const exams = examsRes.data ?? [];
  const examMap = new Map(exams.map((e) => [e.id, e]));
  const assignments = assignmentsRes.data ?? [];
  const notifMap = new Map((notificationsRes.data ?? []).map((n) => [n.id, n]));

  const enrolledCourses = enrollments
    .map((enr) => {
      const course = courseMap.get(enr.course_id);
      if (!course) return null;
      const courseResults = results.filter((r) => r.course_id === course.id);
      const avgScore =
        courseResults.length > 0
          ? Number(
              (
                courseResults.reduce(
                  (sum, r) => sum + Number(r.score_percent ?? 0),
                  0,
                ) / courseResults.length
              ).toFixed(1),
            )
          : 0;
      return {
        ...course,
        progressPercent: Number(enr.progress_percent ?? 0),
        enrollmentStatus: enr.status,
        teacherName: profileNameMap.get(course.teacher_id) || "Instructor",
        averageExamScore: avgScore,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const averageCompletionPercent =
    enrolledCourses.length > 0
      ? Number(
          (
            enrolledCourses.reduce((sum, c) => sum + c.progressPercent, 0) /
            enrolledCourses.length
          ).toFixed(1),
        )
      : 0;

  const totalStudySeconds = studySessions.reduce(
    (sum, s) => sum + Number(s.duration_seconds ?? 0),
    0,
  );
  const totalStudyHours = Number((totalStudySeconds / 3600).toFixed(1));
  const latestGradePercent =
    results.length > 0 ? Number(results[0]?.score_percent ?? 0) : 0;

  const notificationsList = notifRecipients
    .map((nr) => {
      const n = notifMap.get(nr.notification_id);
      if (!n) return null;
      return {
        recipientId: nr.id,
        notificationId: n.id,
        title: n.title,
        body: n.body,
        category: n.notification_type,
        isRead: nr.is_read,
        createdAt: nr.created_at,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const fallbackEmail = auth.data.email ?? "";

  return {
    ok: true,
    data: {
      studentId,
      studentName: auth.data.fullName || fallbackEmail,
      studentEmail: fallbackEmail,
      studentAvatarUrl: auth.data.avatarUrl ?? null,
      enrolledCoursesCount: enrolledCourses.length,
      averageCompletionPercent,
      upcomingExamsCount: exams.length,
      upcomingAssignmentsCount: assignments.length,
      latestGradePercent,
      totalStudyHours,
      unreadNotificationsCount: notificationsList.filter((n) => !n.isRead).length,
      enrolledCourses,
      upcomingExams: exams.slice(0, 8).map((e) => ({
        ...e,
        courseTitle: courseMap.get(e.course_id)?.title || "Course",
      })),
      upcomingAssignments: assignments.slice(0, 8).map((a) => ({
        ...a,
        courseTitle: courseMap.get(a.course_id)?.title || "Course",
      })),
      recentGrades: results.slice(0, 8).map((r) => ({
        ...r,
        courseTitle: courseMap.get(r.course_id)?.title || "Course",
        examTitle: examMap.get(r.exam_id)?.title || "Examination",
      })),
      notifications: notificationsList,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. MY COURSES, CHAPTERS, LESSONS & FAVORITES DATA
// -----------------------------------------------------------------------------
export interface StudentCoursesData {
  studentId: string;
  enrolledCourses: Array<
    TableRow<"courses"> & {
      progressPercent: number;
      enrollmentStatus: string;
      teacherName: string;
    }
  >;
  availablePublishedCourses: Array<
    TableRow<"courses"> & {
      teacherName: string;
    }
  >;
  chapters: Array<TableRow<"chapters">>;
  lessons: Array<TableRow<"lessons">>;
  lessonProgress: Array<TableRow<"lesson_progress">>;
  favorites: Array<TableRow<"favorites">>;
}

export async function getStudentCoursesData(): Promise<
  ServiceResult<StudentCoursesData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const [
    enrollmentsRes,
    publishedCoursesRes,
    lessonProgressRes,
    favoritesRes,
  ] = await Promise.all([
    supabase
      .from("course_enrollments")
      .select("*")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("courses")
      .select("*")
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    supabase.from("lesson_progress").select("*").eq("student_id", studentId),
    supabase.from("favorites").select("*").eq("student_id", studentId),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (publishedCoursesRes.error) {
    return { ok: false, error: publishedCoursesRes.error.message };
  }

  const enrollments = enrollmentsRes.data ?? [];
  const publishedCourses = publishedCoursesRes.data ?? [];

  const enrolledIdsSet = new Set(enrollments.map((e) => e.course_id));
  const enrolledCourseIds = Array.from(enrolledIdsSet);

  const enrolledCoursesRawRes =
    enrolledCourseIds.length > 0
      ? await supabase.from("courses").select("*").in("id", enrolledCourseIds)
      : { data: [] as Array<TableRow<"courses">>, error: null };

  const enrolledCourseMap = new Map(
    (enrolledCoursesRawRes.data ?? []).map((c) => [c.id, c]),
  );

  const teacherIds = Array.from(
    new Set([
      ...publishedCourses.map((c) => c.teacher_id),
      ...(enrolledCoursesRawRes.data ?? []).map((c) => c.teacher_id),
    ]),
  );

  const [chaptersRes, lessonsRes, profilesRes] = await Promise.all([
    enrolledCourseIds.length > 0
      ? supabase
          .from("chapters")
          .select("*")
          .in("course_id", enrolledCourseIds)
          .eq("is_published", true)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"chapters">>, error: null }),
    enrolledCourseIds.length > 0
      ? supabase
          .from("lessons")
          .select("*")
          .in("course_id", enrolledCourseIds)
          .eq("is_published", true)
          .order("position", { ascending: true })
      : Promise.resolve({ data: [] as Array<TableRow<"lessons">>, error: null }),
    teacherIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; full_name: string | null; email: string }>,
          error: null,
        }),
  ]);

  const profileNameMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const enrolledCourses = enrollments
    .map((enr) => {
      const course = enrolledCourseMap.get(enr.course_id);
      if (!course) return null;
      return {
        ...course,
        progressPercent: Number(enr.progress_percent ?? 0),
        enrollmentStatus: enr.status,
        teacherName: profileNameMap.get(course.teacher_id) || "Instructor",
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const availablePublishedCourses = publishedCourses
    .filter((c) => !enrolledIdsSet.has(c.id))
    .map((c) => ({
      ...c,
      teacherName: profileNameMap.get(c.teacher_id) || "Instructor",
    }));

  return {
    ok: true,
    data: {
      studentId,
      enrolledCourses,
      availablePublishedCourses,
      chapters: chaptersRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      lessonProgress: lessonProgressRes.data ?? [],
      favorites: favoritesRes.data ?? [],
    },
  };
}

// -----------------------------------------------------------------------------
// 3. LESSON VIEWER EXPERIENCE DATA
// -----------------------------------------------------------------------------
export interface StudentLessonViewerData {
  studentId: string;
  course: TableRow<"courses">;
  chapter: TableRow<"chapters"> | null;
  lesson: TableRow<"lessons">;
  signedVideoUrl: string | null;
  signedAttachmentUrl: string | null;
  progress: TableRow<"lesson_progress"> | null;
  isFavorited: boolean;
  notes: Array<TableRow<"lesson_notes">>;
  courseChapters: Array<TableRow<"chapters">>;
  courseLessons: Array<TableRow<"lessons">>;
  courseLessonProgress: Array<TableRow<"lesson_progress">>;
  previousLessonId: string | null;
  nextLessonId: string | null;
  relatedLessons: Array<TableRow<"lessons">>;
  practiceQuizzes: Array<TableRow<"lessons">>;
}

export async function getStudentLessonViewerData(
  lessonId: string,
): Promise<ServiceResult<StudentLessonViewerData>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const lessonRes = await supabase
    .from("lessons")
    .select("*")
    .eq("id", lessonId)
    .maybeSingle();

  if (lessonRes.error || !lessonRes.data) {
    return {
      ok: false,
      error:
        lessonRes.error?.message ??
        "Lesson not found or you are not enrolled in this course.",
    };
  }

  const lesson = lessonRes.data;

  // Verify enrollment for students unless lesson is a free preview
  if (auth.data.role === "student" && !lesson.is_preview) {
    const { data: enr } = await supabase
      .from("course_enrollments")
      .select("id")
      .eq("course_id", lesson.course_id)
      .eq("student_id", studentId)
      .maybeSingle();

    if (!enr) {
      return {
        ok: false,
        error: "You must be enrolled in this course to open this lesson.",
      };
    }
  }

  const [
    courseRes,
    chaptersRes,
    allCourseLessonsRes,
    progressRes,
    favRes,
    notesRes,
  ] = await Promise.all([
    supabase.from("courses").select("*").eq("id", lesson.course_id).single(),
    supabase
      .from("chapters")
      .select("*")
      .eq("course_id", lesson.course_id)
      .order("position", { ascending: true }),
    supabase
      .from("lessons")
      .select("*")
      .eq("course_id", lesson.course_id)
      .eq("is_published", true)
      .order("position", { ascending: true }),
    supabase
      .from("lesson_progress")
      .select("*")
      .eq("course_id", lesson.course_id)
      .eq("student_id", studentId),
    supabase
      .from("favorites")
      .select("id")
      .eq("student_id", studentId)
      .eq("lesson_id", lesson.id)
      .maybeSingle(),
    supabase
      .from("lesson_notes")
      .select("*")
      .eq("student_id", studentId)
      .eq("lesson_id", lesson.id)
      .order("created_at", { ascending: false }),
  ]);

  if (courseRes.error || !courseRes.data) {
    return { ok: false, error: "Parent course not found." };
  }

  let signedVideoUrl: string | null = null;
  if (lesson.video_storage_path) {
    const signed = await createSignedDownloadUrl({
      bucketKey: "courseVideos",
      storagePath: lesson.video_storage_path,
      expiresInSeconds: 3600,
    });
    if (signed.ok) signedVideoUrl = signed.data;
  }

  let signedAttachmentUrl: string | null = null;
  if (lesson.attachment_storage_path) {
    const bucketKey =
      lesson.content_type === "presentation"
        ? "coursePresentations"
        : lesson.content_type === "pdf"
          ? "coursePdfs"
          : "courseMaterials";
    const signed = await createSignedDownloadUrl({
      bucketKey,
      storagePath: lesson.attachment_storage_path,
      expiresInSeconds: 3600,
    });
    if (signed.ok) signedAttachmentUrl = signed.data;
  }

  const courseChapters = chaptersRes.data ?? [];
  const chapterPosMap = new Map(courseChapters.map((ch) => [ch.id, ch.position]));
  const courseLessons = [...(allCourseLessonsRes.data ?? [])].sort((a, b) => {
    const chA = chapterPosMap.get(a.chapter_id) ?? 0;
    const chB = chapterPosMap.get(b.chapter_id) ?? 0;
    if (chA !== chB) return chA - chB;
    return a.position - b.position;
  });

  const currentIndex = courseLessons.findIndex((l) => l.id === lesson.id);
  const previousLessonId =
    currentIndex > 0 ? courseLessons[currentIndex - 1]?.id ?? null : null;
  const nextLessonId =
    currentIndex >= 0 && currentIndex < courseLessons.length - 1
      ? courseLessons[currentIndex + 1]?.id ?? null
      : null;

  const relatedLessons = courseLessons.filter(
    (l) => l.chapter_id === lesson.chapter_id && l.id !== lesson.id,
  );
  const practiceQuizzes = courseLessons.filter(
    (l) => l.chapter_id === lesson.chapter_id && l.content_type === "quiz",
  );

  const courseLessonProgress = progressRes.data ?? [];
  const currentProgress =
    courseLessonProgress.find((p) => p.lesson_id === lesson.id) ?? null;

  return {
    ok: true,
    data: {
      studentId,
      course: courseRes.data,
      chapter:
        courseChapters.find((ch) => ch.id === lesson.chapter_id) ?? null,
      lesson,
      signedVideoUrl,
      signedAttachmentUrl,
      progress: currentProgress,
      isFavorited: Boolean(favRes.data),
      notes: notesRes.data ?? [],
      courseChapters,
      courseLessons,
      courseLessonProgress,
      previousLessonId,
      nextLessonId,
      relatedLessons,
      practiceQuizzes,
    },
  };
}

// -----------------------------------------------------------------------------
// 4. PERFORMANCE, MOTIVATION, CERTIFICATES & RATINGS DATA
// -----------------------------------------------------------------------------
export interface StudentPerformanceAndGrowthData {
  studentId: string;
  profile: TableRow<"profiles">;
  enrolledCourses: Array<
    TableRow<"courses"> & {
      progressPercent: number;
      enrollmentStatus: string;
      teacherName: string;
      averageExamScore: number;
    }
  >;
  results: Array<
    TableRow<"results"> & {
      courseTitle: string;
      examTitle: string;
    }
  >;
  studySessions: Array<TableRow<"study_sessions">>;
  completedLessonsCount: number;
  notesCount: number;
  certificates: Array<
    TableRow<"certificates"> & {
      courseTitle: string;
      courseCode: string;
    }
  >;
  courseReviews: Array<TableRow<"course_reviews">>;
  teacherReviews: Array<TableRow<"teacher_reviews">>;
}

export async function getStudentPerformanceAndGrowthData(): Promise<
  ServiceResult<StudentPerformanceAndGrowthData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const [
    profileRes,
    enrollmentsRes,
    resultsRes,
    studyRes,
    lessonProgRes,
    notesRes,
    certsRes,
    courseRevsRes,
    teacherRevsRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", studentId).single(),
    supabase
      .from("course_enrollments")
      .select("*")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("results")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true)
      .order("graded_at", { ascending: false }),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("is_completed", true),
    supabase
      .from("lesson_notes")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId),
    supabase
      .from("certificates")
      .select("*")
      .eq("student_id", studentId)
      .order("issued_at", { ascending: false }),
    supabase.from("course_reviews").select("*").eq("student_id", studentId),
    supabase.from("teacher_reviews").select("*").eq("student_id", studentId),
  ]);

  if (profileRes.error || !profileRes.data) {
    return { ok: false, error: "Profile not found." };
  }

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const certificates = certsRes.data ?? [];

  const courseIds = Array.from(
    new Set([
      ...enrollments.map((e) => e.course_id),
      ...certificates.map((c) => c.course_id),
      ...results.map((r) => r.course_id),
    ]),
  );

  const [coursesRes, examsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("courses").select("*").in("id", courseIds)
      : Promise.resolve({ data: [] as Array<TableRow<"courses">>, error: null }),
    results.length > 0
      ? supabase
          .from("exams")
          .select("id, title")
          .in(
            "id",
            results.map((r) => r.exam_id),
          )
      : Promise.resolve({ data: [] as Array<{ id: string; title: string }>, error: null }),
  ]);

  const teacherIds = Array.from(
    new Set((coursesRes.data ?? []).map((c) => c.teacher_id)),
  );
  const teacherProfilesRes =
    teacherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };
  const profileNameMap = new Map(
    (teacherProfilesRes.data ?? []).map((p) => [p.id, p.full_name || p.email]),
  );

  const courseMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const examTitleMap = new Map((examsRes.data ?? []).map((e) => [e.id, e.title]));

  const enrolledCourses = enrollments
    .map((enr) => {
      const course = courseMap.get(enr.course_id);
      if (!course) return null;
      const courseResults = results.filter((r) => r.course_id === course.id);
      const avgScore =
        courseResults.length > 0
          ? Number(
              (
                courseResults.reduce(
                  (sum, r) => sum + Number(r.score_percent ?? 0),
                  0,
                ) / courseResults.length
              ).toFixed(1),
            )
          : 0;
      return {
        ...course,
        progressPercent: Number(enr.progress_percent ?? 0),
        enrollmentStatus: enr.status,
        teacherName: profileNameMap.get(course.teacher_id) || "Instructor",
        averageExamScore: avgScore,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return {
    ok: true,
    data: {
      studentId,
      profile: profileRes.data,
      enrolledCourses,
      results: results.map((r) => ({
        ...r,
        courseTitle: courseMap.get(r.course_id)?.title || "Course",
        examTitle: examTitleMap.get(r.exam_id) || "Examination",
      })),
      studySessions: studyRes.data ?? [],
      completedLessonsCount: lessonProgRes.count ?? 0,
      notesCount: notesRes.count ?? 0,
      certificates: certificates.map((cert) => ({
        ...cert,
        courseTitle: courseMap.get(cert.course_id)?.title || "Course",
        courseCode: courseMap.get(cert.course_id)?.code || "COURSE",
      })),
      courseReviews: courseRevsRes.data ?? [],
      teacherReviews: teacherRevsRes.data ?? [],
    },
  };
}

// -----------------------------------------------------------------------------
// 5. PART 8 — STUDENT EXAMINATIONS CENTER & SECURE EXAM RUNNER DATA
// -----------------------------------------------------------------------------
export interface StudentExamsCenterData {
  studentId: string;
  studentName: string;
  enrolledCourses: Array<{
    id: string;
    code: string;
    title: string;
  }>;
  exams: Array<
    TableRow<"exams"> & {
      courseTitle: string;
      courseCode: string;
      questionCount: number;
      attemptsUsed: number;
      activeAttemptId: string | null;
      latestAttemptId: string | null;
      latestResult: TableRow<"results"> | null;
    }
  >;
  attempts: Array<
    TableRow<"exam_attempts"> & {
      examTitle: string;
      courseTitle: string;
      result: TableRow<"results"> | null;
    }
  >;
}

export async function getStudentExamsCenterData(): Promise<
  ServiceResult<StudentExamsCenterData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const [profileRes, enrollmentsRes, attemptsRes, resultsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, email").eq("id", studentId).single(),
    supabase.from("course_enrollments").select("course_id").eq("student_id", studentId),
    supabase
      .from("exam_attempts")
      .select("*")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false }),
    supabase
      .from("results")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true),
  ]);

  const studentName =
    profileRes.data?.full_name || profileRes.data?.email || "Student";
  const courseIds = (enrollmentsRes.data ?? []).map((e) => e.course_id);

  const [coursesRes, examsRes] = await Promise.all([
    courseIds.length > 0
      ? supabase.from("courses").select("id, code, title").in("id", courseIds)
      : Promise.resolve({
          data: [] as Array<{ id: string; code: string; title: string }>,
          error: null,
        }),
    courseIds.length > 0
      ? supabase
          .from("exams")
          .select("*")
          .in("course_id", courseIds)
          .eq("status", "published")
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] as Array<TableRow<"exams">>, error: null }),
  ]);

  const courses = coursesRes.data ?? [];
  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Filter exams by assigned_student_ids if the teacher restricted the exam to specific students
  const rawExams = (examsRes.data ?? []).filter((e) => {
    const assigned = e.assigned_student_ids ?? [];
    if (assigned.length === 0) return true;
    return assigned.includes(studentId);
  });

  const examIds = rawExams.map((e) => e.id);
  const questionsRes =
    examIds.length > 0
      ? await supabase.from("questions").select("id, exam_id").in("exam_id", examIds)
      : { data: [] as Array<{ id: string; exam_id: string }>, error: null };

  const questions = questionsRes.data ?? [];
  const attempts = attemptsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const resultByAttemptMap = new Map(results.map((r) => [r.attempt_id, r]));
  const examMap = new Map(rawExams.map((e) => [e.id, e]));

  const enrichedExams = rawExams.map((exam) => {
    const course = courseMap.get(exam.course_id);
    const totalQuestionsInExam = questions.filter((q) => q.exam_id === exam.id).length;
    const effectiveQuestionCount =
      exam.random_question_count && exam.random_question_count > 0
        ? Math.min(totalQuestionsInExam, exam.random_question_count)
        : totalQuestionsInExam;
    const examAttempts = attempts.filter((a) => a.exam_id === exam.id);
    const activeAttempt = examAttempts.find((a) => a.status === "in_progress");
    const latestAttempt = examAttempts[0] ?? null;
    const latestResult = latestAttempt
      ? resultByAttemptMap.get(latestAttempt.id) ?? null
      : null;

    return {
      ...exam,
      courseTitle: course?.title || "Course",
      courseCode: course?.code || "COURSE",
      questionCount: effectiveQuestionCount,
      attemptsUsed: examAttempts.length,
      activeAttemptId: activeAttempt?.id ?? null,
      latestAttemptId: latestAttempt?.id ?? null,
      latestResult,
    };
  });

  const enrichedAttempts = attempts.map((att) => {
    const exam = examMap.get(att.exam_id);
    const course = exam ? courseMap.get(exam.course_id) : undefined;
    return {
      ...att,
      examTitle: exam?.title || "Examination",
      courseTitle: course?.title || "Course",
      result: resultByAttemptMap.get(att.id) ?? null,
    };
  });

  return {
    ok: true,
    data: {
      studentId,
      studentName,
      enrolledCourses: courses,
      exams: enrichedExams,
      attempts: enrichedAttempts,
    },
  };
}

export interface StudentExamRunnerQuestion {
  id: string;
  questionType: TableRow<"questions">["question_type"];
  difficulty: TableRow<"questions">["difficulty"];
  prompt: string;
  points: number;
  position: number;
  mediaUrl: string | null;
  explanation: string | null;
  options: Array<{
    id: string;
    optionText: string;
    position: number;
    isCorrect?: boolean;
  }>;
}

export interface StudentExamRunnerData {
  studentId: string;
  studentName: string;
  studentEmail: string;
  course: TableRow<"courses">;
  exam: TableRow<"exams">;
  attemptsUsed: number;
  activeAttempt: TableRow<"exam_attempts"> | null;
  latestCompletedAttempt: TableRow<"exam_attempts"> | null;
  publishedResult: TableRow<"results"> | null;
  questions: Array<StudentExamRunnerQuestion>;
  savedAnswers: Array<TableRow<"student_answers">>;
  violations: Array<TableRow<"exam_violations">>;
}

export async function getStudentExamRunnerData(
  examId: string,
): Promise<ServiceResult<StudentExamRunnerData>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const [profileRes, examRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("id", studentId)
      .single(),
    supabase.from("exams").select("*").eq("id", examId).maybeSingle(),
  ]);

  if (examRes.error || !examRes.data) {
    return {
      ok: false,
      error:
        examRes.error?.message ??
        "Examination not found or you are not authorized to access it.",
    };
  }

  const exam = examRes.data;

  // Verify assignment if restricted to specific students
  if (
    auth.data.role === "student" &&
    exam.assigned_student_ids &&
    exam.assigned_student_ids.length > 0 &&
    !exam.assigned_student_ids.includes(studentId)
  ) {
    return {
      ok: false,
      error: "This examination is not assigned to your student account.",
    };
  }

  const [courseRes, attemptsRes, questionsRes] = await Promise.all([
    supabase.from("courses").select("*").eq("id", exam.course_id).single(),
    supabase
      .from("exam_attempts")
      .select("*")
      .eq("exam_id", exam.id)
      .eq("student_id", studentId)
      .order("started_at", { ascending: false }),
    supabase
      .from("questions")
      .select("*")
      .eq("exam_id", exam.id)
      .order("position", { ascending: true }),
  ]);

  if (courseRes.error || !courseRes.data) {
    return { ok: false, error: "Parent course not found." };
  }

  const attempts = attemptsRes.data ?? [];
  const activeAttempt =
    attempts.find((a) => a.status === "in_progress") ?? null;
  const latestCompletedAttempt =
    attempts.find((a) => a.status !== "in_progress") ?? null;

  const targetAttempt = activeAttempt ?? latestCompletedAttempt;
  const allQuestions = questionsRes.data ?? [];
  const allQuestionIds = allQuestions.map((q) => q.id);

  const [optionsRes, answersRes, resultRes, violationsRes] = await Promise.all([
    allQuestionIds.length > 0
      ? supabase
          .from("question_options")
          .select("*")
          .in("question_id", allQuestionIds)
          .order("position", { ascending: true })
      : Promise.resolve({
          data: [] as Array<TableRow<"question_options">>,
          error: null,
        }),
    targetAttempt
      ? supabase
          .from("student_answers")
          .select("*")
          .eq("attempt_id", targetAttempt.id)
      : Promise.resolve({
          data: [] as Array<TableRow<"student_answers">>,
          error: null,
        }),
    latestCompletedAttempt
      ? supabase
          .from("results")
          .select("*")
          .eq("attempt_id", latestCompletedAttempt.id)
          .eq("is_published", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    targetAttempt
      ? supabase
          .from("exam_violations")
          .select("*")
          .eq("attempt_id", targetAttempt.id)
          .order("occurred_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<TableRow<"exam_violations">>,
          error: null,
        }),
  ]);

  const publishedResult = resultRes.data ?? null;
  const canRevealCorrectAnswers =
    !activeAttempt && Boolean(publishedResult) && exam.allow_answer_review;

  // Order questions according to attempt's assigned_question_ids when available
  const assignedIds = targetAttempt?.assigned_question_ids ?? [];
  const orderedRawQuestions =
    assignedIds.length > 0
      ? assignedIds
          .map((id) => allQuestions.find((q) => q.id === id))
          .filter((q): q is NonNullable<typeof q> => Boolean(q))
      : allQuestions;

  const allOptions = optionsRes.data ?? [];
  const sanitizedQuestions: Array<StudentExamRunnerQuestion> =
    orderedRawQuestions.map((q, index) => {
      const qOpts = allOptions
        .filter((o) => o.question_id === q.id)
        .map((o) => ({
          id: o.id,
          optionText: o.option_text,
          position: o.position,
          // NEVER expose isCorrect to the browser while an exam is in progress
          ...(canRevealCorrectAnswers ? { isCorrect: o.is_correct } : {}),
        }));

      return {
        id: q.id,
        questionType: q.question_type,
        difficulty: q.difficulty,
        prompt: q.prompt,
        points: Number(q.points),
        position: index + 1,
        mediaUrl: q.media_url,
        explanation: canRevealCorrectAnswers ? q.explanation : null,
        options: qOpts,
      };
    });

  return {
    ok: true,
    data: {
      studentId,
      studentName:
        profileRes.data?.full_name || profileRes.data?.email || "Student",
      studentEmail: profileRes.data?.email || "",
      course: courseRes.data,
      exam,
      attemptsUsed: attempts.length,
      activeAttempt,
      latestCompletedAttempt,
      publishedResult,
      questions: sanitizedQuestions,
      savedAnswers: answersRes.data ?? [],
      violations: violationsRes.data ?? [],
    },
  };
}
