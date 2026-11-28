"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Award,
  ExternalLink,
  Globe,
  Loader2,
  Lock,
  MessageSquareQuote,
  Save,
  Star,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
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
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { teacherSavePublicProfileAction } from "@/services/teacher/actions";
import type { TeacherRatingsData } from "@/services/teacher/queries";

interface TeacherRatingsClientProps {
  data: TeacherRatingsData;
}

export function TeacherRatingsClient({ data }: TeacherRatingsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();
  const [activeTab, setActiveTab] = useState<
    "course-reviews" | "teacher-reviews" | "history" | "public-profile"
  >("course-reviews");

  // Public profile editor state
  const [displayName, setDisplayName] = useState(
    data.publicProfile?.display_name ?? data.teacherFullName,
  );
  const [headline, setHeadline] = useState(
    data.publicProfile?.headline ?? "Academic Instructor at Learnix",
  );
  const [biography, setBiography] = useState(
    data.publicProfile?.biography ?? "",
  );
  const [experienceYears, setExperienceYears] = useState(
    data.publicProfile?.experience_years !== null &&
      data.publicProfile?.experience_years !== undefined
      ? String(data.publicProfile.experience_years)
      : "",
  );
  const [education, setEducation] = useState(
    data.publicProfile?.education ?? "",
  );
  const [certifications, setCertifications] = useState(
    data.publicProfile?.certifications ?? "",
  );
  const [websiteUrl, setWebsiteUrl] = useState(
    data.publicProfile?.website_url ?? "",
  );
  const [linkedinUrl, setLinkedinUrl] = useState(
    data.publicProfile?.linkedin_url ?? "",
  );
  const [isPublicVisible, setIsPublicVisible] = useState(
    data.publicProfile?.is_public_visible ?? true,
  );

  function handleSavePublicProfile() {
    startTransition(async () => {
      const res = await teacherSavePublicProfileAction({
        displayName,
        headline,
        biography,
        experienceYears: experienceYears.trim()
          ? Number(experienceYears)
          : null,
        education,
        certifications,
        websiteUrl,
        linkedinUrl,
        isPublicVisible,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Public instructor profile saved.");
      router.refresh();
    });
  }

  const starDistribution = [5, 4, 3, 2, 1].map((star) => ({
    star: `${star} ★`,
    courseCount: data.courseReviews.filter((r) => r.rating === star).length,
    teacherCount: data.teacherReviews.filter((r) => r.rating === star).length,
  }));

  const kpiCards = [
    {
      label: t.ratings.averageCourseRating,
      value: `${data.averageCourseRating} / 5.0`,
      icon: Star,
      highlight: true,
    },
    {
      label: t.ratings.averageTeacherRating,
      value: `${data.averageTeacherRating} / 5.0`,
      icon: Award,
    },
    {
      label: t.ratings.totalCourseReviews,
      value: data.courseReviews.length,
      icon: MessageSquareQuote,
    },
    {
      label: t.ratings.totalTeacherReviews,
      value: data.teacherReviews.length,
      icon: MessageSquareQuote,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.ratings.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.ratings.subtitle}
          </p>
        </div>

        <Button asChild variant="gold" size="sm">
          <Link href={`/teachers/${data.teacherId}`} target="_blank">
            <Globe className="size-4" />
            <span>View Public Profile</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </Button>
      </div>

      {/* Read-only integrity notice */}
      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-3.5 text-xs">
          <Lock className="size-4 shrink-0 text-emerald-500" />
          <p className="text-foreground">{t.ratings.readOnlySecurityNotice}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((item) => {
          const Icon = item.icon;
          return (
            <Card
              key={item.label}
              className={
                item.highlight
                  ? "border-emerald-500/50 bg-emerald-500/5"
                  : "border-border/80"
              }
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {item.value}
                  </p>
                </div>
                <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-500">
                  <Icon className="size-4" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "course-reviews" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("course-reviews")}
        >
          {t.ratings.tabCourseReviews}
        </Button>
        <Button
          variant={activeTab === "teacher-reviews" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("teacher-reviews")}
        >
          {t.ratings.tabTeacherReviews}
        </Button>
        <Button
          variant={activeTab === "history" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("history")}
        >
          {t.ratings.tabRatingHistory}
        </Button>
        <Button
          variant={activeTab === "public-profile" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("public-profile")}
        >
          <Globe className="size-3.5" />
          <span>Public Profile Settings</span>
        </Button>
      </div>

      {activeTab === "course-reviews" && (
        <Card>
          <CardContent className="pt-6">
            {data.courseReviews.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.ratings.courseLabel}</TableHead>
                    <TableHead>{t.ratings.studentLabel}</TableHead>
                    <TableHead>{t.ratings.ratingStarsLabel}</TableHead>
                    <TableHead>{t.ratings.reviewCommentLabel}</TableHead>
                    <TableHead>Suggestions</TableHead>
                    <TableHead>{t.ratings.submittedAtLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.courseReviews.map((rev) => (
                    <TableRow key={rev.id}>
                      <TableCell className="font-semibold text-foreground">
                        {rev.courseTitle}
                      </TableCell>
                      <TableCell>{rev.studentName}</TableCell>
                      <TableCell>
                        <Badge variant="gold">
                          {"★".repeat(rev.rating)} ({rev.rating}/5)
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm text-xs text-muted-foreground">
                        {rev.comment || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {rev.improvement_suggestions || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rev.created_at.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "teacher-reviews" && (
        <Card>
          <CardContent className="pt-6">
            {data.teacherReviews.length === 0 ? (
              <EmptyState
                icon={Award}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.ratings.courseLabel}</TableHead>
                    <TableHead>{t.ratings.studentLabel}</TableHead>
                    <TableHead>{t.ratings.ratingStarsLabel}</TableHead>
                    <TableHead>{t.ratings.reviewCommentLabel}</TableHead>
                    <TableHead>Suggestions</TableHead>
                    <TableHead>{t.ratings.submittedAtLabel}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teacherReviews.map((rev) => (
                    <TableRow key={rev.id}>
                      <TableCell className="font-semibold text-foreground">
                        {rev.courseTitle}
                      </TableCell>
                      <TableCell>{rev.studentName}</TableCell>
                      <TableCell>
                        <Badge variant="gold">
                          {"★".repeat(rev.rating)} ({rev.rating}/5)
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-sm text-xs text-muted-foreground">
                        {rev.comment || "—"}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {rev.improvement_suggestions || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rev.created_at.slice(0, 10)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "history" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {t.ratings.tabRatingHistory}
            </CardTitle>
            <CardDescription>
              5-star distribution across course and teacher reviews.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 w-full">
              <ResponsiveContainer
                width="100%"
                height="100%"
                minWidth={0}
                minHeight={260}
              >
                <BarChart data={starDistribution}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(115,115,115,0.2)"
                  />
                  <XAxis dataKey="star" fontSize={12} />
                  <YAxis fontSize={12} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="courseCount"
                    name={t.ratings.totalCourseReviews}
                    fill="#10b981"
                    radius={[6, 6, 0, 0]}
                  />
                  <Bar
                    dataKey="teacherCount"
                    name={t.ratings.totalTeacherReviews}
                    fill="#34d399"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "public-profile" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="size-4 text-emerald-500" />
              <span>Public Instructor Profile</span>
            </CardTitle>
            <CardDescription>
              Customize the bio, experience, and academic credentials shown on
              your public instructor page (`/teachers/{data.teacherId}`).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Public Display Name</Label>
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Prof. Jane Doe"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Professional Headline</Label>
                <Input
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="Senior Computer Science Instructor"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Years of Teaching Experience</Label>
                <Input
                  type="number"
                  min={0}
                  max={80}
                  value={experienceYears}
                  onChange={(e) => setExperienceYears(e.target.value)}
                  placeholder="e.g., 8"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Website URL (optional)</Label>
                <Input
                  type="url"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>LinkedIn URL (optional)</Label>
                <Input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Instructor Biography</Label>
              <Textarea
                rows={4}
                value={biography}
                onChange={(e) => setBiography(e.target.value)}
                placeholder="Share your teaching philosophy, academic background, and what students will gain from your courses..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Education & Degrees</Label>
                <Textarea
                  rows={3}
                  value={education}
                  onChange={(e) => setEducation(e.target.value)}
                  placeholder="Ph.D. in Software Engineering..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Certifications & Specializations</Label>
                <Textarea
                  rows={3}
                  value={certifications}
                  onChange={(e) => setCertifications(e.target.value)}
                  placeholder="Cloud Architecture, Machine Learning, Web Security..."
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <input
                type="checkbox"
                checked={isPublicVisible}
                onChange={(e) => setIsPublicVisible(e.target.checked)}
                className="size-4 accent-emerald-500"
              />
              <span className="font-medium text-foreground">
                Make my instructor profile publicly visible to students and
                visitors
              </span>
            </label>

            <div className="flex items-center gap-2 pt-2">
              <Button
                type="button"
                variant="gold"
                size="sm"
                disabled={isPending}
                onClick={handleSavePublicProfile}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Save className="size-4" />
                )}
                <span>Save Public Profile</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
