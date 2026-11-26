"use client";

import { useMemo, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTheme } from "next-themes";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Compass,
  Database,
  Globe2,
  GraduationCap,
  Layers,
  Lock,
  Mail,
  MapPin,
  Phone,
  Play,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import type { Dictionary } from "@/i18n";

const FEATURE_ICONS = {
  "online-courses": BookOpen,
  "smart-examinations": ClipboardCheck,
  "ai-learning-assistant": Bot,
  "student-analytics": BarChart3,
  "teacher-tools": GraduationCap,
  "secure-environment": ShieldCheck,
} as const;

const ABOUT_ICONS = {
  "what-is-learnix": Layers,
  "educational-mission": Target,
  "learning-approach": Compass,
  "ai-capabilities": Sparkles,
} as const;

const ADVANTAGE_ICONS = {
  "adv-1": Sparkles,
  "adv-2": Globe2,
  "adv-3": Brain,
  "adv-4": Users,
  "adv-5": BarChart3,
  "adv-6": Lock,
} as const;

function buildContactSchema(v: Dictionary["contact"]["form"]["validation"]) {
  return z.object({
    fullName: z.string().trim().min(2, v.fullNameMin).max(80, v.fullNameMax),
    email: z.string().trim().email(v.emailInvalid),
    subject: z.string().trim().min(4, v.subjectMin).max(120, v.subjectMax),
    message: z.string().trim().min(15, v.messageMin).max(1500, v.messageMax),
  });
}

type ContactFormValues = z.infer<ReturnType<typeof buildContactSchema>>;

export function LandingPageContent() {
  const { t, locale } = useLocale();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const checkTheme = () => {
      setIsDark(document.documentElement.classList.contains("dark"));
    };
    checkTheme();
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === "class") {
          checkTheme();
        }
      });
    });
    observer.observe(document.documentElement, { attributes: true });
    return () => observer.disconnect();
  }, [mounted]);

  const contactSchema = useMemo(
    () => buildContactSchema(t.contact.form.validation),
    [t.contact.form.validation],
  );

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      fullName: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  async function onSubmitContact(values: ContactFormValues) {
    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, locale }),
      });

      if (!response.ok) {
        toast.error(t.contact.form.errorToastTitle, {
          description: t.contact.form.errorToastDescription,
        });
        return;
      }

      toast.success(t.contact.form.successToastTitle, {
        description: `${values.subject} — ${t.contact.form.successToastDescription}`,
      });
      form.reset();
    } catch {
      toast.error(t.contact.form.errorToastTitle, {
        description: t.contact.form.errorToastDescription,
      });
    }
  }

  function onInvalidContact() {
    toast.error(t.contact.form.errorToastTitle, {
      description: t.contact.form.errorToastDescription,
    });
  }

  const heroImageSrc = useMemo(() => {
    if (!mounted) return "/en-light.png"; 
    const currentTheme = isDark ? "dark" : "light";
    const isArabic = locale === "ar";

    if (isArabic) {
      return currentTheme === "dark" ? "/ar-dark.png" : "/ar-light.png";
    } else {
      return currentTheme === "dark" ? "/en-dark.png" : "/en-light.png";
    }
  }, [locale, isDark, mounted]);

  const features = [
    { icon: BookOpen, label: t.features?.items?.[0]?.title || "Online Courses" },
    { icon: BarChart3, label: t.features?.items?.[3]?.title || "Analytics" },
    { icon: Users, label: t.features?.items?.[4]?.title || "Expert Instructors" },
    { icon: ShieldCheck, label: t.features?.items?.[5]?.title || "Secure & Reliable" },
  ];

  if (!mounted) {
    return null;
  }

  return (
    <div className="flex min-h-dvh flex-col bg-[#FAF9F4] text-[#0a1f1d] dark:bg-[#0a1f1d] dark:text-[#FAF9F4]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#FFFFFF] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#0a1f1d] focus:shadow-lg dark:focus:bg-[#12352D] dark:focus:text-[#FAF9F4]"
      >
        {t.common.skipToContent}
      </a>

      <PublicNavbar overlayHero />

      <main id="main-content" className="flex-1">
        {/* 1. HERO SECTION */}
        <section className="relative flex min-h-screen w-full items-center overflow-hidden">
          
          <div className="absolute inset-0 z-0">
            <Image
              src={heroImageSrc}
              alt="Learnix Background"
              fill
              priority
              quality={100}
              className="object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-white/90 via-white/70 to-transparent rtl:bg-gradient-to-l dark:from-[#0a1f1d] dark:via-[#0a1f1d]/80 dark:to-transparent" />
          </div>

          <div className="relative z-10 w-full px-8 sm:px-12 lg:px-20 xl:px-24 pt-20 pb-32">
            <div className="flex flex-col items-start gap-6 max-w-2xl">
              
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-bold tracking-wider text-emerald-600 uppercase backdrop-blur-sm dark:text-emerald-400">
                <GraduationCap className="size-4" />
                <span>{t.hero.eyebrow || "AI-Powered Learning"}</span>
              </div>

              <h1 className="text-4xl font-extrabold tracking-tight text-[#0a1f1d] sm:text-5xl lg:text-6xl dark:text-white">
                {t.hero.headlineStart || "Elevate Understanding"} <br />
                <span className="text-emerald-500">{t.hero.headlineHighlight || "with Learnix"}</span>
              </h1>

              <p className="max-w-lg text-lg text-gray-700 sm:text-xl dark:text-gray-300">
                {t.hero.description || "Smart courses. Better learning."}
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="inline-flex h-12 items-center justify-center rounded-full bg-emerald-500 px-8 text-sm font-bold text-white transition-all hover:bg-emerald-600 hover:shadow-lg dark:bg-emerald-400 dark:text-[#0a1f1d] dark:hover:bg-emerald-300"
                >
                  {t.hero.primaryCta || "Get Started"}
                  <ArrowRight className="ml-2 size-4 rtl:ml-0 rtl:mr-2 rtl:rotate-180" />
                </Link>
                
                {/* زرار Explore Features */}
                <Link 
                  href="#features"
                  className="group inline-flex h-12 items-center justify-center rounded-full px-6 text-sm font-semibold text-[#0a1f1d] transition-colors hover:text-emerald-500 dark:text-white dark:hover:text-emerald-400"
                >
                  <span className="flex size-10 items-center justify-center rounded-full border border-emerald-500 text-emerald-500 mr-3 rtl:ml-3 rtl:mr-0 group-hover:bg-emerald-500/10 dark:border-emerald-400 dark:text-emerald-400">
                    <Play className="size-4 fill-current ml-0.5 rtl:mr-0.5" />
                  </span>
                  {t.hero.secondaryCta || "Watch Demo"}
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute bottom-8 left-0 right-0 z-20 px-4">
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-2 gap-4 rounded-3xl border border-gray-200 bg-white/90 p-4 backdrop-blur-md md:grid-cols-4 shadow-xl dark:border-white/10 dark:bg-[#12352D]/80 dark:shadow-2xl">
                {features.map((feature, idx) => (
                  <div key={idx} className="flex items-center justify-center gap-3 py-3 text-sm font-medium text-gray-700 border-r border-gray-200 last:border-0 rtl:border-l rtl:border-r-0 dark:text-gray-200 dark:border-white/5">
                    <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500 dark:bg-emerald-400/10 dark:text-emerald-400">
                      <feature.icon className="size-5" />
                    </div>
                    <span>{feature.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 2. ABOUT US SECTION */}
        <section
          id="about"
          aria-labelledby="about-heading"
          className="scroll-mt-20 border-b border-gray-200 bg-[#FAF9F4] pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-24 dark:border-[#1A453B] dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-emerald-500" />
              <Badge
                variant="gold-subtle"
                className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              >
                {t.about.eyebrow}
              </Badge>
              <h2
                id="about-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl lg:text-4xl dark:text-[#FAF9F4]"
              >
                {t.about.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                {t.about.subtitle}
              </p>
            </div>

            <Card className="mt-10 border-emerald-500/45 bg-white text-[#0a1f1d] shadow-md dark:border-emerald-500/20 dark:bg-white/5 dark:text-[#FAF9F4] dark:shadow-md dark:backdrop-blur-sm">
              <CardContent className="flex flex-col items-start justify-between gap-4 py-2 md:flex-row md:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-emerald-600 uppercase dark:text-emerald-400">
                    {t.about.missionLabel}
                  </p>
                  <p className="text-base font-medium text-[#0a1f1d] sm:text-lg dark:text-[#FAF9F4]">
                    {t.about.missionText}
                  </p>
                </div>
                <Link
                  href="/signup"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-5 text-xs font-bold text-white transition-colors hover:bg-emerald-600 dark:bg-emerald-500 dark:text-[#0a1f1d] dark:hover:bg-emerald-400"
                >
                  {t.hero.primaryCta}
                </Link>
              </CardContent>
            </Card>

            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {t.about.pillars.map((pillar) => {
                const Icon =
                  ABOUT_ICONS[pillar.id as keyof typeof ABOUT_ICONS] ?? Layers;
                return (
                  <Card
                    key={pillar.id}
                    className="border border-emerald-500/20 bg-white/5 text-[#FAF9F4] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-500/60 hover:bg-white/10 hover:shadow-lg backdrop-blur-sm"
                  >
                    <CardHeader className="gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 dark:bg-[#0a1f1d]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-base text-[#0a1f1d] dark:text-[#FAF9F4]">
                        {pillar.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-gray-600 dark:text-[#7A9993]">
                        {pillar.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. FEATURES SECTION (تعديل اللايت مود) */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-20 border-b border-gray-200 bg-[#FAF9F4] py-16 sm:py-20 lg:py-24 dark:border-[#1A453B] dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border-transparent bg-emerald-500 font-semibold text-white dark:text-[#0a1f1d]">
                {t.features.eyebrow}
              </Badge>
              <h2
                id="features-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl lg:text-4xl dark:text-[#FAF9F4]"
              >
                {t.features.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                {t.features.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.items.map((feature) => {
                const Icon =
                  FEATURE_ICONS[feature.id as keyof typeof FEATURE_ICONS] ??
                  BookOpen;
                return (
                  <Card
                    key={feature.id}
                    className="group relative overflow-hidden border border-gray-200 bg-white text-[#0a1f1d] shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-emerald-500/60 hover:shadow-md dark:border-emerald-500/30 dark:bg-gradient-to-br dark:from-[#12352D]/90 dark:to-[#0a1f1d] dark:text-[#FAF9F4] dark:hover:border-emerald-400/60 dark:hover:shadow-[0_0_20px_rgba(16,185,129,0.15)] dark:backdrop-blur-md"
                  >
                    {/* إضاءة خلفية (تظهر بس في الدارك مود) */}
                    <div className="absolute -right-10 -top-10 hidden size-32 rounded-full bg-emerald-500/10 blur-2xl transition-all duration-300 group-hover:bg-emerald-400/20 dark:block" />
                    
                    <CardHeader className="gap-3 relative z-10">
                      <div className="flex items-center justify-between">
                        {/* الأيقونة: في اللايت مود خلفيتها خفيفة جداً وفي الدارك مود متدرجة */}
                        <span className="inline-flex size-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-50 text-emerald-600 shadow-sm transition-transform duration-300 group-hover:scale-110 dark:border-emerald-400/30 dark:bg-gradient-to-br dark:from-emerald-500/20 dark:to-emerald-500/5 dark:text-emerald-400 dark:shadow-inner">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <Badge
                          variant="gold-subtle"
                          className="border-emerald-500/30 bg-emerald-500/10 text-emerald-600 transition-colors group-hover:bg-emerald-500/20 dark:text-emerald-400"
                        >
                          {feature.tag}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-[#0a1f1d] transition-colors group-hover:text-emerald-600 dark:text-white dark:group-hover:text-emerald-300">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="relative z-10">
                      <p className="text-sm leading-relaxed text-gray-600 transition-colors group-hover:text-gray-800 dark:text-[#7A9993] dark:group-hover:text-gray-300">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. COURSES PREVIEW SECTION */}
        <section
          id="courses"
          aria-labelledby="courses-heading"
          className="scroll-mt-20 border-b border-gray-200 bg-[#FAF9F4] py-16 sm:py-20 lg:py-24 dark:border-[#1A453B] dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <Badge
                  variant="gold-subtle"
                  className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                >
                  {t.coursesPreview.eyebrow}
                </Badge>
                <h2
                  id="courses-heading"
                  className="mt-3 text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl dark:text-[#FAF9F4]"
                >
                  {t.coursesPreview.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                  {t.coursesPreview.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-transparent bg-emerald-500 font-semibold text-white dark:text-[#0a1f1d]">
                  {t.coursesPreview.allCategoriesTab}
                </Badge>
              </div>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-gray-500 dark:text-[#7A9993]">
              <Database className="size-3.5 text-emerald-500" aria-hidden="true" />
              <span>{t.coursesPreview.categoriesHint}</span>
            </p>

            <div className="mt-6">
              <EmptyState
                icon={BookOpen}
                title={t.coursesPreview.emptyTitle}
                className="border-gray-200 bg-white text-[#0a1f1d] [&_h2]:!text-[#0a1f1d] dark:border-[#1A453B] dark:bg-[#12352D]/60 dark:text-[#FAF9F4] dark:[&_h2]:!text-[#FAF9F4]"
                description={
                  <div className="space-y-2 text-gray-600 dark:text-[#7A9993]">
                    <p>{t.coursesPreview.emptyDescription}</p>
                    <p className="font-mono text-xs text-emerald-600 dark:text-emerald-400">
                      {t.coursesPreview.emptyBackendNote}
                    </p>
                  </div>
                }
                actions={
                  <>
                    <Link
                      href="/signup"
                      className="inline-flex h-9 items-center justify-center rounded-full bg-emerald-500 px-4 text-xs font-bold text-white transition-colors hover:bg-emerald-600 dark:bg-emerald-500 dark:text-[#0a1f1d] dark:hover:bg-emerald-400"
                    >
                      {t.coursesPreview.emptyPrimaryCta}
                    </Link>
                    <Link
                      href="/#contact"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-gray-300 bg-[#FAF9F4] px-4 text-xs font-semibold text-[#0a1f1d] transition-colors hover:border-emerald-500 dark:border-[#1A453B] dark:bg-[#0a1f1d] dark:text-[#FAF9F4]"
                    >
                      {t.coursesPreview.emptySecondaryCta}
                    </Link>
                  </>
                }
              />
            </div>
          </div>
        </section>

        {/* 5. AI LEARNING SECTION */}
        <section
          id="ai-learning"
          aria-labelledby="ai-heading"
          className="scroll-mt-20 border-b border-gray-200 bg-gray-50/60 py-16 sm:py-20 lg:py-24 dark:border-[#1A453B] dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] rtl:lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-6">
                <Badge className="border-transparent bg-emerald-500 font-semibold text-white dark:text-[#0a1f1d]">
                  <Sparkles aria-hidden="true" />
                  <span>{t.aiSection.eyebrow}</span>
                </Badge>
                <h2
                  id="ai-heading"
                  className="text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl lg:text-4xl dark:text-[#FAF9F4]"
                >
                  {t.aiSection.title}
                </h2>
                <p className="text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                  {t.aiSection.subtitle}
                </p>

                <ol className="space-y-4 pt-2">
                  {t.aiSection.capabilities.map((cap) => (
                    <li
                      key={cap.id}
                      className="flex gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-xs transition-colors hover:border-emerald-500/60 dark:border-[#1A453B] dark:bg-[#12352D]/80"
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500 font-mono text-xs font-bold text-white dark:text-[#0a1f1d]">
                        {cap.step}
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {cap.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-gray-600 dark:text-[#7A9993]">
                          {cap.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <Card className="border border-emerald-500/20 bg-white/5 text-[#FAF9F4] shadow-md backdrop-blur-sm">
                <CardHeader className="border-b border-gray-200 dark:border-white/10">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="gold-subtle"
                      className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >
                      {t.aiSection.previewCard.headerBadge}
                    </Badge>
                    <Bot className="size-4 text-emerald-500" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg text-[#0a1f1d] dark:text-[#FAF9F4]">
                    {t.aiSection.previewCard.headerTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-xl border border-gray-200 bg-[#FAF9F4] p-4 dark:border-white/10 dark:bg-white/5">
                    <p className="text-xs font-semibold text-gray-500 dark:text-[#7A9993]">
                      {t.aiSection.previewCard.studentPromptLabel}
                    </p>
                    <p className="mt-1.5 text-sm text-[#0a1f1d] dark:text-[#FAF9F4]">
                      "{t.aiSection.previewCard.studentPromptText}"
                    </p>
                  </div>

                  <div className="rounded-xl border border-emerald-500/45 bg-emerald-500/8 p-4 dark:bg-white/5">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                      <Sparkles className="size-3.5 text-emerald-500" aria-hidden="true" />
                      <span>{t.aiSection.previewCard.aiResponseLabel}</span>
                    </div>
                    <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#0a1f1d] sm:text-sm dark:text-[#FAF9F4]">
                      <li>{t.aiSection.previewCard.aiResponsePoint1}</li>
                      <li>{t.aiSection.previewCard.aiResponsePoint2}</li>
                      <li className="font-medium text-emerald-600 dark:text-emerald-400">
                        {t.aiSection.previewCard.aiResponsePoint3}
                      </li>
                    </ul>
                  </div>

                  <p className="flex items-center gap-2 text-xs text-gray-500 dark:text-[#7A9993]">
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-emerald-500"
                      aria-hidden="true"
                    />
                    <span>{t.aiSection.previewCard.footerNote}</span>
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* 6. WHY CHOOSE LEARNIX SECTION */}
        <section
          id="why-learnix"
          aria-labelledby="why-heading"
          className="scroll-mt-20 border-b border-gray-200 bg-[#FAF9F4] py-16 sm:py-20 lg:py-24 dark:border-[#1A453B] dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="gold-subtle"
                className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              >
                {t.whyChoose.eyebrow}
              </Badge>
              <h2
                id="why-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl lg:text-4xl dark:text-[#FAF9F4]"
              >
                {t.whyChoose.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                {t.whyChoose.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.whyChoose.items.map((adv) => {
                const Icon =
                  ADVANTAGE_ICONS[adv.id as keyof typeof ADVANTAGE_ICONS] ??
                  Sparkles;
                return (
                  <Card
                    key={adv.id}
                    className="border border-emerald-500/20 bg-white/5 text-[#FAF9F4] transition-all duration-200 hover:border-emerald-500/60 hover:bg-white/10 hover:shadow-sm backdrop-blur-sm"
                  >
                    <CardHeader className="flex-row items-start gap-3.5 space-y-0">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-500 dark:bg-[#0a1f1d]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="space-y-1.5">
                        <CardTitle className="text-base text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {adv.title}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed text-gray-600 dark:text-[#7A9993]">
                          {adv.description}
                        </CardDescription>
                      </div>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 7. CONTACT US SECTION */}
        <section
          id="contact"
          aria-labelledby="contact-heading"
          className="scroll-mt-20 bg-[#FAF9F4] py-16 sm:py-20 lg:py-24 dark:bg-[#0a1f1d]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border-transparent bg-emerald-500 font-semibold text-white dark:text-[#0a1f1d]">
                {t.contact.eyebrow}
              </Badge>
              <h2
                id="contact-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#0a1f1d] sm:text-3xl lg:text-4xl dark:text-[#FAF9F4]"
              >
                {t.contact.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-600 sm:text-base dark:text-[#7A9993]">
                {t.contact.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr] rtl:lg:grid-cols-[1.05fr_0.95fr]">
              <Card className="border border-emerald-500/20 bg-white/5 text-[#FAF9F4] backdrop-blur-sm">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg text-[#0a1f1d] dark:text-[#FAF9F4]">
                      {t.contact.infoTitle}
                    </CardTitle>
                    <Badge
                      variant="gold-subtle"
                      className="border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    >
                      {t.common.placeholderTag}
                    </Badge>
                  </div>
                  <CardDescription className="text-gray-600 dark:text-[#7A9993]">
                    {t.contact.infoSubtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-emerald-500/45 bg-emerald-500/10 p-3.5 text-xs text-emerald-600 dark:bg-white/5 dark:text-emerald-400">
                    {t.contact.placeholderNotice}
                  </div>

                  <Separator className="bg-gray-200 dark:bg-white/10" />

                  <dl className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {t.contact.emailLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-gray-500 dark:text-[#7A9993]">
                          {t.contact.emailPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {t.contact.phoneLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-gray-500 dark:text-[#7A9993]">
                          {t.contact.phonePlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {t.contact.addressLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-gray-500 dark:text-[#7A9993]">
                          {t.contact.addressPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock
                        className="mt-0.5 size-4 shrink-0 text-emerald-500"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#0a1f1d] dark:text-[#FAF9F4]">
                          {t.contact.hoursLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-gray-500 dark:text-[#7A9993]">
                          {t.contact.hoursPlaceholderValue}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card className="border border-emerald-500/20 bg-white/5 text-[#FAF9F4] backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-lg text-[#0a1f1d] dark:text-[#FAF9F4]">
                    {t.contact.eyebrow}
                  </CardTitle>
                  <CardDescription className="text-gray-600 dark:text-[#7A9993]">
                    {t.contact.subtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form} key={locale}>
                    <form
                      onSubmit={form.handleSubmit(
                        onSubmitContact,
                        onInvalidContact,
                      )}
                      className="space-y-4 [&_input]:border-gray-300 [&_input]:bg-white [&_input]:text-[#0a1f1d] [&_input]:placeholder:text-gray-400 [&_label]:text-[#0a1f1d] [&_textarea]:border-gray-300 [&_textarea]:bg-white [&_textarea]:text-[#0a1f1d] [&_textarea]:placeholder:text-gray-400 dark:[&_input]:border-white/10 dark:[&_input]:bg-white/5 dark:[&_input]:text-[#FAF9F4] dark:[&_input]:placeholder:text-[#7A9993] dark:[&_label]:text-[#FAF9F4] dark:[&_textarea]:border-white/10 dark:[&_textarea]:bg-white/5 dark:[&_textarea]:text-[#FAF9F4] dark:[&_textarea]:placeholder:text-[#7A9993]"
                      noValidate
                    >
                      <div className="grid gap-4 sm:grid-cols-2">
                        <FormField
                          control={form.control}
                          name="fullName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.contact.form.fullNameLabel}</FormLabel>
                              <FormControl>
                                <Input
                                  autoComplete="name"
                                  placeholder={t.contact.form.fullNamePlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t.contact.form.emailLabel}</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  autoComplete="email"
                                  placeholder={t.contact.form.emailPlaceholder}
                                  {...field}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      <FormField
                        control={form.control}
                        name="subject"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.contact.form.subjectLabel}</FormLabel>
                            <FormControl>
                              <Input
                                placeholder={t.contact.form.subjectPlaceholder}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="message"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t.contact.form.messageLabel}</FormLabel>
                            <FormControl>
                              <Textarea
                                rows={4}
                                placeholder={t.contact.form.messagePlaceholder}
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => form.reset()}
                          className="text-gray-500 hover:bg-gray-100 hover:text-[#0a1f1d] dark:text-[#7A9993] dark:hover:bg-white/10 dark:hover:text-[#FAF9F4]"
                        >
                          {t.contact.form.resetButton}
                        </Button>
                        <Button
                          type="submit"
                          loading={form.formState.isSubmitting}
                          className="rounded-full bg-emerald-500 px-6 font-bold text-white hover:bg-emerald-600 dark:bg-emerald-500 dark:text-[#0a1f1d] dark:hover:bg-emerald-400"
                        >
                          <Send className="size-4 rtl:rotate-180" aria-hidden="true" />
                          <span>
                            {form.formState.isSubmitting
                              ? t.contact.form.submittingButton
                              : t.contact.form.submitButton}
                          </span>
                        </Button>
                      </div>
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}