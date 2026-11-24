"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
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

  const heroServiceItems = useMemo(
    () => t.features.items.slice(0, 4),
    [t.features.items],
  );

  return (
    <div className="flex min-h-dvh flex-col bg-[#F8F8F7] text-[#202124] dark:bg-[#17181A] dark:text-[#F5F5F5]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#FFFFFF] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-[#202124] focus:shadow-lg dark:focus:bg-[#252630] dark:focus:text-[#F5F5F5]"
      >
        {t.common.skipToContent}
      </a>

      <PublicNavbar overlayHero />

      <main id="main-content" className="flex-1 bg-[#F8F8F7] dark:bg-[#17181A]">
        {/* 1. CINEMATIC FULL-WIDTH HERO SECTION */}
        <section
          id="home"
          aria-labelledby="hero-heading"
          className="relative scroll-mt-20"
        >
          <div className="relative flex min-h-[37rem] w-full items-center overflow-hidden bg-[#F8F8F7] pt-28 pb-24 sm:min-h-[41rem] sm:pt-32 sm:pb-28 lg:min-h-[44rem] lg:pt-36 lg:pb-32 dark:bg-[#17181A]">

           <div className="absolute inset-y-0 ltr:right-0 rtl:left-0 w-full overflow-hidden rtl:scale-x-[-1] pointer-events-none">
  <Image
    src="/learnix-hero.jpg"
    alt="Learnix Academic Campus & Modern Architecture"
    fill
    priority
    sizes="100vw"
    quality={100}
    className="object-cover object-center"
  />
</div>

            {/* 2. طبقة التدرج (Gradient) عشان النص يبان */}
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-full bg-gradient-to-r from-[#F8F8F7] via-[#F8F8F7]/80 to-transparent md:w-2/3 dark:from-[#17181A] dark:via-[#17181A]/80 rtl:left-auto rtl:right-0 rtl:bg-gradient-to-l" />

            {/* 3. طبقات التدرج العلوية والسفلية (للتأثير السينمائي) */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[#F8F8F7]/80 to-transparent dark:from-[#17181A]/80"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28 bg-gradient-to-t from-[#F8F8F7] via-[#F8F8F7]/60 to-transparent dark:from-[#17181A] dark:via-[#17181A]/60"
            />

            {/* Hero Content */}
            <div className="relative z-20 w-full max-w-[1600px] px-4 sm:px-6 lg:px-12 ml-0 mr-auto">
              <div className="flex w-full max-w-5xl flex-col items-start gap-5">
                <div className="space-y-3">
                  <div
                    aria-hidden="true"
                    className="h-1 w-14 rounded-full bg-[#C99A22]"
                  />
                  <p className="inline-flex items-center gap-2 text-xs font-bold tracking-[0.18em] text-[#997214] uppercase dark:text-[#C99A22]">
                    <Sparkles className="size-3.5 text-[#C99A22]" aria-hidden="true" />
                    <span>{t.hero.eyebrow}</span>
                  </p>
                </div>

                <h1
                  id="hero-heading"
                  className="text-3xl leading-[1.12] font-extrabold tracking-tight text-[#202124] sm:text-5xl lg:text-[3.4rem] dark:text-[#F5F5F5]"
                >
                  <span className="block">{t.hero.headlineStart}</span>
                  <span className="mt-1 block text-[#C99A22]">
                    {t.hero.headlineHighlight}
                  </span>
                  <span className="mt-1 block text-[#202124] dark:text-[#F5F5F5]">
                    {t.hero.headlineEnd}
                  </span>
                </h1>

                <p className="max-w-xl text-base leading-relaxed text-[#52525B] sm:text-lg dark:text-[#E4E4E7]">
                  {t.hero.description}
                </p>

                <div className="flex w-full flex-col gap-4 pt-1 sm:w-auto sm:flex-row sm:items-center sm:gap-5">
                  <Link
                    href="/signup"
                    className="inline-flex h-12 items-center justify-center gap-2.5 rounded-full bg-[#C99A22] px-7 text-sm font-bold text-[#11131F] shadow-[0_8px_24px_rgba(201,154,34,0.38)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#d8a92b] hover:shadow-[0_12px_28px_rgba(201,154,34,0.52)]"
                  >
                    <span>{t.hero.primaryCta}</span>
                    <ArrowRight
                      className="size-4 rtl:rotate-180"
                      aria-hidden="true"
                    />
                  </Link>

                  <Link
                    href="/#features"
                    className="group inline-flex h-12 items-center justify-center gap-3 rounded-full px-3 text-sm font-semibold text-[#202124] transition-colors hover:text-[#C99A22] dark:text-[#F5F5F5] dark:hover:text-[#C99A22]"
                  >
                    <span className="inline-flex size-10 items-center justify-center rounded-full border border-[#C99A22]/75 bg-white/90 text-[#C99A22] shadow-xs transition-all duration-200 group-hover:border-[#C99A22] group-hover:bg-[#C99A22] group-hover:text-[#11131F] dark:bg-[#11131F]/80">
                      <Play className="size-4 fill-current" aria-hidden="true" />
                    </span>
                    <span>{t.hero.secondaryCta}</span>
                  </Link>
                </div>

                <p className="flex items-center gap-2 pt-0.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
                  <ShieldCheck
                    className="size-4 shrink-0 text-[#C99A22]"
                    aria-hidden="true"
                  />
                  <span>{t.hero.architectureNote}</span>
                </p>
              </div>
            </div>
          </div>

          {/* OVERLAPPING SERVICES DOCK PANEL */}
          <div className="relative z-30 w-full -mt-12 px-4 sm:-mt-14 sm:px-6 lg:-mt-16 lg:px-8">
            <div className="rounded-3xl border border-[#E5E3DF] bg-[#FFFFFF]/95 p-6 shadow-[0_20px_50px_rgba(32,33,36,0.12)] backdrop-blur-xl sm:p-7 lg:p-8 dark:border-[#252630] dark:bg-[#11131F]/95 dark:shadow-[0_24px_60px_rgba(0,0,0,0.85)]">
              <div className="grid items-center gap-8 lg:grid-cols-[0.25fr_0.75fr] lg:gap-10">
                <div className="flex items-start gap-4">
                  <span
                    aria-hidden="true"
                    className="mt-1 h-14 w-1 shrink-0 rounded-full bg-[#C99A22]"
                  />
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold tracking-[0.16em] text-[#997214] uppercase dark:text-[#C99A22]">
                      {t.features.eyebrow}
                    </p>
                    <h2 className="text-xl leading-snug font-bold tracking-tight text-[#202124] sm:text-2xl dark:text-[#F5F5F5]">
                      Explore the Learnix Experience
                    </h2>
                    <p className="text-xs leading-relaxed text-[#737373] sm:text-sm dark:text-[#A1A1AA]">
                      {t.hero.illustration.panelSubtitle}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 w-full">
                  {heroServiceItems.map((service) => {
                    const Icon =
                      FEATURE_ICONS[
                      service.id as keyof typeof FEATURE_ICONS
                      ] ?? BookOpen;
                    return (
                      <Link
                        key={service.id}
                        href="/#features"
                        className="group flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#E5E3DF] bg-[#F8F8F7] p-5 text-center transition-all duration-200 hover:-translate-y-1 hover:border-[#C99A22]/70 hover:bg-[#FFFFFF] hover:shadow-[0_12px_28px_rgba(32,33,36,0.1)] dark:border-[#252630] dark:bg-[#252630]/65 dark:hover:bg-[#252630] dark:hover:shadow-[0_12px_28px_rgba(0,0,0,0.5)]"
                      >
                        <span className="inline-flex size-12 items-center justify-center rounded-full border border-[#C99A22]/35 bg-[#C99A22]/15 text-[#C99A22] transition-all duration-200 group-hover:border-[#C99A22] group-hover:bg-[#C99A22] group-hover:text-[#11131F]">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <div className="space-y-1">
                          <h3 className="text-sm font-semibold text-[#202124] group-hover:text-[#C99A22] dark:text-[#F5F5F5]">
                            {service.title}
                          </h3>
                          <p className="line-clamp-2 text-xs leading-relaxed text-[#737373] dark:text-[#A1A1AA]">
                            {service.description}
                          </p>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. ABOUT US SECTION */}
        <section
          id="about"
          aria-labelledby="about-heading"
          className="scroll-mt-20 border-b border-[#E5E3DF] bg-[#F8F8F7] pt-20 pb-16 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-24 dark:border-[#252630] dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mx-auto mb-3 h-1 w-12 rounded-full bg-[#C99A22]" />
              <Badge
                variant="gold-subtle"
                className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
              >
                {t.about.eyebrow}
              </Badge>
              <h2
                id="about-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl lg:text-4xl dark:text-[#F5F5F5]"
              >
                {t.about.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
                {t.about.subtitle}
              </p>
            </div>

            <Card className="mt-10 border-[#C99A22]/45 bg-[#FFFFFF] text-[#202124] shadow-md dark:bg-[#252630] dark:text-[#F5F5F5] dark:shadow-lg">
              <CardContent className="flex flex-col items-start justify-between gap-4 py-2 md:flex-row md:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-[#997214] uppercase dark:text-[#C99A22]">
                    {t.about.missionLabel}
                  </p>
                  <p className="text-base font-medium text-[#202124] sm:text-lg dark:text-[#F5F5F5]">
                    {t.about.missionText}
                  </p>
                </div>
                <Link
                  href="/signup"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-full bg-[#C99A22] px-5 text-xs font-bold text-[#11131F] transition-colors hover:bg-[#d8a92b]"
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
                    className="border-[#E5E3DF] bg-[#FFFFFF] text-[#202124] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C99A22]/60 hover:shadow-md dark:border-[#252630] dark:bg-[#252630]/80 dark:text-[#F5F5F5] dark:hover:bg-[#252630]"
                  >
                    <CardHeader className="gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-lg border border-[#C99A22]/40 bg-[#C99A22]/15 text-[#C99A22] dark:bg-[#11131F]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-base text-[#202124] dark:text-[#F5F5F5]">
                        {pillar.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-[#737373] dark:text-[#A1A1AA]">
                        {pillar.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 3. FEATURES SECTION */}
        <section
          id="features"
          aria-labelledby="features-heading"
          className="scroll-mt-20 border-b border-[#E5E3DF] bg-[#F0EFEC]/60 py-16 sm:py-20 lg:py-24 dark:border-[#252630] dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border-transparent bg-[#C99A22] font-semibold text-[#11131F]">
                {t.features.eyebrow}
              </Badge>
              <h2
                id="features-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl lg:text-4xl dark:text-[#F5F5F5]"
              >
                {t.features.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
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
                    className="group border-[#E5E3DF] bg-[#FFFFFF] text-[#202124] transition-all duration-200 hover:-translate-y-0.5 hover:border-[#C99A22]/65 hover:shadow-md dark:border-[#252630] dark:bg-[#252630]/80 dark:text-[#F5F5F5] dark:hover:bg-[#252630]"
                  >
                    <CardHeader className="gap-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex size-11 items-center justify-center rounded-xl border border-[#C99A22]/40 bg-[#C99A22]/15 text-[#C99A22] transition-transform duration-200 group-hover:scale-105 dark:bg-[#11131F]">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <Badge
                          variant="gold-subtle"
                          className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
                        >
                          {feature.tag}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-[#202124] dark:text-[#F5F5F5]">
                        {feature.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-[#737373] dark:text-[#A1A1AA]">
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
          className="scroll-mt-20 border-b border-[#E5E3DF] bg-[#F8F8F7] py-16 sm:py-20 lg:py-24 dark:border-[#252630] dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <Badge
                  variant="gold-subtle"
                  className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
                >
                  {t.coursesPreview.eyebrow}
                </Badge>
                <h2
                  id="courses-heading"
                  className="mt-3 text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl dark:text-[#F5F5F5]"
                >
                  {t.coursesPreview.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
                  {t.coursesPreview.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="border-transparent bg-[#C99A22] font-semibold text-[#11131F]">
                  {t.coursesPreview.allCategoriesTab}
                </Badge>
              </div>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-[#737373] dark:text-[#A1A1AA]">
              <Database className="size-3.5 text-[#C99A22]" aria-hidden="true" />
              <span>{t.coursesPreview.categoriesHint}</span>
            </p>

            <div className="mt-6">
              <EmptyState
                icon={BookOpen}
                title={t.coursesPreview.emptyTitle}
                className="border-[#E5E3DF] bg-[#FFFFFF] text-[#202124] [&_h2]:!text-[#202124] dark:border-[#252630] dark:bg-[#252630]/60 dark:text-[#F5F5F5] dark:[&_h2]:!text-[#F5F5F5]"
                description={
                  <div className="space-y-2 text-[#737373] dark:text-[#A1A1AA]">
                    <p>{t.coursesPreview.emptyDescription}</p>
                    <p className="font-mono text-xs text-[#997214] dark:text-[#C99A22]">
                      {t.coursesPreview.emptyBackendNote}
                    </p>
                  </div>
                }
                actions={
                  <>
                    <Link
                      href="/signup"
                      className="inline-flex h-9 items-center justify-center rounded-full bg-[#C99A22] px-4 text-xs font-bold text-[#11131F] transition-colors hover:bg-[#d8a92b]"
                    >
                      {t.coursesPreview.emptyPrimaryCta}
                    </Link>
                    <Link
                      href="/#contact"
                      className="inline-flex h-9 items-center justify-center rounded-full border border-[#E5E3DF] bg-[#F8F8F7] px-4 text-xs font-semibold text-[#202124] transition-colors hover:border-[#C99A22] dark:border-[#252630] dark:bg-[#11131F] dark:text-[#F5F5F5]"
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
          className="scroll-mt-20 border-b border-[#E5E3DF] bg-[#F0EFEC]/60 py-16 sm:py-20 lg:py-24 dark:border-[#252630] dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <Badge className="border-transparent bg-[#C99A22] font-semibold text-[#11131F]">
                  <Sparkles aria-hidden="true" />
                  <span>{t.aiSection.eyebrow}</span>
                </Badge>
                <h2
                  id="ai-heading"
                  className="text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl lg:text-4xl dark:text-[#F5F5F5]"
                >
                  {t.aiSection.title}
                </h2>
                <p className="text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
                  {t.aiSection.subtitle}
                </p>

                <ol className="space-y-4 pt-2">
                  {t.aiSection.capabilities.map((cap) => (
                    <li
                      key={cap.id}
                      className="flex gap-4 rounded-xl border border-[#E5E3DF] bg-[#FFFFFF] p-4 shadow-xs transition-colors hover:border-[#C99A22]/60 dark:border-[#252630] dark:bg-[#252630]/80"
                    >
                      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#C99A22] font-mono text-xs font-bold text-[#11131F]">
                        {cap.step}
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-[#202124] dark:text-[#F5F5F5]">
                          {cap.title}
                        </h3>
                        <p className="text-sm leading-relaxed text-[#737373] dark:text-[#A1A1AA]">
                          {cap.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              <Card className="border-[#C99A22]/45 bg-[#FFFFFF] text-[#202124] shadow-md dark:bg-[#252630] dark:text-[#F5F5F5]">
                <CardHeader className="border-b border-[#E5E3DF] dark:border-[#11131F]">
                  <div className="flex items-center justify-between gap-2">
                    <Badge
                      variant="gold-subtle"
                      className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
                    >
                      {t.aiSection.previewCard.headerBadge}
                    </Badge>
                    <Bot className="size-4 text-[#C99A22]" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg text-[#202124] dark:text-[#F5F5F5]">
                    {t.aiSection.previewCard.headerTitle}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-xl border border-[#E5E3DF] bg-[#F8F8F7] p-4 dark:border-[#252630] dark:bg-[#11131F]">
                    <p className="text-xs font-semibold text-[#737373] dark:text-[#A1A1AA]">
                      {t.aiSection.previewCard.studentPromptLabel}
                    </p>
                    <p className="mt-1.5 text-sm text-[#202124] dark:text-[#F5F5F5]">
                      “{t.aiSection.previewCard.studentPromptText}”
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#C99A22]/45 bg-[#C99A22]/8 p-4 dark:bg-[#11131F]">
                    <div className="flex items-center gap-2 text-xs font-semibold text-[#997214] dark:text-[#C99A22]">
                      <Sparkles className="size-3.5 text-[#C99A22]" aria-hidden="true" />
                      <span>{t.aiSection.previewCard.aiResponseLabel}</span>
                    </div>
                    <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-[#202124] sm:text-sm dark:text-[#F5F5F5]">
                      <li>{t.aiSection.previewCard.aiResponsePoint1}</li>
                      <li>{t.aiSection.previewCard.aiResponsePoint2}</li>
                      <li className="font-medium text-[#997214] dark:text-[#C99A22]">
                        {t.aiSection.previewCard.aiResponsePoint3}
                      </li>
                    </ul>
                  </div>

                  <p className="flex items-center gap-2 text-xs text-[#737373] dark:text-[#A1A1AA]">
                    <CheckCircle2
                      className="size-3.5 shrink-0 text-[#C99A22]"
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
          className="scroll-mt-20 border-b border-[#E5E3DF] bg-[#F8F8F7] py-16 sm:py-20 lg:py-24 dark:border-[#252630] dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge
                variant="gold-subtle"
                className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
              >
                {t.whyChoose.eyebrow}
              </Badge>
              <h2
                id="why-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl lg:text-4xl dark:text-[#F5F5F5]"
              >
                {t.whyChoose.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
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
                    className="border-[#E5E3DF] bg-[#FFFFFF] text-[#202124] transition-all duration-200 hover:border-[#C99A22]/60 hover:shadow-sm dark:border-[#252630] dark:bg-[#252630]/80 dark:text-[#F5F5F5] dark:hover:bg-[#252630]"
                  >
                    <CardHeader className="flex-row items-start gap-3.5 space-y-0">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-[#C99A22]/40 bg-[#C99A22]/15 text-[#C99A22] dark:bg-[#11131F]">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="space-y-1.5">
                        <CardTitle className="text-base text-[#202124] dark:text-[#F5F5F5]">
                          {adv.title}
                        </CardTitle>
                        <CardDescription className="text-sm leading-relaxed text-[#737373] dark:text-[#A1A1AA]">
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
          className="scroll-mt-20 bg-[#F8F8F7] py-16 sm:py-20 lg:py-24 dark:bg-[#17181A]"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge className="border-transparent bg-[#C99A22] font-semibold text-[#11131F]">
                {t.contact.eyebrow}
              </Badge>
              <h2
                id="contact-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-[#202124] sm:text-3xl lg:text-4xl dark:text-[#F5F5F5]"
              >
                {t.contact.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#737373] sm:text-base dark:text-[#A1A1AA]">
                {t.contact.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              <Card className="border-[#E5E3DF] bg-[#FFFFFF] text-[#202124] dark:border-[#252630] dark:bg-[#252630]/80 dark:text-[#F5F5F5]">
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg text-[#202124] dark:text-[#F5F5F5]">
                      {t.contact.infoTitle}
                    </CardTitle>
                    <Badge
                      variant="gold-subtle"
                      className="border-[#C99A22]/40 bg-[#C99A22]/15 text-[#997214] dark:text-[#C99A22]"
                    >
                      {t.common.placeholderTag}
                    </Badge>
                  </div>
                  <CardDescription className="text-[#737373] dark:text-[#A1A1AA]">
                    {t.contact.infoSubtitle}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-[#C99A22]/45 bg-[#C99A22]/10 p-3.5 text-xs text-[#997214] dark:bg-[#11131F] dark:text-[#C99A22]">
                    {t.contact.placeholderNotice}
                  </div>

                  <Separator className="bg-[#E5E3DF] dark:bg-[#11131F]" />

                  <dl className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="mt-0.5 size-4 shrink-0 text-[#C99A22]"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#202124] dark:text-[#F5F5F5]">
                          {t.contact.emailLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
                          {t.contact.emailPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone
                        className="mt-0.5 size-4 shrink-0 text-[#C99A22]"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#202124] dark:text-[#F5F5F5]">
                          {t.contact.phoneLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
                          {t.contact.phonePlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-[#C99A22]"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#202124] dark:text-[#F5F5F5]">
                          {t.contact.addressLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
                          {t.contact.addressPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock
                        className="mt-0.5 size-4 shrink-0 text-[#C99A22]"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-[#202124] dark:text-[#F5F5F5]">
                          {t.contact.hoursLabel}
                        </dt>
                        <dd className="mt-0.5 text-xs text-[#737373] dark:text-[#A1A1AA]">
                          {t.contact.hoursPlaceholderValue}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card className="border-[#C99A22]/45 bg-[#FFFFFF] text-[#202124] dark:bg-[#252630] dark:text-[#F5F5F5]">
                <CardHeader>
                  <CardTitle className="text-lg text-[#202124] dark:text-[#F5F5F5]">
                    {t.contact.eyebrow}
                  </CardTitle>
                  <CardDescription className="text-[#737373] dark:text-[#A1A1AA]">
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
                      className="space-y-4 [&_input]:border-[#DCDAD5] [&_input]:bg-[#F8F8F7] [&_input]:text-[#202124] [&_input]:placeholder:text-[#737373] [&_label]:text-[#202124] [&_textarea]:border-[#DCDAD5] [&_textarea]:bg-[#F8F8F7] [&_textarea]:text-[#202124] [&_textarea]:placeholder:text-[#737373] dark:[&_input]:border-[#252630] dark:[&_input]:bg-[#11131F] dark:[&_input]:text-[#F5F5F5] dark:[&_input]:placeholder:text-[#A1A1AA] dark:[&_label]:text-[#F5F5F5] dark:[&_textarea]:border-[#252630] dark:[&_textarea]:bg-[#11131F] dark:[&_textarea]:text-[#F5F5F5] dark:[&_textarea]:placeholder:text-[#A1A1AA]"
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
                          className="text-[#737373] hover:bg-[#F0EFEC] hover:text-[#202124] dark:text-[#A1A1AA] dark:hover:bg-[#11131F] dark:hover:text-[#F5F5F5]"
                        >
                          {t.contact.form.resetButton}
                        </Button>
                        <Button
                          type="submit"
                          loading={form.formState.isSubmitting}
                          className="rounded-full bg-[#C99A22] px-6 font-bold text-[#11131F] hover:bg-[#d8a92b]"
                        >
                          <Send className="size-4" aria-hidden="true" />
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