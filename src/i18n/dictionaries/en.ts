import type { Dictionary } from "@/i18n/types";

export const en: Dictionary = {
  locale: "en",
  brand: {
    name: "Learnix",
    tagline: "Learnix",
    fullName: "Learnix",
    subtitle: "Next-Generation Intelligent Learning Platform",
  },
  common: {
    loading: "Loading…",
    retry: "Try again",
    save: "Save changes",
    cancel: "Cancel",
    close: "Close",
    search: "Search",
    backToHome: "Back to Homepage",
    skipToContent: "Skip to main content",
    placeholderTag: "Owner Placeholder",
  },
  theme: {
    label: "Theme",
    toggleAria: "Change color theme",
    light: "Light",
    dark: "Dark",
    system: "System",
  },
  language: {
    label: "Language",
    selectAria: "Select interface language",
    switchedToastTitle: "Language updated",
    switchedToastDescription: "The interface is now displayed in English.",
  },
  roles: {
    admin: "Administrator",
    teacher: "Teacher",
    student: "Student",
  },
  nav: {
    home: "Home",
    about: "About",
    features: "Features",
    courses: "Courses",
    ai: "AI Assistant",
    whyLearnix: "Why Learnix",
    contact: "Contact",
    login: "Login",
    createAccount: "Create Account",
    openMenuAria: "Open navigation menu",
    closeMenuAria: "Close navigation menu",
    mobileMenuDescription: "Navigate through Learnix sections and account options.",
  },
  hero: {
    eyebrow: "AI-Powered Academic Excellence",
    headlineStart: "Elevate Understanding with",
    headlineHighlight: "Intelligent Mastery",
    headlineEnd: "Built for Modern Education",
    description:
      "Learnix unifies structured online courses, smart examinations, real-time student analytics, and a context-aware AI tutor inside one secure, distraction-free learning environment.",
    primaryCta: "Get Started",
    secondaryCta: "Explore Features",
    architectureNote:
      "Designed for learners, educators, and academic institutions with strict data privacy.",
    illustration: {
      badge: "Learnix Engine",
      panelTitle: "Adaptive Learning Workspace",
      panelSubtitle: "Real-time comprehension synthesis & rubric alignment",
      moduleLabel: "Active Curriculum Unit",
      moduleTitle: "Structured Concept Synthesis & Smart Assessment",
      aiInsightLabel: "AI Learning Assistant",
      aiInsightText:
        "Breaks down complex topics step by step, checks reasoning, and suggests targeted practice without giving away exam answers.",
      examIntegrityLabel: "Assessment Engine",
      examIntegrityValue: "Timed & Auto-Graded",
      adaptivePathLabel: "Study Guidance",
      adaptivePathValue: "Concept-Linked",
      analyticsLabel: "Progress Telemetry",
      analyticsValue: "Live Diagnostics",
    },
  },
  about: {
    eyebrow: "About Learnix",
    title: "A Cohesive Educational Ecosystem Built Around Deep Comprehension",
    subtitle:
      "Learnix bridges structured curriculum authoring, rigorous assessment, and responsible AI mentorship so students don't just memorize—they master.",
    missionLabel: "Our Educational Mission",
    missionText:
      "To empower every learner and educator with transparent, structured, and intelligent tools that turn passive study into measurable conceptual mastery.",
    pillars: [
      {
        id: "what-is-learnix",
        title: "What Learnix Is",
        description:
          "A unified academic platform combining structured multi-module courses, interactive lessons, proctored-style smart assessments, and role-dedicated workspaces for students, teachers, and administrators.",
      },
      {
        id: "educational-mission",
        title: "Our Educational Mission",
        description:
          "Eliminate fragmented educational tooling by delivering clarity, accessibility, and high academic rigor across every device and language.",
      },
      {
        id: "learning-approach",
        title: "Structured Learning Approach",
        description:
          "Every lesson links directly to clear learning objectives, formative checkpoints, and actionable feedback loops so progress is continuous and verifiable.",
      },
      {
        id: "ai-capabilities",
        title: "AI-Powered Capabilities",
        description:
          "Pedagogically aligned AI guides students through difficult concepts, summarizes key takeaways, and helps instructors design balanced assessments.",
      },
    ],
  },
  features: {
    eyebrow: "Platform Capabilities",
    title: "Everything Needed for Modern Teaching & Learning",
    subtitle:
      "Engineered from the ground up with modular architecture, accessible interfaces, and enterprise-grade security.",
    items: [
      {
        id: "online-courses",
        tag: "Curriculum",
        title: "Online Courses",
        description:
          "Organize learning paths into structured chapters, rich multimedia lessons, downloadable resources, and milestone checkpoints.",
      },
      {
        id: "smart-examinations",
        tag: "Assessment",
        title: "Smart Examinations",
        description:
          "Build timed exams with diverse question formats, automated scoring rubrics, randomized pools, and instant diagnostic breakdowns.",
      },
      {
        id: "ai-learning-assistant",
        tag: "Learnix AI",
        title: "AI Learning Assistant",
        description:
          "On-demand Socratic explanations, concept simplification, and personalized revision prompts tailored to each lesson.",
      },
      {
        id: "student-analytics",
        tag: "Insights",
        title: "Student Analytics",
        description:
          "Track concept mastery, completion velocity, exam accuracy trends, and knowledge gaps through clear visual telemetry.",
      },
      {
        id: "teacher-tools",
        tag: "Instruction",
        title: "Teacher Tools",
        description:
          "Streamline course authoring, question bank management, cohort monitoring, and grading workflows from one workspace.",
      },
      {
        id: "secure-environment",
        tag: "Security",
        title: "Secure Learning Environment",
        description:
          "Protected by row-level database security, verified session tokens, role-isolated permissions, and privacy-first data handling.",
      },
    ],
  },
  coursesPreview: {
    eyebrow: "Courses Catalog",
    title: "Explore Academic Tracks & Published Courses",
    subtitle:
      "Courses and categories load dynamically from the Learnix database as instructors publish approved curricula.",
    allCategoriesTab: "All Categories",
    categoriesHint: "Live database synchronization — zero synthetic or placeholder course records.",
    emptyTitle: "No published courses are available in the catalog yet",
    emptyDescription:
      "Learnix never displays fabricated courses or synthetic enrollment counts. As soon as instructors publish courses from the backend database, categories and course cards will appear here automatically.",
    emptyBackendNote: "Status: Connected to catalog schema · Awaiting published course records",
    emptyPrimaryCta: "Create Account for Updates",
    emptySecondaryCta: "Contact Academic Team",
  },
  aiSection: {
    eyebrow: "Learnix AI",
    title: "How Learnix AI Accelerates Student Understanding",
    subtitle:
      "Rather than replacing critical thinking, Learnix AI acts as a patient academic mentor that adapts to each learner's pace.",
    capabilities: [
      {
        id: "step-1",
        step: "01",
        title: "Contextual Lesson Breakdown",
        description:
          "Students highlight any dense paragraph, formula, or theorem to receive clear, layered explanations matched to the current lesson.",
      },
      {
        id: "step-2",
        step: "02",
        title: "Guided Gap Remediation",
        description:
          "After quizzes or practice sets, the AI pinpoints why errors occurred and builds targeted micro-reviews to close comprehension gaps.",
      },
      {
        id: "step-3",
        step: "03",
        title: "Structured Exam Readiness",
        description:
          "Generates concept summaries, self-check flashcards, and reasoning prompts that strengthen long-term retention before exams.",
      },
    ],
    previewCard: {
      headerBadge: "Interactive Study Session",
      headerTitle: "Learnix AI Concept Mentor",
      studentPromptLabel: "Student Question",
      studentPromptText:
        "Can you help me understand why time complexity changes when we switch from a linear scan to a balanced search tree?",
      aiResponseLabel: "Learnix AI Guidance",
      aiResponsePoint1:
        "1. Core Intuition: Each comparison in a balanced tree halves the remaining search space instead of checking elements one by one.",
      aiResponsePoint2:
        "2. Formal Relation: Halving N items repeatedly takes log₂(N) steps, shifting lookup complexity from O(N) to O(log N).",
      aiResponsePoint3:
        "3. Self-Check Prompt: If a dataset grows from 1,024 to 1,048,576 items, how many additional tree comparisons are required?",
      footerNote: "Pedagogical guardrails active · Encourages reasoning before revealing solutions",
    },
  },
  whyChoose: {
    eyebrow: "Why Choose Learnix",
    title: "Engineered for Academic Clarity, Speed, and Trust",
    subtitle:
      "Six foundational advantages that set Learnix apart from legacy learning management systems.",
    items: [
      {
        id: "adv-1",
        title: "Distraction-Free Precision UI",
        description:
          "High-contrast typography, calibrated light and dark themes, and restrained metallic gold accents keep focus on learning.",
      },
      {
        id: "adv-2",
        title: "Native Multilingual & RTL Architecture",
        description:
          "Seamless switching across English, Arabic (with full RTL layout), German, Italian, and French with persisted preferences.",
      },
      {
        id: "adv-3",
        title: "Responsible Pedagogical AI",
        description:
          "Purpose-built to scaffold comprehension and academic integrity rather than generating unverified shortcuts.",
      },
      {
        id: "adv-4",
        title: "Unified Role Workspaces",
        description:
          "Dedicated, purpose-tuned interfaces for Students, Teachers, and Administrators under a single coherent platform.",
      },
      {
        id: "adv-5",
        title: "Actionable Progress Telemetry",
        description:
          "Real-time charts and rubric breakdowns turn raw assessment data into clear next steps for learners and educators.",
      },
      {
        id: "adv-6",
        title: "Security & Privacy by Default",
        description:
          "Built on PostgreSQL with strict Row-Level Security (RLS) and verified server-side JWT validation.",
      },
    ],
  },
  contact: {
    eyebrow: "Contact Us",
    title: "Connect with the Learnix Team",
    subtitle:
      "Have a question about institutional deployment, curriculum partnerships, or platform access? Send us a message below.",
    infoTitle: "Official Contact Channels",
    infoSubtitle:
      "Official organization contact details are displayed as clearly labeled placeholders until supplied by the platform owner.",
    placeholderNotice:
      "Owner Configuration Pending: Replace the placeholders below with official organization contact details.",
    emailLabel: "Support Email",
    emailPlaceholderValue: "[Placeholder — Official support email not yet supplied by owner]",
    phoneLabel: "Phone / Desk",
    phonePlaceholderValue: "[Placeholder — Official phone number not yet supplied by owner]",
    addressLabel: "Headquarters",
    addressPlaceholderValue: "[Placeholder — Official physical address not yet supplied by owner]",
    hoursLabel: "Support Hours",
    hoursPlaceholderValue: "[Placeholder — Official support schedule not yet supplied by owner]",
    form: {
      fullNameLabel: "Full Name",
      fullNamePlaceholder: "Enter your full name",
      emailLabel: "Email Address",
      emailPlaceholder: "name@example.com",
      subjectLabel: "Subject",
      subjectPlaceholder: "How can we help you?",
      messageLabel: "Message",
      messagePlaceholder: "Write your inquiry or feedback in detail…",
      submitButton: "Send Message",
      submittingButton: "Sending…",
      resetButton: "Clear Form",
      successToastTitle: "Message validated and received",
      successToastDescription:
        "Thank you for contacting Learnix. Your inquiry has been recorded.",
      errorToastTitle: "Please check the highlighted fields",
      errorToastDescription: "Some required contact details need attention before sending.",
      validation: {
        fullNameMin: "Full name must be at least 2 characters.",
        fullNameMax: "Full name cannot exceed 80 characters.",
        emailInvalid: "Please enter a valid email address.",
        subjectMin: "Subject must be at least 4 characters.",
        subjectMax: "Subject cannot exceed 120 characters.",
        messageMin: "Message must be at least 15 characters.",
        messageMax: "Message cannot exceed 1,500 characters.",
      },
    },
  },
  footer: {
    aboutDescription:
      "Learnix is a modern AI-powered educational platform uniting structured courses, smart examinations, and real-time analytics.",
    usefulLinksTitle: "Platform Navigation",
    legalLinksTitle: "Legal & Policies",
    contactTitle: "Contact Information",
    privacyPolicy: "Privacy Policy",
    termsOfService: "Terms of Service",
    designSystemLink: "Part 1 Design System",
    socialLabel: "Official Social Channels (Owner Placeholders)",
    socialPlaceholderToast:
      "Social channel URL placeholder — official profile link will be configured by the platform owner.",
    copyright: "Learnix. All rights reserved.",
  },
  authEntries: {
    part4Badge: "Part 4 Authentication Module",
    part4Notice:
      "This authentication entry point is wired and ready. Live Supabase Auth sign-in, registration, and password recovery workflows will be activated in Part 4.",
    backToLanding: "Return to Public Landing Page",
    login: {
      title: "Sign In to Learnix",
      subtitle: "Access your personalized learning, teaching, or administration workspace.",
      emailLabel: "Email Address",
      passwordLabel: "Password",
      forgotPasswordLink: "Forgot your password?",
      submitButton: "Continue to Sign In",
      noAccountPrompt: "New to Learnix?",
      createAccountLink: "Create an account",
    },
    signup: {
      title: "Create Your Learnix Account",
      subtitle: "Join Learnix to start structured courses and AI-assisted study.",
      fullNameLabel: "Full Name",
      emailLabel: "Email Address",
      roleLabel: "Account Role",
      passwordLabel: "Create Password",
      submitButton: "Create Account",
      hasAccountPrompt: "Already have an account?",
      loginLink: "Sign in",
    },
    forgotPassword: {
      title: "Reset Your Password",
      subtitle: "Enter your account email to receive password recovery instructions.",
      emailLabel: "Email Address",
      submitButton: "Send Recovery Link",
      rememberedPrompt: "Remembered your password?",
      backToLoginLink: "Back to sign in",
    },
    pendingToastTitle: "Scheduled for Part 4",
    pendingToastDescription:
      "Full authentication backend workflows will be enabled in Part 4 of the build plan.",
  },
  legal: {
    placeholderBadge: "Legal Template Placeholder",
    placeholderNotice:
      "The legal text below is a structural placeholder until the platform owner provides jurisdiction-specific legal counsel terms.",
    privacyTitle: "Privacy Policy",
    privacySubtitle:
      "How Learnix handles account data, learning records, and security.",
    privacySections: [
      {
        title: "1. Data Collection & Purpose [Owner Placeholder]",
        body: "Learnix collects only the account and academic activity information required to deliver courses, assessments, and progress analytics. Replace with owner-approved data controller details.",
      },
      {
        title: "2. Security & Row-Level Isolation [Owner Placeholder]",
        body: "All database records are protected with PostgreSQL Row-Level Security (RLS) and encrypted transport. Replace with formal institutional retention schedules.",
      },
      {
        title: "3. Contact for Privacy Inquiries [Owner Placeholder]",
        body: "Data protection contact email and physical address will be supplied by the platform owner.",
      },
    ],
    termsTitle: "Terms of Service",
    termsSubtitle:
      "Rules and academic integrity guidelines for using the Learnix platform.",
    termsSections: [
      {
        title: "1. Platform Usage & Academic Integrity [Owner Placeholder]",
        body: "Users agree to maintain academic honesty during smart examinations and use AI assistance responsibly. Replace with formal legal terms from the platform owner.",
      },
      {
        title: "2. Account Responsibilities [Owner Placeholder]",
        body: "Students, teachers, and administrators are responsible for safeguarding their credentials and adhering to institutional guidelines.",
      },
      {
        title: "3. Governing Law & Jurisdiction [Owner Placeholder]",
        body: "Governing jurisdiction and dispute resolution details will be inserted by the platform owner.",
      },
    ],
  },
};
