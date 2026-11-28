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
  completedCoursesCount: number;
  inProgressCoursesCount: number;
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
  recentGrades: Array<{
    id: string;
    kind: "quiz" | "assignment";
    title: string;
    courseTitle: string;
    scorePercent: number;
    passed: boolean;
    gradedAt: string;
  }>;
  recentTeacherMessages: Array<{
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
    actionUrl: string | null;
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

  const [
    enrollmentsRes,
    resultsRes,
    publishedAsgGradesRes,
    studyRes,
    notifRecipientsRes,
    myConvPartsRes,
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
      .from("assignment_grades")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(10),
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
    supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("user_id", studentId),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };

  const enrollments = enrollmentsRes.data ?? [];
  const results = resultsRes.data ?? [];
  const publishedAsgGrades = publishedAsgGradesRes.data ?? [];
  const studySessions = studyRes.data ?? [];
  const notifRecipients = notifRecipientsRes.data ?? [];
  const myConvIds = (myConvPartsRes.data ?? []).map((p) => p.conversation_id);

  const courseIds = enrollments.map((e) => e.course_id);
  const notifIds = notifRecipients.map((n) => n.notification_id);

  const [coursesRes, examsRes, assignmentsRes, notificationsRes, recentMsgsRes] =
    await Promise.all([
      courseIds.length > 0
        ? supabase
            .from("courses")
            .select("*")
            .in("id", courseIds)
            .is("deleted_at", null)
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
      myConvIds.length > 0
        ? supabase
            .from("messages")
            .select("id, conversation_id, sender_id, body, created_at")
            .in("conversation_id", myConvIds)
            .neq("sender_id", studentId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(5)
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

  const courses = coursesRes.data ?? [];
  const recentMsgs = recentMsgsRes.data ?? [];
  const teacherIds = Array.from(
    new Set([
      ...courses.map((c) => c.teacher_id),
      ...recentMsgs.map((m) => m.sender_id),
    ]),
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
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const exams = examsRes.data ?? [];
  const examMap = new Map(exams.map((e) => [e.id, e]));
  const assignments = assignmentsRes.data ?? [];
  const assignmentMap = new Map(assignments.map((a) => [a.id, a]));
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

  const completedCoursesCount = enrolledCourses.filter(
    (c) => c.progressPercent >= 100 || c.enrollmentStatus === "completed",
  ).length;
  const inProgressCoursesCount = Math.max(
    0,
    enrolledCourses.length - completedCoursesCount,
  );

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

  const combinedGrades: StudentOverviewData["recentGrades"] = [
    ...results.map((r) => ({
      id: `quiz-${r.id}`,
      kind: "quiz" as const,
      title: examMap.get(r.exam_id)?.title || "Quiz",
      courseTitle: courseMap.get(r.course_id)?.title || "Course",
      scorePercent: Number(r.score_percent ?? 0),
      passed: Boolean(r.passed),
      gradedAt: r.graded_at,
    })),
    ...publishedAsgGrades.map((ag) => {
      const asg = assignmentMap.get(ag.assignment_id);
      const maxPts = Number(asg?.max_points ?? 100) || 100;
      const earned = Number(ag.teacher_points ?? 0);
      const pct = Math.min(100, Number(((earned / maxPts) * 100).toFixed(1)));
      return {
        id: `asg-${ag.id}`,
        kind: "assignment" as const,
        title: asg?.title || "Assignment",
        courseTitle: courseMap.get(ag.course_id)?.title || "Course",
        scorePercent: pct,
        passed: pct >= 60,
        gradedAt: ag.published_at || ag.updated_at,
      };
    }),
  ].sort((a, b) => new Date(b.gradedAt).getTime() - new Date(a.gradedAt).getTime());

  const latestGradePercent =
    combinedGrades.length > 0 ? combinedGrades[0]!.scorePercent : 0;

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
        actionUrl: n.action_url,
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
      completedCoursesCount,
      inProgressCoursesCount,
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
      recentGrades: combinedGrades.slice(0, 8),
      recentTeacherMessages: recentMsgs.map((m) => ({
        id: m.id,
        conversationId: m.conversation_id,
        senderName: profileNameMap.get(m.sender_id) || "Instructor",
        body: m.body,
        createdAt: m.created_at,
      })),
      notifications: notificationsList,
    },
  };
}

// -----------------------------------------------------------------------------
// 2. MY COURSES, CHAPTERS, LESSONS & FAVORITES DATA
// -----------------------------------------------------------------------------
export interface StudentLearningResourceView {
  id: string;
  courseId: string;
  chapterId: string | null;
  lessonId: string | null;
  title: string;
  description: string | null;
  resourceType: string;
  fileName: string | null;
  externalUrl: string | null;
  signedUrl: string | null;
}

export interface StudentCoursesData {
  studentId: string;
  categories: string[];
  enrolledCourses: Array<
    TableRow<"courses"> & {
      progressPercent: number;
      enrollmentStatus: string;
      teacherName: string;
      teacherAvatarUrl: string | null;
      ratingAvg: number;
      reviewCount: number;
      enrollmentCount: number;
    }
  >;
  availablePublishedCourses: Array<
    TableRow<"courses"> & {
      teacherName: string;
      teacherAvatarUrl: string | null;
      ratingAvg: number;
      reviewCount: number;
      enrollmentCount: number;
    }
  >;
  chapters: Array<TableRow<"chapters">>;
  lessons: Array<
    TableRow<"lessons"> & {
      signedVideoUrl?: string | null;
      signedAttachmentUrl?: string | null;
    }
  >;
  learningResources: StudentLearningResourceView[];
  lessonProgress: Array<TableRow<"lesson_progress">>;
  favorites: Array<TableRow<"favorites">>;
  approvedReviews: Array<{
    id: string;
    courseId: string;
    studentName: string;
    rating: number;
    comment: string | null;
    createdAt: string;
  }>;
  myCourseReviews: Array<TableRow<"course_reviews">>;
  myTeacherReviews: Array<TableRow<"teacher_reviews">>;
}

export async function getStudentCoursesData(): Promise<
  ServiceResult<StudentCoursesData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const [
    categoriesRes,
    enrollmentsRes,
    publishedCoursesRes,
    lessonProgressRes,
    favoritesRes,
    myCourseRevsRes,
    myTeacherRevsRes,
  ] = await Promise.all([
    supabase
      .from("categories")
      .select("name")
      .eq("is_active", true)
      .order("name", { ascending: true }),
    supabase
      .from("course_enrollments")
      .select("*")
      .eq("student_id", studentId)
      .order("enrolled_at", { ascending: false }),
    supabase
      .from("courses")
      .select("*")
      .eq("status", "published")
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("lesson_progress").select("*").eq("student_id", studentId),
    supabase.from("favorites").select("*").eq("student_id", studentId),
    supabase.from("course_reviews").select("*").eq("student_id", studentId),
    supabase.from("teacher_reviews").select("*").eq("student_id", studentId),
  ]);

  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (publishedCoursesRes.error) {
    return { ok: false, error: publishedCoursesRes.error.message };
  }

  const enrollments = enrollmentsRes.data ?? [];
  const publishedCourses = publishedCoursesRes.data ?? [];

  const enrolledIdsSet = new Set(enrollments.map((e) => e.course_id));
  const enrolledCourseIds = Array.from(enrolledIdsSet);
  const allCatalogCourseIds = Array.from(
    new Set([...publishedCourses.map((c) => c.id), ...enrolledCourseIds]),
  );

  const enrolledCoursesRawRes =
    enrolledCourseIds.length > 0
      ? await supabase
          .from("courses")
          .select("*")
          .in("id", enrolledCourseIds)
          .is("deleted_at", null)
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

  const [
    chaptersRes,
    lessonsRes,
    resourcesRes,
    profilesRes,
    approvedRevsRes,
    allEnrCountsRes,
  ] = await Promise.all([
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
    enrolledCourseIds.length > 0
      ? supabase
          .from("learning_resources")
          .select("*")
          .in("course_id", enrolledCourseIds)
          .eq("is_published", true)
          .order("position", { ascending: true })
      : Promise.resolve({
          data: [] as Array<TableRow<"learning_resources">>,
          error: null,
        }),
    teacherIds.length > 0
      ? supabase
          .from("profiles")
          .select("id, full_name, email, avatar_url")
          .in("id", teacherIds)
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            full_name: string | null;
            email: string;
            avatar_url: string | null;
          }>,
          error: null,
        }),
    allCatalogCourseIds.length > 0
      ? supabase
          .from("course_reviews")
          .select("id, course_id, student_id, rating, comment, created_at")
          .in("course_id", allCatalogCourseIds)
          .eq("is_published", true)
          .eq("moderation_status", "approved")
          .order("created_at", { ascending: false })
      : Promise.resolve({
          data: [] as Array<{
            id: string;
            course_id: string;
            student_id: string;
            rating: number;
            comment: string | null;
            created_at: string;
          }>,
          error: null,
        }),
    allCatalogCourseIds.length > 0
      ? supabase
          .from("course_enrollments")
          .select("course_id")
          .in("course_id", allCatalogCourseIds)
      : Promise.resolve({ data: [] as Array<{ course_id: string }>, error: null }),
  ]);

  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p]),
  );

  const approvedRevs = approvedRevsRes.data ?? [];
  const enrollmentCountMap = new Map<string, number>();
  for (const row of allEnrCountsRes.data ?? []) {
    enrollmentCountMap.set(
      row.course_id,
      (enrollmentCountMap.get(row.course_id) ?? 0) + 1,
    );
  }

  function computeRatingStats(courseId: string) {
    const revs = approvedRevs.filter((r) => r.course_id === courseId);
    const avg =
      revs.length > 0
        ? Number(
            (
              revs.reduce((s, r) => s + Number(r.rating), 0) / revs.length
            ).toFixed(1),
          )
        : 0;
    return { ratingAvg: avg, reviewCount: revs.length };
  }

  // Sign URLs for learning resources in enrolled courses
  const rawResources = resourcesRes.data ?? [];
  const learningResources: StudentLearningResourceView[] = await Promise.all(
    rawResources.map(async (resRow) => {
      let signedUrl: string | null = null;
      if (resRow.storage_bucket && resRow.storage_path) {
        const { data: signed } = await supabase.storage
          .from(resRow.storage_bucket)
          .createSignedUrl(resRow.storage_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: resRow.id,
        courseId: resRow.course_id,
        chapterId: resRow.chapter_id,
        lessonId: resRow.lesson_id,
        title: resRow.title,
        description: resRow.description,
        resourceType: resRow.resource_type,
        fileName: resRow.file_name,
        externalUrl: resRow.external_url,
        signedUrl,
      };
    }),
  );

  const enrolledCourses = enrollments
    .map((enr) => {
      const course = enrolledCourseMap.get(enr.course_id);
      if (!course) return null;
      const teacher = profileMap.get(course.teacher_id);
      const stats = computeRatingStats(course.id);
      return {
        ...course,
        progressPercent: Number(enr.progress_percent ?? 0),
        enrollmentStatus: enr.status,
        teacherName: teacher?.full_name || teacher?.email || "Instructor",
        teacherAvatarUrl: teacher?.avatar_url ?? null,
        ratingAvg: stats.ratingAvg,
        reviewCount: stats.reviewCount,
        enrollmentCount: enrollmentCountMap.get(course.id) ?? 1,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  const availablePublishedCourses = publishedCourses
    .filter((c) => !enrolledIdsSet.has(c.id))
    .map((c) => {
      const teacher = profileMap.get(c.teacher_id);
      const stats = computeRatingStats(c.id);
      return {
        ...c,
        teacherName: teacher?.full_name || teacher?.email || "Instructor",
        teacherAvatarUrl: teacher?.avatar_url ?? null,
        ratingAvg: stats.ratingAvg,
        reviewCount: stats.reviewCount,
        enrollmentCount: enrollmentCountMap.get(c.id) ?? 0,
      };
    });

  return {
    ok: true,
    data: {
      studentId,
      categories: (categoriesRes.data ?? []).map((c) => c.name),
      enrolledCourses,
      availablePublishedCourses,
      chapters: chaptersRes.data ?? [],
      lessons: lessonsRes.data ?? [],
      learningResources,
      lessonProgress: lessonProgressRes.data ?? [],
      favorites: favoritesRes.data ?? [],
      approvedReviews: approvedRevs.map((r) => ({
        id: r.id,
        courseId: r.course_id,
        studentName:
          r.student_id === studentId ? "You" : "Verified Student",
        rating: r.rating,
        comment: r.comment,
        createdAt: r.created_at,
      })),
      myCourseReviews: myCourseRevsRes.data ?? [],
      myTeacherReviews: myTeacherRevsRes.data ?? [],
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
  learningResources: StudentLearningResourceView[];
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
    resourcesRes,
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
    supabase
      .from("learning_resources")
      .select("*")
      .eq("course_id", lesson.course_id)
      .eq("is_published", true)
      .order("position", { ascending: true }),
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

  const filteredLessonResources = (resourcesRes.data ?? []).filter(
    (r) => !r.lesson_id || r.lesson_id === lesson.id,
  );
  const learningResources: StudentLearningResourceView[] = await Promise.all(
    filteredLessonResources.map(async (resRow) => {
      let signedUrl: string | null = null;
      if (resRow.storage_bucket && resRow.storage_path) {
        const { data: signed } = await supabase.storage
          .from(resRow.storage_bucket)
          .createSignedUrl(resRow.storage_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: resRow.id,
        courseId: resRow.course_id,
        chapterId: resRow.chapter_id,
        lessonId: resRow.lesson_id,
        title: resRow.title,
        description: resRow.description,
        resourceType: resRow.resource_type,
        fileName: resRow.file_name,
        externalUrl: resRow.external_url,
        signedUrl,
      };
    }),
  );

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
      learningResources,
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
      averageAssignmentScore: number;
    }
  >;
  results: Array<
    TableRow<"results"> & {
      courseTitle: string;
      examTitle: string;
    }
  >;
  assignmentGrades: Array<{
    id: string;
    assignmentId: string;
    assignmentTitle: string;
    courseId: string;
    courseTitle: string;
    earnedPoints: number;
    maxPoints: number;
    scorePercent: number;
    feedback: string | null;
    gradedAt: string;
  }>;
  completedLessons: Array<{
    id: string;
    courseId: string;
    completedAt: string;
  }>;
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
    asgGradesRes,
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
      .from("assignment_grades")
      .select("*")
      .eq("student_id", studentId)
      .eq("is_published", true)
      .order("published_at", { ascending: false }),
    supabase
      .from("study_sessions")
      .select("*")
      .eq("student_id", studentId)
      .order("started_at", { ascending: false }),
    supabase
      .from("lesson_progress")
      .select("id, course_id, completed_at, updated_at")
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
  const rawAsgGrades = asgGradesRes.data ?? [];
  const certificates = certsRes.data ?? [];
  const completedLessonsRows = lessonProgRes.data ?? [];

  const courseIds = Array.from(
    new Set([
      ...enrollments.map((e) => e.course_id),
      ...certificates.map((c) => c.course_id),
      ...results.map((r) => r.course_id),
      ...rawAsgGrades.map((g) => g.course_id),
    ]),
  );

  const [coursesRes, examsRes, assignmentsRes] = await Promise.all([
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
    rawAsgGrades.length > 0
      ? supabase
          .from("assignments")
          .select("id, title, max_points")
          .in(
            "id",
            rawAsgGrades.map((g) => g.assignment_id),
          )
      : Promise.resolve({
          data: [] as Array<{ id: string; title: string; max_points: number }>,
          error: null,
        }),
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
  const asgMap = new Map((assignmentsRes.data ?? []).map((a) => [a.id, a]));

  const assignmentGrades: StudentPerformanceAndGrowthData["assignmentGrades"] =
    rawAsgGrades.map((g) => {
      const asg = asgMap.get(g.assignment_id);
      const maxPoints = Number(asg?.max_points ?? 100) || 100;
      const earnedPoints = Number(g.teacher_points ?? 0);
      const scorePercent = Math.min(
        100,
        Number(((earnedPoints / maxPoints) * 100).toFixed(1)),
      );
      return {
        id: g.id,
        assignmentId: g.assignment_id,
        assignmentTitle: asg?.title || "Assignment",
        courseId: g.course_id,
        courseTitle: courseMap.get(g.course_id)?.title || "Course",
        earnedPoints,
        maxPoints,
        scorePercent,
        feedback: g.teacher_feedback,
        gradedAt: g.published_at || g.updated_at,
      };
    });

  const enrolledCourses = enrollments
    .map((enr) => {
      const course = courseMap.get(enr.course_id);
      if (!course || course.deleted_at) return null;
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
      const courseAsg = assignmentGrades.filter((a) => a.courseId === course.id);
      const avgAsg =
        courseAsg.length > 0
          ? Number(
              (
                courseAsg.reduce((sum, a) => sum + a.scorePercent, 0) /
                courseAsg.length
              ).toFixed(1),
            )
          : 0;
      return {
        ...course,
        progressPercent: Number(enr.progress_percent ?? 0),
        enrollmentStatus: enr.status,
        teacherName: profileNameMap.get(course.teacher_id) || "Instructor",
        averageExamScore: avgScore,
        averageAssignmentScore: avgAsg,
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
      assignmentGrades,
      completedLessons: completedLessonsRows.map((lp) => ({
        id: lp.id,
        courseId: lp.course_id,
        completedAt: lp.completed_at || lp.updated_at,
      })),
      studySessions: studyRes.data ?? [],
      completedLessonsCount: completedLessonsRows.length,
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

  const [optionsRes, activePayloadRes, answersRes, resultRes, violationsRes] =
    await Promise.all([
      !activeAttempt && allQuestionIds.length > 0
        ? supabase
            .from("question_options")
            .select("*")
            .in("question_id", allQuestionIds)
            .order("position", { ascending: true })
        : Promise.resolve({
            data: [] as Array<TableRow<"question_options">>,
            error: null,
          }),
      activeAttempt
        ? supabase.rpc("get_student_exam_payload", {
            p_attempt_id: activeAttempt.id,
          })
        : Promise.resolve({ data: null, error: null }),
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

  let sanitizedQuestions: Array<StudentExamRunnerQuestion> = [];

  // Active in-progress attempt: use server-randomized RPC payload with zero `is_correct` exposure
  if (activeAttempt && Array.isArray(activePayloadRes.data)) {
    const rpcQuestions = activePayloadRes.data as Array<{
      id: string;
      question_type: TableRow<"questions">["question_type"];
      difficulty: TableRow<"questions">["difficulty"];
      prompt: string;
      points: number;
      position: number;
      media_url: string | null;
      options: Array<{
        id: string;
        option_text: string;
        position: number;
      }>;
    }>;

    sanitizedQuestions = rpcQuestions.map((q, index) => ({
      id: q.id,
      questionType: q.question_type,
      difficulty: q.difficulty,
      prompt: q.prompt,
      points: Number(q.points),
      position: index + 1,
      mediaUrl: q.media_url,
      explanation: null,
      options: (q.options ?? []).map((o) => ({
        id: o.id,
        optionText: o.option_text,
        position: o.position,
      })),
    }));
  } else {
    const assignedIds = targetAttempt?.assigned_question_ids ?? [];
    const orderedRawQuestions =
      assignedIds.length > 0
        ? assignedIds
            .map((id) => allQuestions.find((q) => q.id === id))
            .filter((q): q is NonNullable<typeof q> => Boolean(q))
        : allQuestions;

    const allOptions = optionsRes.data ?? [];
    sanitizedQuestions = orderedRawQuestions.map((q, index) => {
      const qOpts = allOptions
        .filter((o) => o.question_id === q.id)
        .map((o) => ({
          id: o.id,
          optionText: o.option_text,
          position: o.position,
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
  }

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


// -----------------------------------------------------------------------------
// 6. STUDENT ASSIGNMENTS WORKSPACE DATA
// -----------------------------------------------------------------------------
export interface StudentAssignmentMaterialView {
  id: string;
  storageBucket: string;
  storagePath: string;
  fileName: string;
  mimeType: string | null;
  fileSizeBytes: number | null;
  signedUrl: string | null;
}

export interface StudentAssignmentItem {
  id: string;
  courseId: string;
  courseCode: string;
  courseTitle: string;
  teacherId: string;
  teacherName: string;
  title: string;
  description: string;
  instructions: string | null;
  submissionTypes: string[];
  maxPoints: number;
  dueAt: string | null;
  allowLateSubmissions: boolean;
  teacherAttachmentName: string | null;
  teacherAttachmentUrl: string | null;
  materials: StudentAssignmentMaterialView[];
  submission: {
    id: string;
    status: "draft" | "submitted" | "under_review" | "graded" | "returned" | "late";
    submissionText: string | null;
    attachmentPath: string | null;
    attachmentFileName: string | null;
    attachmentMimeType: string | null;
    attachmentSignedUrl: string | null;
    submittedAt: string;
    isGradePublished: boolean;
    publishedPoints: number | null;
    publishedFeedback: string | null;
    gradedAt: string | null;
    versionCount: number;
  } | null;
}

export interface StudentAssignmentsWorkspaceData {
  studentId: string;
  enrolledCourses: Array<{ id: string; code: string; title: string }>;
  assignments: StudentAssignmentItem[];
}

export async function getStudentAssignmentsData(): Promise<
  ServiceResult<StudentAssignmentsWorkspaceData>
> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const studentId = auth.data.userId;

  const { data: enrollments, error: enrErr } = await supabase
    .from("course_enrollments")
    .select("course_id")
    .eq("student_id", studentId);

  if (enrErr) return { ok: false, error: enrErr.message };

  const courseIds = (enrollments ?? []).map((e) => e.course_id);
  if (courseIds.length === 0) {
    return {
      ok: true,
      data: { studentId, enrolledCourses: [], assignments: [] },
    };
  }

  const [coursesRes, assignmentsRes, submissionsRes, gradesRes, versionsRes] =
    await Promise.all([
      supabase
        .from("courses")
        .select("id, code, title, teacher_id")
        .in("id", courseIds)
        .is("deleted_at", null),
      supabase
        .from("assignments")
        .select("*")
        .in("course_id", courseIds)
        .eq("is_published", true)
        .order("due_at", { ascending: true }),
      supabase
        .from("assignment_submissions")
        .select("*")
        .eq("student_id", studentId),
      supabase
        .from("assignment_grades")
        .select("*")
        .eq("student_id", studentId)
        .eq("is_published", true),
      supabase
        .from("assignment_submission_versions")
        .select("submission_id")
        .eq("student_id", studentId),
    ]);

  const assignmentIds = (assignmentsRes.data ?? []).map((a) => a.id);
  const materialsRes =
    assignmentIds.length > 0
      ? await supabase
          .from("assignment_materials")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("created_at", { ascending: true })
      : { data: [] as Array<TableRow<"assignment_materials">> };

  const versionCountMap = new Map<string, number>();
  for (const v of versionsRes.data ?? []) {
    versionCountMap.set(
      v.submission_id,
      (versionCountMap.get(v.submission_id) ?? 0) + 1,
    );
  }

  const courses = coursesRes.data ?? [];
  const teacherIds = Array.from(new Set(courses.map((c) => c.teacher_id)));
  const { data: teacherProfiles } =
    teacherIds.length > 0
      ? await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", teacherIds)
      : { data: [] as Array<{ id: string; full_name: string | null; email: string }> };

  const teacherMap = new Map(
    (teacherProfiles ?? []).map((p) => [p.id, p.full_name || p.email]),
  );
  const courseMap = new Map(courses.map((c) => [c.id, c]));
  const subByAsgMap = new Map(
    (submissionsRes.data ?? []).map((s) => [s.assignment_id, s]),
  );
  const gradeBySubMap = new Map(
    (gradesRes.data ?? []).map((g) => [g.submission_id, g]),
  );

  // Batch-sign teacher assignment attachments, materials & student submission files
  const allPaths = Array.from(
    new Set(
      [
        ...(assignmentsRes.data ?? []).map((a) => a.attachment_storage_path),
        ...(materialsRes.data ?? [])
          .filter((m) => m.storage_bucket === "assignment-attachments")
          .map((m) => m.storage_path),
        ...(submissionsRes.data ?? []).map((s) => s.attachment_storage_path),
      ].filter((p): p is string => Boolean(p)),
    ),
  );
  const signedMap = new Map<string, string>();
  if (allPaths.length > 0) {
    const { data: signed } = await supabase.storage
      .from("assignment-attachments")
      .createSignedUrls(allPaths, 3600);
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) {
        signedMap.set(s.path, s.signedUrl);
      }
    }
  }

  const items: StudentAssignmentItem[] = (assignmentsRes.data ?? [])
    .map((asg) => {
      const course = courseMap.get(asg.course_id);
      if (!course) return null;
      const sub = subByAsgMap.get(asg.id) ?? null;
      const pubGrade = sub ? gradeBySubMap.get(sub.id) ?? null : null;
      const isGradePublished = Boolean(
        pubGrade?.is_published || sub?.is_grade_published,
      );

      let displayStatus: NonNullable<StudentAssignmentItem["submission"]>["status"] =
        (sub?.status as NonNullable<
          StudentAssignmentItem["submission"]
        >["status"]) ?? "submitted";
      if (sub) {
        if (isGradePublished) {
          displayStatus = "graded";
        } else if (sub.status === "graded" && !isGradePublished) {
          displayStatus = "under_review";
        }
      }

      const rawMats = (materialsRes.data ?? []).filter(
        (m) => m.assignment_id === asg.id,
      );
      const materials: StudentAssignmentMaterialView[] = rawMats.map((m) => ({
        id: m.id,
        storageBucket: m.storage_bucket,
        storagePath: m.storage_path,
        fileName: m.file_name,
        mimeType: m.mime_type,
        fileSizeBytes: m.file_size_bytes,
        signedUrl: signedMap.get(m.storage_path) ?? null,
      }));

      if (
        asg.attachment_storage_path &&
        !materials.some((m) => m.storagePath === asg.attachment_storage_path)
      ) {
        materials.unshift({
          id: `legacy-${asg.id}`,
          storageBucket: "assignment-attachments",
          storagePath: asg.attachment_storage_path,
          fileName:
            asg.attachment_file_name ||
            asg.attachment_storage_path.split("/").pop() ||
            "Attachment",
          mimeType: null,
          fileSizeBytes: null,
          signedUrl: signedMap.get(asg.attachment_storage_path) ?? null,
        });
      }

      return {
        id: asg.id,
        courseId: course.id,
        courseCode: course.code,
        courseTitle: course.title,
        teacherId: course.teacher_id,
        teacherName: teacherMap.get(course.teacher_id) || "Instructor",
        title: asg.title,
        description: asg.description,
        instructions: asg.instructions,
        submissionTypes:
          asg.submission_types && asg.submission_types.length > 0
            ? asg.submission_types
            : ["text", "file"],
        maxPoints: Number(asg.max_points ?? 100),
        dueAt: asg.due_at,
        allowLateSubmissions: asg.allow_late_submissions,
        teacherAttachmentName:
          asg.attachment_file_name ||
          (asg.attachment_storage_path
            ? asg.attachment_storage_path.split("/").pop() ?? "Attachment"
            : null),
        teacherAttachmentUrl: asg.attachment_storage_path
          ? signedMap.get(asg.attachment_storage_path) ?? null
          : null,
        materials,
        submission: sub
          ? {
              id: sub.id,
              status: displayStatus,
              submissionText: sub.submission_text,
              attachmentPath: sub.attachment_storage_path,
              attachmentFileName:
                sub.attachment_file_name ||
                (sub.attachment_storage_path
                  ? sub.attachment_storage_path.split("/").pop() ?? "File"
                  : null),
              attachmentMimeType: sub.attachment_mime_type,
              attachmentSignedUrl: sub.attachment_storage_path
                ? signedMap.get(sub.attachment_storage_path) ?? null
                : null,
              submittedAt: sub.submitted_at,
              isGradePublished,
              // Strictly prevent unpublished grade exposure
              publishedPoints: isGradePublished
                ? Number(pubGrade?.teacher_points ?? sub.grade_points ?? 0)
                : null,
              publishedFeedback: isGradePublished
                ? pubGrade?.teacher_feedback ?? sub.feedback ?? null
                : null,
              gradedAt: isGradePublished
                ? pubGrade?.published_at ?? sub.graded_at ?? null
                : null,
              versionCount:
                (versionCountMap.get(sub.id) ?? 0) +
                (sub.attachment_storage_path ? 1 : 0),
            }
          : null,
      };
    })
    .filter((i): i is NonNullable<typeof i> => i !== null);

  return {
    ok: true,
    data: {
      studentId,
      enrolledCourses: courses.map((c) => ({
        id: c.id,
        code: c.code,
        title: c.title,
      })),
      assignments: items,
    },
  };
}
