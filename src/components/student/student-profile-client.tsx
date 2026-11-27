"use client";

import Link from "next/link";
import { Award, ShieldCheck, Trophy } from "lucide-react";

import { ProfileSettingsClient } from "@/components/auth/profile-settings-client";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import type { StudentPerformanceAndGrowthData } from "@/services/student/queries";

interface StudentProfileClientProps {
  data: StudentPerformanceAndGrowthData;
}

export function StudentProfileClient({ data }: StudentProfileClientProps) {
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.profile.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.profile.subtitle}
        </p>
      </div>

      {/* Earned Certificates & Achievements Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Award className="size-4 text-gold-foreground" />
                <span>{t.profile.certificatesSummaryTitle}</span>
              </CardTitle>
              <CardDescription>
                {data.certificates.length} verified certificates earned
              </CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/student/motivation">{t.nav.motivation}</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.certificates.length === 0 ? (
              <p className="text-muted-foreground">
                Complete a course to earn your first verified certificate.
              </p>
            ) : (
              data.certificates.map((cert) => (
                <div
                  key={cert.id}
                  className="flex items-center justify-between rounded-lg border border-border/80 p-3"
                >
                  <div>
                    <p className="font-semibold text-foreground">
                      {cert.courseTitle}
                    </p>
                    <p className="font-mono text-[11px] text-muted-foreground">
                      {cert.certificate_number}
                    </p>
                  </div>
                  <Badge variant="gold">
                    <ShieldCheck className="mr-1 size-3" />
                    Verified
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Trophy className="size-4 text-gold-foreground" />
              <span>{t.profile.achievementsSummaryTitle}</span>
            </CardTitle>
            <CardDescription>
              Your recorded learning milestones
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-3 text-center text-xs">
            <div className="rounded-lg border border-border p-3">
              <p className="text-lg font-bold text-foreground">
                {data.completedLessonsCount}
              </p>
              <p className="text-muted-foreground">Lessons Completed</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-lg font-bold text-foreground">
                {data.notesCount}
              </p>
              <p className="text-muted-foreground">Personal Notes</p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-lg font-bold text-foreground">
                {data.results.filter((r) => r.passed).length}
              </p>
              <p className="text-muted-foreground">Exams Passed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Full Profile Settings (Avatar upload, Personal Info, Password, Language, Theme, Notifications) */}
      <ProfileSettingsClient profile={data.profile} teacherRequest={null} embedded />
    </div>
  );
}
