import type { Locale } from "@/lib/preferences";

export interface TeacherDictionary {
  nav: {
    groupTeaching: string;
    groupAssessment: string;
    groupIntelligence: string;
    overview: string;
    courses: string;
    exams: string;
    students: string;
    aiAssistant: string;
    grading: string;
    ratings: string;
  };
  common: {
    searchPlaceholder: string;
    allFilter: string;
    create: string;
    edit: string;
    delete: string;
    save: string;
    cancel: string;
    confirm: string;
    actions: string;
    published: string;
    draft: string;
    archived: string;
    pendingApproval: string;
    easy: string;
    medium: string;
    hard: string;
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
    assignedCourses: string;
    enrolledStudents: string;
    upcomingClasses: string;
    upcomingExams: string;
    recentSubmissions: string;
    averagePerformance: string;
    unreadNotifications: string;
    performanceChartTitle: string;
    performanceChartDescription: string;
    scheduleSectionTitle: string;
    scheduleSectionDescription: string;
    examsSectionTitle: string;
    examsSectionDescription: string;
    submissionsSectionTitle: string;
    submissionsSectionDescription: string;
    notificationsSectionTitle: string;
    notificationsSectionDescription: string;
  };
  courses: {
    title: string;
    subtitle: string;
    tabCourses: string;
    tabChaptersLessons: string;
    tabEnrolledStudents: string;
    createCourse: string;
    editCourse: string;
    courseTitleLabel: string;
    courseCodeLabel: string;
    courseSummaryLabel: string;
    courseDescriptionLabel: string;
    departmentLabel: string;
    levelLabel: string;
    languageLabel: string;
    statusLabel: string;
    estimatedHoursLabel: string;
    passingScoreLabel: string;
    completionRequirementsLabel: string;
    thumbnailUploadLabel: string;
    uploadInProgress: string;
    uploadSuccessToast: string;
    courseSavedToast: string;
    selectCoursePrompt: string;
    addChapter: string;
    chapterTitleLabel: string;
    chapterSummaryLabel: string;
    chapterOrderLabel: string;
    chapterPublishedLabel: string;
    chapterSavedToast: string;
    chapterDeletedToast: string;
    addLesson: string;
    lessonTitleLabel: string;
    lessonTypeLabel: string;
    typeVideo: string;
    typePdf: string;
    typePresentation: string;
    typeArticle: string;
    typeQuiz: string;
    lessonSummaryLabel: string;
    lessonBodyLabel: string;
    durationMinutesLabel: string;
    uploadLessonMediaLabel: string;
    externalResourceUrlLabel: string;
    scheduledPublishAtLabel: string;
    isPreviewLabel: string;
    isPublishedLabel: string;
    createAfterLessonQuizNote: string;
    lessonSavedToast: string;
    lessonDeletedToast: string;
    enrolledCountLabel: string;
    progressLabel: string;
    enrolledAtLabel: string;
  };
  exams: {
    title: string;
    subtitle: string;
    tabExams: string;
    tabBuilder: string;
    tabQuestionBank: string;
    createExam: string;
    editExam: string;
    examTitleLabel: string;
    courseLabel: string;
    chapterLabel: string;
    classLabel: string;
    assignedStudentsLabel: string;
    instructionsLabel: string;
    durationMinutesLabel: string;
    totalPointsLabel: string;
    passingScoreLabel: string;
    maxAttemptsLabel: string;
    randomQuestionCountLabel: string;
    versionCountLabel: string;
    availableFromLabel: string;
    availableUntilLabel: string;
    shuffleQuestionsLabel: string;
    shuffleOptionsLabel: string;
    strictProctoringLabel: string;
    showResultsImmediatelyLabel: string;
    statusLabel: string;
    examSavedToast: string;
    selectExamPrompt: string;
    addQuestion: string;
    questionTypeLabel: string;
    typeSingleChoice: string;
    typeMultipleChoice: string;
    typeTrueFalse: string;
    typeEssay: string;
    difficultyLabel: string;
    pointsLabel: string;
    promptLabel: string;
    explanationLabel: string;
    mediaUrlLabel: string;
    uploadDiagramLabel: string;
    saveToQuestionBankLabel: string;
    optionsHeading: string;
    addOptionButton: string;
    correctOptionLabel: string;
    questionSavedToast: string;
    questionDeletedToast: string;
    importToSelectedExamButton: string;
    importedFromBankToast: string;
  };
  students: {
    title: string;
    subtitle: string;
    tabRoster: string;
    tabFallingBehind: string;
    tabAttendance: string;
    tabFeedbackAnnouncements: string;
    studentNameLabel: string;
    enrolledCoursesLabel: string;
    averageProgressLabel: string;
    examAverageLabel: string;
    attendanceRateLabel: string;
    studyTimeLabel: string;
    fallingBehindBadge: string;
    onTrackBadge: string;
    openProfileButton: string;
    profileDialogTitle: string;
    recentActivityTitle: string;
    recordAttendanceTitle: string;
    recordAttendanceDescription: string;
    sessionTitleLabel: string;
    sessionDateLabel: string;
    statusPresent: string;
    statusAbsent: string;
    statusLate: string;
    statusExcused: string;
    saveAttendanceButton: string;
    attendanceSavedToast: string;
    sendFeedbackTitle: string;
    sendFeedbackDescription: string;
    recipientModeLabel: string;
    modePersonalFeedback: string;
    modeCourseAnnouncement: string;
    targetStudentLabel: string;
    targetCourseLabel: string;
    subjectLabel: string;
    messageBodyLabel: string;
    sendDispatchButton: string;
    feedbackSentToast: string;
  };
  aiAssistant: {
    title: string;
    subtitle: string;
    part9NoticeBadge: string;
    part9NoticeDescription: string;
    tabExamGenerator: string;
    tabPdfLessonQuestions: string;
    tabTeachingPlans: string;
    tabPerformanceWeakness: string;
    selectCourseLabel: string;
    selectChapterLessonLabel: string;
    questionCountLabel: string;
    difficultyMixLabel: string;
    uploadPdfSourceLabel: string;
    topicPromptLabel: string;
    prepareBlueprintButton: string;
    blueprintReadyTitle: string;
    examSummaryTitle: string;
    weaknessAnalysisTitle: string;
    assignmentSuggestionsTitle: string;
    learningRecommendationsTitle: string;
  };
  grading: {
    title: string;
    subtitle: string;
    tabExamSubmissions: string;
    tabEssayAiReview: string;
    tabAssignments: string;
    studentLabel: string;
    examLabel: string;
    statusLabel: string;
    scorePercentLabel: string;
    earnedPointsLabel: string;
    publishedLabel: string;
    reviewAnswersButton: string;
    publishResultButton: string;
    unpublishResultButton: string;
    resultPublishedToast: string;
    aiSuggestedPointsLabel: string;
    aiSuggestedFeedbackLabel: string;
    approveAiGradeButton: string;
    customPointsLabel: string;
    teacherFeedbackLabel: string;
    saveEssayGradeButton: string;
    essayGradedToast: string;
    assignmentTitleLabel: string;
    submissionTextLabel: string;
    gradePointsLabel: string;
    saveAssignmentGradeButton: string;
    assignmentGradedToast: string;
  };
  ratings: {
    title: string;
    subtitle: string;
    readOnlySecurityNotice: string;
    averageCourseRating: string;
    averageTeacherRating: string;
    totalCourseReviews: string;
    totalTeacherReviews: string;
    tabCourseReviews: string;
    tabTeacherReviews: string;
    tabRatingHistory: string;
    courseLabel: string;
    studentLabel: string;
    ratingStarsLabel: string;
    reviewCommentLabel: string;
    submittedAtLabel: string;
  };
}

const en: TeacherDictionary = {
  nav: {
    groupTeaching: "Curriculum & Classes",
    groupAssessment: "Examinations & Grading",
    groupIntelligence: "AI & Insights",
    overview: "Teacher Overview",
    courses: "Courses & Lessons",
    exams: "Smart Exam Builder",
    students: "Student Management",
    aiAssistant: "AI Teacher Assistant",
    grading: "Assignments",
    ratings: "Course Ratings",
  },
  common: {
    searchPlaceholder: "Search records...",
    allFilter: "All",
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    save: "Save Changes",
    cancel: "Cancel",
    confirm: "Confirm",
    actions: "Actions",
    published: "Published",
    draft: "Draft",
    archived: "Archived",
    pendingApproval: "Pending Approval",
    easy: "Easy",
    medium: "Medium",
    hard: "Hard",
    exportExcel: "Export CSV / Excel",
    exportPdf: "Export PDF Report",
    pageOf: "Page",
    previous: "Previous",
    next: "Next",
    noRecordsTitle: "No records found",
    noRecordsDescription: "There are no matching records assigned to your teaching workspace yet.",
  },
  overview: {
    title: "Teacher Command Center",
    subtitle: "Monitor your assigned courses, enrolled students, upcoming schedules, and grading queue.",
    assignedCourses: "Assigned Courses",
    enrolledStudents: "Enrolled Students",
    upcomingClasses: "Upcoming Classes",
    upcomingExams: "Upcoming Examinations",
    recentSubmissions: "Recent Submissions",
    averagePerformance: "Avg. Student Score",
    unreadNotifications: "Unread Notifications",
    performanceChartTitle: "Course Enrollment & Performance Overview",
    performanceChartDescription: "Enrolled students and average examination score across your assigned courses.",
    scheduleSectionTitle: "Upcoming Class Schedule",
    scheduleSectionDescription: "Weekly timetable slots assigned to you.",
    examsSectionTitle: "Upcoming & Active Examinations",
    examsSectionDescription: "Scheduled examination windows for your courses.",
    submissionsSectionTitle: "Recent Exam & Assignment Submissions",
    submissionsSectionDescription: "Latest student work awaiting review or recently graded.",
    notificationsSectionTitle: "Recent Notifications",
    notificationsSectionDescription: "Platform alerts and academic updates sent to your account.",
  },
  courses: {
    title: "Course & Curriculum Management",
    subtitle: "Create courses, organize chapters, upload videos/PDFs/PowerPoints, schedule lessons, and set quizzes.",
    tabCourses: "My Courses",
    tabChaptersLessons: "Chapters, Lessons & Quizzes",
    tabEnrolledStudents: "Enrolled Students",
    createCourse: "Create Course",
    editCourse: "Edit Course",
    courseTitleLabel: "Course Title",
    courseCodeLabel: "Course Code",
    courseSummaryLabel: "Short Summary",
    courseDescriptionLabel: "Detailed Description",
    departmentLabel: "Department",
    levelLabel: "Educational Level",
    languageLabel: "Language",
    statusLabel: "Course Status",
    estimatedHoursLabel: "Estimated Hours",
    passingScoreLabel: "Passing Score (%)",
    completionRequirementsLabel: "Course Completion Requirements",
    thumbnailUploadLabel: "Upload Course Thumbnail",
    uploadInProgress: "Uploading file to secure storage...",
    uploadSuccessToast: "File uploaded to Supabase Storage.",
    courseSavedToast: "Course saved successfully.",
    selectCoursePrompt: "Select a course to manage its chapters, lessons, and enrolled students",
    addChapter: "Add Chapter",
    chapterTitleLabel: "Chapter Title",
    chapterSummaryLabel: "Chapter Summary",
    chapterOrderLabel: "Position Order",
    chapterPublishedLabel: "Publish Chapter",
    chapterSavedToast: "Chapter saved.",
    chapterDeletedToast: "Chapter deleted.",
    addLesson: "Add Lesson or Quiz",
    lessonTitleLabel: "Lesson Title",
    lessonTypeLabel: "Content Type",
    typeVideo: "Video Lecture",
    typePdf: "PDF Document",
    typePresentation: "PowerPoint Presentation",
    typeArticle: "Interactive Article",
    typeQuiz: "Post-Lesson Quiz",
    lessonSummaryLabel: "Lesson Summary",
    lessonBodyLabel: "Lesson Notes / Quiz Instructions (Markdown)",
    durationMinutesLabel: "Duration (Minutes)",
    uploadLessonMediaLabel: "Upload Media File (Video / PDF / PPTX)",
    externalResourceUrlLabel: "External Resource URL",
    scheduledPublishAtLabel: "Schedule Publication Date & Time",
    isPreviewLabel: "Free Preview Lesson",
    isPublishedLabel: "Publish Immediately",
    createAfterLessonQuizNote: "Select 'Post-Lesson Quiz' to place a comprehension check right after a lesson.",
    lessonSavedToast: "Lesson saved.",
    lessonDeletedToast: "Lesson deleted.",
    enrolledCountLabel: "Enrolled Students",
    progressLabel: "Completion Progress",
    enrolledAtLabel: "Enrolled Date",
  },
  exams: {
    title: "Smart Examination Builder",
    subtitle: "Author multi-version examinations with MCQ, True/False, and Essay items, diagrams, and random bank selection.",
    tabExams: "Examinations",
    tabBuilder: "Question Authoring",
    tabQuestionBank: "Reusable Question Bank",
    createExam: "Create Examination",
    editExam: "Edit Examination",
    examTitleLabel: "Examination Title",
    courseLabel: "Assigned Course",
    chapterLabel: "Optional Chapter Scope",
    classLabel: "Assigned Class Cohort",
    assignedStudentsLabel: "Specific Assigned Students (Optional)",
    instructionsLabel: "Examination Instructions",
    durationMinutesLabel: "Duration (Minutes)",
    totalPointsLabel: "Total Marks",
    passingScoreLabel: "Passing Percentage (%)",
    maxAttemptsLabel: "Allowed Attempts",
    randomQuestionCountLabel: "Random Question Draw Count (0 = All)",
    versionCountLabel: "Exam Versions (A, B, C...)",
    availableFromLabel: "Start Date & Time",
    availableUntilLabel: "End Date & Time",
    shuffleQuestionsLabel: "Shuffle Questions",
    shuffleOptionsLabel: "Shuffle Options",
    strictProctoringLabel: "Strict Anti-Cheat Proctoring",
    showResultsImmediatelyLabel: "Instant Auto-Grade Disclosure",
    statusLabel: "Exam Status",
    examSavedToast: "Examination saved.",
    selectExamPrompt: "Select an examination to manage questions",
    addQuestion: "Add Question",
    questionTypeLabel: "Question Format",
    typeSingleChoice: "Multiple Choice (Single Correct)",
    typeMultipleChoice: "Multiple Choice (Multiple Correct)",
    typeTrueFalse: "True / False",
    typeEssay: "Essay / Long Response",
    difficultyLabel: "Difficulty Level",
    pointsLabel: "Question Marks",
    promptLabel: "Question Prompt",
    explanationLabel: "Answer Key Explanation / Grading Rubric",
    mediaUrlLabel: "Image or Diagram URL",
    uploadDiagramLabel: "Upload Image / Diagram",
    saveToQuestionBankLabel: "Include in Reusable Question Bank",
    optionsHeading: "Answer Options",
    addOptionButton: "Add Choice Option",
    correctOptionLabel: "Correct",
    questionSavedToast: "Question saved.",
    questionDeletedToast: "Question removed.",
    importToSelectedExamButton: "Clone into Selected Exam",
    importedFromBankToast: "Question cloned into the selected examination.",
  },
  students: {
    title: "Assigned Student Management",
    subtitle: "Monitor progress, identify at-risk learners, and send personal feedback or announcements.",
    tabRoster: "Assigned Students",
    tabFallingBehind: "Falling Behind Alerts",
    tabAttendance: "Attendance Tracking",
    tabFeedbackAnnouncements: "Feedback & Announcements",
    studentNameLabel: "Student",
    enrolledCoursesLabel: "Assigned Courses",
    averageProgressLabel: "Course Progress",
    examAverageLabel: "Exam Average",
    attendanceRateLabel: "Attendance Rate",
    studyTimeLabel: "Study Time",
    fallingBehindBadge: "Needs Attention",
    onTrackBadge: "On Track",
    openProfileButton: "Student Profile",
    profileDialogTitle: "Student Learning Profile & Activity",
    recentActivityTitle: "Recent Lesson & Study Sessions",
    recordAttendanceTitle: "Record Class Attendance Session",
    recordAttendanceDescription: "Log attendance status for all students enrolled in your selected course.",
    sessionTitleLabel: "Session Topic",
    sessionDateLabel: "Session Date",
    statusPresent: "Present",
    statusAbsent: "Absent",
    statusLate: "Late",
    statusExcused: "Excused",
    saveAttendanceButton: "Save Attendance Sheet",
    attendanceSavedToast: "Attendance session recorded.",
    sendFeedbackTitle: "Personal Feedback & Course Announcements",
    sendFeedbackDescription: "Deliver targeted academic guidance to an individual student or broadcast to an entire course.",
    recipientModeLabel: "Delivery Mode",
    modePersonalFeedback: "Personal Student Feedback",
    modeCourseAnnouncement: "Course-Wide Announcement",
    targetStudentLabel: "Select Assigned Student",
    targetCourseLabel: "Select Assigned Course",
    subjectLabel: "Subject Headline",
    messageBodyLabel: "Feedback / Announcement Message",
    sendDispatchButton: "Send Message",
    feedbackSentToast: "Message delivered to student notifications.",
  },
  aiAssistant: {
    title: "AI Teacher Assistant Workspace",
    subtitle: "Structured intelligence workbench for exam generation, PDF/lesson question synthesis, teaching plans, and weakness diagnostics.",
    part9NoticeBadge: "Part 9 AI Engine Ready",
    part9NoticeDescription: "Interactive workspace prepared with live course & exam data bindings. Generative LLM provider streaming connects in Part 9.",
    tabExamGenerator: "AI Exam & Quiz Generator",
    tabPdfLessonQuestions: "PDF & Lesson Question Extraction",
    tabTeachingPlans: "Teaching Plan & Assignment Suggestions",
    tabPerformanceWeakness: "Performance & Weakness Analysis",
    selectCourseLabel: "Target Course",
    selectChapterLessonLabel: "Target Chapter / Lesson",
    questionCountLabel: "Number of Questions",
    difficultyMixLabel: "Difficulty Distribution",
    uploadPdfSourceLabel: "Select Lesson PDF / Presentation Source",
    topicPromptLabel: "Pedagogical Focus & Learning Objectives",
    prepareBlueprintButton: "Synthesize Structured Blueprint",
    blueprintReadyTitle: "Structured Pedagogical Blueprint",
    examSummaryTitle: "Course Examination Performance Summary",
    weaknessAnalysisTitle: "Cohort Weakness & Topic Gap Diagnostics",
    assignmentSuggestionsTitle: "Recommended Remedial Assignments",
    learningRecommendationsTitle: "Additional Learning Resource Recommendations",
  },
  grading: {
    title: "Grading, AI Essay Review & Results",
    subtitle: "Inspect exam submissions, approve or adjust AI essay scores, publish official results, and export reports.",
    tabExamSubmissions: "Exam Attempts & Results",
    tabEssayAiReview: "Essay & AI Grading Queue",
    tabAssignments: "Assignment Submissions",
    studentLabel: "Student",
    examLabel: "Examination",
    statusLabel: "Status",
    scorePercentLabel: "Score (%)",
    earnedPointsLabel: "Earned Marks",
    publishedLabel: "Result Visibility",
    reviewAnswersButton: "Review Answers",
    publishResultButton: "Publish Result",
    unpublishResultButton: "Hide Result",
    resultPublishedToast: "Result visibility updated.",
    aiSuggestedPointsLabel: "AI Suggested Score",
    aiSuggestedFeedbackLabel: "AI Suggested Feedback",
    approveAiGradeButton: "Approve AI Suggestion",
    customPointsLabel: "Awarded Marks",
    teacherFeedbackLabel: "Official Teacher Feedback",
    saveEssayGradeButton: "Save Grade & Recalculate Result",
    essayGradedToast: "Student answer graded and exam total updated.",
    assignmentTitleLabel: "Assignment",
    submissionTextLabel: "Student Submission",
    gradePointsLabel: "Awarded Points",
    saveAssignmentGradeButton: "Save Assignment Grade",
    assignmentGradedToast: "Assignment submission graded.",
  },
  ratings: {
    title: "Course & Teacher Ratings",
    subtitle: "Review verified student ratings and written feedback across your assigned courses.",
    readOnlySecurityNotice: "Integrity Protection: Student ratings and reviews are strictly read-only and protected by database security policies.",
    averageCourseRating: "Average Course Rating",
    averageTeacherRating: "Average Teacher Rating",
    totalCourseReviews: "Course Reviews",
    totalTeacherReviews: "Teacher Reviews",
    tabCourseReviews: "Course Reviews",
    tabTeacherReviews: "Direct Teacher Reviews",
    tabRatingHistory: "Rating Distribution & History",
    courseLabel: "Course",
    studentLabel: "Student Reviewer",
    ratingStarsLabel: "Rating",
    reviewCommentLabel: "Written Review",
    submittedAtLabel: "Submitted Date",
  },
};

const ar: TeacherDictionary = {
  nav: {
    groupTeaching: "المناهج والفصول",
    groupAssessment: "الاختبارات والتصحيح",
    groupIntelligence: "الذكاء الاصطناعي والتحليلات",
    overview: "نظرة عامة للمعلم",
    courses: "الدورات والدروس",
    exams: "منشئ الاختبارات الذكي",
    students: "إدارة الطلاب",
    aiAssistant: "مساعد المعلم الذكي",
    grading: "المهام",
    ratings: "تقييمات الدورات",
  },
  common: {
    searchPlaceholder: "ابحث في السجلات...",
    allFilter: "الكل",
    create: "إنشاء",
    edit: "تعديل",
    delete: "حذف",
    save: "حفظ التغييرات",
    cancel: "إلغاء",
    confirm: "تأكيد",
    actions: "الإجراءات",
    published: "منشور",
    draft: "مسودة",
    archived: "مؤرشف",
    pendingApproval: "بانتظار الموافقة",
    easy: "سهل",
    medium: "متوسط",
    hard: "صعب",
    exportExcel: "تصدير CSV / Excel",
    exportPdf: "تصدير تقرير PDF",
    pageOf: "صفحة",
    previous: "السابق",
    next: "التالي",
    noRecordsTitle: "لا توجد سجلات",
    noRecordsDescription: "لا توجد سجلات مطابقة مخصصة لمساحة عملك التدريسية حتى الآن.",
  },
  overview: {
    title: "مركز قيادة المعلم",
    subtitle: "تابع دوراتك المخصصة، الطلاب المسجلين، الحصص القادمة، وطابور التصحيح.",
    assignedCourses: "الدورات المخصصة",
    enrolledStudents: "الطلاب المسجلون",
    upcomingClasses: "الحصص القادمة",
    upcomingExams: "الاختبارات القادمة",
    recentSubmissions: "التسليمات الأخيرة",
    averagePerformance: "متوسط أداء الطلاب",
    unreadNotifications: "إشعارات غير مقروءة",
    performanceChartTitle: "نظرة عامة على التسجيل وأداء الدورات",
    performanceChartDescription: "عدد الطلاب المسجلين ومتوسط درجات الاختبارات في دوراتك.",
    scheduleSectionTitle: "جدول الحصص القادمة",
    scheduleSectionDescription: "المواعيد الأسبوعية المخصصة لك.",
    examsSectionTitle: "الاختبارات القادمة والنشطة",
    examsSectionDescription: "مواعيد الاختبارات المجدولة لدوراتك.",
    submissionsSectionTitle: "أحدث تسليمات الاختبارات والواجبات",
    submissionsSectionDescription: "أحدث أعمال الطلاب بانتظار المراجعة أو التي تم تقييمها مؤخراً.",
    notificationsSectionTitle: "أحدث الإشعارات",
    notificationsSectionDescription: "تنبيهات المنصة والتحديثات الأكاديمية المرسلة لحسابك.",
  },
  courses: {
    title: "إدارة الدورات والمناهج",
    subtitle: "أنشئ الدورات، نظّم الفصول، ارفع الفيديوهات وملفات PDF والعروض التقديمية، وجدول نشر الدروس والاختبارات القصيرة.",
    tabCourses: "دوراتي",
    tabChaptersLessons: "الفصول والدروس والاختبارات القصيرة",
    tabEnrolledStudents: "الطلاب المسجلون",
    createCourse: "إنشاء دورة",
    editCourse: "تعديل الدورة",
    courseTitleLabel: "عنوان الدورة",
    courseCodeLabel: "رمز الدورة",
    courseSummaryLabel: "ملخص قصير",
    courseDescriptionLabel: "وصف تفصيلي",
    departmentLabel: "القسم",
    levelLabel: "المستوى التعليمي",
    languageLabel: "اللغة",
    statusLabel: "حالة الدورة",
    estimatedHoursLabel: "الساعات المقدرة",
    passingScoreLabel: "درجة النجاح (%)",
    completionRequirementsLabel: "متطلبات إتمام الدورة",
    thumbnailUploadLabel: "رفع الصورة المصغرة للدورة",
    uploadInProgress: "جارٍ رفع الملف إلى التخزين الآمن...",
    uploadSuccessToast: "تم رفع الملف بنجاح.",
    courseSavedToast: "تم حفظ الدورة بنجاح.",
    selectCoursePrompt: "اختر دورة لإدارة فصولها ودروسها وطلابها المسجلين",
    addChapter: "إضافة فصل",
    chapterTitleLabel: "عنوان الفصل",
    chapterSummaryLabel: "ملخص الفصل",
    chapterOrderLabel: "ترتيب العرض",
    chapterPublishedLabel: "نشر الفصل",
    chapterSavedToast: "تم حفظ الفصل.",
    chapterDeletedToast: "تم حذف الفصل.",
    addLesson: "إضافة درس أو اختبار قصير",
    lessonTitleLabel: "عنوان الدرس",
    lessonTypeLabel: "نوع المحتوى",
    typeVideo: "محاضرة فيديو",
    typePdf: "مستند PDF",
    typePresentation: "عرض بوربوينت",
    typeArticle: "مقال تفاعلي",
    typeQuiz: "اختبار قصير بعد الدرس",
    lessonSummaryLabel: "ملخص الدرس",
    lessonBodyLabel: "ملاحظات الدرس / تعليمات الاختبار القصير",
    durationMinutesLabel: "المدة (دقائق)",
    uploadLessonMediaLabel: "رفع ملف الوسائط (فيديو / PDF / بوربوينت)",
    externalResourceUrlLabel: "رابط مصدر خارجي",
    scheduledPublishAtLabel: "جدولة تاريخ ووقت النشر",
    isPreviewLabel: "درس معاينة مجانية",
    isPublishedLabel: "نشر فوري",
    createAfterLessonQuizNote: "اختر 'اختبار قصير بعد الدرس' لإضافة تقييم استيعابي مباشرة بعد الدرس.",
    lessonSavedToast: "تم حفظ الدرس.",
    lessonDeletedToast: "تم حذف الدرس.",
    enrolledCountLabel: "الطلاب المسجلون",
    progressLabel: "نسبة الإنجاز",
    enrolledAtLabel: "تاريخ التسجيل",
  },
  exams: {
    title: "منشئ الاختبارات الذكي",
    subtitle: "صمّم اختبارات متعددة النماذج بأسئلة اختيار من متعدد وصح/خطأ ومقالية مع صور توضيحية وسحب عشوائي من بنك الأسئلة.",
    tabExams: "الاختبارات",
    tabBuilder: "إعداد الأسئلة",
    tabQuestionBank: "بنك الأسئلة التشاركي",
    createExam: "إنشاء اختبار",
    editExam: "تعديل الاختبار",
    examTitleLabel: "عنوان الاختبار",
    courseLabel: "الدورة المخصصة",
    chapterLabel: "نطاق الفصل (اختياري)",
    classLabel: "الشعبة / الفصل المخصص",
    assignedStudentsLabel: "طلاب محددون (اختياري)",
    instructionsLabel: "تعليمات الاختبار",
    durationMinutesLabel: "المدة (دقائق)",
    totalPointsLabel: "إجمالي الدرجات",
    passingScoreLabel: "نسبة النجاح (%)",
    maxAttemptsLabel: "عدد المحاولات المسموحة",
    randomQuestionCountLabel: "عدد الأسئلة العشوائية (0 = الكل)",
    versionCountLabel: "عدد نماذج الاختبار (A, B, C...)",
    availableFromLabel: "تاريخ ووقت البدء",
    availableUntilLabel: "تاريخ ووقت الانتهاء",
    shuffleQuestionsLabel: "خلط ترتيب الأسئلة",
    shuffleOptionsLabel: "خلط ترتيب الخيارات",
    strictProctoringLabel: "مراقبة صارمة لمنع الغش",
    showResultsImmediatelyLabel: "إظهار النتيجة فور التسليم",
    statusLabel: "حالة الاختبار",
    examSavedToast: "تم حفظ الاختبار.",
    selectExamPrompt: "اختر اختباراً لإدارة أسئلته",
    addQuestion: "إضافة سؤال",
    questionTypeLabel: "نوع السؤال",
    typeSingleChoice: "اختيار من متعدد (إجابة واحدة)",
    typeMultipleChoice: "اختيار من متعدد (عدة إجابات)",
    typeTrueFalse: "صح / خطأ",
    typeEssay: "سؤال مقالي",
    difficultyLabel: "مستوى الصعوبة",
    pointsLabel: "درجة السؤال",
    promptLabel: "نص السؤال",
    explanationLabel: "شرح الإجابة النموذجية / معايير التصحيح",
    mediaUrlLabel: "رابط صورة أو رسم توضيحي",
    uploadDiagramLabel: "رفع صورة أو رسم توضيحي",
    saveToQuestionBankLabel: "حفظ في بنك الأسئلة لإعادة الاستخدام",
    optionsHeading: "خيارات الإجابة",
    addOptionButton: "إضافة خيار",
    correctOptionLabel: "صحيحة",
    questionSavedToast: "تم حفظ السؤال.",
    questionDeletedToast: "تم حذف السؤال.",
    importToSelectedExamButton: "نسخ إلى الاختبار المحدد",
    importedFromBankToast: "تم نسخ السؤال إلى الاختبار المحدد.",
  },
  students: {
    title: "إدارة الطلاب المخصصين",
    subtitle: "راقب التقدم، اكتشف الطلاب المتأخرين، سجّل الحضور، وأرسل ملاحظات شخصية أو إعلانات عامة.",
    tabRoster: "قائمة الطلاب المخصصين",
    tabFallingBehind: "تنبيهات الطلاب المتأخرين",
    tabAttendance: "متابعة الحضور والغياب",
    tabFeedbackAnnouncements: "الملاحظات والإعلانات",
    studentNameLabel: "الطالب",
    enrolledCoursesLabel: "الدورات المسجلة",
    averageProgressLabel: "تقدم الدورة",
    examAverageLabel: "متوسط الاختبارات",
    attendanceRateLabel: "نسبة الحضور",
    studyTimeLabel: "وقت الدراسة",
    fallingBehindBadge: "يحتاج متابعة",
    onTrackBadge: "منتظم",
    openProfileButton: "ملف الطالب",
    profileDialogTitle: "ملف تعلم الطالب ونشاطه",
    recentActivityTitle: "أحدث جلسات الدراسة والدروس",
    recordAttendanceTitle: "تسجيل جلسة حضور الفصل",
    recordAttendanceDescription: "سجّل حالة الحضور لجميع الطلاب المسجلين في الدورة المحددة.",
    sessionTitleLabel: "موضوع الجلسة",
    sessionDateLabel: "تاريخ الجلسة",
    statusPresent: "حاضر",
    statusAbsent: "غائب",
    statusLate: "متأخر",
    statusExcused: "بعذر",
    saveAttendanceButton: "حفظ كشف الحضور",
    attendanceSavedToast: "تم تسجيل جلسة الحضور.",
    sendFeedbackTitle: "الملاحظات الشخصية وإعلانات الدورة",
    sendFeedbackDescription: "أرسل توجيهاً أكاديمياً لطالب محدد أو إعلاناً لجميع طلاب الدورة.",
    recipientModeLabel: "وضع الإرسال",
    modePersonalFeedback: "ملاحظة شخصية لطالب",
    modeCourseAnnouncement: "إعلان عام للدورة",
    targetStudentLabel: "اختر الطالب المخصص",
    targetCourseLabel: "اختر الدورة المخصصة",
    subjectLabel: "عنوان الرسالة",
    messageBodyLabel: "نص الملاحظة أو الإعلان",
    sendDispatchButton: "إرسال الرسالة",
    feedbackSentToast: "تم إرسال الرسالة إلى إشعارات الطلاب.",
  },
  aiAssistant: {
    title: "مساحة عمل مساعد المعلم الذكي",
    subtitle: "واجهة ذكية متكاملة لتوليد الاختبارات، استخراج أسئلة من PDF والدروس، خطط التدريس، وتشخيص نقاط الضعف.",
    part9NoticeBadge: "جاهز لمحرك الذكاء الاصطناعي (الجزء 9)",
    part9NoticeDescription: "واجهة تفاعلية مرتبطة ببيانات دوراتك واختباراتك الفعلية، ومجهزة للربط المباشر مع نماذج الذكاء الاصطناعي في الجزء 9.",
    tabExamGenerator: "توليد الاختبارات بالذكاء الاصطناعي",
    tabPdfLessonQuestions: "استخراج أسئلة من PDF والدروس",
    tabTeachingPlans: "خطط التدريس واقتراحات الواجبات",
    tabPerformanceWeakness: "ملخصات الأداء وتحليل نقاط الضعف",
    selectCourseLabel: "الدورة المستهدفة",
    selectChapterLessonLabel: "الفصل / الدرس المستهدف",
    questionCountLabel: "عدد الأسئلة المقترحة",
    difficultyMixLabel: "توزيع مستويات الصعوبة",
    uploadPdfSourceLabel: "اختر ملف PDF أو العرض التقديمي للدرس",
    topicPromptLabel: "التركيز التربوي وأهداف التعلم",
    prepareBlueprintButton: "توليد المخطط التربوي المهيكل",
    blueprintReadyTitle: "المخطط التربوي الذكي",
    examSummaryTitle: "ملخص أداء اختبارات الدورة",
    weaknessAnalysisTitle: "تشخيص نقاط الضعف والفجوات المعرفية",
    assignmentSuggestionsTitle: "اقتراحات الواجبات العلاجية",
    learningRecommendationsTitle: "توصيات مصادر التعلم الإضافية",
  },
  grading: {
    title: "التصحيح ومراجعة المقالات الذكية والنتائج",
    subtitle: "راجع إجابات الطلاب، اعتمد أو عدّل درجات الذكاء الاصطناعي للأسئلة المقالية، انشر النتائج، وصدّر التقارير.",
    tabExamSubmissions: "محاولات الاختبارات والنتائج",
    tabEssayAiReview: "طابور الأسئلة المقالية وتقييم الذكاء الاصطناعي",
    tabAssignments: "تسليمات الواجبات",
    studentLabel: "الطالب",
    examLabel: "الاختبار",
    statusLabel: "الحالة",
    scorePercentLabel: "النتيجة (%)",
    earnedPointsLabel: "الدرجات المكتسبة",
    publishedLabel: "حالة النشر",
    reviewAnswersButton: "مراجعة الإجابات",
    publishResultButton: "نشر النتيجة",
    unpublishResultButton: "إخفاء النتيجة",
    resultPublishedToast: "تم تحديث حالة نشر النتيجة.",
    aiSuggestedPointsLabel: "الدرجة المقترحة من الذكاء الاصطناعي",
    aiSuggestedFeedbackLabel: "ملاحظات الذكاء الاصطناعي المقترحة",
    approveAiGradeButton: "اعتماد تقييم الذكاء الاصطناعي",
    customPointsLabel: "الدرجة الممنوحة",
    teacherFeedbackLabel: "ملاحظات المعلم الرسمية",
    saveEssayGradeButton: "حفظ الدرجة وإعادة حساب النتيجة",
    essayGradedToast: "تم تصحيح الإجابة وتحديث نتيجة الاختبار.",
    assignmentTitleLabel: "الواجب",
    submissionTextLabel: "إجابة الطالب",
    gradePointsLabel: "الدرجة الممنوحة",
    saveAssignmentGradeButton: "حفظ درجة الواجب",
    assignmentGradedToast: "تم رصد درجة الواجب بنجاح.",
  },
  ratings: {
    title: "تقييمات الدورات والمعلم",
    subtitle: "اطّلع على تقييمات الطلاب الموثقة ومراجعاتهم المكتوبة لدوراتك.",
    readOnlySecurityNotice: "حماية النزاهة: تقييمات ومراجعات الطلاب للقراءة فقط ولا يمكن للمعلم تعديلها أو حذفها.",
    averageCourseRating: "متوسط تقييم الدورات",
    averageTeacherRating: "متوسط تقييم المعلم",
    totalCourseReviews: "مراجعات الدورات",
    totalTeacherReviews: "مراجعات المعلم",
    tabCourseReviews: "مراجعات الدورات",
    tabTeacherReviews: "تقييمات المعلم المباشرة",
    tabRatingHistory: "توزيع وسجل التقييمات",
    courseLabel: "الدورة",
    studentLabel: "الطالب المقيّم",
    ratingStarsLabel: "التقييم",
    reviewCommentLabel: "المراجعة المكتوبة",
    submittedAtLabel: "تاريخ التقييم",
  },
};

const de: TeacherDictionary = {
  ...en,
  nav: {
    groupTeaching: "Lehrplan & Kurse",
    groupAssessment: "Prüfungen & Bewertung",
    groupIntelligence: "KI & Analysen",
    overview: "Lehrer-Übersicht",
    courses: "Kurse & Lektionen",
    exams: "Smart Exam Builder",
    students: "Schülerverwaltung",
    aiAssistant: "KI-Lehrerassistent",
    grading: "Aufgaben",
    ratings: "Kursbewertungen",
  },
  overview: {
    ...en.overview,
    title: "Lehrer-Kommandozentrale",
    subtitle: "Überwachen Sie Ihre zugewiesenen Kurse, eingeschriebenen Studierenden, Termine und Abgaben.",
  },
};

const it: TeacherDictionary = {
  ...en,
  nav: {
    groupTeaching: "Curriculum e Corsi",
    groupAssessment: "Esami e Valutazioni",
    groupIntelligence: "IA e Approfondimenti",
    overview: "Panoramica Docente",
    courses: "Corsi e Lezioni",
    exams: "Smart Exam Builder",
    students: "Gestione Studenti",
    aiAssistant: "Assistente IA Docente",
    grading: "Compiti",
    ratings: "Valutazioni Corsi",
  },
  overview: {
    ...en.overview,
    title: "Centro di Controllo Docente",
    subtitle: "Monitora i corsi assegnati, gli studenti iscritti, le lezioni imminenti e le consegne da valutare.",
  },
};

const fr: TeacherDictionary = {
  ...en,
  nav: {
    groupTeaching: "Programme & Cours",
    groupAssessment: "Examens & Notation",
    groupIntelligence: "IA & Analyses",
    overview: "Aperçu Enseignant",
    courses: "Cours & Leçons",
    exams: "Générateur d'Examens",
    students: "Gestion des Étudiants",
    aiAssistant: "Assistant IA Enseignant",
    grading: "Devoirs",
    ratings: "Évaluations des Cours",
  },
  overview: {
    ...en.overview,
    title: "Centre de Pilotage Enseignant",
    subtitle: "Suivez vos cours attribués, les étudiants inscrits, les séances à venir et les copies à corriger.",
  },
};

const TEACHER_DICTIONARIES: Record<Locale, TeacherDictionary> = {
  en,
  ar,
  de,
  it,
  fr,
};

export function getTeacherDictionary(locale: Locale): TeacherDictionary {
  return TEACHER_DICTIONARIES[locale] ?? TEACHER_DICTIONARIES.en;
}
