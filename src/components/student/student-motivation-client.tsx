"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  CheckCircle2,
  Download,
  Flame,
  Medal,
  ShieldCheck,
  Sparkles,
  Trophy,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { exportPrintablePdfReport } from "@/lib/admin/export-and-import";
import { studentClaimCourseCertificateAction } from "@/services/student/actions";
import type { StudentPerformanceAndGrowthData } from "@/services/student/queries";

interface StudentMotivationClientProps {
  data: StudentPerformanceAndGrowthData;
}

export function StudentMotivationClient({
  data,
}: StudentMotivationClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [activeTab, setActiveTab] = useState<
    "challenges" | "achievements" | "certificates"
  >("challenges");

  const totalStudyMinutes = Math.round(
    data.studySessions.reduce(
      (sum, s) => sum + Number(s.duration_seconds ?? 0),
      0,
    ) / 60,
  );
  const completedCourses = data.enrolledCourses.filter(
    (c) => c.progressPercent >= 100 || c.enrollmentStatus === "completed",
  );
  const issuedCourseIds = new Set(data.certificates.map((c) => c.course_id));

  const weeklyChallenges = [
    {
      id: "challenge-lessons",
      title: "Complete 3 Lessons This Week",
      progress: Math.min(3, data.completedLessonsCount),
      target: 3,
      rewardLabel: "+150 Learnix XP",
    },
    {
      id: "challenge-study-time",
      title: "Log 60 Minutes of Focused Study",
      progress: Math.min(60, totalStudyMinutes),
      target: 60,
      rewardLabel: "+200 Learnix XP",
    },
    {
      id: "challenge-notes",
      title: "Write 2 Timestamped Personal Notes",
      progress: Math.min(2, data.notesCount),
      target: 2,
      rewardLabel: "+100 Learnix XP",
    },
  ];

  const achievements = [
    {
      id: "ach-first-lesson",
      title: "First Milestone Unlocked",
      description: "Complete your first lesson on Learnix.",
      unlocked: data.completedLessonsCount >= 1,
    },
    {
      id: "ach-note-taker",
      title: "Active Note Taker",
      description: "Save timestamped personal notes while studying.",
      unlocked: data.notesCount >= 1,
    },
    {
      id: "ach-high-scorer",
      title: "Academic Excellence (≥ 85%)",
      description: "Score 85% or higher on an official examination.",
      unlocked: data.results.some((r) => Number(r.score_percent) >= 85),
    },
    {
      id: "ach-course-finisher",
      title: "Course Graduate",
      description: "Reach 100% completion in an enrolled course.",
      unlocked: completedCourses.length >= 1,
    },
  ];

  function handleClaimCertificate(courseId: string) {
    startTransition(async () => {
      const res = await studentClaimCourseCertificateAction({ courseId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.motivation.certificateClaimedToast);
      router.refresh();
    });
  }

  function handlePrintCertificate(
    cert: StudentPerformanceAndGrowthData["certificates"][number],
  ) {
    exportPrintablePdfReport({
      title: "Official Certificate of Course Completion",
      subtitle: `Issued to ${data.profile.full_name || data.profile.email} for successfully completing ${cert.courseTitle}`,
      headers: [
        "Student Name",
        "Course",
        "Final Score",
        "Certificate ID",
        "Verification Hash",
        "Issued Date",
      ],
      rows: [
        [
          data.profile.full_name || data.profile.email,
          `${cert.courseCode} — ${cert.courseTitle}`,
          `${Number(cert.final_score ?? 100).toFixed(1)}%`,
          cert.certificate_number,
          cert.verification_hash,
          cert.issued_at.slice(0, 10),
        ],
      ],
    });
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.motivation.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.motivation.subtitle}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "challenges" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("challenges")}
        >
          {t.motivation.tabChallenges}
        </Button>
        <Button
          variant={activeTab === "achievements" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("achievements")}
        >
          {t.motivation.tabAchievements}
        </Button>
        <Button
          variant={activeTab === "certificates" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("certificates")}
        >
          {t.motivation.tabCertificates} ({data.certificates.length})
        </Button>
      </div>

      {/* TAB 1: WEEKLY CHALLENGES */}
      {activeTab === "challenges" && (
        <div className="grid gap-5 md:grid-cols-3">
          {weeklyChallenges.map((ch) => {
            const pct = Math.min(100, Math.round((ch.progress / ch.target) * 100));
            const done = ch.progress >= ch.target;
            return (
              <Card
                key={ch.id}
                className={
                  done ? "border-gold-primary/60 bg-gold-primary/5" : ""
                }
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <Flame className="size-5 text-gold-foreground" />
                    <Badge variant={done ? "gold" : "outline"}>
                      {ch.rewardLabel}
                    </Badge>
                  </div>
                  <CardTitle className="mt-2 text-base">{ch.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-mono font-semibold text-foreground">
                      {ch.progress} / {ch.target} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full bg-gold-metallic transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* TAB 2: ACHIEVEMENTS & COURSE COMPLETION REWARDS */}
      {activeTab === "achievements" && (
        <div className="grid gap-5 md:grid-cols-2">
          {achievements.map((ach) => (
            <Card
              key={ach.id}
              className={
                ach.unlocked
                  ? "border-gold-primary/60 bg-gold-primary/5"
                  : "opacity-75"
              }
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0">
                <div className="flex items-center gap-3">
                  <div className="rounded-xl bg-gold-primary/15 p-2.5 text-gold-foreground">
                    {ach.unlocked ? (
                      <Trophy className="size-5" />
                    ) : (
                      <Medal className="size-5" />
                    )}
                  </div>
                  <div>
                    <CardTitle className="text-base">{ach.title}</CardTitle>
                    <CardDescription className="text-xs">
                      {ach.description}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant={ach.unlocked ? "gold" : "outline"}>
                  {ach.unlocked ? "Unlocked" : "In Progress"}
                </Badge>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      {/* TAB 3: CERTIFICATES AFTER SUCCESSFUL COMPLETION */}
      {activeTab === "certificates" && (
        <div className="space-y-6">
          {/* Eligible completed courses awaiting certificate claim */}
          {completedCourses.filter((c) => !issuedCourseIds.has(c.id)).length >
            0 && (
            <Card className="border-gold-primary/50 bg-gold-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Sparkles className="size-4 text-gold-foreground" />
                  <span>{t.motivation.rewardsTitle}</span>
                </CardTitle>
                <CardDescription>
                  {t.motivation.certificatesDescription}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {completedCourses
                  .filter((c) => !issuedCourseIds.has(c.id))
                  .map((c) => (
                    <div
                      key={c.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/80 bg-background p-3 text-xs"
                    >
                      <div>
                        <p className="font-semibold text-foreground">
                          {c.code} — {c.title}
                        </p>
                        <p className="text-muted-foreground">
                          100% Completed • Eligible for official certificate
                        </p>
                      </div>
                      <Button
                        variant="gold"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleClaimCertificate(c.id)}
                      >
                        <Award className="size-3.5" />
                        <span>{t.motivation.claimCertificateButton}</span>
                      </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          {data.certificates.length === 0 ? (
            <EmptyState
              icon={Award}
              title={t.common.noRecordsTitle}
              description={t.motivation.certificatesDescription}
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2">
              {data.certificates.map((cert) => (
                <Card
                  key={cert.id}
                  className="border-gold-primary/60 shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <Badge variant="gold" className="gap-1">
                        <ShieldCheck className="size-3.5" />
                        <span>Verified Credential</span>
                      </Badge>
                      <span className="font-mono text-xs text-muted-foreground">
                        {cert.issued_at.slice(0, 10)}
                      </span>
                    </div>
                    <CardTitle className="mt-2 text-lg">
                      {cert.courseTitle}
                    </CardTitle>
                    <CardDescription>
                      Awarded to{" "}
                      {data.profile.full_name || data.profile.email}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-1.5 text-xs text-muted-foreground">
                    <p>
                      <strong className="text-foreground">
                        {t.motivation.certificateNumberLabel}:
                      </strong>{" "}
                      <span className="font-mono">
                        {cert.certificate_number}
                      </span>
                    </p>
                    <p className="truncate">
                      <strong className="text-foreground">
                        {t.motivation.verificationHashLabel}:
                      </strong>{" "}
                      <span className="font-mono">
                        {cert.verification_hash}
                      </span>
                    </p>
                    {cert.final_score !== null && (
                      <p className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          Final Score: {Number(cert.final_score).toFixed(1)}%
                        </span>
                      </p>
                    )}
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="gold"
                      size="sm"
                      className="w-full"
                      onClick={() => handlePrintCertificate(cert)}
                    >
                      <Download className="size-3.5" />
                      <span>
                        {t.motivation.downloadCertificatePdfButton}
                      </span>
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
