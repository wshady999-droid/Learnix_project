"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Award,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Paperclip,
  Save,
  Send,
  Upload,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { studentSaveAssignmentSubmissionAction } from "@/services/student/actions";
import type {
  StudentAssignmentItem,
  StudentAssignmentsWorkspaceData,
} from "@/services/student/queries";

interface StudentAssignmentsClientProps {
  data: StudentAssignmentsWorkspaceData;
}

const DARK_GLASS_CARD =
  "border-white/10 bg-[#0F1115]/75 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-white/10 dark:bg-[#0F1115]/75";

const DARK_GLASS_SUBBOX =
  "border-white/10 bg-[#0F1115]/55 backdrop-blur-md";

export function StudentAssignmentsClient({
  data,
}: StudentAssignmentsClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [courseFilter, setCourseFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string>(
    searchParams.get("assignmentId") || data.assignments[0]?.id || "",
  );

  const filteredAssignments = useMemo(() => {
    return data.assignments.filter((asg) => {
      if (courseFilter !== "all" && asg.courseId !== courseFilter) return false;
      const st = asg.submission?.status ?? "not_started";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      return true;
    });
  }, [data.assignments, courseFilter, statusFilter]);

  const activeAssignment: StudentAssignmentItem | null = useMemo(
    () =>
      filteredAssignments.find((a) => a.id === selectedId) ??
      filteredAssignments[0] ??
      null,
    [filteredAssignments, selectedId],
  );

  const [answerText, setAnswerText] = useState<string>(
    activeAssignment?.submission?.submissionText ?? "",
  );
  const [uploadedFile, setUploadedFile] = useState<{
    path: string;
    fileName: string;
    mimeType: string;
  } | null>(
    activeAssignment?.submission?.attachmentPath
      ? {
          path: activeAssignment.submission.attachmentPath,
          fileName: activeAssignment.submission.attachmentFileName || "File",
          mimeType: "application/octet-stream",
        }
      : null,
  );
  const [uploading, setUploading] = useState(false);

  function selectAssignment(asg: StudentAssignmentItem) {
    setSelectedId(asg.id);
    setAnswerText(asg.submission?.submissionText ?? "");
    setUploadedFile(
      asg.submission?.attachmentPath
        ? {
            path: asg.submission.attachmentPath,
            fileName: asg.submission.attachmentFileName || "File",
            mimeType: "application/octet-stream",
          }
        : null,
    );
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeAssignment) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("File must be 25 MB or smaller.");
      return;
    }

    setUploading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      // Storage RLS requires: {course_id}/{student_id}/{filename}
      const storagePath = `${activeAssignment.courseId}/${data.studentId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("assignment-attachments")
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });

      if (error) {
        toast.error(error.message);
        return;
      }

      setUploadedFile({
        path: storagePath,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      });
      toast.success("Assignment file uploaded.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function handleSaveOrSubmit(isDraft: boolean) {
    if (!activeAssignment) return;
    startTransition(async () => {
      const res = await studentSaveAssignmentSubmissionAction({
        assignmentId: activeAssignment.id,
        submissionText: answerText,
        attachmentStoragePath: uploadedFile?.path ?? null,
        attachmentFileName: uploadedFile?.fileName ?? null,
        attachmentMimeType: uploadedFile?.mimeType ?? null,
        isDraft,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        isDraft
          ? "Draft saved! You can continue editing before submitting."
          : res.data.status === "late"
            ? "Assignment submitted (marked Late)."
            : "Assignment submitted successfully!",
      );
      router.refresh();
    });
  }

  function renderStatusBadge(asg: StudentAssignmentItem) {
    const st = asg.submission?.status;
    if (!st) return <Badge variant="outline">Pending</Badge>;
    switch (st) {
      case "draft":
        return <Badge variant="outline">Draft</Badge>;
      case "submitted":
        return <Badge variant="gold-subtle">Submitted</Badge>;
      case "under_review":
        return <Badge variant="warning">Under Review</Badge>;
      case "late":
        return <Badge variant="destructive">Late</Badge>;
      case "graded":
        return <Badge variant="gold">Graded</Badge>;
      default:
        return <Badge variant="outline">{st}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Course Assignments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Read assignment instructions, save drafts, upload files, and view published instructor grades.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            className={cn(
              fieldBase,
              "h-9 w-48 border-white/10 bg-[#0F1115]/75 text-xs backdrop-blur-md",
            )}
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
          >
            <option value="all">All Enrolled Courses</option>
            {data.enrolledCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} — {c.title}
              </option>
            ))}
          </select>

          <select
            className={cn(
              fieldBase,
              "h-9 w-40 border-white/10 bg-[#0F1115]/75 text-xs backdrop-blur-md",
            )}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="not_started">Not Started</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="late">Late</option>
            <option value="graded">Graded</option>
          </select>
        </div>
      </div>

      {data.assignments.length === 0 ? (
        <Card className={cn(DARK_GLASS_CARD, "py-6")}>
          <CardContent className="p-6">
            <EmptyState
              icon={FileText}
              title="No assignments published yet"
              description="Assignments published by your course instructors will appear here."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Assignment List */}
          <Card className={cn(DARK_GLASS_CARD, "lg:col-span-4")}>
            <CardHeader className="border-b border-white/10 pb-3">
              <CardTitle className="text-sm">
                Assignments ({filteredAssignments.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 pt-4 text-xs">
              {filteredAssignments.map((asg) => {
                const isSelected = activeAssignment?.id === asg.id;
                return (
                  <button
                    key={asg.id}
                    type="button"
                    onClick={() => selectAssignment(asg)}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      isSelected
                        ? "border-[#C99A22]/60 bg-[#0F1115]/80"
                        : "border-white/10 bg-[#0F1115]/45 hover:bg-[#0F1115]/65",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[10px] text-[#C99A22]">
                        {asg.courseCode}
                      </span>
                      {renderStatusBadge(asg)}
                    </div>
                    <p className="mt-1 truncate font-semibold text-foreground">
                      {asg.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Clock className="size-3" />
                      <span>
                        {asg.dueAt
                          ? `Due ${asg.dueAt.slice(0, 16).replace("T", " ")}`
                          : "Open deadline"}
                      </span>
                      <span>• {asg.maxPoints} pts</span>
                    </p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          {/* Assignment Detail, Submission Form & Published Grade */}
          <div className="space-y-6 lg:col-span-8">
            {!activeAssignment ? (
              <Card className={DARK_GLASS_CARD}>
                <CardContent className="py-12">
                  <EmptyState
                    icon={FileText}
                    title="Select an assignment"
                    description="Choose an assignment from the list to view instructions and submit your work."
                  />
                </CardContent>
              </Card>
            ) : (
              <>
                <Card className={DARK_GLASS_CARD}>
                  <CardHeader className="border-b border-white/10">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-[#0F1115]/60 font-mono text-xs"
                        >
                          {activeAssignment.courseCode}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {activeAssignment.courseTitle} •{" "}
                          {activeAssignment.teacherName}
                        </span>
                      </div>
                      {renderStatusBadge(activeAssignment)}
                    </div>
                    <CardTitle className="pt-1 text-xl">
                      {activeAssignment.title}
                    </CardTitle>
                    <CardDescription className="flex flex-wrap items-center gap-3 text-xs">
                      <span>Maximum Marks: {activeAssignment.maxPoints}</span>
                      <span>•</span>
                      <span>
                        Deadline:{" "}
                        {activeAssignment.dueAt
                          ? activeAssignment.dueAt.slice(0, 16).replace("T", " ")
                          : "No strict deadline"}
                      </span>
                      {!activeAssignment.allowLateSubmissions && (
                        <Badge
                          variant="outline"
                          className="border-white/15 bg-[#0F1115]/60 text-[10px]"
                        >
                          Strict Deadline
                        </Badge>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4 pt-4 text-xs">
                    <div
                      className={cn(
                        "rounded-xl border p-4 leading-relaxed whitespace-pre-wrap text-foreground",
                        DARK_GLASS_SUBBOX,
                      )}
                    >
                      {activeAssignment.description}
                    </div>

                    {activeAssignment.instructions && (
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">
                          Detailed Instructions
                        </p>
                        <div
                          className={cn(
                            "rounded-xl border p-3.5 leading-relaxed whitespace-pre-wrap text-muted-foreground",
                            DARK_GLASS_SUBBOX,
                          )}
                        >
                          {activeAssignment.instructions}
                        </div>
                      </div>
                    )}

                    {activeAssignment.teacherAttachmentUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
                      >
                        <a
                          href={activeAssignment.teacherAttachmentUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download className="size-3.5 text-[#C99A22]" />
                          <span>
                            Download Reference:{" "}
                            {activeAssignment.teacherAttachmentName}
                          </span>
                        </a>
                      </Button>
                    )}
                  </CardContent>
                </Card>

                {/* Published Grade & Feedback Card (Strictly shown ONLY when grade is published!) */}
                {activeAssignment.submission?.isGradePublished ? (
                  <Card className="border-emerald-400/35 bg-[#0F1115]/75 text-foreground backdrop-blur-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <Award className="size-5 text-emerald-400" />
                          Published Grade & Feedback
                        </span>
                        <Badge variant="gold" className="text-sm">
                          {activeAssignment.submission.publishedPoints} /{" "}
                          {activeAssignment.maxPoints} pts
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <p className="font-semibold text-foreground">
                        Instructor Feedback:
                      </p>
                      <p
                        className={cn(
                          "rounded-lg border p-3 leading-relaxed whitespace-pre-wrap text-foreground",
                          DARK_GLASS_SUBBOX,
                        )}
                      >
                        {activeAssignment.submission.publishedFeedback ||
                          "Graded and approved by your instructor."}
                      </p>
                    </CardContent>
                  </Card>
                ) : (
                  activeAssignment.submission &&
                  activeAssignment.submission.status !== "draft" && (
                    <Card className={DARK_GLASS_CARD}>
                      <CardContent className="flex items-center gap-3 py-4 text-xs">
                        <CheckCircle2 className="size-5 shrink-0 text-[#C99A22]" />
                        <div>
                          <p className="font-semibold text-foreground">
                            Submission Received (
                            {activeAssignment.submission.status ===
                            "under_review"
                              ? "Under Instructor Review"
                              : "Submitted"}
                            )
                          </p>
                          <p className="text-muted-foreground">
                            Your grade and teacher feedback will appear here as soon as your instructor approves and publishes them.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )
                )}

                {/* Answer & File Upload Workspace */}
                <Card className={DARK_GLASS_CARD}>
                  <CardHeader className="border-b border-white/10">
                    <CardTitle className="text-base">Your Submission</CardTitle>
                    <CardDescription>
                      {activeAssignment.submission?.isGradePublished
                        ? "This submission has been graded and finalized."
                        : "Write your response below and/or attach your work file (PDF, DOCX, ZIP, TXT, or image)."}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    {activeAssignment.submissionTypes.includes("text") && (
                      <div className="space-y-1.5">
                        <Label>Written Response</Label>
                        <Textarea
                          rows={7}
                          disabled={Boolean(
                            activeAssignment.submission?.isGradePublished,
                          )}
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Write your structured assignment answer here..."
                          className={cn(DARK_GLASS_SUBBOX, "text-foreground")}
                        />
                      </div>
                    )}

                    {activeAssignment.submissionTypes.includes("file") && (
                      <div className="space-y-2">
                        <Label>Assignment File Attachment</Label>
                        <div className="flex flex-wrap items-center gap-3">
                          {!activeAssignment.submission?.isGradePublished && (
                            <label
                              className={cn(
                                "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold hover:border-[#C99A22]/50",
                                DARK_GLASS_SUBBOX,
                              )}
                            >
                              <Upload className="size-4 text-[#C99A22]" />
                              <span>
                                {uploading
                                  ? "Uploading..."
                                  : uploadedFile
                                    ? "Replace File"
                                    : "Upload File (≤ 25 MB)"}
                              </span>
                              <input
                                type="file"
                                accept=".pdf,.zip,.doc,.docx,.txt,.png,.jpg,.jpeg"
                                className="hidden"
                                disabled={uploading}
                                onChange={handleFileUpload}
                              />
                            </label>
                          )}

                          {uploadedFile && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#C99A22]/40 bg-[#0F1115]/65 px-3 py-1.5 text-xs font-medium">
                              <Paperclip className="size-3.5 text-[#C99A22]" />
                              {uploadedFile.fileName}
                            </span>
                          )}

                          {activeAssignment.submission?.attachmentSignedUrl && (
                            <Button
                              asChild
                              variant="outline"
                              size="sm"
                              className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
                            >
                              <a
                                href={
                                  activeAssignment.submission
                                    .attachmentSignedUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                              >
                                <Download className="size-3.5" />
                                <span>Download Submitted File</span>
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    {!activeAssignment.submission?.isGradePublished && (
                      <div className="flex flex-wrap justify-end gap-2 pt-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending || uploading}
                          onClick={() => handleSaveOrSubmit(true)}
                          className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
                        >
                          <Save className="size-3.5" />
                          <span>Save Draft</span>
                        </Button>
                        <Button
                          variant="gold"
                          size="sm"
                          disabled={isPending || uploading}
                          onClick={() => handleSaveOrSubmit(false)}
                        >
                          <Send className="size-3.5" />
                          <span>
                            {activeAssignment.submission &&
                            activeAssignment.submission.status !== "draft"
                              ? "Update Submission"
                              : "Submit Assignment"}
                          </span>
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}