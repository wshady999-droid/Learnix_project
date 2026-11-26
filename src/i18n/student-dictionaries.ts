import type { Locale } from "@/lib/preferences";

export interface StudentDictionary {
  nav: {
    groupLearning: string;
    groupIntelligence: string;
    groupGrowth: string;
    overview: string;
    courses: string;
    exams: string;
    aiAssistant: string;
    performance: string;
    motivation: string;
    ratings: string;
    profile: string;
  };
  common: {
    searchPlaceholder: string;
    allFilter: string;
    open: string;
    continueLearning: string;
    completed: string;
    inProgress: string;
    enrollNow: string;
    enrolledToast: string;
    save: string;
    cancel: string;
    delete: string;
    download: string;
    noRecordsTitle: string;
    noRecordsDescription: string;
  };
  overview: {
    welcomePrefix: string;
    subtitle: string;
    enrolledCourses: string;
    completionProgress: string;
    upcomingExams: string;
    upcomingAssignments: string;
    recentGrades: string;
    studyHours: string;
    unreadNotifications: string;
    enrolledCoursesSectionTitle: string;
    enrolledCoursesSectionDescription: string;
    upcomingExamsTitle: string;
    upcomingAssignmentsTitle: string;
    recentGradesTitle: string;
    notificationsTitle: string;
    markAllReadButton: string;
    studyChartTitle: string;
    studyChartDescription: string;
  };
  courses: {
    title: string;
    subtitle: string;
    tabEnrolled: string;
    tabCatalog: string;
    tabFavorites: string;
    searchCourseContentPlaceholder: string;
    chaptersCountLabel: string;
    lessonsCountLabel: string;
    progressLabel: string;
    openLessonViewerButton: string;
    selectCoursePrompt: string;
    resumeFromSecondLabel: string;
    favoriteButton: string;
    unfavoriteButton: string;
    favoritedToast: string;
  };
  lessonViewer: {
    backToCourses: string;
    chapterLabel: string;
    lessonLabel: string;
    markCompleteButton: string;
    completedBadge: string;
    saveResumePositionButton: string;
    positionSavedToast: string;
    lessonCompletedToast: string;
    previousLesson: string;
    nextLesson: string;
    tabOverviewMaterials: string;
    tabPersonalNotes: string;
    tabPracticeQuiz: string;
    tabRelatedLessons: string;
    downloadAttachmentButton: string;
    openExternalResourceButton: string;
    addNoteTitle: string;
    noteTimestampLabel: string;
    notePlaceholder: string;
    saveNoteButton: string;
    noteSavedToast: string;
    noteDeletedToast: string;
    practiceQuizHeading: string;
    practiceQuizDescription: string;
  };
  aiAssistant: {
    title: string;
    subtitle: string;
    part9Badge: string;
    part9Description: string;
    tabCourseQa: string;
    tabSummariesFlashcards: string;
    tabPracticeQuizTermTranslator: string;
    tabStudyPlan: string;
    selectCourseLabel: string;
    selectLessonLabel: string;
    askPromptLabel: string;
    scientificTermLabel: string;
    targetLanguageLabel: string;
    generateButton: string;
    outputHeading: string;
  };
  performance: {
    title: string;
    subtitle: string;
    overallExamAverage: string;
    completedCoursesCount: string;
    totalStudyHours: string;
    examsPassedCount: string;
    gradesChartTitle: string;
    gradesChartDescription: string;
    progressComparisonTitle: string;
    progressComparisonDescription: string;
    strengthsTitle: string;
    weaknessesRevisionTitle: string;
    examGradesTableTitle: string;
  };
  motivation: {
    title: string;
    subtitle: string;
    tabChallenges: string;
    tabAchievements: string;
    tabCertificates: string;
    weeklyChallengesTitle: string;
    weeklyChallengesDescription: string;
    achievementsTitle: string;
    rewardsTitle: string;
    certificatesTitle: string;
    certificatesDescription: string;
    claimCertificateButton: string;
    certificateClaimedToast: string;
    downloadCertificatePdfButton: string;
    certificateNumberLabel: string;
    verificationHashLabel: string;
  };
  ratings: {
    title: string;
    subtitle: string;
    policyNotice: string;
    selectCompletedCourseLabel: string;
    courseRatingStarsLabel: string;
    courseCommentLabel: string;
    submitCourseReviewButton: string;
    courseReviewSavedToast: string;
    teacherRatingStarsLabel: string;
    teacherCommentLabel: string;
    submitTeacherReviewButton: string;
    teacherReviewSavedToast: string;
    mySubmittedReviewsTitle: string;
  };
  profile: {
    title: string;
    subtitle: string;
    openFullAccountSecurityButton: string;
    certificatesSummaryTitle: string;
    achievementsSummaryTitle: string;
  };
  exams: {
    title: string;
    subtitle: string;
    tabAvailable: string;
    tabHistory: string;
    startExamButton: string;
    resumeExamButton: string;
    viewResultButton: string;
    attemptsUsedLabel: string;
    durationLabel: string;
    marksLabel: string;
    passingScoreLabel: string;
    proctoredBadge: string;
    cameraRequiredBadge: string;
    instructionsHeading: string;
    privacyNoticeHeading: string;
    privacyNoticeBody: string;
    browserLimitationNotice: string;
    cameraConsentCheckboxLabel: string;
    guardianConsentCheckboxLabel: string;
    verifyCameraButton: string;
    cameraVerifiedBadge: string;
    confirmStartExamButton: string;
    timeRemainingLabel: string;
    autoSavedBadge: string;
    savingBadge: string;
    cameraActiveIndicator: string;
    simulatePhoneFlagButton: string;
    focusObscuredHeading: string;
    focusObscuredDescription: string;
    returnToExamButton: string;
    submitExamButton: string;
    submitConfirmHeading: string;
    submitConfirmDescription: string;
    submittedSuccessToast: string;
    timeExpiredToast: string;
    resultSummaryHeading: string;
    resultPendingPublicationNotice: string;
    answerBreakdownHeading: string;
    weakTopicsHeading: string;
  };
}

const en: StudentDictionary = {
  nav: {
    groupLearning: "LEARNING",
    groupIntelligence: "AI & PROGRESS",
    groupGrowth: "ACCOUNT",
    overview: "Overview",
    courses: "Explore Courses",
    exams: "Exams",
    aiAssistant: "AI Study Assistant",
    performance: "Performance",
    motivation: "Motivation & Certificates",
    ratings: "Course & Teacher Ratings",
    profile: "Profile",
  },
  common: {
    searchPlaceholder: "Search courses, chapters, or lessons...",
    allFilter: "All",
    open: "Open",
    continueLearning: "Continue Learning",
    completed: "Completed",
    inProgress: "In Progress",
    enrollNow: "Enroll in Course",
    enrolledToast: "Successfully enrolled in course.",
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    download: "Download File",
    noRecordsTitle: "No records yet",
    noRecordsDescription: "Start exploring your enrolled courses and lessons to populate this view.",
  },
  overview: {
    welcomePrefix: "Welcome back,",
    subtitle: "Continue your learning journey, track upcoming exams, and review your study milestones.",
    enrolledCourses: "Enrolled Courses",
    completionProgress: "Avg. Course Progress",
    upcomingExams: "Upcoming Exams",
    upcomingAssignments: "Active Assignments",
    recentGrades: "Latest Exam Score",
    studyHours: "Total Study Hours",
    unreadNotifications: "Unread Alerts",
    enrolledCoursesSectionTitle: "Your Active Courses",
    enrolledCoursesSectionDescription: "Resume where you left off across your enrolled curriculum.",
    upcomingExamsTitle: "Upcoming Examinations",
    upcomingAssignmentsTitle: "Upcoming Assignments",
    recentGradesTitle: "Recent Published Grades",
    notificationsTitle: "Notification Center",
    markAllReadButton: "Mark Read",
    studyChartTitle: "Course Progress & Exam Performance",
    studyChartDescription: "Comparison of lesson completion percentage and examination average per course.",
  },
  courses: {
    title: "My Courses & Curriculum Explorer",
    subtitle: "Access chapters, watch lessons, resume from your last timestamp, bookmark favorites, and download permitted files.",
    tabEnrolled: "My Enrolled Courses",
    tabCatalog: "Available Published Courses",
    tabFavorites: "Saved Favorite Lessons",
    searchCourseContentPlaceholder: "Search lessons, chapters, or course codes...",
    chaptersCountLabel: "Chapters",
    lessonsCountLabel: "Lessons",
    progressLabel: "Course Completion",
    openLessonViewerButton: "Launch Lesson Viewer",
    selectCoursePrompt: "Select an enrolled course to browse chapters & lessons",
    resumeFromSecondLabel: "Resume at",
    favoriteButton: "Save Favorite",
    unfavoriteButton: "Favorited",
    favoritedToast: "Favorites updated.",
  },
  lessonViewer: {
    backToCourses: "Back to My Courses",
    chapterLabel: "Chapter",
    lessonLabel: "Lesson",
    markCompleteButton: "Mark Lesson Completed",
    completedBadge: "Lesson Completed",
    saveResumePositionButton: "Save Video Resume Position",
    positionSavedToast: "Playback resume timestamp and study time saved.",
    lessonCompletedToast: "Lesson marked complete and course progress updated!",
    previousLesson: "Previous Lesson",
    nextLesson: "Next Lesson",
    tabOverviewMaterials: "Lesson Content & Downloads",
    tabPersonalNotes: "My Personal Notes",
    tabPracticeQuiz: "Practice Quiz",
    tabRelatedLessons: "Related Chapter Lessons",
    downloadAttachmentButton: "Download Educational File",
    openExternalResourceButton: "Open External Reference",
    addNoteTitle: "Add Personal Lesson Note",
    noteTimestampLabel: "Video Timestamp (Seconds)",
    notePlaceholder: "Write your key takeaways, formulas, or questions for this lesson...",
    saveNoteButton: "Save Note",
    noteSavedToast: "Personal note saved.",
    noteDeletedToast: "Note removed.",
    practiceQuizHeading: "Post-Lesson Comprehension & Practice Quiz",
    practiceQuizDescription: "Review the interactive self-check exercises for this lesson.",
  },
  aiAssistant: {
    title: "Learnix AI Study Assistant",
    subtitle: "Your personal AI tutor for course Q&A, PDF discussions, lesson explanations, flashcards, terminology translation, and study plans.",
    part9Badge: "Part 9 AI Backend Ready",
    part9Description: "Connected to your live enrolled courses, lessons, and notes. Streaming LLM inference connects in Part 9.",
    tabCourseQa: "Course Q&A & PDF Discussion",
    tabSummariesFlashcards: "Lesson Summaries & Flashcards",
    tabPracticeQuizTermTranslator: "Practice Quiz & Terminology Translator",
    tabStudyPlan: "Personalized Study Plan",
    selectCourseLabel: "Enrolled Course Context",
    selectLessonLabel: "Specific Lesson / PDF Context",
    askPromptLabel: "Your Question or Difficult Topic",
    scientificTermLabel: "Scientific or Technical Term to Translate",
    targetLanguageLabel: "Target Explanation Language",
    generateButton: "Synthesize Study Aid",
    outputHeading: "Structured Study Assistant Output",
  },
  performance: {
    title: "Student Performance & Analytics",
    subtitle: "Track exam grades, course progress, study hours, strengths, and subjects needing revision.",
    overallExamAverage: "Overall Exam Average",
    completedCoursesCount: "Completed Courses",
    totalStudyHours: "Logged Study Hours",
    examsPassedCount: "Examinations Passed",
    gradesChartTitle: "Examination Score History",
    gradesChartDescription: "Your percentage scores across completed examinations.",
    progressComparisonTitle: "Course Completion vs. Exam Mastery",
    progressComparisonDescription: "Compare your lesson progress against examination performance.",
    strengthsTitle: "Academic Strengths (≥ 75%)",
    weaknessesRevisionTitle: "Subjects Needing Revision (< 75%)",
    examGradesTableTitle: "Official Examination Grades & Feedback",
  },
  motivation: {
    title: "Learning Motivation, Achievements & Certificates",
    subtitle: "Complete weekly challenges, unlock academic badges, and claim verified completion certificates.",
    tabChallenges: "Weekly Challenges",
    tabAchievements: "Achievements & Rewards",
    tabCertificates: "My Certificates",
    weeklyChallengesTitle: "Active Weekly Learning Challenges",
    weeklyChallengesDescription: "Stay consistent with your study sessions and lesson milestones.",
    achievementsTitle: "Unlocked Academic Achievements",
    rewardsTitle: "Course Completion Rewards",
    certificatesTitle: "Verified Course Completion Certificates",
    certificatesDescription: "Courses with 100% completion are eligible for instant certificate issuance.",
    claimCertificateButton: "Claim Completion Certificate",
    certificateClaimedToast: "Official course certificate issued!",
    downloadCertificatePdfButton: "Print / Save Certificate PDF",
    certificateNumberLabel: "Certificate ID",
    verificationHashLabel: "Verification Hash",
  },
  ratings: {
    title: "Course & Teacher Ratings",
    subtitle: "Share 1-to-5 star ratings and written feedback for your enrolled and completed courses.",
    policyNotice: "Platform Policy: One verified course rating and one teacher rating per student per course. You may update your own review at any time.",
    selectCompletedCourseLabel: "Select Eligible Course",
    courseRatingStarsLabel: "Course Rating (1 to 5 Stars)",
    courseCommentLabel: "Written Course Feedback",
    submitCourseReviewButton: "Submit / Update Course Rating",
    courseReviewSavedToast: "Your course rating has been saved.",
    teacherRatingStarsLabel: "Teacher Rating (1 to 5 Stars)",
    teacherCommentLabel: "Written Teacher Feedback",
    submitTeacherReviewButton: "Submit / Update Teacher Rating",
    teacherReviewSavedToast: "Your teacher rating has been saved.",
    mySubmittedReviewsTitle: "My Submitted Reviews",
  },
  profile: {
    title: "Student Profile, Preferences & Achievements",
    subtitle: "Manage your avatar, personal info, password, 5-language preference, dark/light theme, and view your earned credentials.",
    openFullAccountSecurityButton: "Account & Security Settings",
    certificatesSummaryTitle: "Earned Certificates",
    achievementsSummaryTitle: "Learning Milestones",
  },
  exams: {
    title: "Secure Online Examination Center",
    subtitle: "Take assigned examinations with auto-save protection, integrity monitoring, and instant or teacher-verified results.",
    tabAvailable: "Assigned Examinations",
    tabHistory: "My Attempts & Results",
    startExamButton: "Open Examination",
    resumeExamButton: "Resume Active Attempt",
    viewResultButton: "Inspect Result & Analysis",
    attemptsUsedLabel: "Attempts Used",
    durationLabel: "Duration",
    marksLabel: "Total Marks",
    passingScoreLabel: "Passing Score",
    proctoredBadge: "Proctored Session",
    cameraRequiredBadge: "Camera Monitoring Enabled",
    instructionsHeading: "Examination Instructions & Integrity Agreement",
    privacyNoticeHeading: "Camera Monitoring & Privacy Notice",
    privacyNoticeBody: "When camera monitoring is enabled by your instructor, your webcam is activated strictly during the active examination session with a visible indicator. Event metadata and timestamps are retained only for the configured academic retention period and are never activated secretly. Uncertain automated detections never automatically fail your exam; all alerts are reviewed by your assigned teacher.",
    browserLimitationNotice: "Technical Transparency: Web browsers cannot guarantee complete OS-level screenshot prevention. Dynamic watermarks, focus/tab monitoring, and copy/print deterrence are active during this session.",
    cameraConsentCheckboxLabel: "I understand how camera & browser monitoring work and explicitly consent to session monitoring during this exam.",
    guardianConsentCheckboxLabel: "I confirm student / parent-guardian consent for examination integrity monitoring under platform privacy policy.",
    verifyCameraButton: "Verify Camera Availability",
    cameraVerifiedBadge: "Camera Verified & Ready",
    confirmStartExamButton: "Confirm & Begin Examination",
    timeRemainingLabel: "Time Remaining",
    autoSavedBadge: "Answers Auto-Saved",
    savingBadge: "Saving Answer...",
    cameraActiveIndicator: "CAMERA ACTIVE • SESSION MONITORED",
    simulatePhoneFlagButton: "Log AI Camera / Phone Check",
    focusObscuredHeading: "Examination Content Temporarily Obscured",
    focusObscuredDescription: "Browser focus or tab switch detected. This timestamped event has been logged for teacher review while your exam progress remains safely preserved.",
    returnToExamButton: "Resume Examination View",
    submitExamButton: "Submit Examination",
    submitConfirmHeading: "Confirm Final Examination Submission",
    submitConfirmDescription: "Are you sure you want to submit your examination? Choice questions are graded immediately and written essays are queued for AI suggestion & teacher verification.",
    submittedSuccessToast: "Examination submitted and saved.",
    timeExpiredToast: "Examination time expired — your saved answers have been submitted automatically.",
    resultSummaryHeading: "Official Examination Result & Topic Diagnostics",
    resultPendingPublicationNotice: "Your examination has been submitted. Official scores and answer breakdowns will appear once your instructor publishes the results.",
    answerBreakdownHeading: "Question-by-Question Review & Explanations",
    weakTopicsHeading: "Difficulty & Topic Weakness Analysis",
  },
};

const ar: StudentDictionary = {
  nav: {
    groupLearning: "تعلّمي",
    groupIntelligence: "الذكاء الاصطناعي والتحليلات",
    groupGrowth: "التحفيز والحساب",
    overview: "نظرة عامة للطالب",
    courses: "دوراتي ودروسي",
    exams: "الاختبارات الإلكترونية",
    aiAssistant: "مساعد الدراسة الذكي",
    performance: "لوحة الأداء والدرجات",
    motivation: "التحفيز والشهادات",
    ratings: "تقييم الدورات والمعلمين",
    profile: "الملف الشخصي للطالب",
  },
  common: {
    searchPlaceholder: "ابحث في الدورات أو الفصول أو الدروس...",
    allFilter: "الكل",
    open: "فتح",
    continueLearning: "متابعة التعلم",
    completed: "مكتمل",
    inProgress: "قيد التقدم",
    enrollNow: "التسجيل في الدورة",
    enrolledToast: "تم التسجيل في الدورة بنجاح.",
    save: "حفظ",
    cancel: "إلغاء",
    delete: "حذف",
    download: "تحميل الملف",
    noRecordsTitle: "لا توجد سجلات بعد",
    noRecordsDescription: "ابدأ باستكشاف دوراتك ودروسك المسجلة لعرض البيانات هنا.",
  },
  overview: {
    welcomePrefix: "مرحباً بعودتك،",
    subtitle: "واصل رحلتك التعليمية، تابع اختباراتك القادمة، وراجع إنجازاتك الدراسية.",
    enrolledCourses: "الدورات المسجلة",
    completionProgress: "متوسط إنجاز الدورات",
    upcomingExams: "الاختبارات القادمة",
    upcomingAssignments: "الواجبات النشطة",
    recentGrades: "آخر درجة اختبار",
    studyHours: "ساعات الدراسة",
    unreadNotifications: "إشعارات جديدة",
    enrolledCoursesSectionTitle: "دوراتك النشطة",
    enrolledCoursesSectionDescription: "استكمل التعلم من حيث توقفت.",
    upcomingExamsTitle: "الاختبارات القادمة",
    upcomingAssignmentsTitle: "الواجبات القادمة",
    recentGradesTitle: "أحدث الدرجات المنشورة",
    notificationsTitle: "مركز الإشعارات",
    markAllReadButton: "تحديد كمقروء",
    studyChartTitle: "تقدم الدورات وأداء الاختبارات",
    studyChartDescription: "مقارنة نسبة إتمام الدروس ومتوسط درجات الاختبارات لكل دورة.",
  },
  courses: {
    title: "دوراتي ومستكشف المناهج",
    subtitle: "تصفح الفصول، شاهد الدروس، استكمل الفيديو من آخر موضع محفوظ، احفظ المفضلة، وحمّل الملفات التعليمية.",
    tabEnrolled: "دوراتي المسجلة",
    tabCatalog: "الدورات المتاحة للتسجيل",
    tabFavorites: "الدروس المفضلة",
    searchCourseContentPlaceholder: "ابحث في الدروس أو الفصول أو رموز الدورات...",
    chaptersCountLabel: "الفصول",
    lessonsCountLabel: "الدروس",
    progressLabel: "نسبة الإنجاز",
    openLessonViewerButton: "فتح عارض الدرس",
    selectCoursePrompt: "اختر دورة مسجلة لتصفح فصولها ودروسها",
    resumeFromSecondLabel: "استئناف عند",
    favoriteButton: "إضافة للمفضلة",
    unfavoriteButton: "في المفضلة",
    favoritedToast: "تم تحديث قائمة المفضلة.",
  },
  lessonViewer: {
    backToCourses: "العودة إلى دوراتي",
    chapterLabel: "الفصل",
    lessonLabel: "الدرس",
    markCompleteButton: "تحديد الدرس كمكتمل",
    completedBadge: "مكتمل",
    saveResumePositionButton: "حفظ موضع استئناف الفيديو",
    positionSavedToast: "تم حفظ موضع الفيديو ووقت الدراسة.",
    lessonCompletedToast: "تم إكمال الدرس وتحديث تقدم الدورة!",
    previousLesson: "الدرس السابق",
    nextLesson: "الدرس التالي",
    tabOverviewMaterials: "محتوى الدرس والملفات",
    tabPersonalNotes: "ملاحظاتي الشخصية",
    tabPracticeQuiz: "اختبار تدريبي",
    tabRelatedLessons: "دروس ذات صلة",
    downloadAttachmentButton: "تحميل المرفق التعليمي",
    openExternalResourceButton: "فتح المصدر الخارجي",
    addNoteTitle: "إضافة ملاحظة شخصية على الدرس",
    noteTimestampLabel: "التوقيت في الفيديو (ثواني)",
    notePlaceholder: "اكتب ملاحظاتك، القوانين المهمة، أو النقاط التي تود مراجعتها...",
    saveNoteButton: "حفظ الملاحظة",
    noteSavedToast: "تم حفظ ملاحظتك الشخصية.",
    noteDeletedToast: "تم حذف الملاحظة.",
    practiceQuizHeading: "اختبار الفهم والتدريب بعد الدرس",
    practiceQuizDescription: "راجع أسئلة التقييم الذاتي الخاصة بهذا الدرس.",
  },
  aiAssistant: {
    title: "مساعد الدراسة الذكي Learnix AI",
    subtitle: "معلمك الذكي للإجابة عن أسئلة الدورات، مناقشة ملفات PDF، تلخيص الدروس، البطاقات التعليمية، ترجمة المصطلحات العلمية، وخطط المذاكرة.",
    part9Badge: "جاهز للربط مع محرك الذكاء الاصطناعي (الجزء 9)",
    part9Description: "مرتبط بدوراتك ودروسك الفعلية، وجاهز للربط مع نماذج الذكاء الاصطناعي في الجزء 9.",
    tabCourseQa: "أسئلة الدورة ومناقشة PDF",
    tabSummariesFlashcards: "ملخصات الدروس والبطاقات التعليمية",
    tabPracticeQuizTermTranslator: "الاختبار التدريبي وترجمة المصطلحات",
    tabStudyPlan: "خطة المذاكرة الذكية",
    selectCourseLabel: "اختر الدورة",
    selectLessonLabel: "اختر الدرس / ملف PDF",
    askPromptLabel: "سؤالك أو الموضوع الصعب الذي تريد شرحه",
    scientificTermLabel: "المصطلح العلمي أو التقني للترجمة والشرح",
    targetLanguageLabel: "لغة الشرح المطلوبة",
    generateButton: "توليد المحتوى المساعد",
    outputHeading: "مخرجات مساعد الدراسة المهيكل",
  },
  performance: {
    title: "لوحة الأداء والتحليلات الدراسية",
    subtitle: "تابع درجات الاختبارات، تقدم الدورات، ساعات الدراسة، نقاط القوة، والمواد التي تحتاج إلى مراجعة.",
    overallExamAverage: "المتوسط العام للاختبارات",
    completedCoursesCount: "الدورات المكتملة",
    totalStudyHours: "ساعات الدراسة المسجلة",
    examsPassedCount: "الاختبارات المجتازة",
    gradesChartTitle: "سجل درجات الاختبارات",
    gradesChartDescription: "النسب المئوية لدرجاتك في الاختبارات المكتملة.",
    progressComparisonTitle: "مقارنة إنجاز الدروس بأداء الاختبارات",
    progressComparisonDescription: "قارن تقدمك في الدروس بمتوسط درجاتك في كل دورة.",
    strengthsTitle: "نقاط القوة الأكاديمية (≥ 75%)",
    weaknessesRevisionTitle: "مواد تحتاج إلى مراجعة (< 75%)",
    examGradesTableTitle: "جدول درجات الاختبارات وملاحظات المعلمين",
  },
  motivation: {
    title: "التحفيز الدراسي والإنجازات والشهادات",
    subtitle: "أكمل التحديات الأسبوعية، افتح أوسمة التفوق، واحصل على شهادات إتمام الدورات المعتمدة.",
    tabChallenges: "التحديات الأسبوعية",
    tabAchievements: "الإنجازات والمكافآت",
    tabCertificates: "شهاداتي المعتمدة",
    weeklyChallengesTitle: "تحديات التعلم الأسبوعية",
    weeklyChallengesDescription: "حافظ على انتظام جلسات المذاكرة وإتمام الدروس.",
    achievementsTitle: "أوسمة الإنجاز الأكاديمي",
    rewardsTitle: "مكافآت إتمام الدورات",
    certificatesTitle: "شهادات إتمام الدورات الموثقة",
    certificatesDescription: "الدورات المكتملة بنسبة 100% مؤهلة لإصدار الشهادة فوراً.",
    claimCertificateButton: "إصدار شهادة إتمام الدورة",
    certificateClaimedToast: "تم إصدار شهادة إتمام الدورة بنجاح!",
    downloadCertificatePdfButton: "طباعة / حفظ الشهادة PDF",
    certificateNumberLabel: "رقم الشهادة",
    verificationHashLabel: "رمز التحقق",
  },
  ratings: {
    title: "تقييم الدورات والمعلمين",
    subtitle: "قيّم الدورات والمعلمين من 1 إلى 5 نجوم مع كتابة رأيك بعد دراسة الدورة.",
    policyNotice: "سياسة المنصة: تقييم واحد للدورة وتقييم واحد للمعلم لكل طالب في كل دورة، مع إمكانية تعديل تقييمك في أي وقت.",
    selectCompletedCourseLabel: "اختر الدورة المؤهلة للتقييم",
    courseRatingStarsLabel: "تقييم الدورة (من 1 إلى 5 نجوم)",
    courseCommentLabel: "رأيك المكتوب في الدورة",
    submitCourseReviewButton: "حفظ / تحديث تقييم الدورة",
    courseReviewSavedToast: "تم حفظ تقييم الدورة بنجاح.",
    teacherRatingStarsLabel: "تقييم المعلم (من 1 إلى 5 نجوم)",
    teacherCommentLabel: "رأيك المكتوب حول المعلم",
    submitTeacherReviewButton: "حفظ / تحديث تقييم المعلم",
    teacherReviewSavedToast: "تم حفظ تقييم المعلم بنجاح.",
    mySubmittedReviewsTitle: "تقييماتي المرسلة",
  },
  profile: {
    title: "الملف الشخصي والإعدادات والإنجازات",
    subtitle: "عدّل صورتك الشخصية وبياناتك وكلمة المرور واللغة والمظهر، واستعرض شهاداتك.",
    openFullAccountSecurityButton: "إعدادات الحساب والأمان",
    certificatesSummaryTitle: "الشهادات المكتسبة",
    achievementsSummaryTitle: "أوسمة التعلم",
  },
  exams: {
    title: "مركز الاختبارات الإلكترونية الآمن",
    subtitle: "أدِّ اختباراتك المخصصة مع الحفظ التلقائي، المراقبة، والنتائج الفورية أو المعتمدة.",
    tabAvailable: "الاختبارات المتاحة",
    tabHistory: "محاولاتي ونتائجي",
    startExamButton: "فتح الاختبار",
    resumeExamButton: "استئناف المحاولة النشطة",
    viewResultButton: "عرض النتيجة والتحليل",
    attemptsUsedLabel: "المحاولات المستخدمة",
    durationLabel: "المدة",
    marksLabel: "إجمالي الدرجات",
    passingScoreLabel: "نسبة النجاح",
    proctoredBadge: "مراقبة مفعّلة",
    cameraRequiredBadge: "مراقبة الكاميرا مطلوبة",
    instructionsHeading: "تعليمات الاختبار وميثاق النزاهة",
    privacyNoticeHeading: "إشعار الخصوصية ومراقبة الكاميرا",
    privacyNoticeBody: "عند تفعيل مراقبة الكاميرا من قِبل المعلم، تعمل الكاميرا حصرياً أثناء جلسة الاختبار النشطة مع مؤشر مرئي واضح، ولا يتم تشغيلها سراً أبداً. يتم الاحتفاظ ببيانات الأحداث والتوقيتات فقط خلال فترة الحفظ المحددة، ولا تؤدي التنبيهات الآلية غير المؤكدة إلى الرسوب التلقائي بل تُعرض على المعلم للمراجعة.",
    browserLimitationNotice: "شفافية تقنية: متصفحات الويب لا يمكنها منع التقاط الشاشة على مستوى نظام التشغيل بالكامل؛ لذلك يتم تفعيل العلامة المائية الديناميكية ومراقبة تبديل التبويبات ومنع النسخ والطباعة.",
    cameraConsentCheckboxLabel: "أفهم آلية عمل مراقبة الكاميرا والمتصفح وأوافق صراحةً على مراقبة الجلسة أثناء هذا الاختبار.",
    guardianConsentCheckboxLabel: "أؤكد موافقة الطالب / ولي الأمر على شروط نزاهة الاختبار وسياسة الخصوصية.",
    verifyCameraButton: "التحقق من جاهزية الكاميرا",
    cameraVerifiedBadge: "الكاميرا جاهزة ومفعّلة",
    confirmStartExamButton: "تأكيد وبدء الاختبار الآن",
    timeRemainingLabel: "الوقت المتبقي",
    autoSavedBadge: "تم الحفظ تلقائياً",
    savingBadge: "جارٍ حفظ الإجابة...",
    cameraActiveIndicator: "الكاميرا نشطة • الجلسة مراقبة",
    simulatePhoneFlagButton: "تسجيل فحص الكاميرا / الهاتف",
    focusObscuredHeading: "تم إخفاء محتوى الاختبار مؤقتاً",
    focusObscuredDescription: "تم رصد مغادرة صفحة الاختبار أو فقدان تركيز النافذة، وتم تسجيل الحدث للمعلم مع الحفاظ الكامل على إجاباتك.",
    returnToExamButton: "العودة إلى شاشة الاختبار",
    submitExamButton: "تسليم الاختبار النهائي",
    submitConfirmHeading: "تأكيد التسليم النهائي للاختبار",
    submitConfirmDescription: "هل أنت متأكد من تسليم الاختبار؟ يتم تصحيح أسئلة الاختيار تلقائياً وإرسال الأسئلة المقالية لمراجعة المعلم.",
    submittedSuccessToast: "تم تسليم الاختبار وحفظ إجاباتك بنجاح.",
    timeExpiredToast: "انتهى وقت الاختبار — تم تسليم إجاباتك المحفوظة تلقائياً.",
    resultSummaryHeading: "نتيجة الاختبار وتحليل الأداء",
    resultPendingPublicationNotice: "تم تسليم اختبارك بنجاح. ستظهر الدرجة التفصيلية فور اعتماد ونشر النتيجة من قِبل المعلم.",
    answerBreakdownHeading: "مراجعة الأسئلة والإجابات والشرح",
    weakTopicsHeading: "تحليل مستويات الصعوبة ونقاط الضعف",
  },
};

const de: StudentDictionary = {
  ...en,
  nav: {
    groupLearning: "Mein Lernen",
    groupIntelligence: "KI & Analysen",
    groupGrowth: "Motivation & Konto",
    overview: "Studierenden-Übersicht",
    courses: "Meine Kurse",
    exams: "Online-Prüfungen",
    aiAssistant: "KI-Lernassistent",
    performance: "Leistungs-Dashboard",
    motivation: "Motivation & Zertifikate",
    ratings: "Kursbewertungen",
    profile: "Mein Profil",
  },
};

const it: StudentDictionary = {
  ...en,
  nav: {
    groupLearning: "Il Mio Apprendimento",
    groupIntelligence: "IA e Analisi",
    groupGrowth: "Motivazione e Profilo",
    overview: "Panoramica Studente",
    courses: "I Miei Corsi",
    exams: "Esami Online",
    aiAssistant: "Assistente Studio IA",
    performance: "Dashboard Prestazioni",
    motivation: "Motivazione e Certificati",
    ratings: "Valutazioni Corsi",
    profile: "Profilo Studente",
  },
};

const fr: StudentDictionary = {
  ...en,
  nav: {
    groupLearning: "Mon Apprentissage",
    groupIntelligence: "IA & Analyses",
    groupGrowth: "Motivation & Compte",
    overview: "Aperçu Étudiant",
    courses: "Mes Cours",
    exams: "Examens en Ligne",
    aiAssistant: "Assistant d'Étude IA",
    performance: "Tableau de Performance",
    motivation: "Motivation & Certificats",
    ratings: "Évaluations des Cours",
    profile: "Profil Étudiant",
  },
};

const STUDENT_DICTIONARIES: Record<Locale, StudentDictionary> = {
  en,
  ar,
  de,
  it,
  fr,
};

export function getStudentDictionary(locale: Locale): StudentDictionary {
  return STUDENT_DICTIONARIES[locale] ?? STUDENT_DICTIONARIES.en;
}
