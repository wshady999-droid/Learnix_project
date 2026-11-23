"use client";

import { useMemo } from "react";
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

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-card focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg"
      >
        {t.common.skipToContent}
      </a>

      <PublicNavbar />

      <main id="main-content" className="flex-1">
        {/* 1. HERO SECTION */}
        <section
          id="home"
          aria-labelledby="hero-heading"
          className="relative scroll-mt-16 overflow-hidden border-b border-border/70 py-16 sm:py-20 lg:py-28"
        >
          {/* Ambient radial gold aura */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -top-40 -z-10 mx-auto h-96 max-w-4xl rounded-full bg-gold-subtle/70 blur-3xl dark:bg-gold-subtle/40"
          />

          <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-8">
            <div className="flex flex-col items-start gap-6">
              <Badge variant="gold" className="px-3 py-1">
                <Sparkles aria-hidden="true" />
                <span>{t.hero.eyebrow}</span>
              </Badge>

              <h1
                id="hero-heading"
                className="text-3xl leading-[1.15] font-bold tracking-tight text-foreground sm:text-5xl lg:text-[3.25rem]"
              >
                <span>{t.hero.headlineStart} </span>
                <span className="text-gold-metallic">{t.hero.headlineHighlight}</span>
                <span> {t.hero.headlineEnd}</span>
              </h1>

              <p className="max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                {t.hero.description}
              </p>

              <div className="flex w-full flex-col gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
                <Button asChild variant="gold" size="lg">
                  <Link href="/signup">
                    <span>{t.hero.primaryCta}</span>
                    <ArrowRight className="size-4 rtl:rotate-180" aria-hidden="true" />
                  </Link>
                </Button>
                <Button asChild variant="gold-outline" size="lg">
                  <Link href="/#features">{t.hero.secondaryCta}</Link>
                </Button>
              </div>

              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck className="size-4 shrink-0 text-gold-foreground" aria-hidden="true" />
                <span>{t.hero.architectureNote}</span>
              </p>
            </div>

            {/* Premium Educational Illustration Card */}
            <div className="relative">
              <Card variant="premium" className="relative overflow-hidden shadow-lg">
                <CardHeader className="border-b border-border/70 pb-4">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="gold-subtle">
                      <Brain className="size-3.5" aria-hidden="true" />
                      <span>{t.hero.illustration.badge}</span>
                    </Badge>
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs font-medium text-gold-foreground">
                      <span className="size-2 rounded-full bg-success" aria-hidden="true" />
                      Learnix v1
                    </span>
                  </div>
                  <CardTitle className="pt-1 text-lg">{t.hero.illustration.panelTitle}</CardTitle>
                  <CardDescription>{t.hero.illustration.panelSubtitle}</CardDescription>
                </CardHeader>

                <CardContent className="space-y-4 pt-5">
                  {/* Active Curriculum Unit */}
                  <div className="rounded-xl border border-gold-border/70 bg-gold-subtle/60 p-4">
                    <p className="text-[11px] font-semibold tracking-wider text-gold-foreground uppercase">
                      {t.hero.illustration.moduleLabel}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">
                      {t.hero.illustration.moduleTitle}
                    </p>
                  </div>

                  {/* AI Learning Assistant callout */}
                  <div className="rounded-xl border border-border bg-muted/45 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
                      <span className="gold-sheen inline-flex size-6 items-center justify-center rounded-md bg-gold-metallic text-brand-charcoal shadow-gold">
                        <Bot className="size-3.5" aria-hidden="true" />
                      </span>
                      <span>{t.hero.illustration.aiInsightLabel}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                      {t.hero.illustration.aiInsightText}
                    </p>
                  </div>

                  {/* Three architectural pillars inside illustration */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {t.hero.illustration.examIntegrityLabel}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {t.hero.illustration.examIntegrityValue}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {t.hero.illustration.adaptivePathLabel}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {t.hero.illustration.adaptivePathValue}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-card p-3">
                      <p className="text-[11px] text-muted-foreground">
                        {t.hero.illustration.analyticsLabel}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-gold-foreground">
                        {t.hero.illustration.analyticsValue}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* 2. ABOUT US SECTION */}
        <section
          id="about"
          aria-labelledby="about-heading"
          className="scroll-mt-16 border-b border-border/70 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="gold-subtle">{t.about.eyebrow}</Badge>
              <h2
                id="about-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
              >
                {t.about.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.about.subtitle}
              </p>
            </div>

            {/* Mission Banner */}
            <Card variant="premium" className="mt-10">
              <CardContent className="flex flex-col items-start justify-between gap-4 py-2 md:flex-row md:items-center">
                <div className="space-y-1">
                  <p className="text-xs font-semibold tracking-wider text-gold-foreground uppercase">
                    {t.about.missionLabel}
                  </p>
                  <p className="text-base font-medium text-foreground sm:text-lg">
                    {t.about.missionText}
                  </p>
                </div>
                <Button asChild variant="gold" size="sm" className="shrink-0">
                  <Link href="/signup">{t.hero.primaryCta}</Link>
                </Button>
              </CardContent>
            </Card>

            {/* 4 Pillars: What Learnix Is, Educational Mission, Learning Approach, AI Capabilities */}
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {t.about.pillars.map((pillar) => {
                const Icon =
                  ABOUT_ICONS[pillar.id as keyof typeof ABOUT_ICONS] ?? Layers;
                return (
                  <Card
                    key={pillar.id}
                    className="transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-border hover:shadow-md"
                  >
                    <CardHeader className="gap-3">
                      <span className="inline-flex size-10 items-center justify-center rounded-lg border border-gold-border bg-gold-subtle text-gold-foreground">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <CardTitle className="text-base">{pillar.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
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
          className="scroll-mt-16 border-b border-border/70 bg-muted/30 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="gold">{t.features.eyebrow}</Badge>
              <h2
                id="features-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
              >
                {t.features.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.features.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.features.items.map((feature) => {
                const Icon =
                  FEATURE_ICONS[feature.id as keyof typeof FEATURE_ICONS] ?? BookOpen;
                return (
                  <Card
                    key={feature.id}
                    className="group transition-all duration-200 hover:-translate-y-0.5 hover:border-gold-border hover:shadow-md"
                  >
                    <CardHeader className="gap-3">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex size-11 items-center justify-center rounded-xl border border-gold-border bg-gold-subtle text-gold-foreground transition-transform duration-200 group-hover:scale-105">
                          <Icon className="size-5" aria-hidden="true" />
                        </span>
                        <Badge variant="gold-subtle">{feature.tag}</Badge>
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        {/* 4. COURSES PREVIEW SECTION (No fake courses — live backend empty state until published) */}
        <section
          id="courses"
          aria-labelledby="courses-heading"
          className="scroll-mt-16 border-b border-border/70 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <Badge variant="gold-subtle">{t.coursesPreview.eyebrow}</Badge>
                <h2
                  id="courses-heading"
                  className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl"
                >
                  {t.coursesPreview.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t.coursesPreview.subtitle}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="gold">{t.coursesPreview.allCategoriesTab}</Badge>
              </div>
            </div>

            <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              <Database className="size-3.5 text-gold-foreground" aria-hidden="true" />
              <span>{t.coursesPreview.categoriesHint}</span>
            </p>

            <div className="mt-6">
              <EmptyState
                icon={BookOpen}
                title={t.coursesPreview.emptyTitle}
                description={
                  <div className="space-y-2">
                    <p>{t.coursesPreview.emptyDescription}</p>
                    <p className="font-mono text-xs text-gold-foreground">
                      {t.coursesPreview.emptyBackendNote}
                    </p>
                  </div>
                }
                actions={
                  <>
                    <Button asChild variant="gold" size="sm">
                      <Link href="/signup">{t.coursesPreview.emptyPrimaryCta}</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/#contact">{t.coursesPreview.emptySecondaryCta}</Link>
                    </Button>
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
          className="scroll-mt-16 border-b border-border/70 bg-muted/30 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="space-y-6">
                <Badge variant="gold">
                  <Sparkles aria-hidden="true" />
                  <span>{t.aiSection.eyebrow}</span>
                </Badge>
                <h2
                  id="ai-heading"
                  className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
                >
                  {t.aiSection.title}
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  {t.aiSection.subtitle}
                </p>

                <ol className="space-y-4 pt-2">
                  {t.aiSection.capabilities.map((cap) => (
                    <li
                      key={cap.id}
                      className="flex gap-4 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-gold-border"
                    >
                      <span className="gold-sheen inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-gold-metallic font-mono text-xs font-bold text-brand-charcoal shadow-gold">
                        {cap.step}
                      </span>
                      <div className="space-y-1">
                        <h3 className="text-base font-semibold text-foreground">{cap.title}</h3>
                        <p className="text-sm leading-relaxed text-muted-foreground">
                          {cap.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Interactive Pedagogical AI Mentor Preview */}
              <Card variant="premium" className="shadow-md">
                <CardHeader className="border-b border-border/70">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="gold-subtle">{t.aiSection.previewCard.headerBadge}</Badge>
                    <Bot className="size-4 text-gold-foreground" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-lg">{t.aiSection.previewCard.headerTitle}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <div className="rounded-xl border border-border bg-muted/50 p-4">
                    <p className="text-xs font-semibold text-muted-foreground">
                      {t.aiSection.previewCard.studentPromptLabel}
                    </p>
                    <p className="mt-1.5 text-sm text-foreground">
                      “{t.aiSection.previewCard.studentPromptText}”
                    </p>
                  </div>

                  <div className="rounded-xl border border-gold-border bg-gold-subtle/50 p-4">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gold-foreground">
                      <Sparkles className="size-3.5" aria-hidden="true" />
                      <span>{t.aiSection.previewCard.aiResponseLabel}</span>
                    </div>
                    <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-foreground sm:text-sm">
                      <li>{t.aiSection.previewCard.aiResponsePoint1}</li>
                      <li>{t.aiSection.previewCard.aiResponsePoint2}</li>
                      <li className="font-medium text-gold-foreground">
                        {t.aiSection.previewCard.aiResponsePoint3}
                      </li>
                    </ul>
                  </div>

                  <p className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="size-3.5 shrink-0 text-success" aria-hidden="true" />
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
          className="scroll-mt-16 border-b border-border/70 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="gold-subtle">{t.whyChoose.eyebrow}</Badge>
              <h2
                id="why-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
              >
                {t.whyChoose.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.whyChoose.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {t.whyChoose.items.map((adv) => {
                const Icon =
                  ADVANTAGE_ICONS[adv.id as keyof typeof ADVANTAGE_ICONS] ?? Sparkles;
                return (
                  <Card
                    key={adv.id}
                    className="transition-all duration-200 hover:border-gold-border hover:shadow-sm"
                  >
                    <CardHeader className="flex-row items-start gap-3.5 space-y-0">
                      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-lg border border-gold-border bg-gold-subtle text-gold-foreground">
                        <Icon className="size-5" aria-hidden="true" />
                      </span>
                      <div className="space-y-1.5">
                        <CardTitle className="text-base">{adv.title}</CardTitle>
                        <CardDescription className="text-sm leading-relaxed">
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
          className="scroll-mt-16 py-16 sm:py-20 lg:py-24"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="gold">{t.contact.eyebrow}</Badge>
              <h2
                id="contact-heading"
                className="mt-3 text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl"
              >
                {t.contact.title}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t.contact.subtitle}
              </p>
            </div>

            <div className="mt-12 grid gap-8 lg:grid-cols-[0.95fr_1.05fr]">
              {/* Official Contact Channels (Transparent Owner Placeholders) */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <CardTitle className="text-lg">{t.contact.infoTitle}</CardTitle>
                    <Badge variant="gold-subtle">{t.common.placeholderTag}</Badge>
                  </div>
                  <CardDescription>{t.contact.infoSubtitle}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-xl border border-gold-border/80 bg-gold-subtle/50 p-3.5 text-xs text-gold-foreground">
                    {t.contact.placeholderNotice}
                  </div>

                  <Separator />

                  <dl className="space-y-4 text-sm">
                    <div className="flex items-start gap-3">
                      <Mail
                        className="mt-0.5 size-4 shrink-0 text-gold-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-foreground">{t.contact.emailLabel}</dt>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {t.contact.emailPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Phone
                        className="mt-0.5 size-4 shrink-0 text-gold-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-foreground">{t.contact.phoneLabel}</dt>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {t.contact.phonePlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin
                        className="mt-0.5 size-4 shrink-0 text-gold-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-foreground">{t.contact.addressLabel}</dt>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {t.contact.addressPlaceholderValue}
                        </dd>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Clock
                        className="mt-0.5 size-4 shrink-0 text-gold-foreground"
                        aria-hidden="true"
                      />
                      <div>
                        <dt className="font-semibold text-foreground">{t.contact.hoursLabel}</dt>
                        <dd className="mt-0.5 text-xs text-muted-foreground">
                          {t.contact.hoursPlaceholderValue}
                        </dd>
                      </div>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Validated Contact Form */}
              <Card variant="premium">
                <CardHeader>
                  <CardTitle className="text-lg">{t.contact.eyebrow}</CardTitle>
                  <CardDescription>{t.contact.subtitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Form {...form} key={locale}>
                    <form
                      onSubmit={form.handleSubmit(onSubmitContact, onInvalidContact)}
                      className="space-y-4"
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
                        >
                          {t.contact.form.resetButton}
                        </Button>
                        <Button
                          type="submit"
                          variant="gold"
                          loading={form.formState.isSubmitting}
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
