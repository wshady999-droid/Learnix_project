import type { Locale } from "@/lib/preferences";

export interface AuthDictionary {
  common: {
    orContinueWith: string;
    googleButton: string;
    rememberSession: string;
    signOut: string;
    signingOut: string;
    signedOutToast: string;
    profileMenuLabel: string;
    dashboardLink: string;
    profileSettingsLink: string;
    optionalTag: string;
    requiredTag: string;
    showPassword: string;
    hidePassword: string;
  };
  passwordRules: {
    heading: string;
    minLength: string;
    uppercase: string;
    lowercase: string;
    number: string;
    special: string;
    mismatch: string;
  };
  login: {
    badge: string;
    title: string;
    subtitle: string;
    emailLabel: string;
    emailPlaceholder: string;
    passwordLabel: string;
    forgotPasswordLink: string;
    submitPasswordButton: string;
    submittingPasswordButton: string;
    noAccountPrompt: string;
    createAccountLink: string;
    invalidCredentialsError: string;
    accountSuspendedError: string;
    sessionExpiredNotice: string;
    loginSuccessToast: string;
  };
  signup: {
    badge: string;
    title: string;
    subtitle: string;
    studentTab: string;
    teacherTab: string;
    studentDescription: string;
    teacherDescription: string;
    emailAlreadyExistsError: string;
    registrationSuccessToast: string;
    teacherRegistrationSuccessToast: string;
    useDifferentEmail: string;
    fullNameLabel: string;
    fullNamePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    countryCodeLabel: string;
    phoneLabel: string;
    phonePlaceholder: string;
    passwordLabel: string;
    confirmPasswordLabel: string;
    avatarLabel: string;
    avatarHelp: string;
    specializationLabel: string;
    specializationPlaceholder: string;
    qualificationsLabel: string;
    qualificationsPlaceholder: string;
    submitStudentButton: string;
    submitTeacherButton: string;
    submittingButton: string;
    hasAccountPrompt: string;
    loginLink: string;
    validation: {
      fullNameMin: string;
      emailInvalid: string;
      phoneInvalid: string;
      specializationMin: string;
      qualificationsMin: string;
      avatarSizeError: string;
      avatarTypeError: string;
    };
  };
  recovery: {
    forgotBadge: string;
    forgotTitle: string;
    forgotSubtitle: string;
    sendLinkButton: string;
    sendingLinkButton: string;
    neutralConfirmationTitle: string;
    neutralConfirmationDescription: string;
    resetBadge: string;
    resetTitle: string;
    resetSubtitle: string;
    newPasswordLabel: string;
    confirmNewPasswordLabel: string;
    updatePasswordButton: string;
    updatingPasswordButton: string;
    passwordUpdatedToast: string;
    backToLogin: string;
  };
  profile: {
    pageTitle: string;
    pageSubtitle: string;
    personalInfoTitle: string;
    personalInfoDescription: string;
    avatarSectionTitle: string;
    uploadAvatarButton: string;
    uploadingAvatarButton: string;
    avatarUpdatedToast: string;
    bioLabel: string;
    bioPlaceholder: string;
    saveProfileButton: string;
    savingProfileButton: string;
    profileSavedToast: string;
    preferencesTitle: string;
    preferencesDescription: string;
    languagePreferenceLabel: string;
    themePreferenceLabel: string;
    notificationsTitle: string;
    notificationsDescription: string;
    notifEmailUpdates: string;
    notifCourseAlerts: string;
    notifExamReminders: string;
    notifGradeNotifications: string;
    notifSecurityAlerts: string;
    savePreferencesButton: string;
    preferencesSavedToast: string;
    securityTitle: string;
    securityDescription: string;
    changePasswordButton: string;
    roleBadgeLabel: string;
    teacherRequestStatusLabel: string;
    teacherRequestPending: string;
    teacherRequestApproved: string;
    teacherRequestRejected: string;
  };
}

export const AUTH_DICTIONARIES: Readonly<Record<Locale, AuthDictionary>> = {
  en: {
    common: {
      orContinueWith: "Or continue with",
      googleButton: "Continue with Google",
      rememberSession: "Keep me signed in on this device",
      signOut: "Sign Out",
      signingOut: "Signing out…",
      signedOutToast: "You have been signed out securely.",
      profileMenuLabel: "Account & Profile",
      dashboardLink: "Go to Dashboard",
      profileSettingsLink: "Profile & Security",
      optionalTag: "Optional",
      requiredTag: "Required",
      showPassword: "Show password",
      hidePassword: "Hide password",
    },
    passwordRules: {
      heading: "Password security requirements:",
      minLength: "At least 8 characters",
      uppercase: "At least one uppercase letter (A–Z)",
      lowercase: "At least one lowercase letter (a–z)",
      number: "At least one number (0–9)",
      special: "At least one special character (!@#$%^&*…)",
      mismatch: "Passwords do not match.",
    },
    login: {
      badge: "Secure Workspace Access",
      title: "Sign In to Learnix",
      subtitle: "Access your Student, Teacher, or Administrator dashboard.",
      emailLabel: "Email Address",
      emailPlaceholder: "name@example.com",
      passwordLabel: "Password",
      forgotPasswordLink: "Forgot password?",
      submitPasswordButton: "Sign In",
      submittingPasswordButton: "Signing in…",
      noAccountPrompt: "Don't have a Learnix account?",
      createAccountLink: "Create an account",
      invalidCredentialsError: "Invalid email or password. Please verify your credentials.",
      accountSuspendedError:
        "This account is currently suspended. Please contact platform administration.",
      sessionExpiredNotice: "Your session expired. Please sign in again to continue.",
      loginSuccessToast: "Welcome back to Learnix.",
    },
    signup: {
      badge: "Account Registration",
      title: "Create Your Learnix Account",
      subtitle: "Choose your registration track below to get started.",
      studentTab: "Student Account",
      teacherTab: "Teacher Account",
      studentDescription:
        "Instant access to course enrollment, interactive lessons, smart exams, and AI tutoring.",
      teacherDescription:
        "Instant access to create and manage your courses, upload materials, build smart exams, and grade student submissions.",
      emailAlreadyExistsError:
        "An account with this email address already exists. Please sign in or reset your password.",
      registrationSuccessToast: "Your Learnix account is ready. Welcome!",
      teacherRegistrationSuccessToast:
        "Your Learnix teacher account is active. Welcome to your Teacher Dashboard!",
      useDifferentEmail: "Use a different email address",
      fullNameLabel: "Full Name",
      fullNamePlaceholder: "Enter your full legal or academic name",
      emailLabel: "Email Address",
      emailPlaceholder: "name@example.com",
      countryCodeLabel: "Country",
      phoneLabel: "Phone Number",
      phonePlaceholder: "555 019 2834",
      passwordLabel: "Password",
      confirmPasswordLabel: "Confirm Password",
      avatarLabel: "Profile Picture",
      avatarHelp: "JPEG, PNG, WebP, or AVIF up to 5 MB.",
      specializationLabel: "Academic Specialization / Subject Area",
      specializationPlaceholder: "e.g. Artificial Intelligence, Applied Mathematics, Physics",
      qualificationsLabel: "Professional & Educational Qualifications",
      qualificationsPlaceholder:
        "Summarize your academic degree, teaching experience, institution, and relevant credentials…",
      submitStudentButton: "Create Student Account",
      submitTeacherButton: "Create Teacher Account",
      submittingButton: "Creating account…",
      hasAccountPrompt: "Already have a Learnix account?",
      loginLink: "Sign in",
      validation: {
        fullNameMin: "Full name must be at least 2 characters.",
        emailInvalid: "Please enter a valid email address.",
        phoneInvalid: "Please enter a valid phone number (6–15 digits).",
        specializationMin: "Please specify your academic specialization (at least 3 characters).",
        qualificationsMin:
          "Please provide your educational and professional details (at least 20 characters).",
        avatarSizeError: "Profile picture must be 5 MB or smaller.",
        avatarTypeError: "Only JPEG, PNG, WebP, or AVIF images are allowed.",
      },
    },
    recovery: {
      forgotBadge: "Account Recovery",
      forgotTitle: "Reset Your Password",
      forgotSubtitle:
        "Enter the email address associated with your account and we will send recovery instructions.",
      sendLinkButton: "Send Recovery Instructions",
      sendingLinkButton: "Sending…",
      neutralConfirmationTitle: "Check Your Inbox",
      neutralConfirmationDescription:
        "If an account exists for that email address, password recovery instructions have been sent. Check your inbox and spam folder.",
      resetBadge: "Set New Password",
      resetTitle: "Choose a New Password",
      resetSubtitle: "Enter and confirm your new strong password below.",
      newPasswordLabel: "New Password",
      confirmNewPasswordLabel: "Confirm New Password",
      updatePasswordButton: "Update Password",
      updatingPasswordButton: "Updating password…",
      passwordUpdatedToast: "Your password has been updated. You can now sign in.",
      backToLogin: "Return to Sign In",
    },
    profile: {
      pageTitle: "Profile & Account Security",
      pageSubtitle:
        "Manage your personal details, profile picture, language, theme, notification preferences, and password.",
      personalInfoTitle: "Personal Information",
      personalInfoDescription: "Update your name, phone number, and academic bio.",
      avatarSectionTitle: "Profile Picture",
      uploadAvatarButton: "Upload New Photo",
      uploadingAvatarButton: "Uploading…",
      avatarUpdatedToast: "Profile picture updated.",
      bioLabel: "Academic Bio",
      bioPlaceholder: "Share a brief introduction about your academic interests or teaching focus…",
      saveProfileButton: "Save Personal Info",
      savingProfileButton: "Saving…",
      profileSavedToast: "Your personal profile information has been saved.",
      preferencesTitle: "Interface & Regional Preferences",
      preferencesDescription: "Synchronize your preferred language and color theme.",
      languagePreferenceLabel: "Preferred Interface Language",
      themePreferenceLabel: "Preferred Color Theme",
      notificationsTitle: "Notification Preferences",
      notificationsDescription: "Choose which platform alerts and reminders you receive.",
      notifEmailUpdates: "Important platform announcements via email",
      notifCourseAlerts: "New lesson and course material updates",
      notifExamReminders: "Upcoming examination schedule reminders",
      notifGradeNotifications: "Instant notifications when results are published",
      notifSecurityAlerts: "Account login and security activity alerts",
      savePreferencesButton: "Save Preferences",
      preferencesSavedToast: "Your notification and interface preferences have been saved.",
      securityTitle: "Password & Session Security",
      securityDescription: "Rotate your account password with full strength validation.",
      changePasswordButton: "Update Password",
      roleBadgeLabel: "Authorized Role",
      teacherRequestStatusLabel: "Teacher Application Status",
      teacherRequestPending: "Pending Administrator Approval",
      teacherRequestApproved: "Approved",
      teacherRequestRejected: "Not Approved",
    },
  },
  ar: {
    common: {
      orContinueWith: "أو المتابعة باستخدام",
      googleButton: "المتابعة باستخدام Google",
      rememberSession: "إبقاء تسجيل دخولي نشطاً على هذا الجهاز",
      signOut: "تسجيل الخروج",
      signingOut: "جاري تسجيل الخروج…",
      signedOutToast: "تم تسجيل خروجك بأمان.",
      profileMenuLabel: "الحساب والملف الشخصي",
      dashboardLink: "الانتقال إلى لوحة التحكم",
      profileSettingsLink: "الملف الشخصي والأمان",
      optionalTag: "اختياري",
      requiredTag: "مطلوب",
      showPassword: "إظهار كلمة المرور",
      hidePassword: "إخفاء كلمة المرور",
    },
    passwordRules: {
      heading: "متطلبات أمان كلمة المرور:",
      minLength: "8 أحرف على الأقل",
      uppercase: "حرف كبير واحد على الأقل (A–Z)",
      lowercase: "حرف صغير واحد على الأقل (a–z)",
      number: "رقم واحد على الأقل (0–9)",
      special: "رمز خاص واحد على الأقل (!@#$%^&*…)",
      mismatch: "كلمتا المرور غير متطابقتين.",
    },
    login: {
      badge: "دخول آمن للمنصة",
      title: "تسجيل الدخول إلى ليرنيكس",
      subtitle: "ادخل إلى لوحة تحكم الطالب أو المعلم أو مدير النظام.",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "name@example.com",
      passwordLabel: "كلمة المرور",
      forgotPasswordLink: "نسيت كلمة المرور؟",
      submitPasswordButton: "تسجيل الدخول",
      submittingPasswordButton: "جاري تسجيل الدخول…",
      noAccountPrompt: "ليس لديك حساب في ليرنيكس؟",
      createAccountLink: "إنشاء حساب جديد",
      invalidCredentialsError: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
      accountSuspendedError: "هذا الحساب موقوف حالياً. يرجى التواصل مع إدارة المنصة.",
      sessionExpiredNotice: "انتهت صلاحية الجلسة. يرجى تسجيل الدخول مرة أخرى.",
      loginSuccessToast: "مرحباً بعودتك إلى ليرنيكس – Learnix.",
    },
    signup: {
      badge: "تسجيل حساب جديد",
      title: "إنشاء حسابك في ليرنيكس",
      subtitle: "اختر مسار التسجيل أدناه للبدء.",
      studentTab: "حساب طالب",
      teacherTab: "حساب معلم",
      studentDescription:
        "وصول فوري للتسجيل في الدورات والدروس التفاعلية والاختبارات الذكية والمساعد الذكي.",
      teacherDescription:
        "وصول فوري لإنشاء وإدارة دوراتك ورفع المواد التعليمية وبناء الاختبارات الذكية وتصحيح إجابات الطلاب.",
      emailAlreadyExistsError:
        "يوجد حساب مسجل بهذا البريد الإلكتروني بالفعل. يرجى تسجيل الدخول أو استعادة كلمة المرور.",
      registrationSuccessToast: "تم إنشاء حسابك في ليرنيكس بنجاح. مرحباً بك!",
      teacherRegistrationSuccessToast:
        "تم تفعيل حساب المعلم الخاص بك في ليرنيكس. مرحباً بك في لوحة تحكم المعلم!",
      useDifferentEmail: "استخدام بريد إلكتروني آخر",
      fullNameLabel: "الاسم الكامل",
      fullNamePlaceholder: "أدخل اسمك الكامل",
      emailLabel: "البريد الإلكتروني",
      emailPlaceholder: "name@example.com",
      countryCodeLabel: "الدولة",
      phoneLabel: "رقم الهاتف",
      phonePlaceholder: "50 123 4567",
      passwordLabel: "كلمة المرور",
      confirmPasswordLabel: "تأكيد كلمة المرور",
      avatarLabel: "الصورة الشخصية",
      avatarHelp: "صورة JPEG أو PNG أو WebP أو AVIF بحد أقصى 5 ميجابايت.",
      specializationLabel: "التخصص الأكاديمي / المجال العلمي",
      specializationPlaceholder: "مثال: الذكاء الاصطناعي، الرياضيات التطبيقية، الفيزياء",
      qualificationsLabel: "المؤهلات العلمية والخبرة المهنية",
      qualificationsPlaceholder:
        "اذكر درجتك الأكاديمية وخبراتك التدريسية والمؤسسة التعليمية والمؤهلات ذات الصلة…",
      submitStudentButton: "إنشاء حساب طالب",
      submitTeacherButton: "إنشاء حساب معلم",
      submittingButton: "جاري إنشاء الحساب…",
      hasAccountPrompt: "لديك حساب بالفعل في ليرنيكس؟",
      loginLink: "تسجيل الدخول",
      validation: {
        fullNameMin: "يجب أن يتكون الاسم الكامل من حرفين على الأقل.",
        emailInvalid: "يرجى إدخال بريد إلكتروني صحيح.",
        phoneInvalid: "يرجى إدخال رقم هاتف صحيح (من 6 إلى 15 رقماً).",
        specializationMin: "يرجى تحديد التخصص الأكاديمي (3 أحرف على الأقل).",
        qualificationsMin: "يرجى كتابة المؤهلات العلمية والمهنية (20 حرفاً على الأقل).",
        avatarSizeError: "يجب ألا يتجاوز حجم الصورة الشخصية 5 ميجابايت.",
        avatarTypeError: "يُسمح فقط بصور JPEG أو PNG أو WebP أو AVIF.",
      },
    },
    recovery: {
      forgotBadge: "استعادة الحساب",
      forgotTitle: "إعادة تعيين كلمة المرور",
      forgotSubtitle:
        "أدخل البريد الإلكتروني المرتبط بحسابك وسنرسل لك تعليمات استعادة كلمة المرور.",
      sendLinkButton: "إرسال تعليمات الاستعادة",
      sendingLinkButton: "جاري الإرسال…",
      neutralConfirmationTitle: "تحقق من بريدك الوارد",
      neutralConfirmationDescription:
        "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، فقد تم إرسال تعليمات إعادة تعيين كلمة المرور.",
      resetBadge: "تعيين كلمة مرور جديدة",
      resetTitle: "اختر كلمة مرور جديدة",
      resetSubtitle: "أدخل كلمة المرور الجديدة القوية وأكّدها أدناه.",
      newPasswordLabel: "كلمة المرور الجديدة",
      confirmNewPasswordLabel: "تأكيد كلمة المرور الجديدة",
      updatePasswordButton: "تحديث كلمة المرور",
      updatingPasswordButton: "جاري التحديث…",
      passwordUpdatedToast: "تم تحديث كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.",
      backToLogin: "العودة إلى تسجيل الدخول",
    },
    profile: {
      pageTitle: "الملف الشخصي وأمان الحساب",
      pageSubtitle:
        "إدارة بياناتك الشخصية وصورتك واللغة والمظهر وتفضيلات الإشعارات وكلمة المرور.",
      personalInfoTitle: "المعلومات الشخصية",
      personalInfoDescription: "تحديث الاسم ورقم الهاتف والنبذة الأكاديمية.",
      avatarSectionTitle: "الصورة الشخصية",
      uploadAvatarButton: "رفع صورة جديدة",
      uploadingAvatarButton: "جاري الرفع…",
      avatarUpdatedToast: "تم تحديث الصورة الشخصية.",
      bioLabel: "النبذة الأكاديمية",
      bioPlaceholder: "اكتب نبذة مختصرة عن اهتماماتك الأكاديمية أو مجالك التدريسي…",
      saveProfileButton: "حفظ المعلومات الشخصية",
      savingProfileButton: "جاري الحفظ…",
      profileSavedToast: "تم حفظ معلومات ملفك الشخصي بنجاح.",
      preferencesTitle: "تفضيلات الواجهة واللغة",
      preferencesDescription: "مزامنة اللغة المفضلة ومظهر الألوان.",
      languagePreferenceLabel: "لغة الواجهة المفضلة",
      themePreferenceLabel: "مظهر الألوان المفضل",
      notificationsTitle: "تفضيلات الإشعارات",
      notificationsDescription: "تحكم في التنبيهات والتذكيرات التيتصلك من المنصة.",
      notifEmailUpdates: "إعلانات المنصة الهامة عبر البريد الإلكتروني",
      notifCourseAlerts: "تحديثات الدروس والمواد التعليمية الجديدة",
      notifExamReminders: "تذكيرات مواعيد الاختبارات القادمة",
      notifGradeNotifications: "إشعارات فورية عند نشر النتائج",
      notifSecurityAlerts: "تنبيهات تسجيل الدخول وأنشطة أمان الحساب",
      savePreferencesButton: "حفظ التفضيلات",
      preferencesSavedToast: "تم حفظ تفضيلات الإشعارات والواجهة.",
      securityTitle: "أمان كلمة المرور والجلسة",
      securityDescription: "تغيير كلمة المرور مع التحقق الكامل من قوتها.",
      changePasswordButton: "تحديث كلمة المرور",
      roleBadgeLabel: "الدور المعتمد",
      teacherRequestStatusLabel: "حالة طلب المعلم",
      teacherRequestPending: "قيد مراجعة مدير النظام",
      teacherRequestApproved: "معتمد",
      teacherRequestRejected: "غير معتمد",
    },
  },
  de: {
    common: {
      orContinueWith: "Oder fortfahren mit",
      googleButton: "Mit Google fortfahren",
      rememberSession: "Auf diesem Gerät angemeldet bleiben",
      signOut: "Abmelden",
      signingOut: "Abmeldung läuft…",
      signedOutToast: "Sie wurden sicher abgemeldet.",
      profileMenuLabel: "Konto & Profil",
      dashboardLink: "Zum Dashboard",
      profileSettingsLink: "Profil & Sicherheit",
      optionalTag: "Optional",
      requiredTag: "Erforderlich",
      showPassword: "Passwort anzeigen",
      hidePassword: "Passwort verbergen",
    },
    passwordRules: {
      heading: "Sicherheitsanforderungen an das Passwort:",
      minLength: "Mindestens 8 Zeichen",
      uppercase: "Mindestens ein Großbuchstabe (A–Z)",
      lowercase: "Mindestens ein Kleinbuchstabe (a–z)",
      number: "Mindestens eine Ziffer (0–9)",
      special: "Mindestens ein Sonderzeichen (!@#$%^&*…)",
      mismatch: "Die Passwörter stimmen nicht überein.",
    },
    login: {
      badge: "Sicherer Arbeitsbereich-Zugang",
      title: "Bei Learnix anmelden",
      subtitle: "Greifen Sie auf Ihr Studierenden-, Lehrkräfte- oder Admin-Dashboard zu.",
      emailLabel: "E-Mail-Adresse",
      emailPlaceholder: "name@beispiel.de",
      passwordLabel: "Passwort",
      forgotPasswordLink: "Passwort vergessen?",
      submitPasswordButton: "Anmelden",
      submittingPasswordButton: "Anmeldung…",
      noAccountPrompt: "Noch kein Learnix-Konto?",
      createAccountLink: "Konto erstellen",
      invalidCredentialsError: "Ungültige E-Mail-Adresse oder falsches Passwort.",
      accountSuspendedError:
        "Dieses Konto ist derzeit gesperrt. Bitte wenden Sie sich an die Administration.",
      sessionExpiredNotice: "Ihre Sitzung ist abgelaufen. Bitte melden Sie sich erneut an.",
      loginSuccessToast: "Willkommen zurück bei Learnix.",
    },
    signup: {
      badge: "Kontoregistrierung",
      title: "Ihr Learnix-Konto erstellen",
      subtitle: "Wählen Sie unten Ihren Registrierungspfad.",
      studentTab: "Studierendenkonto",
      teacherTab: "Lehrkräftekonto",
      studentDescription:
        "Sofortiger Zugang zu Kursen, interaktiven Lektionen, Prüfungen und KI-Tutor.",
      teacherDescription:
        "Sofortiger Zugang zum Erstellen und Verwalten eigener Kurse, Hochladen von Materialien, Erstellen von Prüfungen und Bewerten von Einreichungen.",
      emailAlreadyExistsError:
        "Ein Konto mit dieser E-Mail-Adresse existiert bereits. Bitte melden Sie sich an oder setzen Sie Ihr Passwort zurück.",
      registrationSuccessToast: "Ihr Learnix-Konto ist bereit. Willkommen!",
      teacherRegistrationSuccessToast:
        "Ihr Learnix-Lehrkräftekonto ist aktiv. Willkommen im Lehrkräfte-Dashboard!",
      useDifferentEmail: "Andere E-Mail-Adresse verwenden",
      fullNameLabel: "Vollständiger Name",
      fullNamePlaceholder: "Geben Sie Ihren vollständigen Namen ein",
      emailLabel: "E-Mail-Adresse",
      emailPlaceholder: "name@beispiel.de",
      countryCodeLabel: "Land",
      phoneLabel: "Telefonnummer",
      phonePlaceholder: "151 23456789",
      passwordLabel: "Passwort",
      confirmPasswordLabel: "Passwort bestätigen",
      avatarLabel: "Profilbild",
      avatarHelp: "JPEG, PNG, WebP oder AVIF bis zu 5 MB.",
      specializationLabel: "Akademisches Fachgebiet / Spezialisierung",
      specializationPlaceholder: "z. B. Künstliche Intelligenz, Angewandte Mathematik, Physik",
      qualificationsLabel: "Berufliche & akademische Qualifikationen",
      qualificationsPlaceholder:
        "Fassen Sie Ihren Abschluss, Ihre Lehrerfahrung, Institution und relevante Nachweise zusammen…",
      submitStudentButton: "Studierendenkonto erstellen",
      submitTeacherButton: "Lehrkräftekonto erstellen",
      submittingButton: "Konto wird erstellt…",
      hasAccountPrompt: "Haben Sie bereits ein Learnix-Konto?",
      loginLink: "Anmelden",
      validation: {
        fullNameMin: "Der vollständige Name muss mindestens 2 Zeichen enthalten.",
        emailInvalid: "Bitte geben Sie eine gültige E-Mail-Adresse ein.",
        phoneInvalid: "Bitte geben Sie eine gültige Telefonnummer ein (6–15 Ziffern).",
        specializationMin: "Bitte geben Sie Ihr Fachgebiet an (mindestens 3 Zeichen).",
        qualificationsMin:
          "Bitte beschreiben Sie Ihre Qualifikationen (mindestens 20 Zeichen).",
        avatarSizeError: "Das Profilbild darf maximal 5 MB groß sein.",
        avatarTypeError: "Nur JPEG-, PNG-, WebP- oder AVIF-Bilder sind zulässig.",
      },
    },
    recovery: {
      forgotBadge: "Kontowiederherstellung",
      forgotTitle: "Passwort zurücksetzen",
      forgotSubtitle:
        "Geben Sie die E-Mail-Adresse Ihres Kontos ein, um Anweisungen zum Zurücksetzen zu erhalten.",
      sendLinkButton: "Anweisungen senden",
      sendingLinkButton: "Wird gesendet…",
      neutralConfirmationTitle: "Posteingang prüfen",
      neutralConfirmationDescription:
        "Falls ein Konto für diese E-Mail-Adresse existiert, wurden Anweisungen zum Zurücksetzen des Passworts gesendet.",
      resetBadge: "Neues Passwort festlegen",
      resetTitle: "Neues Passwort wählen",
      resetSubtitle: "Geben Sie unten Ihr neues sicheres Passwort ein und bestätigen Sie es.",
      newPasswordLabel: "Neues Passwort",
      confirmNewPasswordLabel: "Neues Passwort bestätigen",
      updatePasswordButton: "Passwort aktualisieren",
      updatingPasswordButton: "Wird aktualisiert…",
      passwordUpdatedToast: "Ihr Passwort wurde aktualisiert. Sie können sich jetzt anmelden.",
      backToLogin: "Zurück zur Anmeldung",
    },
    profile: {
      pageTitle: "Profil & Kontosicherheit",
      pageSubtitle:
        "Verwalten Sie persönliche Daten, Profilbild, Sprache, Design, Benachrichtigungen und Passwort.",
      personalInfoTitle: "Persönliche Angaben",
      personalInfoDescription: "Aktualisieren Sie Name, Telefonnummer und akademische Kurzbiografie.",
      avatarSectionTitle: "Profilbild",
      uploadAvatarButton: "Neues Foto hochladen",
      uploadingAvatarButton: "Wird hochgeladen…",
      avatarUpdatedToast: "Profilbild aktualisiert.",
      bioLabel: "Akademische Biografie",
      bioPlaceholder: "Kurze Vorstellung Ihrer Studieninteressen oder Lehrschwerpunkte…",
      saveProfileButton: "Persönliche Daten speichern",
      savingProfileButton: "Wird gespeichert…",
      profileSavedToast: "Ihre Profilinformationen wurden gespeichert.",
      preferencesTitle: "Oberflächen- & Spracheinstellungen",
      preferencesDescription: "Synchronisieren Sie Ihre bevorzugte Sprache und Ihr Farbschema.",
      languagePreferenceLabel: "Bevorzugte Sprache",
      themePreferenceLabel: "Bevorzugtes Farbschema",
      notificationsTitle: "Benachrichtigungseinstellungen",
      notificationsDescription: "Wählen Sie aus, welche Plattformhinweise Sie erhalten möchten.",
      notifEmailUpdates: "Wichtige Plattformankündigungen per E-Mail",
      notifCourseAlerts: "Neue Lektionen und Kursmaterialien",
      notifExamReminders: "Erinnerungen an bevorstehende Prüfungen",
      notifGradeNotifications: "Sofortige Benachrichtigung bei veröffentlichten Ergebnissen",
      notifSecurityAlerts: "Sicherheits- und Anmeldewarnungen",
      savePreferencesButton: "Einstellungen speichern",
      preferencesSavedToast: "Ihre Einstellungen wurden gespeichert.",
      securityTitle: "Passwort- & Sitzungssicherheit",
      securityDescription: "Ändern Sie Ihr Kontopasswort mit vollständiger Sicherheitsprüfung.",
      changePasswordButton: "Passwort aktualisieren",
      roleBadgeLabel: "Autorisierte Rolle",
      teacherRequestStatusLabel: "Status des Lehrkraft-Antrags",
      teacherRequestPending: "Wartet auf Administratorfreigabe",
      teacherRequestApproved: "Freigegeben",
      teacherRequestRejected: "Nicht freigegeben",
    },
  },
  it: {
    common: {
      orContinueWith: "Oppure continua con",
      googleButton: "Continua con Google",
      rememberSession: "Mantieni l'accesso su questo dispositivo",
      signOut: "Disconnetti",
      signingOut: "Disconnessione…",
      signedOutToast: "Disconnessione effettuata in sicurezza.",
      profileMenuLabel: "Account e profilo",
      dashboardLink: "Vai alla Dashboard",
      profileSettingsLink: "Profilo e sicurezza",
      optionalTag: "Facoltativo",
      requiredTag: "Obbligatorio",
      showPassword: "Mostra password",
      hidePassword: "Nascondi password",
    },
    passwordRules: {
      heading: "Requisiti di sicurezza della password:",
      minLength: "Almeno 8 caratteri",
      uppercase: "Almeno una lettera maiuscola (A–Z)",
      lowercase: "Almeno una lettera minuscola (a–z)",
      number: "Almeno un numero (0–9)",
      special: "Almeno un carattere speciale (!@#$%^&*…)",
      mismatch: "Le password non coincidono.",
    },
    login: {
      badge: "Accesso sicuro allo spazio di lavoro",
      title: "Accedi a Learnix",
      subtitle: "Accedi alla tua dashboard Studente, Docente o Amministratore.",
      emailLabel: "Indirizzo email",
      emailPlaceholder: "nome@esempio.it",
      passwordLabel: "Password",
      forgotPasswordLink: "Password dimenticata?",
      submitPasswordButton: "Accedi",
      submittingPasswordButton: "Accesso in corso…",
      noAccountPrompt: "Non hai un account Learnix?",
      createAccountLink: "Crea un account",
      invalidCredentialsError: "Email o password non validi. Verifica le tue credenziali.",
      accountSuspendedError:
        "Questo account è attualmente sospeso. Contatta l'amministrazione della piattaforma.",
      sessionExpiredNotice: "La sessione è scaduta. Accedi nuovamente per continuare.",
      loginSuccessToast: "Bentornato su Learnix.",
    },
    signup: {
      badge: "Registrazione account",
      title: "Crea il tuo account Learnix",
      subtitle: "Scegli il tuo percorso di registrazione qui sotto.",
      studentTab: "Account Studente",
      teacherTab: "Account Docente",
      studentDescription:
        "Accesso immediato a corsi, lezioni interattive, esami intelligenti e tutor IA.",
      teacherDescription:
        "Accesso immediato per creare e gestire i tuoi corsi, caricare materiali, creare esami intelligenti e valutare gli elaborati degli studenti.",
      emailAlreadyExistsError:
        "Esiste già un account con questo indirizzo email. Accedi o reimposta la password.",
      registrationSuccessToast: "Il tuo account Learnix è pronto. Benvenuto!",
      teacherRegistrationSuccessToast:
        "Il tuo account Docente Learnix è attivo. Benvenuto nella Dashboard Docente!",
      useDifferentEmail: "Usa un indirizzo email diverso",
      fullNameLabel: "Nome e cognome",
      fullNamePlaceholder: "Inserisci il tuo nome completo",
      emailLabel: "Indirizzo email",
      emailPlaceholder: "nome@esempio.it",
      countryCodeLabel: "Paese",
      phoneLabel: "Numero di telefono",
      phonePlaceholder: "320 123 4567",
      passwordLabel: "Password",
      confirmPasswordLabel: "Conferma password",
      avatarLabel: "Foto profilo",
      avatarHelp: "JPEG, PNG, WebP o AVIF fino a 5 MB.",
      specializationLabel: "Specializzazione accademica / Materia",
      specializationPlaceholder: "es. Intelligenza Artificiale, Matematica Applicata, Fisica",
      qualificationsLabel: "Qualifiche professionali e accademiche",
      qualificationsPlaceholder:
        "Riassumi titolo di studio, esperienza di insegnamento, istituto e credenziali…",
      submitStudentButton: "Crea account Studente",
      submitTeacherButton: "Crea account Docente",
      submittingButton: "Creazione account…",
      hasAccountPrompt: "Hai già un account Learnix?",
      loginLink: "Accedi",
      validation: {
        fullNameMin: "Il nome completo deve contenere almeno 2 caratteri.",
        emailInvalid: "Inserisci un indirizzo email valido.",
        phoneInvalid: "Inserisci un numero di telefono valido (6–15 cifre).",
        specializationMin: "Indica la tua specializzazione accademica (almeno 3 caratteri).",
        qualificationsMin:
          "Descrivi le tue qualifiche accademiche e professionali (almeno 20 caratteri).",
        avatarSizeError: "La foto profilo non può superare 5 MB.",
        avatarTypeError: "Sono consentite solo immagini JPEG, PNG, WebP o AVIF.",
      },
    },
    recovery: {
      forgotBadge: "Recupero account",
      forgotTitle: "Reimposta la password",
      forgotSubtitle:
        "Inserisci l'indirizzo email associato al tuo account per ricevere le istruzioni di recupero.",
      sendLinkButton: "Invia istruzioni di recupero",
      sendingLinkButton: "Invio in corso…",
      neutralConfirmationTitle: "Controlla la tua casella di posta",
      neutralConfirmationDescription:
        "Se esiste un account associato a questo indirizzo email, le istruzioni per reimpostare la password sono state inviate.",
      resetBadge: "Imposta nuova password",
      resetTitle: "Scegli una nuova password",
      resetSubtitle: "Inserisci e conferma la tua nuova password sicura qui sotto.",
      newPasswordLabel: "Nuova password",
      confirmNewPasswordLabel: "Conferma nuova password",
      updatePasswordButton: "Aggiorna password",
      updatingPasswordButton: "Aggiornamento…",
      passwordUpdatedToast: "La tua password è stata aggiornata. Ora puoi accedere.",
      backToLogin: "Torna all'accesso",
    },
    profile: {
      pageTitle: "Profilo e sicurezza dell'account",
      pageSubtitle:
        "Gestisci dati personali, foto profilo, lingua, tema, notifiche e password.",
      personalInfoTitle: "Informazioni personali",
      personalInfoDescription: "Aggiorna nome, numero di telefono e biografia accademica.",
      avatarSectionTitle: "Foto profilo",
      uploadAvatarButton: "Carica nuova foto",
      uploadingAvatarButton: "Caricamento…",
      avatarUpdatedToast: "Foto profilo aggiornata.",
      bioLabel: "Biografia accademica",
      bioPlaceholder: "Scrivi una breve presentazione sui tuoi interessi di studio o insegnamento…",
      saveProfileButton: "Salva informazioni personali",
      savingProfileButton: "Salvataggio…",
      profileSavedToast: "Le informazioni del profilo sono state salvate.",
      preferencesTitle: "Preferenze interfaccia e lingua",
      preferencesDescription: "Sincronizza la lingua preferita e il tema colore.",
      languagePreferenceLabel: "Lingua preferita dell'interfaccia",
      themePreferenceLabel: "Tema colore preferito",
      notificationsTitle: "Preferenze di notifica",
      notificationsDescription: "Scegli quali avvisi e promemoria ricevere dalla piattaforma.",
      notifEmailUpdates: "Comunicazioni importanti della piattaforma via email",
      notifCourseAlerts: "Aggiornamenti su nuove lezioni e materiali didattici",
      notifExamReminders: "Promemoria sui prossimi esami in programma",
      notifGradeNotifications: "Notifiche immediate alla pubblicazione dei risultati",
      notifSecurityAlerts: "Avvisi di sicurezza e attività di accesso",
      savePreferencesButton: "Salva preferenze",
      preferencesSavedToast: "Le tue preferenze sono state salvate.",
      securityTitle: "Sicurezza password e sessione",
      securityDescription: "Aggiorna la password del tuo account con validazione completa.",
      changePasswordButton: "Aggiorna password",
      roleBadgeLabel: "Ruolo autorizzato",
      teacherRequestStatusLabel: "Stato candidatura Docente",
      teacherRequestPending: "In attesa di approvazione Admin",
      teacherRequestApproved: "Approvata",
      teacherRequestRejected: "Non approvata",
    },
  },
  fr: {
    common: {
      orContinueWith: "Ou continuer avec",
      googleButton: "Continuer avec Google",
      rememberSession: "Rester connecté sur cet appareil",
      signOut: "Se déconnecter",
      signingOut: "Déconnexion…",
      signedOutToast: "Vous avez été déconnecté en toute sécurité.",
      profileMenuLabel: "Compte et profil",
      dashboardLink: "Aller au tableau de bord",
      profileSettingsLink: "Profil et sécurité",
      optionalTag: "Facultatif",
      requiredTag: "Requis",
      showPassword: "Afficher le mot de passe",
      hidePassword: "Masquer le mot de passe",
    },
    passwordRules: {
      heading: "Exigences de sécurité du mot de passe :",
      minLength: "Au moins 8 caractères",
      uppercase: "Au moins une lettre majuscule (A–Z)",
      lowercase: "Au moins une lettre minuscule (a–z)",
      number: "Au moins un chiffre (0–9)",
      special: "Au moins un caractère spécial (!@#$%^&*…)",
      mismatch: "Les mots de passe ne correspondent pas.",
    },
    login: {
      badge: "Accès sécurisé à l'espace de travail",
      title: "Connexion à Learnix",
      subtitle: "Accédez à votre tableau de bord Étudiant, Enseignant ou Administrateur.",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "nom@exemple.fr",
      passwordLabel: "Mot de passe",
      forgotPasswordLink: "Mot de passe oublié ?",
      submitPasswordButton: "Se connecter",
      submittingPasswordButton: "Connexion…",
      noAccountPrompt: "Vous n'avez pas encore de compte Learnix ?",
      createAccountLink: "Créer un compte",
      invalidCredentialsError: "Adresse e-mail ou mot de passe incorrect.",
      accountSuspendedError:
        "Ce compte est actuellement suspendu. Veuillez contacter l'administration.",
      sessionExpiredNotice: "Votre session a expiré. Veuillez vous reconnecter.",
      loginSuccessToast: "Bon retour sur Learnix.",
    },
    signup: {
      badge: "Inscription au compte",
      title: "Créer votre compte Learnix",
      subtitle: "Choisissez votre parcours d'inscription ci-dessous.",
      studentTab: "Compte Étudiant",
      teacherTab: "Compte Enseignant",
      studentDescription:
        "Accès immédiat aux cours, leçons interactives, examens intelligents et tuteur IA.",
      teacherDescription:
        "Accès immédiat pour créer et gérer vos cours, téléverser des supports, concevoir des examens intelligents et noter les copies.",
      emailAlreadyExistsError:
        "Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter ou réinitialiser votre mot de passe.",
      registrationSuccessToast: "Votre compte Learnix est prêt. Bienvenue !",
      teacherRegistrationSuccessToast:
        "Votre compte Enseignant Learnix est actif. Bienvenue sur votre tableau de bord !",
      useDifferentEmail: "Utiliser une autre adresse e-mail",
      fullNameLabel: "Nom complet",
      fullNamePlaceholder: "Saisissez votre nom complet",
      emailLabel: "Adresse e-mail",
      emailPlaceholder: "nom@exemple.fr",
      countryCodeLabel: "Pays",
      phoneLabel: "Numéro de téléphone",
      phonePlaceholder: "6 12 34 56 78",
      passwordLabel: "Mot de passe",
      confirmPasswordLabel: "Confirmer le mot de passe",
      avatarLabel: "Photo de profil",
      avatarHelp: "JPEG, PNG, WebP ou AVIF jusqu'à 5 Mo.",
      specializationLabel: "Spécialisation académique / Discipline",
      specializationPlaceholder: "ex. Intelligence Artificielle, Mathématiques Appliquées, Physique",
      qualificationsLabel: "Qualifications professionnelles et académiques",
      qualificationsPlaceholder:
        "Résumez votre diplôme, votre expérience d'enseignement, votre établissement et vos références…",
      submitStudentButton: "Créer un compte Étudiant",
      submitTeacherButton: "Créer un compte Enseignant",
      submittingButton: "Création du compte…",
      hasAccountPrompt: "Vous avez déjà un compte Learnix ?",
      loginLink: "Se connecter",
      validation: {
        fullNameMin: "Le nom complet doit comporter au moins 2 caractères.",
        emailInvalid: "Veuillez saisir une adresse e-mail valide.",
        phoneInvalid: "Veuillez saisir un numéro de téléphone valide (6 à 15 chiffres).",
        specializationMin: "Veuillez indiquer votre spécialisation (au moins 3 caractères).",
        qualificationsMin:
          "Veuillez détailler vos qualifications académiques et professionnelles (au moins 20 caractères).",
        avatarSizeError: "La photo de profil ne doit pas dépasser 5 Mo.",
        avatarTypeError: "Seules les images JPEG, PNG, WebP ou AVIF sont autorisées.",
      },
    },
    recovery: {
      forgotBadge: "Récupération de compte",
      forgotTitle: "Réinitialiser votre mot de passe",
      forgotSubtitle:
        "Saisissez l'adresse e-mail associée à votre compte pour recevoir les instructions de récupération.",
      sendLinkButton: "Envoyer les instructions",
      sendingLinkButton: "Envoi en cours…",
      neutralConfirmationTitle: "Vérifiez votre boîte de réception",
      neutralConfirmationDescription:
        "Si un compte correspond à cette adresse e-mail, les instructions de réinitialisation du mot de passe ont été envoyées.",
      resetBadge: "Définir un nouveau mot de passe",
      resetTitle: "Choisissez un nouveau mot de passe",
      resetSubtitle: "Saisissez et confirmez votre nouveau mot de passe sécurisé ci-dessous.",
      newPasswordLabel: "Nouveau mot de passe",
      confirmNewPasswordLabel: "Confirmer le nouveau mot de passe",
      updatePasswordButton: "Mettre à jour le mot de passe",
      updatingPasswordButton: "Mise à jour…",
      passwordUpdatedToast:
        "Votre mot de passe a été mis à jour. Vous pouvez maintenant vous connecter.",
      backToLogin: "Retour à la connexion",
    },
    profile: {
      pageTitle: "Profil et sécurité du compte",
      pageSubtitle:
        "Gérez vos informations personnelles, photo de profil, langue, thème, notifications et mot de passe.",
      personalInfoTitle: "Informations personnelles",
      personalInfoDescription: "Mettez à jour votre nom, numéro de téléphone et biographie académique.",
      avatarSectionTitle: "Photo de profil",
      uploadAvatarButton: "Téléverser une nouvelle photo",
      uploadingAvatarButton: "Téléversement…",
      avatarUpdatedToast: "Photo de profil mise à jour.",
      bioLabel: "Biographie académique",
      bioPlaceholder: "Présentez brièvement vos centres d'intérêt académiques ou d'enseignement…",
      saveProfileButton: "Enregistrer les informations",
      savingProfileButton: "Enregistrement…",
      profileSavedToast: "Vos informations personnelles ont été enregistrées.",
      preferencesTitle: "Préférences d'interface et de langue",
      preferencesDescription: "Synchronisez votre langue préférée et votre thème de couleur.",
      languagePreferenceLabel: "Langue d'interface préférée",
      themePreferenceLabel: "Thème de couleur préféré",
      notificationsTitle: "Préférences de notification",
      notificationsDescription: "Choisissez les alertes et rappels que vous souhaitez recevoir.",
      notifEmailUpdates: "Annonces importantes de la plateforme par e-mail",
      notifCourseAlerts: "Mises à jour des nouvelles leçons et supports de cours",
      notifExamReminders: "Rappels des examens programmés à venir",
      notifGradeNotifications: "Notifications instantanées lors de la publication des résultats",
      notifSecurityAlerts: "Alertes de connexion et d'activité de sécurité",
      savePreferencesButton: "Enregistrer les préférences",
      preferencesSavedToast: "Vos préférences ont été enregistrées.",
      securityTitle: "Sécurité du mot de passe et de la session",
      securityDescription: "Modifiez votre mot de passe avec validation complète de robustesse.",
      changePasswordButton: "Mettre à jour le mot de passe",
      roleBadgeLabel: "Rôle autorisé",
      teacherRequestStatusLabel: "Statut de la candidature Enseignant",
      teacherRequestPending: "En attente d'approbation Administrateur",
      teacherRequestApproved: "Approuvée",
      teacherRequestRejected: "Non approuvée",
    },
  },
};

export function getAuthDictionary(locale: Locale): AuthDictionary {
  return AUTH_DICTIONARIES[locale] ?? AUTH_DICTIONARIES.en;
}
