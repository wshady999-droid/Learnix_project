"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  EyeOff,
  Lock,
  MessageSquareWarning,
  Search,
  Star,
  Trash2,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { adminModerateReviewAction } from "@/services/admin/actions";
import type {
  AdminModeratedReviewItem,
  AdminReviewsModerationData,
} from "@/services/admin/queries";

interface AdminReviewsClientProps {
  data: AdminReviewsModerationData;
}

export function AdminReviewsClient({ data }: AdminReviewsClientProps) {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [ratingFilter, setRatingFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);

  const [moderatingItem, setModeratingItem] = useState<{
    review: AdminModeratedReviewItem;
    action: "hide" | "remove";
  } | null>(null);
  const [moderationReason, setModerationReason] = useState("");

  const filteredReviews = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.reviews.filter((item) => {
      if (courseFilter !== "all" && item.courseId !== courseFilter) {
        return false;
      }
      if (teacherFilter !== "all" && item.teacherId !== teacherFilter) {
        return false;
      }
      if (ratingFilter !== "all" && String(item.rating) !== ratingFilter) {
        return false;
      }
      if (statusFilter !== "all" && item.moderationStatus !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        (item.comment ?? "").toLowerCase().includes(q) ||
        (item.improvementSuggestions ?? "").toLowerCase().includes(q) ||
        item.studentName.toLowerCase().includes(q) ||
        item.courseTitle.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q)
      );
    });
  }, [
    data.reviews,
    search,
    courseFilter,
    teacherFilter,
    ratingFilter,
    statusFilter,
  ]);

  async function handleConfirmModerate() {
    if (!moderatingItem) return;
    if (moderationReason.trim().length < 3) {
      toast.error("Please provide a moderation reason.");
      return;
    }

    setBusyId(moderatingItem.review.id);
    const res = await adminModerateReviewAction({
      reviewId: moderatingItem.review.id,
      reviewType: moderatingItem.review.reviewType,
      action: moderatingItem.action,
      reason: moderationReason,
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      moderatingItem.action === "remove"
        ? "Inappropriate comment removed and audit logged."
        : "Review hidden from public course display.",
    );
    setModeratingItem(null);
    setModerationReason("");
    router.refresh();
  }

  async function handleRestoreReview(review: AdminModeratedReviewItem) {
    setBusyId(review.id);
    const res = await adminModerateReviewAction({
      reviewId: review.id,
      reviewType: review.reviewType,
      action: "approve",
    });
    setBusyId(null);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("Review approved and restored.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Reviews & Ratings Moderation
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Inspect student course and teacher reviews, filter by course, teacher, or star rating, and hide or remove inappropriate comments with an audited reason.
        </p>
      </div>

      <Card className="border-emerald-500/40 bg-emerald-500/5">
        <CardContent className="flex items-center gap-3 py-3 text-xs">
          <Lock className="size-4 shrink-0 text-emerald-500" />
          <p className="text-foreground">
            <strong>Academic Rating Integrity:</strong> Student star rating values are strictly immutable in the database and cannot be altered—administrators can only moderate inappropriate written comments with a recorded reason.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search comments, student, course..."
              className="ps-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              aria-label="Filter by course"
              className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
            >
              <option value="all">All Courses</option>
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <select
              value={teacherFilter}
              onChange={(e) => setTeacherFilter(e.target.value)}
              aria-label="Filter by teacher"
              className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
            >
              <option value="all">All Teachers</option>
              {data.teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              aria-label="Filter by rating"
              className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
            >
              <option value="all">All Ratings</option>
              {[5, 4, 3, 2, 1].map((r) => (
                <option key={r} value={String(r)}>
                  {r} ★
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by moderation status"
              className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
            >
              <option value="all">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="hidden">Hidden</option>
              <option value="removed">Removed</option>
            </select>
          </div>
        </CardHeader>

        <CardContent>
          {filteredReviews.length === 0 ? (
            <EmptyState
              icon={MessageSquareWarning}
              title="No Reviews Match Your Filters"
              description="Student course and teacher reviews appear here automatically."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Target</TableHead>
                  <TableHead>Student</TableHead>
                  <TableHead>Rating</TableHead>
                  <TableHead>Comment & Suggestions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-end">Moderation</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReviews.map((item) => (
                  <TableRow key={`${item.reviewType}-${item.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="uppercase">
                          {item.reviewType}
                        </Badge>
                        <span className="font-semibold text-foreground text-xs">
                          {item.courseTitle}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Instructor: {item.teacherName}
                      </p>
                    </TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-foreground">
                        {item.studentName}
                      </div>
                      <div className="font-mono text-[11px] text-muted-foreground">
                        {item.studentEmail}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        <Star className="size-3.5 fill-current" />
                        {item.rating} / 5
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md text-xs">
                      <p className="whitespace-pre-wrap text-foreground">
                        {item.comment || "—"}
                      </p>
                      {item.improvementSuggestions && (
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          <strong>Suggestion:</strong>{" "}
                          {item.improvementSuggestions}
                        </p>
                      )}
                      {item.moderationReason && (
                        <p className="mt-1 text-[11px] text-destructive">
                          <strong>Moderation Reason:</strong>{" "}
                          {item.moderationReason}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.moderationStatus === "approved"
                            ? "success"
                            : item.moderationStatus === "removed"
                              ? "destructive"
                              : "warning"
                        }
                      >
                        {item.moderationStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex flex-wrap justify-end gap-1.5">
                        {item.moderationStatus !== "approved" ? (
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={busyId === item.id}
                            onClick={() => void handleRestoreReview(item)}
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Approve</span>
                          </Button>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => {
                                setModeratingItem({
                                  review: item,
                                  action: "hide",
                                });
                                setModerationReason("");
                              }}
                            >
                              <EyeOff className="size-3.5" />
                              <span>Hide</span>
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={busyId === item.id}
                              onClick={() => {
                                setModeratingItem({
                                  review: item,
                                  action: "remove",
                                });
                                setModerationReason("");
                              }}
                            >
                              <Trash2 className="size-3.5" />
                              <span>Remove</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* MODERATION REASON DIALOG */}
      <Dialog
        open={Boolean(moderatingItem)}
        onOpenChange={(open) => {
          if (!open) setModeratingItem(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {moderatingItem?.action === "remove"
                ? "Remove Inappropriate Review"
                : "Hide Review Comment"}
            </DialogTitle>
            <DialogDescription>
              Provide a mandatory moderation reason. This action is logged in the security audit trail without altering historical rating integrity.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Moderation Reason * (Required)</Label>
            <Textarea
              rows={3}
              value={moderationReason}
              onChange={(e) => setModerationReason(e.target.value)}
              placeholder="Profanity / off-topic spam / personal harassment..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setModeratingItem(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyId === moderatingItem?.review.id}
              onClick={() => void handleConfirmModerate()}
            >
              Confirm Moderation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
