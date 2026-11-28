import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import {
  ArrowLeft,
  Award,
  BookOpen,
  Briefcase,
  Clock,
  ExternalLink,
  GraduationCap,
  Star,
  User,
} from "lucide-react";

import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPublicTeacherProfileData } from "@/services/shared/queries";

export const metadata: Metadata = {
  title: "Instructor Profile | Learnix",
  description:
    "Public Learnix instructor profile, published courses, ratings, and verified student reviews.",
};

async function PublicTeacherProfileLoader({
  paramsPromise,
}: {
  paramsPromise: Promise<{ teacherId: string }>;
}) {
  await connection();
  const { teacherId } = await paramsPromise;
  const res = await getPublicTeacherProfileData(teacherId);

  if (!res.ok) {
    notFound();
  }

  const profile = res.data;

  return (
    <main className="min-h-dvh bg-background px-4 py-10 text-foreground sm:px-6 lg:px-10">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" size="sm">
            <Link href="/student/courses">
              <ArrowLeft className="size-4" />
              <span>Back to Courses</span>
            </Link>
          </Button>
          <Badge variant="gold-subtle">Verified Learnix Instructor</Badge>
        </div>

        {/* Hero Profile Card */}
        <Card className="overflow-hidden border-white/10 bg-[#0F1115]/80 text-foreground backdrop-blur-xl shadow-[0_12px_36px_rgba(0,0,0,0.35)]">
          <CardContent className="grid gap-6 p-6 sm:p-8 lg:grid-cols-12">
            <div className="flex flex-col items-start gap-4 sm:flex-row lg:col-span-8">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.fullName}
                  className="size-24 shrink-0 rounded-2xl border border-emerald-500/40 object-cover"
                />
              ) : (
                <div className="flex size-24 shrink-0 items-center justify-center rounded-2xl border border-emerald-500/40 bg-emerald-500/15 text-3xl font-bold text-emerald-400">
                  {profile.fullName.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="space-y-2.5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    {profile.fullName}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-emerald-400">
                    {profile.headline}
                  </p>
                </div>

                <p className="max-w-2xl text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                  {profile.biography}
                </p>

                <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                  {profile.experienceYears !== null && (
                    <Badge variant="outline" className="gap-1 border-white/15">
                      <Briefcase className="size-3 text-emerald-400" />
                      {profile.experienceYears}{" "}
                      {profile.experienceYears === 1 ? "year" : "years"} teaching
                    </Badge>
                  )}
                  <Badge variant="outline" className="gap-1 border-white/15">
                    <BookOpen className="size-3 text-emerald-400" />
                    {profile.courses.length} Published{" "}
                    {profile.courses.length === 1 ? "Course" : "Courses"}
                  </Badge>
                  {profile.websiteUrl && (
                    <a
                      href={profile.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-emerald-400 hover:bg-white/5"
                    >
                      <span>Website</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {profile.linkedinUrl && (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 px-2.5 py-1 text-emerald-400 hover:bg-white/5"
                    >
                      <span>LinkedIn</span>
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 lg:col-span-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
                <Award className="mx-auto size-5 text-emerald-400" />
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {profile.averageTeacherRating > 0
                    ? `${profile.averageTeacherRating}★`
                    : "New"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Instructor Rating
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#141922]/80 p-4 text-center">
                <Star className="mx-auto size-5 text-amber-400" />
                <p className="mt-2 text-2xl font-bold text-foreground">
                  {profile.averageCourseRating > 0
                    ? `${profile.averageCourseRating}★`
                    : "New"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Avg Course Rating ({profile.totalReviews} reviews)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {(profile.education || profile.certifications) && (
          <div className="grid gap-4 md:grid-cols-2">
            {profile.education && (
              <Card className="border-white/10 bg-[#0F1115]/75">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <GraduationCap className="size-4 text-emerald-400" />
                    <span>Education & Academic Background</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {profile.education}
                </CardContent>
              </Card>
            )}
            {profile.certifications && (
              <Card className="border-white/10 bg-[#0F1115]/75">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Award className="size-4 text-emerald-400" />
                    <span>Certifications & Specializations</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-wrap text-muted-foreground">
                  {profile.certifications}
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* Published Courses */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Published Courses ({profile.courses.length})
          </h2>
          {profile.courses.length === 0 ? (
            <Card className="border-white/10 bg-[#0F1115]/60 p-8 text-center text-sm text-muted-foreground">
              No published courses yet.
            </Card>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {profile.courses.map((course) => (
                <Card
                  key={course.id}
                  className="flex flex-col justify-between overflow-hidden border-white/10 bg-[#0F1115]/75 transition-colors hover:border-emerald-500/40"
                >
                  <div>
                    <img
                      src={
                        course.thumbnailUrl?.trim() || "/learnix-hero.jpg"
                      }
                      alt={course.title}
                      className="h-44 w-full object-cover"
                    />
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge variant="gold-subtle">{course.category}</Badge>
                        {course.reviewCount > 0 && (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400">
                            <Star className="size-3.5 fill-amber-400 text-amber-400" />
                            {course.ratingAvg} ({course.reviewCount})
                          </span>
                        )}
                      </div>
                      <CardTitle className="mt-2 line-clamp-2 text-base">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2 text-xs">
                        {course.subtitle ||
                          course.description ||
                          "Structured Learnix curriculum"}
                      </CardDescription>
                    </CardHeader>
                  </div>
                  <CardContent className="flex items-center justify-between border-t border-white/10 pt-3 text-xs">
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Clock className="size-3.5 text-emerald-400" />
                      {course.estimatedHours > 0
                        ? `${course.estimatedHours} ${course.durationUnit}`
                        : "Self-paced"}
                    </span>
                    <Button asChild variant="gold" size="sm">
                      <Link href="/student/courses">Explore & Enroll</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Verified Student Reviews */}
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Verified Student Ratings & Reviews ({profile.reviews.length})
          </h2>
          {profile.reviews.length === 0 ? (
            <Card className="border-white/10 bg-[#0F1115]/60 p-8 text-center text-sm text-muted-foreground">
              No published student reviews yet.
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {profile.reviews.map((rev) => (
                <Card
                  key={rev.id}
                  className="border-white/10 bg-[#0F1115]/75 p-4 text-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <p className="flex items-center gap-1.5 font-semibold text-foreground">
                        <User className="size-3.5 text-emerald-400" />
                        <span>{rev.studentName}</span>
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        Course: <strong className="text-foreground">{rev.courseTitle}</strong> •{" "}
                        Instructor: <strong className="text-foreground">{profile.fullName}</strong>
                      </p>
                    </div>
                    <Badge variant="gold">
                      {"★".repeat(rev.rating)} ({rev.rating}/5)
                    </Badge>
                  </div>
                  <p className="mt-2.5 leading-relaxed text-muted-foreground">
                    {rev.comment || "Submitted a verified 5-star rating."}
                  </p>
                  <p className="mt-2 font-mono text-[10px] text-muted-foreground/75">
                    {rev.createdAt.slice(0, 10)}
                  </p>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

export default function PublicTeacherProfilePage({
  params,
}: {
  params: Promise<{ teacherId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <main className="min-h-dvh bg-background px-4 py-16 text-foreground sm:px-6 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <LoadingState />
          </div>
        </main>
      }
    >
      <PublicTeacherProfileLoader paramsPromise={params} />
    </Suspense>
  );
}
