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
    profilesRes,
    coursesRes,
    teacherReqsRes,
    examsCountRes,
    enrollmentsRes,
    auditCountRes,
    recentAuditRes,
  ] = await Promise.all([
    supabase.from("profiles").select("role, status"),
    supabase.from("courses").select("status"),
    supabase
      .from("teacher_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase.from("exams").select("id", { count: "exact", head: true }),
    supabase.from("course_enrollments").select("status, progress_percent"),
    supabase.from("audit_logs").select("id", { count: "exact", head: true }),
    supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };
  if (coursesRes.error) return { ok: false, error: coursesRes.error.message };
  if (teacherReqsRes.error) return { ok: false, error: teacherReqsRes.error.message };
  if (examsCountRes.error) return { ok: false, error: examsCountRes.error.message };
  if (enrollmentsRes.error) return { ok: false, error: enrollmentsRes.error.message };
  if (auditCountRes.error) return { ok: false, error: auditCountRes.error.message };

  const profiles = profilesRes.data ?? [];
  const courses = coursesRes.data ?? [];
  const enrollments = enrollmentsRes.data ?? [];

  const totalStudents = profiles.filter((p) => p.role === "student").length;
  const totalTeachers = profiles.filter((p) => p.role === "teacher").length;
  const totalAdmins = profiles.filter((p) => p.role === "admin").length;
  const activeUsers = profiles.filter((p) => p.status === "active").length;
  const suspendedUsers = profiles.filter((p) => p.status === "suspended").length;

  const totalCourses = courses.length;
  const publishedCourses = courses.filter((c) => c.status === "published").length;
  const draftCourses = courses.filter((c) => c.status === "draft").length;

  const totalEnrollments = enrollments.length;
  const completedEnrollments = enrollments.filter((e) => e.status === "completed").length;
  const activeEnrollments = enrollments.filter((e) => e.status === "active").length;
  const droppedEnrollments = enrollments.filter((e) => e.status === "dropped").length;

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
  teachers: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email">>;
  departments: Array<TableRow<"departments">>;
}

export async function getAdminCoursesData(): Promise<ServiceResult<AdminCoursesData>> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [coursesRes, profilesRes, enrollmentsRes, reviewsRes, deptsRes] = await Promise.all([
    supabase.from("courses").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email, role"),
    supabase.from("course_enrollments").select("course_id"),
    supabase.from("course_reviews").select("course_id, rating"),
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

  const courses: AdminCourseManagementItem[] = (coursesRes.data ?? []).map((course) => {
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

  const teachers = (profilesRes.data ?? []).filter(
    (p) => p.role === "teacher" || p.role === "admin",
  );

  return {
    ok: true,
    data: {
      courses,
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
    supabase.from("courses").select("id, title, code").order("title", { ascending: true }),
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
  courses: Array<Pick<TableRow<"courses">, "id" | "title" | "code" | "category" | "teacher_id" | "class_id">>;
  enrollments: Array<TableRow<"course_enrollments">>;
  classes: Array<Pick<TableRow<"classes">, "id" | "name" | "code">>;
  teacherReviews: Array<TableRow<"teacher_reviews">>;
  courseReviews: Array<TableRow<"course_reviews">>;
  profiles: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email" | "role">>;
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
    classesRes,
    tReviewsRes,
    cReviewsRes,
    profilesRes,
  ] = await Promise.all([
    supabase.from("results").select("*").order("graded_at", { ascending: false }),
    supabase.from("exams").select("id, title, course_id, passing_score"),
    supabase
      .from("courses")
      .select("id, title, code, category, teacher_id, class_id"),
    supabase.from("course_enrollments").select("*"),
    supabase.from("classes").select("id, name, code"),
    supabase.from("teacher_reviews").select("*"),
    supabase.from("course_reviews").select("*"),
    supabase.from("profiles").select("id, full_name, email, role"),
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
      classes: classesRes.data ?? [],
      teacherReviews: tReviewsRes.data ?? [],
      courseReviews: cReviewsRes.data ?? [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminSecurityControlData {
  auditLogs: Array<TableRow<"audit_logs">>;
  devices: Array<TableRow<"user_devices">>;
  roles: Array<TableRow<"roles">>;
  permissions: Array<TableRow<"permissions">>;
  rolePermissions: Array<TableRow<"role_permissions">>;
  profiles: Array<Pick<TableRow<"profiles">, "id" | "full_name" | "email" | "role" | "status">>;
}

export async function getAdminSecurityControlData(): Promise<
  ServiceResult<AdminSecurityControlData>
> {
  const adminCheck = await requireRole(["admin"]);
  if (!adminCheck.ok) return adminCheck;

  const supabase = await createSupabaseServerClient();

  const [auditRes, devicesRes, rolesRes, permsRes, rolePermsRes, profilesRes] =
    await Promise.all([
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
      supabase.from("profiles").select("id, full_name, email, role, status"),
    ]);

  if (auditRes.error) return { ok: false, error: auditRes.error.message };
  if (devicesRes.error) return { ok: false, error: devicesRes.error.message };
  if (rolesRes.error) return { ok: false, error: rolesRes.error.message };
  if (permsRes.error) return { ok: false, error: permsRes.error.message };
  if (rolePermsRes.error) return { ok: false, error: rolePermsRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  return {
    ok: true,
    data: {
      auditLogs: auditRes.data ?? [],
      devices: devicesRes.data ?? [],
      roles: rolesRes.data ?? [],
      permissions: permsRes.data ?? [],
      rolePermissions: rolePermsRes.data ?? [],
      profiles: profilesRes.data ?? [],
    },
  };
}

export interface AdminNotificationsData {
  notifications: Array<TableRow<"notifications">>;
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

  const [notifsRes, deptsRes, classesRes, profilesRes] = await Promise.all([
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("departments").select("id, name, code").order("name", { ascending: true }),
    supabase.from("classes").select("id, name, code").order("code", { ascending: true }),
    supabase.from("profiles").select("id, full_name, email, role"),
  ]);

  if (notifsRes.error) return { ok: false, error: notifsRes.error.message };
  if (deptsRes.error) return { ok: false, error: deptsRes.error.message };
  if (classesRes.error) return { ok: false, error: classesRes.error.message };
  if (profilesRes.error) return { ok: false, error: profilesRes.error.message };

  return {
    ok: true,
    data: {
      notifications: notifsRes.data ?? [],
      departments: deptsRes.data ?? [],
      classes: classesRes.data ?? [],
      profiles: profilesRes.data ?? [],
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
