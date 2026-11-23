import type { Locale } from "@/lib/preferences";

export interface FeatureTranslationItem {
  id: string;
  title: string;
  description: string;
  tag: string;
}

export interface AboutPillarTranslationItem {
  id: string;
  title: string;
  description: string;
}

export interface AiCapabilityTranslationItem {
  id: string;
  step: string;
  title: string;
  description: string;
}

export interface AdvantageTranslationItem {
  id: string;
  title: string;
  description: string;
}

export interface Dictionary {
  locale: Locale;
  brand: {
    name: string;
    tagline: string;
    fullName: string;
    subtitle: string;
  };
  common: {
    loading: string;
    retry: string;
    save: string;
    cancel: string;
    close: string;
    search: string;
    backToHome: string;
    skipToContent: string;
    placeholderTag: string;
  };
  theme: {
    label: string;
    toggleAria: string;
    light: string;
    dark: string;
    system: string;
  };
  language: {
    label: string;
    selectAria: string;
    switchedToastTitle: string;
    switchedToastDescription: string;
  };
  roles: {
    admin: string;
    teacher: string;
    student: string;
  };
  nav: {
    home: string;
    about: string;
    features: string;
    courses: string;
    ai: string;
    whyLearnix: string;
    contact: string;
    login: string;
    createAccount: string;
    openMenuAria: string;
    closeMenuAria: string;
    mobileMenuDescription: string;
  };
  hero: {
    eyebrow: string;
    headlineStart: string;
    headlineHighlight: string;
    headlineEnd: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    architectureNote: string;
    illustration: {
      badge: string;
      panelTitle: string;
      panelSubtitle: string;
      moduleLabel: string;
      moduleTitle: string;
      aiInsightLabel: string;
      aiInsightText: string;
      examIntegrityLabel: string;
      examIntegrityValue: string;
      adaptivePathLabel: string;
      adaptivePathValue: string;
      analyticsLabel: string;
      analyticsValue: string;
    };
  };
  about: {
    eyebrow: string;
    title: string;
    subtitle: string;
    missionLabel: string;
    missionText: string;
    pillars: readonly AboutPillarTranslationItem[];
  };
  features: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: readonly FeatureTranslationItem[];
  };
  coursesPreview: {
    eyebrow: string;
    title: string;
    subtitle: string;
    allCategoriesTab: string;
    categoriesHint: string;
    emptyTitle: string;
    emptyDescription: string;
    emptyBackendNote: string;
    emptyPrimaryCta: string;
    emptySecondaryCta: string;
  };
  aiSection: {
    eyebrow: string;
    title: string;
    subtitle: string;
    capabilities: readonly AiCapabilityTranslationItem[];
    previewCard: {
      headerBadge: string;
      headerTitle: string;
      studentPromptLabel: string;
      studentPromptText: string;
      aiResponseLabel: string;
      aiResponsePoint1: string;
      aiResponsePoint2: string;
      aiResponsePoint3: string;
      footerNote: string;
    };
  };
  whyChoose: {
    eyebrow: string;
    title: string;
    subtitle: string;
    items: readonly AdvantageTranslationItem[];
  };
  contact: {
    eyebrow: string;
    title: string;
    subtitle: string;
    infoTitle: string;
    infoSubtitle: string;
    placeholderNotice: string;
    emailLabel: string;
    emailPlaceholderValue: string;
    phoneLabel: string;
    phonePlaceholderValue: string;
    addressLabel: string;
    addressPlaceholderValue: string;
    hoursLabel: string;
    hoursPlaceholderValue: string;
    form: {
      fullNameLabel: string;
      fullNamePlaceholder: string;
      emailLabel: string;
      emailPlaceholder: string;
      subjectLabel: string;
      subjectPlaceholder: string;
      messageLabel: string;
      messagePlaceholder: string;
      submitButton: string;
      submittingButton: string;
      resetButton: string;
      successToastTitle: string;
      successToastDescription: string;
      errorToastTitle: string;
      errorToastDescription: string;
      validation: {
        fullNameMin: string;
        fullNameMax: string;
        emailInvalid: string;
        subjectMin: string;
        subjectMax: string;
        messageMin: string;
        messageMax: string;
      };
    };
  };
  footer: {
    aboutDescription: string;
    usefulLinksTitle: string;
    legalLinksTitle: string;
    contactTitle: string;
    privacyPolicy: string;
    termsOfService: string;
    designSystemLink: string;
    socialLabel: string;
    socialPlaceholderToast: string;
    copyright: string;
  };
  authEntries: {
    part4Badge: string;
    part4Notice: string;
    backToLanding: string;
    login: {
      title: string;
      subtitle: string;
      emailLabel: string;
      passwordLabel: string;
      forgotPasswordLink: string;
      submitButton: string;
      noAccountPrompt: string;
      createAccountLink: string;
    };
    signup: {
      title: string;
      subtitle: string;
      fullNameLabel: string;
      emailLabel: string;
      roleLabel: string;
      passwordLabel: string;
      submitButton: string;
      hasAccountPrompt: string;
      loginLink: string;
    };
    forgotPassword: {
      title: string;
      subtitle: string;
      emailLabel: string;
      submitButton: string;
      rememberedPrompt: string;
      backToLoginLink: string;
    };
    pendingToastTitle: string;
    pendingToastDescription: string;
  };
  legal: {
    placeholderBadge: string;
    placeholderNotice: string;
    privacyTitle: string;
    privacySubtitle: string;
    privacySections: readonly { title: string; body: string }[];
    termsTitle: string;
    termsSubtitle: string;
    termsSections: readonly { title: string; body: string }[];
  };
}
