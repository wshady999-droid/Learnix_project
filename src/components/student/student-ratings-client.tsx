"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Award, ShieldCheck, Star } from "lucide-react";

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
import { Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getStudentDictionary } from "@/i18n/student-dictionaries";
import { cn } from "@/lib/utils";
import {
  studentSaveCourseReviewAction,
  studentSaveTeacherReviewAction,
} from "@/services/student/actions";
import type { StudentPerformanceAndGrowthData } from "@/services/student/queries";

interface StudentRatingsClientProps {
  data: StudentPerformanceAndGrowthData;
}

export function StudentRatingsClient({ data }: StudentRatingsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const t = getStudentDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    data.enrolledCourses[0]?.id ?? "",
  );
  const activeCourse = data.enrolledCourses.find(
    (c) => c.id === selectedCourseId,
  );

  const existingCourseReview = data.courseReviews.find(
    (r) => r.course_id === selectedCourseId,
  );
  const existingTeacherReview = data.teacherReviews.find(
    (r) => r.course_id === selectedCourseId,
  );

  const [courseStars, setCourseStars] = useState<number>(
    existingCourseReview?.rating ?? 5,
  );
  const [courseComment, setCourseComment] = useState<string>(
    existingCourseReview?.comment ?? "",
  );

  const [teacherStars, setTeacherStars] = useState<number>(
    existingTeacherReview?.rating ?? 5,
  );
  const [teacherComment, setTeacherComment] = useState<string>(
    existingTeacherReview?.comment ?? "",
  );

  function handleCourseSelect(nextCourseId: string) {
    setSelectedCourseId(nextCourseId);
    const cRev = data.courseReviews.find((r) => r.course_id === nextCourseId);
    const tRev = data.teacherReviews.find((r) => r.course_id === nextCourseId);
    setCourseStars(cRev?.rating ?? 5);
    setCourseComment(cRev?.comment ?? "");
    setTeacherStars(tRev?.rating ?? 5);
    setTeacherComment(tRev?.comment ?? "");
  }

  function handleSubmitCourseReview() {
    if (!selectedCourseId) return;
    startTransition(async () => {
      const res = await studentSaveCourseReviewAction({
        courseId: selectedCourseId,
        rating: courseStars,
        comment: courseComment,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.ratings.courseReviewSavedToast);
      router.refresh();
    });
  }

  function handleSubmitTeacherReview() {
    if (!selectedCourseId || !activeCourse) return;
    startTransition(async () => {
      const res = await studentSaveTeacherReviewAction({
        courseId: selectedCourseId,
        teacherId: activeCourse.teacher_id,
        rating: teacherStars,
        comment: teacherComment,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.ratings.teacherReviewSavedToast);
      router.refresh();
    });
  }

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

      <Card className="border-gold-primary/40 bg-gold-primary/5">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 py-4 text-xs">
          <div className="flex items-center gap-3">
            <ShieldCheck className="size-4 shrink-0 text-gold-foreground" />
            <p className="text-foreground">{t.ratings.policyNotice}</p>
          </div>
          {data.enrolledCourses.length > 0 && (
            <select
              className={cn(fieldBase, "h-9 w-64 bg-background")}
              value={selectedCourseId}
              onChange={(e) => handleCourseSelect(e.target.value)}
            >
              {data.enrolledCourses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title} ({c.progressPercent}%)
                </option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {data.enrolledCourses.length === 0 ? (
        <EmptyState
          icon={Star}
          title={t.common.noRecordsTitle}
          description="Enroll in a course to rate the curriculum and instructor."
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Course Rating Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {activeCourse?.title ?? "Course"}
                </CardTitle>
                {existingCourseReview && (
                  <Badge variant="gold">Submitted (Editable)</Badge>
                )}
              </div>
              <CardDescription>
                {t.ratings.courseRatingStarsLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    type="button"
                    size="sm"
                    variant={courseStars >= star ? "gold" : "outline"}
                    onClick={() => setCourseStars(star)}
                  >
                    ★ {star}
                  </Button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>{t.ratings.courseCommentLabel}</Label>
                <Textarea
                  rows={4}
                  value={courseComment}
                  onChange={(e) => setCourseComment(e.target.value)}
                  placeholder="Share your feedback on the lessons, materials, and clarity..."
                />
              </div>

              <Button
                variant="gold"
                size="sm"
                disabled={isPending}
                onClick={handleSubmitCourseReview}
              >
                <Star className="size-3.5" />
                <span>{t.ratings.submitCourseReviewButton}</span>
              </Button>
            </CardContent>
          </Card>

          {/* Teacher Rating Form */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  {activeCourse?.teacherName ?? "Instructor"}
                </CardTitle>
                {existingTeacherReview && (
                  <Badge variant="gold">Submitted (Editable)</Badge>
                )}
              </div>
              <CardDescription>
                {t.ratings.teacherRatingStarsLabel}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Button
                    key={star}
                    type="button"
                    size="sm"
                    variant={teacherStars >= star ? "gold" : "outline"}
                    onClick={() => setTeacherStars(star)}
                  >
                    ★ {star}
                  </Button>
                ))}
              </div>

              <div className="space-y-1.5">
                <Label>{t.ratings.teacherCommentLabel}</Label>
                <Textarea
                  rows={4}
                  value={teacherComment}
                  onChange={(e) => setTeacherComment(e.target.value)}
                  placeholder="Share your feedback on the instructor's teaching style and support..."
                />
              </div>

              <Button
                variant="gold"
                size="sm"
                disabled={isPending}
                onClick={handleSubmitTeacherReview}
              >
                <Award className="size-3.5" />
                <span>{t.ratings.submitTeacherReviewButton}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* My Submitted Reviews History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t.ratings.mySubmittedReviewsTitle}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2.5 text-xs">
          {data.courseReviews.length === 0 &&
          data.teacherReviews.length === 0 ? (
            <p className="text-muted-foreground">
              You have not submitted any ratings yet.
            </p>
          ) : (
            <>
              {data.courseReviews.map((rev) => {
                const course = data.enrolledCourses.find(
                  (c) => c.id === rev.course_id,
                );
                return (
                  <div
                    key={rev.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        Course: {course?.title ?? "Enrolled Course"}
                      </p>
                      <p className="text-muted-foreground">
                        {rev.comment || "No written comment"}
                      </p>
                    </div>
                    <Badge variant="gold">{"★".repeat(rev.rating)}</Badge>
                  </div>
                );
              })}

              {data.teacherReviews.map((rev) => {
                const course = data.enrolledCourses.find(
                  (c) => c.id === rev.course_id,
                );
                return (
                  <div
                    key={rev.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 p-3"
                  >
                    <div>
                      <p className="font-semibold text-foreground">
                        Instructor: {course?.teacherName ?? "Instructor"}
                      </p>
                      <p className="text-muted-foreground">
                        {rev.comment || "No written comment"}
                      </p>
                    </div>
                    <Badge variant="gold">{"★".repeat(rev.rating)}</Badge>
                  </div>
                );
              })}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
