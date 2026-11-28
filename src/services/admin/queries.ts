import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export interface AdminOverviewData {
  totalStudents: number;
  totalTeachers: number;
  totalAdmins: number;
  totalCourses: number;
  publishedCourses: number;
  draftCourses: number;
  activeUsers: number;
  suspendedUsers: number;
  pendingTeacherRequests: number;
  totalExaminations: number;
  totalAssignments: number;
  totalReviews: number;
  totalEnrollments: number;
  completedEnrollments: number;
  activeEnrollments: number;
  droppedEnrollments: number;
  completionRatePercent: number;
  platformActivityCount: number;
  recentAuditLogs: Array<TableRow<"audit_logs">>;
}

export async function getAdminOverviewData(): Promise<ServiceResult<AdminOverviewData>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [
    studentsCountRes,
    teachersCountRes,
    adminsCountRes,
    activeUsersCountRes,
    suspendedUsersCountRes,
    publishedCoursesCountRes,
    draftCoursesCountRes,
    archivedCoursesCountRes,
    teacherReqsRes,
    examsCountRes,
    assignmentsCountRes,
    courseReviewsCountRes,
    teacherReviewsCountRes,
    completedEnrCountRes,
    activeEnrCountRes,
    droppedEnrCountRes,
    auditCountRes,
    recentAuditRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "student"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "teacher"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("status", "suspended"),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "published"),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "draft"),
    supabase
      .from("courses")
      .select("id", { count: "exact", head: true })
      .is("deleted_at", null)
      .eq("status", "archived"),
    supabase
      .from("teacher_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("assignments").select("id", { count: "exact", head: true }),
    supabase.from("course_reviews").select("id", { count: "exact", head: true }),
    supabase.from("teacher_reviews").select("id", { count: "exact", head: true }),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "active"),
    supabase
      .from("course_enrollments")
      .select("id", { count: "exact", head: true })
      .eq("status", "dropped"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (studentsCountRes.error) return { ok: false, error: studentsCountRes.error.message };
  if (publishedCoursesCountRes.error) return { ok: false, error: publishedCoursesCountRes.error.message };
  if (teacherReqsRes.error) return { ok: false, error: teacherReqsRes.error.message };
  if (examsCountRes.error) return { ok: false, error: examsCountRes.error.message };
  if (completedEnrCountRes.error) return { ok: false, error: completedEnrCountRes.error.message };
  if (auditCountRes.error) return { ok: false, error: auditCountRes.error.message };

  const totalStudents = studentsCountRes.count ?? 0;
  const totalTeachers = teachersCountRes.count ?? 0;
  const totalAdmins = adminsCountRes.count ?? 0;
  const activeUsers = activeUsersCountRes.count ?? 0;
  const suspendedUsers = suspendedUsersCountRes.count ?? 0;

  const publishedCourses = publishedCoursesCountRes.count ?? 0;
  const draftCourses = draftCoursesCountRes.count ?? 0;
  const archivedCourses = archivedCoursesCountRes.count ?? 0;
  const totalCourses = publishedCourses + draftCourses + archivedCourses;

  const completedEnrollments = completedEnrCountRes.count ?? 0;
  const activeEnrollments = activeEnrCountRes.count ?? 0;
  const droppedEnrollments = droppedEnrCountRes.count ?? 0;
  const totalEnrollments = completedEnrollments + activeEnrollments + droppedEnrollments;

  const totalReviews =
    (courseReviewsCountRes.count ?? 0) + (teacherReviewsCountRes.count ?? 0);

  const completionRatePercent =
    totalEnrollments > 0
      ? Number(((completedEnrollments / totalEnrollments) * 100).toFixed(1))
      : 0;

  return {
    ok: true,
    data: {
      totalStudents,
      totalTeachers,
      totalAdmins,
      totalCourses,
      publishedCourses,
      draftCourses,
      activeUsers,
      suspendedUsers,
      pendingTeacherRequests: teacherReqsRes.count ?? 0,
      totalExaminations: examsCountRes.count ?? 0,
      totalAssignments: assignmentsCountRes.count ?? 0,
      totalReviews,
      totalEnrollments,
      completedEnrollments,
      activeEnrollments,
      droppedEnrollments,
      completionRatePercent,
      platformActivityCount: auditCountRes.count ?? 0,
      recentAuditLogs: recentAuditRes.data ?? [],
    },
  };
}

export interface AdminUsersManagementData {
  currentAdminId: string;
  profiles: Array<TableRow<"profiles">>;
  teacherRequests: Array<TableRow<"teacher_requests">>;
  permissions: Array<TableRow<"permissions">>;
  userPermissions: Array<TableRow<"user_permissions">>;
  departments: Array<TableRow<"departments">>;
  educationalLevels: Array<TableRow<"educational_levels">>;
  recentAuditLogs: Array<TableRow<"audit_logs">>;
}

export async function getAdminUsersManagementData(): Promise<
  ServiceResult<AdminUsersManagementData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [
    profilesRes,
    requestsRes,
    permissionsRes,
    userPermsRes,
    deptsRes,
    levelsRes,
    auditRes,
  ] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: false }),
    supabase
      .from("teacher_requests")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("permissions").select("*").order("code", { ascending: true }),
    supabase.from("user_permissions").select("*"),
    supabase.from("departments").select("*").order("name", { ascending: true }),
    supabase
      .from("educational_levels")
      .select("*")
      .order("rank_order", { ascending: true }),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };
  if (requestsRes.error) return { ok: false, error: requestsRes.error.message };
  if (permissionsRes.error) return { ok: false, error: permissionsRes.error.message };
  if (userPermsRes.error) return { ok: false, error: userPermsRes.error.message };
  if (deptsRes.error) return { ok: false, error: deptsRes.error.message };
  if (levelsRes.error) return { ok: false, error: levelsRes.error.message };

  return {
    ok: true,
    data: {
      currentAdminId: adminCheck.data.userId,
      profiles: profilesRes.data ?? [],
      teacherRequests: requestsRes.data ?? [],
      permissions: permissionsRes.data ?? [],
      userPermissions: userPermsRes.data ?? [],
      departments: deptsRes.data ?? [],
      educationalLevels: levelsRes.data ?? [],
      recentAuditLogs: auditRes.data ?? [],
    },
  };
}

export interface AdminDepartmentsData {
  departments: Array<TableRow<"departments">>;
  educationalLevels: Array<TableRow<"educational_levels">>;
  classes: Array<TableRow<"classes">>;
  assignments: Array<TableRow<"student_teacher_assignments">>;
  teachers: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email">>;
  students: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email">>;
}

export async function getAdminDepartmentsData(): Promise<ServiceResult<AdminDepartmentsData>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [deptsRes, levelsRes, classesRes, assignRes, profilesRes] = await Promise.all([
    supabase.from("departments").select("*").order("name", { ascending: true }),
    supabase
      .from("educational_levels")
      .select("*")
      .order("rank_order", { ascending: true }),
    supabase.from("classes").select("*").order("code", { ascending: true }),
    supabase
      .from("student_teacher_assignments")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, role"),
  ]);

  if (deptsRes.error) return { ok: false, error: deptsRes.error.message };
  if (levelsRes.error) return { ok: false, error: levelsRes.error.message };
  if (classesRes.error) return { ok: false, error: classesRes.error.message };
  if (assignRes.error) return { ok: false, error: assignRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  const allProfiles = profilesRes.data ?? [];
  const teachers = allProfiles.filter((p) => p.role === "teacher");
  const students = allProfiles.filter((p) => p.role === "student");

  return {
    ok: true,
    data: {
      departments: deptsRes.data ?? [],
      educationalLevels: levelsRes.data ?? [],
      classes: classesRes.data ?? [],
      assignments: assignRes.data ?? [],
      teachers,
      students,
    },
  };
}

export interface AdminCategoryItem {
  category: TableRow<"categories">;
  coursesCount: number;
}

export interface AdminCourseManagementItem {
  course: TableRow<"courses">;
  teacherName: string;
  teacherEmail: string;
  enrollmentsCount: number;
  averageRating: number | null;
  reviewsCount: number;
}

export interface AdminCoursesData {
  courses: AdminCourseManagementItem[];
  categories: AdminCategoryItem[];
  teachers: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email">>;
  departments: Array<TableRow<"departments">>;
}

export async function getAdminCoursesData(): Promise<ServiceResult<AdminCoursesData>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [coursesRes, categoriesRes, profilesRes, enrollmentsRes, reviewsRes, deptsRes] =
    await Promise.all([
      supabase.from("courses").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name", { ascending: true }),
      supabase.from("profiles").select("id, full_name, email, role"),
      supabase.from("course_enrollments").select("course_id"),
      supabase
        .from("course_reviews")
        .select("course_id, rating")
        .eq("moderation_status", "approved"),
      supabase.from("departments").select("*").order("name", { ascending: true }),
    ]);

  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };
  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (reviewsRes.error) return { ok: false, error: reviewsRes.error.message };
  if (deptsRes.error) return { ok: false, error: deptsRes.error.message };

  const profilesMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p]),
  );

  const enrollmentCounts = new Map<string, number>();
  for (const e of enrollmentsRes.data ?? []) {
    enrollmentCounts.set(e.course_id, (enrollmentCounts.get(e.course_id) ?? 0) + 1);
  }

  const ratingsAgg = new Map<string, { sum: number; count: number }>();
  for (const r of reviewsRes.data ?? []) {
    const curr = ratingsAgg.get(r.course_id) ?? { sum: 0, count: 0 };
    curr.sum += r.rating;
    curr.count += 1;
    ratingsAgg.set(r.course_id, curr);
  }

  const allCourses = coursesRes.data ?? [];

  const courses: AdminCourseManagementItem[] = allCourses.map((course) => {
    const teacher = profilesMap.get(course.teacher_id);
    const ratingInfo = ratingsAgg.get(course.id);
    return {
      course,
      teacherName: teacher?.full_name || teacher?.email || "Instructor",
      teacherEmail: teacher?.email || "",
      enrollmentsCount: enrollmentCounts.get(course.id) ?? 0,
      averageRating:
        ratingInfo && ratingInfo.count > 0
          ? Number((ratingInfo.sum / ratingInfo.count).toFixed(2))
          : null,
      reviewsCount: ratingInfo?.count ?? 0,
    };
  });

  const categories: AdminCategoryItem[] = (categoriesRes.data ?? []).map((cat) => {
    const coursesCount = allCourses.filter(
      (c) =>
        !c.deleted_at &&
        (c.category_id === cat.id ||
          c.category.toLowerCase() === cat.name.toLowerCase()),
    ).length;
    return {
      category: cat,
      coursesCount,
    };
  });

  const teachers = (profilesRes.data ?? []).filter(
    (p) => p.role === "teacher" || p.role === "admin",
  );

  return {
    ok: true,
    data: {
      courses,
      categories,
      teachers,
      departments: deptsRes.data ?? [],
    },
  };
}

export interface AdminScheduleAndAttendanceData {
  schedules: Array<TableRow<"class_schedules">>;
  attendanceSessions: Array<TableRow<"attendance">>;
  attendanceRecords: Array<TableRow<"attendance_records">>;
  classes: Array<TableRow<"classes">>;
  courses: Array<Pick<TableRow<"courses">, "id" | "title" | "code">>;
  profiles: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email" | "role">>;
}

export async function getAdminScheduleAndAttendanceData(): Promise<
  ServiceResult<AdminScheduleAndAttendanceData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [schedRes, attRes, recRes, classesRes, coursesRes, profilesRes] = await Promise.all([
    supabase
      .from("class_schedules")
      .select("*")
      .order("day_of_week", { ascending: true })
      .order("start_time", { ascending: true }),
    supabase.from("attendance").select("*").order("session_date", { ascending: false }),
    supabase
      .from("attendance_records")
      .select("*")
      .order("recorded_at", { ascending: false }),
    supabase.from("classes").select("*").order("code", { ascending: true }),
    supabase
      .from("courses")
      .select("id, title, code")
      .is("deleted_at", null)
      .order("title", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email, role"),
  ]);

  if (schedRes.error) return { ok: false, error: schedRes.error.message };
  if (attRes.error) return { ok: false, error: attRes.error.message };
  if (recRes.error) return { ok: false, error: recRes.error.message };
  if (classesRes.error) return { ok: false, error: classesRes.error.message };
  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  return {
    ok: true,
    data: {
      schedules: schedRes.data ?? [],
      attendanceSessions: attRes.data ?? [],
      attendanceRecords: recRes.data ?? [],
      classes: classesRes.data ?? [],
      courses: coursesRes.data ?? [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminAnalyticsReportData {
  results: Array<TableRow<"results">>;
  exams: Array<Pick<TableRow<"exams">, "id" | "title" | "course_id" | "passing_score">>;
  courses: Array<
    Pick<
      TableRow<"courses">,
      "id" | "title" | "code" | "category" | "teacher_id" | "class_id" | "status"
    >
  >;
  enrollments: Array<TableRow<"course_enrollments">>;
  assignments: Array<Pick<TableRow<"assignments">, "id" | "title" | "course_id" | "max_points">>;
  assignmentSubmissions: Array<
    Pick<
      TableRow<"assignment_submissions">,
      "id" | "assignment_id" | "student_id" | "grade_points" | "status" | "submitted_at"
    >
  >;
  classes: Array<Pick<TableRow<"classes">, "id" | "name" | "code">>;
  teacherReviews: Array<TableRow<"teacher_reviews">>;
  courseReviews: Array<TableRow<"course_reviews">>;
  profiles: Array<
    Pick<TableRow<"profiles">, "id" | "full_name" | "email" | "role" | "status" | "created_at">
  >;
}

export async function getAdminAnalyticsReportData(): Promise<
  ServiceResult<AdminAnalyticsReportData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [
    resultsRes,
    examsRes,
    coursesRes,
    enrollmentsRes,
    assignmentsRes,
    assignmentSubsRes,
    classesRes,
    tReviewsRes,
    cReviewsRes,
    profilesRes,
  ] = await Promise.all([
    supabase.from("results").select("*").order("graded_at", { ascending: false }),
    supabase.from("exams").select("id, title, course_id, passing_score"),
    supabase
      .from("courses")
      .select("id, title, code, category, teacher_id, class_id, status")
      .is("deleted_at", null),
    supabase.from("course_enrollments").select("*"),
    supabase.from("assignments").select("id, title, course_id, max_points"),
    supabase
      .from("assignment_submissions")
      .select("id, assignment_id, student_id, grade_points, status, submitted_at")
      .neq("status", "draft"),
    supabase.from("classes").select("id, name, code"),
    supabase.from("teacher_reviews").select("*").eq("moderation_status", "approved"),
    supabase.from("course_reviews").select("*").eq("moderation_status", "approved"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, status, created_at")
      .order("created_at", { ascending: false }),
  ]);

  if (resultsRes.error) return { ok: false, error: resultsRes.error.message };
  if (examsRes.error) return { ok: false, error: examsRes.error.message };
  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (classesRes.error) return { ok: false, error: classesRes.error.message };
  if (tReviewsRes.error) return { ok: false, error: tReviewsRes.error.message };
  if (cReviewsRes.error) return { ok: false, error: cReviewsRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  return {
    ok: true,
    data: {
      results: resultsRes.data ?? [],
      exams: examsRes.data ?? [],
      courses: coursesRes.data ?? [],
      enrollments: enrollmentsRes.data ?? [],
      assignments: assignmentsRes.data ?? [],
      assignmentSubmissions: assignmentSubsRes.data ?? [],
      classes: classesRes.data ?? [],
      teacherReviews: tReviewsRes.data ?? [],
      courseReviews: cReviewsRes.data ?? [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminSecurityControlData {
  securityEvents: Array<TableRow<"security_events">>;
  examViolations: Array<
    TableRow<"exam_violations"> & {
      studentName: string;
      studentEmail: string;
    }
  >;
  auditLogs: Array<TableRow<"audit_logs">>;
  devices: Array<TableRow<"user_devices">>;
  roles: Array<TableRow<"roles">>;
  permissions: Array<TableRow<"permissions">>;
  rolePermissions: Array<TableRow<"role_permissions">>;
  profiles: Array<
    Pick<
      TableRow<"profiles">,
      "id" | "full_name" | "email" | "role" | "status" | "suspension_reason" | "suspended_at"
    >
  >;
}

export async function getAdminSecurityControlData(): Promise<
  ServiceResult<AdminSecurityControlData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [
    secEventsRes,
    violationsRes,
    auditRes,
    devicesRes,
    rolesRes,
    permsRes,
    rolePermsRes,
    profilesRes,
  ] = await Promise.all([
    supabase
      .from("security_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("exam_violations")
      .select("*")
      .order("occurred_at", { ascending: false })
      .limit(150),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("user_devices")
      .select("*")
      .order("last_active_at", { ascending: false }),
    supabase.from("roles").select("*").order("code", { ascending: true }),
    supabase.from("permissions").select("*").order("code", { ascending: true }),
    supabase.from("role_permissions").select("*"),
    supabase
      .from("profiles")
      .select("id, full_name, email, role, status, suspension_reason, suspended_at")
      .order("created_at", { ascending: false }),
  ]);

  if (auditRes.error) return { ok: false, error: auditRes.error.message };
  if (devicesRes.error) return { ok: false, error: devicesRes.error.message };
  if (rolesRes.error) return { ok: false, error: rolesRes.error.message };
  if (permsRes.error) return { ok: false, error: permsRes.error.message };
  if (rolePermsRes.error) return { ok: false, error: rolePermsRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
  const examViolations = (violationsRes.data ?? []).map((v) => {
    const stu = profilesMap.get(v.student_id);
    return {
      ...v,
      studentName: stu?.full_name || stu?.email || "Student",
      studentEmail: stu?.email || "",
    };
  });

  return {
    ok: true,
    data: {
      securityEvents: secEventsRes.data ?? [],
      examViolations,
      auditLogs: auditRes.data ?? [],
      devices: devicesRes.data ?? [],
      roles: rolesRes.data ?? [],
      permissions: permsRes.data ?? [],
      rolePermissions: rolePermsRes.data ?? [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminNotificationHistoryRow extends TableRow<"notifications"> {
  deliveredCount: number;
  readCount: number;
}

export interface AdminNotificationsData {
  notifications: Array<AdminNotificationHistoryRow>;
  contactMessages: Array<TableRow<"contact_messages">>;
  departments: Array<Pick<TableRow<"departments">, "id" | "name" | "code">>;
  classes: Array<Pick<TableRow<"classes">, "id" | "name" | "code">>;
  profiles: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email" | "role">>;
}

export async function getAdminNotificationsData(): Promise<
  ServiceResult<AdminNotificationsData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [notifsRes, contactsRes, profilesRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .eq("sender_id", adminCheck.data.userId)
      .eq("is_announcement", true)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("contact_messages")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("profiles").select("id, full_name, email, role"),
  ]);

  if (notifsRes.error) return { ok: false, error: notifsRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  const notifList = notifsRes.data ?? [];
  const notifIds = notifList.map((n) => n.id);

  const recipientsRes =
    notifIds.length > 0
      ? await supabase
          .from("notification_recipients")
          .select("notification_id, is_read")
          .in("notification_id", notifIds)
      : { data: [] as Array<{ notification_id: string; is_read: boolean }> };

  const statsMap = new Map<string, { delivered: number; read: number }>();
  for (const row of recipientsRes.data ?? []) {
    const curr = statsMap.get(row.notification_id) ?? { delivered: 0, read: 0 };
    curr.delivered += 1;
    if (row.is_read) curr.read += 1;
    statsMap.set(row.notification_id, curr);
  }

  const notifications: Array<AdminNotificationHistoryRow> = notifList.map((n) => {
    const st = statsMap.get(n.id) ?? { delivered: 0, read: 0 };
    return {
      ...n,
      deliveredCount: st.delivered,
      readCount: st.read,
    };
  });

  return {
    ok: true,
    data: {
      notifications,
      contactMessages: contactsRes.data ?? [],
      departments: [],
      classes: [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminModeratedReviewItem {
  id: string;
  reviewType: "course" | "teacher";
  courseId: string | null;
  courseTitle: string;
  teacherId: string | null;
  teacherName: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  rating: number;
  comment: string | null;
  improvementSuggestions: string | null;
  moderationStatus: string;
  moderationReason: string | null;
  isPublished: boolean;
  createdAt: string;
}

export interface AdminReviewsModerationData {
  reviews: Array<AdminModeratedReviewItem>;
  courses: Array<{ id: string; title: string; code: string }>;
  teachers: Array<{ id: string; name: string }>;
}

export async function getAdminReviewsModerationData(): Promise<
  ServiceResult<AdminReviewsModerationData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [courseReviewsRes, teacherReviewsRes, coursesRes, profilesRes] =
    await Promise.all([
      supabase
        .from("course_reviews")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("teacher_reviews")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase.from("courses").select("id, title, code, teacher_id"),
      supabase.from("profiles").select("id, full_name, email, role"),
    ]);

  if (courseReviewsRes.error) {
    return { ok: false, error: courseReviewsRes.error.message };
  }
  if (teacherReviewsRes.error) {
    return { ok: false, error: teacherReviewsRes.error.message };
  }

  const coursesMap = new Map((coursesRes.data ?? []).map((c) => [c.id, c]));
  const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));

  const combined: Array<AdminModeratedReviewItem> = [
    ...(courseReviewsRes.data ?? []).map((cr) => {
      const course = coursesMap.get(cr.course_id);
      const teacher = course ? profilesMap.get(course.teacher_id) : undefined;
      const student = profilesMap.get(cr.student_id);
      return {
        id: cr.id,
        reviewType: "course" as const,
        courseId: cr.course_id,
        courseTitle: course?.title ?? "Course",
        teacherId: course?.teacher_id ?? null,
        teacherName: teacher?.full_name || teacher?.email || "Instructor",
        studentId: cr.student_id,
        studentName: student?.full_name || student?.email || "Student",
        studentEmail: student?.email || "",
        rating: cr.rating,
        comment: cr.comment,
        improvementSuggestions: cr.improvement_suggestions,
        moderationStatus: cr.moderation_status,
        moderationReason: cr.moderation_reason,
        isPublished: cr.is_published,
        createdAt: cr.created_at,
      };
    }),
    ...(teacherReviewsRes.data ?? []).map((tr) => {
      const course = tr.course_id ? coursesMap.get(tr.course_id) : undefined;
      const teacher = profilesMap.get(tr.teacher_id);
      const student = profilesMap.get(tr.student_id);
      return {
        id: tr.id,
        reviewType: "teacher" as const,
        courseId: tr.course_id,
        courseTitle: course?.title ?? "General",
        teacherId: tr.teacher_id,
        teacherName: teacher?.full_name || teacher?.email || "Instructor",
        studentId: tr.student_id,
        studentName: student?.full_name || student?.email || "Student",
        studentEmail: student?.email || "",
        rating: tr.rating,
        comment: tr.comment,
        improvementSuggestions: tr.improvement_suggestions,
        moderationStatus: tr.moderation_status,
        moderationReason: tr.moderation_reason,
        isPublished: tr.is_published,
        createdAt: tr.created_at,
      };
    }),
  ].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const courses = (coursesRes.data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    code: c.code,
  }));

  const teachers = (profilesRes.data ?? [])
    .filter((p) => p.role === "teacher")
    .map((t) => ({
      id: t.id,
      name: t.full_name || t.email,
    }));

  return {
    ok: true,
    data: {
      reviews: combined,
      courses,
      teachers,
    },
  };
}

export async function getAdminPlatformSettingsData(): Promise<
  ServiceResult<Array<TableRow<"platform_settings">>>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("platform_settings")
    .select("*")
    .order("key", { ascending: true });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}
