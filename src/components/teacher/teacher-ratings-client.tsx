"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, Lock, MessageSquareQuote, Star } from "lucide-react";

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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import type { TeacherRatingsData } from "@/services/teacher/queries";

interface TeacherRatingsClientProps {
  data: TeacherRatingsData;
}

export function TeacherRatingsClient({ data }: TeacherRatingsClientProps) {
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [activeTab, setActiveTab] = useState<
    "course-reviews" | "teacher-reviews" | "history"
  >("course-reviews");

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {t.ratings.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.ratings.subtitle}
        </p>
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
    </div>
  );
}
