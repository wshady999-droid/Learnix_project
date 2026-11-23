import type { Locale } from "@/lib/preferences";

export interface AdminDictionary {
  nav: {
    groupGovernance: string;
    groupAcademic: string;
    groupOperations: string;
    overview: string;
    users: string;
    departments: string;
    courses: string;
    schedule: string;
    analytics: string;
    security: string;
    notifications: string;
    settings: string;
  };
  common: {
    searchPlaceholder: string;
    allFilter: string;
    active: string;
    suspended: string;
    pending: string;
    approved: string;
    rejected: string;
    published: string;
    draft: string;
    archived: string;
    actions: string;
    confirm: string;
    cancel: string;
    delete: string;
    edit: string;
    create: string;
    save: string;
    exportExcel: string;
    exportPdf: string;
    pageOf: string;
    previous: string;
    next: string;
    noRecordsTitle: string;
    noRecordsDescription: string;
  };
  overview: {
    title: string;
    subtitle: string;
    totalStudents: string;
    totalTeachers: string;
    totalCourses: string;
    activeUsers: string;
    pendingTeacherRequests: string;
    totalExaminations: string;
    completionRate: string;
    platformActivityCount: string;
    activityChartTitle: string;
    activityChartDescription: string;
    completionChartTitle: string;
    completionChartDescription: string;
    recentAuditTitle: string;
    recentAuditDescription: string;
  };
  users: {
    title: string;
    subtitle: string;
    tabUsers: string;
    tabTeacherRequests: string;
    tabBulkImport: string;
    addUserButton: string;
    addUserDialogTitle: string;
    addUserDialogDescription: string;
    fullNameLabel: string;
    emailLabel: string;
    roleLabel: string;
    phoneLabel: string;
    departmentLabel: string;
    levelLabel: string;
    sendPasswordReset: string;
    passwordResetSentToast: string;
    activateAccount: string;
    suspendAccount: string;
    statusUpdatedToast: string;
    roleUpdatedToast: string;
    viewDetailsAndActivity: string;
    activityHistoryTitle: string;
    customPermissionsTitle: string;
    grantPermission: string;
    revokePermission: string;
    permissionUpdatedToast: string;
    teacherRequestApprove: string;
    teacherRequestReject: string;
    teacherRequestReviewedToast: string;
    bulkImportTitle: string;
    bulkImportDescription: string;
    bulkTemplateDownload: string;
    bulkUploadLabel: string;
    bulkValidateButton: string;
    bulkImportValidButton: string;
    bulkValidRowsCount: string;
    bulkIssuesCount: string;
    bulkSuccessToast: string;
    bulkServiceKeyRequiredNote: string;
  };
  departments: {
    title: string;
    subtitle: string;
    tabDepartments: string;
    tabLevels: string;
    tabClasses: string;
    tabAssignments: string;
    createDepartment: string;
    createLevel: string;
    createClass: string;
    createAssignment: string;
    codeLabel: string;
    nameLabel: string;
    descriptionLabel: string;
    headTeacherLabel: string;
    rankOrderLabel: string;
    academicYearLabel: string;
    maxCapacityLabel: string;
    advisorTeacherLabel: string;
    studentLabel: string;
    teacherLabel: string;
    classLabel: string;
    safeDeleteConfirmTitle: string;
    safeDeleteConfirmDescription: string;
    savedToast: string;
    deletedToast: string;
  };
  courses: {
    title: string;
    subtitle: string;
    courseTitleCol: string;
    categoryCol: string;
    teacherCol: string;
    statusCol: string;
    enrollmentsCol: string;
    ratingCol: string;
    approvePublish: string;
    setDraft: string;
    archiveCourse: string;
    assignTeacher: string;
    courseUpdatedToast: string;
  };
  schedule: {
    title: string;
    subtitle: string;
    tabTimetable: string;
    tabAttendance: string;
    addScheduleSlot: string;
    dayOfWeekLabel: string;
    startTimeLabel: string;
    endTimeLabel: string;
    roomLabel: string;
    presentCount: string;
    absentCount: string;
    lateCount: string;
    excusedCount: string;
    absenceRate: string;
    days: readonly string[];
  };
  analytics: {
    title: string;
    subtitle: string;
    studentPerformanceTitle: string;
    classComparisonTitle: string;
    difficultSubjectsTitle: string;
    passFailRateTitle: string;
    teacherPerformanceTitle: string;
    monthlyPerformanceTitle: string;
    coursePopularityTitle: string;
    passedLabel: string;
    failedLabel: string;
    avgScoreLabel: string;
    enrollmentsLabel: string;
  };
  security: {
    title: string;
    subtitle: string;
    tabAuditLogs: string;
    tabLoginAttempts: string;
    tabDevices: string;
    tabRolePermissions: string;
    tabBackups: string;
    actorCol: string;
    actionCol: string;
    entityCol: string;
    ipDeviceCol: string;
    timestampCol: string;
    trustDevice: string;
    untrustDevice: string;
    backupStatusHealthy: string;
    backupPitrTitle: string;
    backupPitrDescription: string;
    backupRlsVerificationTitle: string;
    backupRlsVerificationDescription: string;
  };
  notifications: {
    title: string;
    subtitle: string;
    composeTitle: string;
    audienceLabel: string;
    audienceAllStudents: string;
    audienceAllTeachers: string;
    audienceAllUsers: string;
    audienceDepartment: string;
    audienceClass: string;
    audienceIndividual: string;
    typeLabel: string;
    titleLabel: string;
    bodyLabel: string;
    scheduleForLabel: string;
    isAnnouncementLabel: string;
    sendNotificationButton: string;
    sentSuccessToast: string;
    historyTitle: string;
  };
  settings: {
    title: string;
    subtitle: string;
    platformIdentityTitle: string;
    platformNameLabel: string;
    taglineLabel: string;
    defaultLocaleLabel: string;
    defaultThemeLabel: string;
    securityPolicyTitle: string;
    maxExamViolationsLabel: string;
    requireTeacherApprovalLabel: string;
    allowStudentSelfEnrollmentLabel: string;
    maintenanceModeLabel: string;
    saveSettingsButton: string;
    settingsSavedToast: string;
  };
}

const en: AdminDictionary = {
  nav: {
    groupGovernance: "Governance",
    groupAcademic: "Academic Operations",
    groupOperations: "Security & System",
    overview: "Overview",
    users: "Users & Approvals",
    departments: "Departments & Classes",
    courses: "Courses Catalog",
    schedule: "Schedule & Attendance",
    analytics: "Analytics & Reports",
    security: "Security & Audit",
    notifications: "Notifications",
    settings: "Platform Settings",
  },
  common: {
    searchPlaceholder: "Search records…",
    allFilter: "All",
    active: "Active",
    suspended: "Suspended",
    pending: "Pending",
    approved: "Approved",
    rejected: "Rejected",
    published: "Published",
    draft: "Draft",
    archived: "Archived",
    actions: "Actions",
    confirm: "Confirm",
    cancel: "Cancel",
    delete: "Delete",
    edit: "Edit",
    create: "Create",
    save: "Save Changes",
    exportExcel: "Export Excel (CSV)",
    exportPdf: "Export PDF Report",
    pageOf: "Page",
    previous: "Previous",
    next: "Next",
    noRecordsTitle: "No records found",
    noRecordsDescription:
      "Records from the Supabase database will appear here as soon as they are created.",
  },
  overview: {
    title: "Admin Control Center",
    subtitle: "Live platform metrics, user governance, academic progress, and system telemetry.",
    totalStudents: "Total Students",
    totalTeachers: "Total Teachers",
    totalCourses: "Total Courses",
    activeUsers: "Active Accounts",
    pendingTeacherRequests: "Pending Teacher Approvals",
    totalExaminations: "Total Examinations",
    completionRate: "Course Completion Rate",
    platformActivityCount: "Logged Audit Events",
    activityChartTitle: "Platform Activity & Study Telemetry",
    activityChartDescription: "Real-time distribution of platform accounts and academic resources.",
    completionChartTitle: "Enrollment & Completion Breakdown",
    completionChartDescription: "Live status of student course enrollments across the platform.",
    recentAuditTitle: "Recent Administrative & Security Activity",
    recentAuditDescription: "Latest verified events recorded in public.audit_logs.",
  },
  users: {
    title: "User & Role Management",
    subtitle:
      "Provision accounts, import student cohorts via Excel/CSV, approve teacher requests, and manage granular permissions.",
    tabUsers: "All Users",
    tabTeacherRequests: "Teacher Approvals",
    tabBulkImport: "Excel / CSV Bulk Import",
    addUserButton: "Add User",
    addUserDialogTitle: "Create Platform User Account",
    addUserDialogDescription:
      "Creates a verified account in Supabase Auth and assigns their authoritative profile role.",
    fullNameLabel: "Full Name",
    emailLabel: "Email Address",
    roleLabel: "Assigned Role",
    phoneLabel: "Phone Number",
    departmentLabel: "Department",
    levelLabel: "Educational Level",
    sendPasswordReset: "Send Password Reset Email",
    passwordResetSentToast: "Password reset email dispatched via Supabase Auth.",
    activateAccount: "Activate Account",
    suspendAccount: "Suspend Account",
    statusUpdatedToast: "User account status updated.",
    roleUpdatedToast: "User role updated.",
    viewDetailsAndActivity: "Inspect & Permissions",
    activityHistoryTitle: "Individual Activity History",
    customPermissionsTitle: "Custom Permission Overrides",
    grantPermission: "Grant",
    revokePermission: "Revoke",
    permissionUpdatedToast: "User permission override updated.",
    teacherRequestApprove: "Approve as Teacher",
    teacherRequestReject: "Reject Request",
    teacherRequestReviewedToast: "Teacher application reviewed and updated.",
    bulkImportTitle: "Bulk Student & Teacher Import (Excel / CSV)",
    bulkImportDescription:
      "Upload a spreadsheet (.csv / .txt exported from Excel) with columns: full_name, email, role, phone, department_code, level_code. All rows are validated before import.",
    bulkTemplateDownload: "Download Excel CSV Template",
    bulkUploadLabel: "Select Spreadsheet File (.csv, .tsv) or Paste Rows",
    bulkValidateButton: "Validate Records",
    bulkImportValidButton: "Import Validated Accounts",
    bulkValidRowsCount: "Valid rows ready to import",
    bulkIssuesCount: "Validation errors found",
    bulkSuccessToast: "Bulk user import completed.",
    bulkServiceKeyRequiredNote:
      "Note: Direct Auth account creation without email confirmation requires SUPABASE_SECRET_KEY in .env.local; otherwise standard signup invitations are dispatched.",
  },
  departments: {
    title: "Departments, Levels & Classes",
    subtitle:
      "Manage academic departments, educational levels, student cohorts, and teacher-student assignments.",
    tabDepartments: "Departments",
    tabLevels: "Educational Levels",
    tabClasses: "Classes / Cohorts",
    tabAssignments: "Teacher-Student Assignments",
    createDepartment: "New Department",
    createLevel: "New Educational Level",
    createClass: "New Class",
    createAssignment: "Assign Student to Teacher",
    codeLabel: "Code",
    nameLabel: "Name",
    descriptionLabel: "Description",
    headTeacherLabel: "Head Teacher",
    rankOrderLabel: "Level Order",
    academicYearLabel: "Academic Year",
    maxCapacityLabel: "Max Capacity",
    advisorTeacherLabel: "Advisor Teacher",
    studentLabel: "Student",
    teacherLabel: "Teacher",
    classLabel: "Class Cohort",
    safeDeleteConfirmTitle: "Confirm Safe Deletion",
    safeDeleteConfirmDescription:
      "Are you sure you want to delete this record? Dependent classes or courses referencing it will prevent unsafe deletion.",
    savedToast: "Academic structure record saved.",
    deletedToast: "Record deleted safely.",
  },
  courses: {
    title: "Course Governance & Catalog",
    subtitle:
      "Review all platform courses, approve or archive curricula, reassign instructors, and monitor enrollments and ratings.",
    courseTitleCol: "Course",
    categoryCol: "Category",
    teacherCol: "Instructor",
    statusCol: "Status",
    enrollmentsCol: "Enrollments",
    ratingCol: "Avg Rating",
    approvePublish: "Approve & Publish",
    setDraft: "Move to Draft",
    archiveCourse: "Archive",
    assignTeacher: "Reassign Teacher",
    courseUpdatedToast: "Course governance settings updated.",
  },
  schedule: {
    title: "Schedules & Attendance Monitoring",
    subtitle:
      "Manage weekly class timetables, teacher/student schedules, and monitor attendance and absence metrics.",
    tabTimetable: "Class & Teacher Schedules",
    tabAttendance: "Attendance & Absence Records",
    addScheduleSlot: "Add Timetable Slot",
    dayOfWeekLabel: "Day of Week",
    startTimeLabel: "Start Time",
    endTimeLabel: "End Time",
    roomLabel: "Room / Virtual Link",
    presentCount: "Present",
    absentCount: "Absent",
    lateCount: "Late",
    excusedCount: "Excused",
    absenceRate: "Overall Absence Rate",
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  },
  analytics: {
    title: "Analytics & Executive Reports",
    subtitle:
      "Comprehensive student performance, class comparisons, difficult subject diagnostics, pass/fail rates, teacher performance, and PDF/Excel exports.",
    studentPerformanceTitle: "Student Performance Summary",
    classComparisonTitle: "Department & Class Cohort Comparison",
    difficultSubjectsTitle: "Difficult Subject & Exam Analysis (Lowest Avg Scores)",
    passFailRateTitle: "Examination Pass vs. Failure Distribution",
    teacherPerformanceTitle: "Instructor Performance & Rating Report",
    monthlyPerformanceTitle: "Monthly Enrollment & Exam Activity",
    coursePopularityTitle: "Course Popularity & Completion Analytics",
    passedLabel: "Passed",
    failedLabel: "Failed",
    avgScoreLabel: "Average Score",
    enrollmentsLabel: "Enrollments",
  },
  security: {
    title: "Security, Sessions & Audit Control",
    subtitle:
      "Monitor login attempts, registered user devices, immutable audit logs, role-permission mappings, and database backup posture.",
    tabAuditLogs: "Audit Trail",
    tabLoginAttempts: "Login & Auth Events",
    tabDevices: "Active Devices & Sessions",
    tabRolePermissions: "Role Permissions Matrix",
    tabBackups: "Backup Status & DR Plan",
    actorCol: "Actor",
    actionCol: "Action",
    entityCol: "Entity",
    ipDeviceCol: "Client / IP",
    timestampCol: "Timestamp (UTC)",
    trustDevice: "Mark Trusted",
    untrustDevice: "Revoke Trust",
    backupStatusHealthy: "PostgreSQL 17 WAL Archiving & Daily Snapshots Active",
    backupPitrTitle: "Automated Backups & Point-in-Time Recovery (PITR)",
    backupPitrDescription:
      "Supabase PostgreSQL maintains automated daily backups and transaction log archiving. Schema migrations are tracked deterministically in supabase/migrations/.",
    backupRlsVerificationTitle: "Row-Level Security & Secret Isolation Posture",
    backupRlsVerificationDescription:
      "100% of public tables enforce Row-Level Security (RLS). Sensitive credentials and service_role keys are isolated strictly on the server.",
  },
  notifications: {
    title: "Notification & Announcement Center",
    subtitle:
      "Broadcast targeted notifications or scheduled announcements to all students, all teachers, specific classes, or individual users.",
    composeTitle: "Compose Notification / Announcement",
    audienceLabel: "Target Audience",
    audienceAllStudents: "All Students",
    audienceAllTeachers: "All Teachers",
    audienceAllUsers: "All Platform Users",
    audienceDepartment: "Specific Department",
    audienceClass: "Specific Class Cohort",
    audienceIndividual: "Individual User",
    typeLabel: "Category",
    titleLabel: "Notification Title",
    bodyLabel: "Message Content",
    scheduleForLabel: "Schedule Delivery (Optional UTC/Local Time)",
    isAnnouncementLabel: "Pin as Official Platform Announcement",
    sendNotificationButton: "Dispatch Notification",
    sentSuccessToast: "Notification dispatched to recipients.",
    historyTitle: "Broadcast & Scheduled Notification History",
  },
  settings: {
    title: "Admin Platform Settings",
    subtitle:
      "Configure global platform identity, language and theme defaults, exam security thresholds, and user registration policies.",
    platformIdentityTitle: "Platform Information & Regional Defaults",
    platformNameLabel: "Platform Name",
    taglineLabel: "Brand Tagline",
    defaultLocaleLabel: "Default Interface Language",
    defaultThemeLabel: "Default Theme Preference",
    securityPolicyTitle: "Security & Academic Policies",
    maxExamViolationsLabel: "Default Max Allowed Exam Violations",
    requireTeacherApprovalLabel: "Require Admin Approval for Teacher Registrations",
    allowStudentSelfEnrollmentLabel: "Allow Students to Self-Enroll in Published Courses",
    maintenanceModeLabel: "Enable Maintenance Banner",
    saveSettingsButton: "Save Platform Settings",
    settingsSavedToast: "Global platform settings updated and audited.",
  },
};

const ar: AdminDictionary = {
  ...en,
  nav: {
    groupGovernance: "الحوكمة والإدارة",
    groupAcademic: "العمليات الأكاديمية",
    groupOperations: "الأمان والنظام",
    overview: "نظرة عامة",
    users: "المستخدمون والموافقات",
    departments: "الأقسام والفصول",
    courses: "إدارة الدورات",
    schedule: "الجداول والحضور",
    analytics: "التحليلات والتقارير",
    security: "الأمان وسجل التدقيق",
    notifications: "الإشعارات والإعلانات",
    settings: "إعدادات المنصة",
  },
  common: {
    ...en.common,
    searchPlaceholder: "بحث في السجلات…",
    allFilter: "الكل",
    active: "نشط",
    suspended: "موقوف",
    pending: "قيد الانتظار",
    approved: "معتمد",
    rejected: "مرفوض",
    published: "منشور",
    draft: "مسودة",
    archived: "مؤرشف",
    actions: "الإجراءات",
    confirm: "تأكيد",
    cancel: "إلغاء",
    delete: "حذف",
    edit: "تعديل",
    create: "إنشاء",
    save: "حفظ التغييرات",
    exportExcel: "تصدير Excel (CSV)",
    exportPdf: "تصدير تقرير PDF",
    pageOf: "صفحة",
    previous: "السابق",
    next: "التالي",
    noRecordsTitle: "لا توجد سجلات",
    noRecordsDescription: "ستظهر السجلات من قاعدة بيانات Supabase هنا فور إنشائها.",
  },
  overview: {
    ...en.overview,
    title: "مركز تحكم مدير النظام",
    subtitle: "مؤشرات المنصة المباشرة، حوكمة المستخدمين، التقدم الأكاديمي، ومراقبة الأداء.",
    totalStudents: "إجمالي الطلاب",
    totalTeachers: "إجمالي المعلمين",
    totalCourses: "إجمالي الدورات",
    activeUsers: "الحسابات النشطة",
    pendingTeacherRequests: "طلبات المعلمين المعلقة",
    totalExaminations: "إجمالي الاختبارات",
    completionRate: "معدل إكمال الدورات",
    platformActivityCount: "أحداث التدقيق المسجلة",
  },
};

const de: AdminDictionary = {
  ...en,
  nav: {
    groupGovernance: "Verwaltung",
    groupAcademic: "Akademischer Betrieb",
    groupOperations: "Sicherheit & System",
    overview: "Übersicht",
    users: "Benutzer & Freigaben",
    departments: "Fachbereiche & Klassen",
    courses: "Kursverwaltung",
    schedule: "Stundenplan & Anwesenheit",
    analytics: "Analysen & Berichte",
    security: "Sicherheit & Audit",
    notifications: "Benachrichtigungen",
    settings: "Plattformeinstellungen",
  },
  common: {
    ...en.common,
    searchPlaceholder: "Einträge durchsuchen…",
    allFilter: "Alle",
    active: "Aktiv",
    suspended: "Gesperrt",
    pending: "Ausstehend",
    approved: "Freigegeben",
    rejected: "Abgelehnt",
    published: "Veröffentlicht",
    draft: "Entwurf",
    archived: "Archiviert",
    exportExcel: "Excel exportieren (CSV)",
    exportPdf: "PDF-Bericht exportieren",
  },
};

const it: AdminDictionary = {
  ...en,
  nav: {
    groupGovernance: "Governance",
    groupAcademic: "Operazioni Accademiche",
    groupOperations: "Sicurezza e Sistema",
    overview: "Panoramica",
    users: "Utenti e Approvazioni",
    departments: "Dipartimenti e Classi",
    courses: "Gestione Corsi",
    schedule: "Orari e Presenze",
    analytics: "Analisi e Report",
    security: "Sicurezza e Audit",
    notifications: "Notifiche",
    settings: "Impostazioni",
  },
  common: {
    ...en.common,
    searchPlaceholder: "Cerca record…",
    allFilter: "Tutti",
    active: "Attivo",
    suspended: "Sospeso",
    pending: "In attesa",
    approved: "Approvato",
    rejected: "Rifiutato",
    published: "Pubblicato",
    draft: "Bozza",
    archived: "Archiviato",
    exportExcel: "Esporta Excel (CSV)",
    exportPdf: "Esporta Report PDF",
  },
};

const fr: AdminDictionary = {
  ...en,
  nav: {
    groupGovernance: "Gouvernance",
    groupAcademic: "Opérations Académiques",
    groupOperations: "Sécurité et Système",
    overview: "Vue d'ensemble",
    users: "Utilisateurs et Approbations",
    departments: "Départements et Classes",
    courses: "Gestion des Cours",
    schedule: "Emploi du temps et Présences",
    analytics: "Analyses et Rapports",
    security: "Sécurité et Audit",
    notifications: "Notifications",
    settings: "Paramètres",
  },
  common: {
    ...en.common,
    searchPlaceholder: "Rechercher…",
    allFilter: "Tous",
    active: "Actif",
    suspended: "Suspendu",
    pending: "En attente",
    approved: "Approuvé",
    rejected: "Refusé",
    published: "Publié",
    draft: "Brouillon",
    archived: "Archivé",
    exportExcel: "Exporter Excel (CSV)",
    exportPdf: "Exporter Rapport PDF",
  },
};

export const ADMIN_DICTIONARIES: Readonly<Record<Locale, AdminDictionary>> = {
  en,
  ar,
  de,
  it,
  fr,
};

export function getAdminDictionary(locale: Locale): AdminDictionary {
  return ADMIN_DICTIONARIES[locale] ?? ADMIN_DICTIONARIES.en;
}
