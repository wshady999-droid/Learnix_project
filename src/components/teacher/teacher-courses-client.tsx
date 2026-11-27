"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Edit3,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Film,
  FolderPlus,
  HelpCircle,
  ImagePlus,
  Layers,
  MessageSquare,
  Plus,
  Presentation,
  Search,
  Trash2,
  Upload,
  Users,
  X,
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
import { getTeacherDictionary } from "@/i18n/teacher-dictionaries";
import { COURSE_CATEGORIES } from "@/lib/constants/categories";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  uploadCourseThumbnail,
  validateCourseThumbnailFile,
} from "@/lib/supabase/course-storage";
import { cn } from "@/lib/utils";
import type { TableRow as DbTableRow } from "@/services/db/utils";
import {
  teacherDeleteChapterAction,
  teacherDeleteLearningResourceAction,
  teacherDeleteLessonAction,
  teacherReorderChapterAction,
  teacherReorderLessonAction,
  teacherSaveChapterAction,
  teacherSaveCourseAction,
  teacherSaveLearningResourceAction,
  teacherSaveLessonAction,
  teacherToggleCourseStatusAction,
  teacherToggleLessonPublishedAction,
} from "@/services/teacher/actions";
import type { TeacherCoursesData } from "@/services/teacher/queries";

interface TeacherCoursesClientProps {
  data: TeacherCoursesData;
}

export function TeacherCoursesClient({ data }: TeacherCoursesClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const t = getTeacherDictionary(locale);
  const [isPending, startTransition] = useTransition();

  const categoryOptions = useMemo(() => {
    if (data.categories.length > 0) {
      return data.categories.map((c) => ({ id: c.id, name: c.name }));
    }
    return COURSE_CATEGORIES.map((name) => ({ id: "", name }));
  }, [data.categories]);

  const [activeTab, setActiveTab] = useState<
    "courses" | "chapters" | "resources" | "students"
  >("courses");
  const [search, setSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string>(
    data.courses[0]?.id ?? "",
  );

  // Course modal state
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [editingCourseId, setEditingCourseId] = useState<string | undefined>(
    undefined,
  );
  const [editingCourseCode, setEditingCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [courseCategoryId, setCourseCategoryId] = useState<string>(
    categoryOptions[0]?.id ?? "",
  );
  const [courseCategoryName, setCourseCategoryName] = useState<string>(
    categoryOptions[0]?.name ?? COURSE_CATEGORIES[0],
  );
  const [courseSummary, setCourseSummary] = useState("");
  const [courseDescription, setCourseDescription] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("none");
  const [levelId, setLevelId] = useState<string>("none");
  const [courseLanguage, setCourseLanguage] = useState<
    "en" | "ar" | "de" | "it" | "fr"
  >("en");
  const [estimatedHours, setEstimatedHours] = useState("12");
  const [durationUnit, setDurationUnit] = useState<"hours" | "days">("hours");
  const [passingScore, setPassingScore] = useState("60");
  const [completionRequirements, setCompletionRequirements] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(
    null,
  );
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);

  // Chapter modal state
  const [chapterDialogOpen, setChapterDialogOpen] = useState(false);
  const [editingChapterId, setEditingChapterId] = useState<string | undefined>(
    undefined,
  );
  const [chapterTitle, setChapterTitle] = useState("");
  const [chapterSummary, setChapterSummary] = useState("");
  const [chapterOrder, setChapterOrder] = useState("1");
  const [chapterPublished, setChapterPublished] = useState(true);

  // Lesson modal state
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [editingLessonId, setEditingLessonId] = useState<string | undefined>(
    undefined,
  );
  const [lessonChapterId, setLessonChapterId] = useState<string>("");
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonType, setLessonType] = useState<
    "video" | "pdf" | "presentation" | "article" | "quiz"
  >("video");
  const [lessonSummary, setLessonSummary] = useState("");
  const [lessonBody, setLessonBody] = useState("");
  const [lessonDuration, setLessonDuration] = useState("20");
  const [lessonOrder, setLessonOrder] = useState("1");
  const [videoStoragePath, setVideoStoragePath] = useState("");
  const [attachmentStoragePath, setAttachmentStoragePath] = useState("");
  const [externalResourceUrl, setExternalResourceUrl] = useState("");
  const [scheduledPublishAt, setScheduledPublishAt] = useState("");
  const [isPreview, setIsPreview] = useState(false);
  const [isPublished, setIsPublished] = useState(true);
  const [uploadingLessonMedia, setUploadingLessonMedia] = useState(false);

  // Learning Resource modal state
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<
    string | undefined
  >(undefined);
  const [resourceChapterId, setResourceChapterId] = useState<string>("none");
  const [resourceLessonId, setResourceLessonId] = useState<string>("none");
  const [resourceTitle, setResourceTitle] = useState("");
  const [resourceDescription, setResourceDescription] = useState("");
  const [resourceType, setResourceType] = useState<
    "pdf" | "document" | "link" | "slides" | "archive" | "other"
  >("pdf");
  const [resourceStoragePath, setResourceStoragePath] = useState("");
  const [resourceFileName, setResourceFileName] = useState("");
  const [resourceFileSize, setResourceFileSize] = useState<number | null>(null);
  const [resourceMimeType, setResourceMimeType] = useState("");
  const [resourceExternalUrl, setResourceExternalUrl] = useState("");
  const [resourcePublished, setResourcePublished] = useState(true);
  const [uploadingResourceFile, setUploadingResourceFile] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "new") {
      openNewCourseModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, [thumbnailPreviewUrl]);

  const filteredCourses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return data.courses;
    return data.courses.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        (c.category ?? "").toLowerCase().includes(q) ||
        (c.subtitle ?? "").toLowerCase().includes(q),
    );
  }, [data.courses, search]);

  const activeCourseId = selectedCourseId || data.courses[0]?.id || "";
  const activeCourse = useMemo(
    () => data.courses.find((c) => c.id === activeCourseId) ?? null,
    [data.courses, activeCourseId],
  );
  const courseChapters = useMemo(
    () => data.chapters.filter((ch) => ch.course_id === activeCourseId),
    [data.chapters, activeCourseId],
  );
  const courseLessons = useMemo(
    () => data.lessons.filter((l) => l.course_id === activeCourseId),
    [data.lessons, activeCourseId],
  );
  const courseResources = useMemo(
    () => data.learningResources.filter((r) => r.course_id === activeCourseId),
    [data.learningResources, activeCourseId],
  );
  const courseEnrollments = useMemo(
    () => data.enrollments.filter((e) => e.course_id === activeCourseId),
    [data.enrollments, activeCourseId],
  );

  function openNewCourseModal() {
    setEditingCourseId(undefined);
    setEditingCourseCode("");
    setCourseTitle("");
    setCourseCategoryId(categoryOptions[0]?.id ?? "");
    setCourseCategoryName(categoryOptions[0]?.name ?? COURSE_CATEGORIES[0]);
    setCourseSummary("");
    setCourseDescription("");
    setDepartmentId("none");
    setLevelId("none");
    setCourseLanguage("en");
    setEstimatedHours("12");
    setDurationUnit("hours");
    setPassingScore("60");
    setCompletionRequirements(
      "Complete all sections, lessons, and pass the course assessments.",
    );
    setThumbnailUrl("");
    setThumbnailFile(null);
    setThumbnailPreviewUrl(null);
    setCourseDialogOpen(true);
  }

  function openEditCourseModal(course: DbTableRow<"courses">) {
    setEditingCourseId(course.id);
    setEditingCourseCode(course.code);
    setCourseTitle(course.title);
    const matchingCat =
      categoryOptions.find(
        (c) =>
          (course.category_id && c.id === course.category_id) ||
          c.name.toLowerCase() === (course.category ?? "").toLowerCase(),
      ) ?? categoryOptions[0];
    setCourseCategoryId(matchingCat?.id ?? "");
    setCourseCategoryName(matchingCat?.name ?? course.category ?? "General");
    setCourseSummary(course.subtitle ?? "");
    setCourseDescription(course.description ?? "");
    setDepartmentId(course.department_id ?? "none");
    setLevelId(course.educational_level_id ?? "none");
    setCourseLanguage(
      (course.language as "en" | "ar" | "de" | "it" | "fr") || "en",
    );
    setEstimatedHours(String(course.estimated_hours ?? 12));
    setDurationUnit(
      course.duration_unit === "days" ? "days" : "hours",
    );
    setPassingScore(String(course.passing_score ?? 60));
    setCompletionRequirements(course.completion_requirements ?? "");
    setThumbnailUrl(course.thumbnail_url ?? "");
    setThumbnailFile(null);
    setThumbnailPreviewUrl(course.thumbnail_url ?? null);
    setCourseDialogOpen(true);
  }

  function handleThumbnailFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateCourseThumbnailFile(file);
    if (validationError) {
      toast.error(validationError);
      e.target.value = "";
      return;
    }

    if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }

    const localObjectUrl = URL.createObjectURL(file);
    setThumbnailFile(file);
    setThumbnailPreviewUrl(localObjectUrl);
  }

  function handleClearThumbnailSelection() {
    if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
    }
    setThumbnailFile(null);
    setThumbnailPreviewUrl(null);
    setThumbnailUrl("");
  }

  function handleSaveCourse(targetStatus: "draft" | "published") {
    if (courseTitle.trim().length < 3) {
      toast.error("Course Name must be at least 3 characters.");
      return;
    }
    if (!courseCategoryName.trim()) {
      toast.error("Please select a Course Category.");
      return;
    }
    if (courseDescription.trim().length < 10) {
      toast.error("Course Description must be at least 10 characters.");
      return;
    }
    if (Number(estimatedHours) < 1) {
      toast.error("Duration must be at least 1.");
      return;
    }
    if (!editingCourseId && !thumbnailFile && !thumbnailUrl) {
      toast.error("Course Cover Image is mandatory when creating a course.");
      return;
    }

    startTransition(async () => {
      let resolvedThumbnailUrl: string | null = thumbnailUrl || null;

      if (thumbnailFile) {
        setUploadingThumbnail(true);
        try {
          const uploaded = await uploadCourseThumbnail({
            file: thumbnailFile,
            folderId: editingCourseId || data.teacherId,
          });
          resolvedThumbnailUrl = uploaded.publicUrl;
          setThumbnailUrl(uploaded.publicUrl);
        } catch (err) {
          setUploadingThumbnail(false);
          toast.error(
            err instanceof Error
              ? err.message
              : "Failed to upload course cover image.",
          );
          return;
        }
        setUploadingThumbnail(false);
      }

      const res = await teacherSaveCourseAction({
        id: editingCourseId,
        title: courseTitle,
        categoryId: courseCategoryId || null,
        category: courseCategoryName,
        summary: courseSummary || courseDescription.slice(0, 140),
        description: courseDescription,
        departmentId: departmentId === "none" ? null : departmentId,
        educationalLevelId: levelId === "none" ? null : levelId,
        language: courseLanguage,
        status: targetStatus,
        estimatedHours: Number(estimatedHours),
        durationUnit,
        passingScore: Number(passingScore),
        completionRequirements,
        thumbnailUrl: resolvedThumbnailUrl,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(
        targetStatus === "published"
          ? `Course published (${res.data.code}).`
          : `Course draft saved (${res.data.code}).`,
      );
      setCourseDialogOpen(false);
      setThumbnailFile(null);
      setSelectedCourseId(res.data.id);
      router.refresh();
    });
  }

  function handleQuickToggleCoursePublish(course: DbTableRow<"courses">) {
    const nextStatus = course.status === "published" ? "draft" : "published";
    startTransition(async () => {
      const res = await teacherToggleCourseStatusAction({
        courseId: course.id,
        status: nextStatus,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        nextStatus === "published"
          ? "Course published to students."
          : "Course unpublished to draft.",
      );
      router.refresh();
    });
  }

  function openNewChapterModal() {
    if (!activeCourseId) return;
    setEditingChapterId(undefined);
    setChapterTitle("");
    setChapterSummary("");
    setChapterOrder(String(courseChapters.length + 1));
    setChapterPublished(true);
    setChapterDialogOpen(true);
  }

  function openEditChapterModal(ch: DbTableRow<"chapters">) {
    setEditingChapterId(ch.id);
    setChapterTitle(ch.title);
    setChapterSummary(ch.description ?? "");
    setChapterOrder(String(ch.position));
    setChapterPublished(ch.is_published);
    setChapterDialogOpen(true);
  }

  function handleSaveChapter() {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherSaveChapterAction({
        id: editingChapterId,
        courseId: activeCourseId,
        title: chapterTitle,
        summary: chapterSummary,
        positionOrder: Number(chapterOrder),
        isPublished: chapterPublished,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.courses.chapterSavedToast);
      setChapterDialogOpen(false);
      router.refresh();
    });
  }

  function handleReorderChapter(chapterId: string, direction: "up" | "down") {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherReorderChapterAction({
        courseId: activeCourseId,
        chapterId,
        direction,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDeleteChapter(chapterId: string) {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherDeleteChapterAction({
        chapterId,
        courseId: activeCourseId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.courses.chapterDeletedToast);
      router.refresh();
    });
  }

  function openNewLessonModal(defaultChapterId?: string) {
    const chId = defaultChapterId || courseChapters[0]?.id || "";
    if (!chId) {
      toast.error("Create a section first before adding lessons.");
      return;
    }
    setEditingLessonId(undefined);
    setLessonChapterId(chId);
    setLessonTitle("");
    setLessonType("video");
    setLessonSummary("");
    setLessonBody("");
    setLessonDuration("20");
    setLessonOrder(
      String(courseLessons.filter((l) => l.chapter_id === chId).length + 1),
    );
    setVideoStoragePath("");
    setAttachmentStoragePath("");
    setExternalResourceUrl("");
    setScheduledPublishAt("");
    setIsPreview(false);
    setIsPublished(true);
    setLessonDialogOpen(true);
  }

  function openEditLessonModal(lesson: DbTableRow<"lessons">) {
    setEditingLessonId(lesson.id);
    setLessonChapterId(lesson.chapter_id);
    setLessonTitle(lesson.title);
    setLessonType(lesson.content_type);
    setLessonSummary(lesson.summary ?? "");
    setLessonBody(lesson.content_markdown ?? "");
    setLessonDuration(
      String(Math.max(1, Math.round(lesson.duration_seconds / 60))),
    );
    setLessonOrder(String(lesson.position));
    setVideoStoragePath(lesson.video_storage_path ?? "");
    setAttachmentStoragePath(lesson.attachment_storage_path ?? "");
    setExternalResourceUrl(lesson.external_resource_url ?? "");
    setScheduledPublishAt(
      lesson.scheduled_publish_at
        ? lesson.scheduled_publish_at.slice(0, 16)
        : "",
    );
    setIsPreview(lesson.is_preview);
    setIsPublished(lesson.is_published);
    setLessonDialogOpen(true);
  }

  async function handleLessonMediaUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file || !activeCourseId) return;

    let bucketId: "course-videos" | "course-pdfs" | "course-presentations" =
      "course-videos";
    if (lessonType === "pdf") {
      bucketId = "course-pdfs";
    } else if (lessonType === "presentation") {
      bucketId = "course-presentations";
    }

    setUploadingLessonMedia(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${activeCourseId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from(bucketId)
        .upload(storagePath, file, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }

      if (bucketId === "course-videos") {
        setVideoStoragePath(storagePath);
      } else {
        setAttachmentStoragePath(storagePath);
      }
      toast.success(t.courses.uploadSuccessToast);
    } finally {
      setUploadingLessonMedia(false);
    }
  }

  function handleSaveLesson() {
    if (!activeCourseId || !lessonChapterId) return;
    startTransition(async () => {
      const res = await teacherSaveLessonAction({
        id: editingLessonId,
        courseId: activeCourseId,
        chapterId: lessonChapterId,
        title: lessonTitle,
        contentType: lessonType,
        summary: lessonSummary,
        bodyMarkdown: lessonBody,
        durationMinutes: Number(lessonDuration),
        positionOrder: Number(lessonOrder),
        videoStoragePath: videoStoragePath || null,
        attachmentStoragePath: attachmentStoragePath || null,
        externalResourceUrl: externalResourceUrl || null,
        scheduledPublishAt: scheduledPublishAt
          ? new Date(scheduledPublishAt).toISOString()
          : null,
        isPreview,
        isPublished,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(t.courses.lessonSavedToast);
      setLessonDialogOpen(false);
      router.refresh();
    });
  }

  function handleReorderLesson(
    chapterId: string,
    lessonId: string,
    direction: "up" | "down",
  ) {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherReorderLessonAction({
        courseId: activeCourseId,
        chapterId,
        lessonId,
        direction,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleToggleLessonPublished(lesson: DbTableRow<"lessons">) {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherToggleLessonPublishedAction({
        courseId: activeCourseId,
        lessonId: lesson.id,
        isPublished: !lesson.is_published,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(
        lesson.is_published ? "Lesson hidden as draft." : "Lesson published.",
      );
      router.refresh();
    });
  }

  function handleDeleteLesson(lessonId: string) {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherDeleteLessonAction({
        lessonId,
        courseId: activeCourseId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(t.courses.lessonDeletedToast);
      router.refresh();
    });
  }

  function openNewResourceModal() {
    if (!activeCourseId) return;
    setEditingResourceId(undefined);
    setResourceChapterId("none");
    setResourceLessonId("none");
    setResourceTitle("");
    setResourceDescription("");
    setResourceType("pdf");
    setResourceStoragePath("");
    setResourceFileName("");
    setResourceFileSize(null);
    setResourceMimeType("");
    setResourceExternalUrl("");
    setResourcePublished(true);
    setResourceDialogOpen(true);
  }

  function openEditResourceModal(resItem: DbTableRow<"learning_resources">) {
    setEditingResourceId(resItem.id);
    setResourceChapterId(resItem.chapter_id ?? "none");
    setResourceLessonId(resItem.lesson_id ?? "none");
    setResourceTitle(resItem.title);
    setResourceDescription(resItem.description ?? "");
    setResourceType(
      (resItem.resource_type as
        | "pdf"
        | "document"
        | "link"
        | "slides"
        | "archive"
        | "other") || "pdf",
    );
    setResourceStoragePath(resItem.storage_path ?? "");
    setResourceFileName(resItem.file_name ?? "");
    setResourceFileSize(resItem.file_size_bytes);
    setResourceMimeType(resItem.mime_type ?? "");
    setResourceExternalUrl(resItem.external_url ?? "");
    setResourcePublished(resItem.is_published);
    setResourceDialogOpen(true);
  }

  async function handleResourceFileUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file || !activeCourseId) return;

    setUploadingResourceFile(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${activeCourseId}/resources_${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("course-materials")
        .upload(storagePath, file, { upsert: true });

      if (error) {
        toast.error(error.message);
        return;
      }
      setResourceStoragePath(storagePath);
      setResourceFileName(file.name);
      setResourceFileSize(file.size);
      setResourceMimeType(file.type || "application/octet-stream");
      if (!resourceTitle.trim()) {
        setResourceTitle(file.name.replace(/\.[^.]+$/, ""));
      }
      toast.success("Learning resource uploaded.");
    } finally {
      setUploadingResourceFile(false);
    }
  }

  function handleSaveResource() {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherSaveLearningResourceAction({
        id: editingResourceId,
        courseId: activeCourseId,
        chapterId: resourceChapterId === "none" ? null : resourceChapterId,
        lessonId: resourceLessonId === "none" ? null : resourceLessonId,
        title: resourceTitle,
        description: resourceDescription,
        resourceType,
        storageBucket: resourceStoragePath ? "course-materials" : null,
        storagePath: resourceStoragePath || null,
        externalUrl: resourceExternalUrl || null,
        fileName: resourceFileName || null,
        fileSizeBytes: resourceFileSize,
        mimeType: resourceMimeType || null,
        isPublished: resourcePublished,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Learning resource saved.");
      setResourceDialogOpen(false);
      router.refresh();
    });
  }

  function handleDeleteResource(resourceId: string) {
    if (!activeCourseId) return;
    startTransition(async () => {
      const res = await teacherDeleteLearningResourceAction({
        resourceId,
        courseId: activeCourseId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Learning resource removed.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {t.courses.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.courses.subtitle}
          </p>
        </div>
        <Button variant="gold" size="sm" onClick={openNewCourseModal}>
          <Plus className="size-4" />
          <span>{t.courses.createCourse}</span>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "courses" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("courses")}
        >
          {t.courses.tabCourses} ({data.courses.length})
        </Button>
        <Button
          variant={activeTab === "chapters" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("chapters")}
        >
          {t.courses.tabChaptersLessons}
        </Button>
        <Button
          variant={activeTab === "resources" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("resources")}
        >
          Learning Resources ({courseResources.length})
        </Button>
        <Button
          variant={activeTab === "students" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("students")}
        >
          {t.courses.tabEnrolledStudents}
        </Button>
      </div>

      {activeTab === "courses" && (
        <div className="space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t.common.searchPlaceholder}
              className="pl-9"
            />
          </div>

          {filteredCourses.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title={t.common.noRecordsTitle}
              description={t.common.noRecordsDescription}
              actions={
                <Button variant="gold" size="sm" onClick={openNewCourseModal}>
                  <Plus className="size-4" />
                  <span>{t.courses.createCourse}</span>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course) => {
                const chaptersCount = data.chapters.filter(
                  (ch) => ch.course_id === course.id,
                ).length;
                const lessonsCount = data.lessons.filter(
                  (l) => l.course_id === course.id,
                ).length;
                const enrolledCount = data.enrollments.filter(
                  (e) => e.course_id === course.id,
                ).length;
                const isSelected = course.id === activeCourseId;

                return (
                  <Card
                    key={course.id}
                    className={cn(
                      "overflow-hidden",
                      isSelected
                        ? "border-emerald-500/60 shadow-md"
                        : "border-border/80",
                    )}
                  >
                    <div className="relative h-36 w-full overflow-hidden border-b border-border/60 bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={course.thumbnail_url || "/learnix-hero.jpg"}
                        alt={course.title}
                        className="h-full w-full object-cover"
                      />
                      <div className="absolute top-2.5 right-2.5">
                        <Badge className="border border-emerald-500/60 bg-[#0a1f1d]/85 text-[10px] font-semibold text-emerald-300 backdrop-blur-md">
                          {course.category || "General"}
                        </Badge>
                      </div>
                    </div>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {course.code}
                        </Badge>
                        <Badge
                          variant={
                            course.status === "published" ? "gold" : "outline"
                          }
                        >
                          {course.status}
                        </Badge>
                      </div>
                      <CardTitle className="mt-2 text-base">
                        {course.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-2">
                        {course.description ||
                          course.subtitle ||
                          "No description provided."}
                      </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs text-muted-foreground">
                      <div className="grid grid-cols-4 gap-2 rounded-lg border border-border/70 bg-muted/40 p-2.5 text-center">
                        <div>
                          <p className="font-semibold text-foreground">
                            {chaptersCount}
                          </p>
                          <p className="text-[11px]">Sections</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {lessonsCount}
                          </p>
                          <p className="text-[11px]">Lessons</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {enrolledCount}
                          </p>
                          <p className="text-[11px]">Students</p>
                        </div>
                        <div>
                          <p className="font-semibold text-foreground">
                            {Number(course.estimated_hours ?? 10)}
                            {course.duration_unit === "days" ? "d" : "h"}
                          </p>
                          <p className="text-[11px]">Duration</p>
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 pt-3">
                      <Button
                        variant={isSelected ? "gold" : "outline"}
                        size="sm"
                        onClick={() => {
                          setSelectedCourseId(course.id);
                          setActiveTab("chapters");
                        }}
                      >
                        <Layers className="size-3.5" />
                        <span>Manage Content</span>
                      </Button>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleQuickToggleCoursePublish(course)}
                        >
                          {course.status === "published"
                            ? "Unpublish"
                            : "Publish"}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditCourseModal(course)}
                        >
                          <Edit3 className="size-3.5" />
                          <span>{t.common.edit}</span>
                        </Button>
                      </div>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === "chapters" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {activeCourse
                  ? `${activeCourse.code} — ${activeCourse.title}`
                  : t.courses.selectCoursePrompt}
              </CardTitle>
              <CardDescription>
                Organize sections, videos, PDFs, text lessons, reordering, and visibility.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={cn(fieldBase, "h-9 w-64")}
                value={activeCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>

              <Button
                variant="outline"
                size="sm"
                disabled={!activeCourseId}
                onClick={openNewChapterModal}
              >
                <Plus className="size-4" />
                <span>Add Section</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!activeCourseId}
                onClick={openNewResourceModal}
              >
                <FolderPlus className="size-4" />
                <span>Add Resource</span>
              </Button>
              <Button
                variant="gold"
                size="sm"
                disabled={!activeCourseId || courseChapters.length === 0}
                onClick={() => openNewLessonModal()}
              >
                <Plus className="size-4" />
                <span>{t.courses.addLesson}</span>
              </Button>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {courseChapters.length === 0 ? (
              <EmptyState
                icon={Layers}
                title={t.common.noRecordsTitle}
                description="Add your first section to organize videos, PDFs, text lessons, and learning resources."
              />
            ) : (
              courseChapters.map((chapter, chIdx) => {
                const lessonsInChapter = courseLessons.filter(
                  (l) => l.chapter_id === chapter.id,
                );

                return (
                  <div
                    key={chapter.id}
                    className="rounded-xl border border-border/80 bg-card/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="font-mono text-xs">
                            #{chIdx + 1}
                          </Badge>
                          <h3 className="font-semibold text-foreground">
                            {chapter.title}
                          </h3>
                          <Badge
                            variant={
                              chapter.is_published ? "gold" : "outline"
                            }
                          >
                            {chapter.is_published
                              ? t.common.published
                              : t.common.draft}
                          </Badge>
                        </div>
                        {chapter.description && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {chapter.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Move section up"
                          disabled={isPending || chIdx === 0}
                          onClick={() =>
                            handleReorderChapter(chapter.id, "up")
                          }
                        >
                          <ArrowUp className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Move section down"
                          disabled={
                            isPending || chIdx === courseChapters.length - 1
                          }
                          onClick={() =>
                            handleReorderChapter(chapter.id, "down")
                          }
                        >
                          <ArrowDown className="size-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openNewLessonModal(chapter.id)}
                        >
                          <Plus className="size-3.5" />
                          <span>{t.courses.addLesson}</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditChapterModal(chapter)}
                        >
                          <Edit3 className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeleteChapter(chapter.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>

                    {lessonsInChapter.length === 0 ? (
                      <p className="py-4 text-center text-xs text-muted-foreground">
                        No lessons in this section yet.
                      </p>
                    ) : (
                      <div className="mt-3 space-y-2">
                        {lessonsInChapter.map((lesson, lIdx) => (
                          <div
                            key={lesson.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/80 p-3 text-xs"
                          >
                            <div className="flex items-center gap-2.5">
                              {lesson.content_type === "video" && (
                                <Film className="size-4 text-emerald-500" />
                              )}
                              {lesson.content_type === "pdf" && (
                                <FileText className="size-4 text-emerald-500" />
                              )}
                              {lesson.content_type === "presentation" && (
                                <Presentation className="size-4 text-emerald-500" />
                              )}
                              {lesson.content_type === "article" && (
                                <BookOpen className="size-4 text-emerald-500" />
                              )}
                              {lesson.content_type === "quiz" && (
                                <HelpCircle className="size-4 text-emerald-500" />
                              )}
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-semibold text-foreground">
                                    {lIdx + 1}. {lesson.title}
                                  </span>
                                  <Badge variant="outline" className="uppercase">
                                    {lesson.content_type === "article"
                                      ? "TEXT"
                                      : lesson.content_type}
                                  </Badge>
                                  <Badge
                                    variant={
                                      lesson.is_published ? "gold" : "outline"
                                    }
                                  >
                                    {lesson.is_published
                                      ? "Published"
                                      : "Draft"}
                                  </Badge>
                                  {lesson.is_preview && (
                                    <Badge variant="outline">Preview</Badge>
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                                  <span>
                                    {Math.max(
                                      1,
                                      Math.round(lesson.duration_seconds / 60),
                                    )}{" "}
                                    min
                                  </span>
                                  {lesson.scheduled_publish_at && (
                                    <span className="flex items-center gap-1">
                                      <CalendarClock className="size-3" />
                                      Scheduled:{" "}
                                      {lesson.scheduled_publish_at
                                        .slice(0, 16)
                                        .replace("T", " ")}
                                    </span>
                                  )}
                                  {lesson.external_resource_url && (
                                    <a
                                      href={lesson.external_resource_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 text-emerald-600 underline dark:text-emerald-400"
                                    >
                                      <ExternalLink className="size-3" />
                                      External Resource
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Move lesson up"
                                disabled={isPending || lIdx === 0}
                                onClick={() =>
                                  handleReorderLesson(
                                    chapter.id,
                                    lesson.id,
                                    "up",
                                  )
                                }
                              >
                                <ArrowUp className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Move lesson down"
                                disabled={
                                  isPending ||
                                  lIdx === lessonsInChapter.length - 1
                                }
                                onClick={() =>
                                  handleReorderLesson(
                                    chapter.id,
                                    lesson.id,
                                    "down",
                                  )
                                }
                              >
                                <ArrowDown className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title={
                                  lesson.is_published
                                    ? "Unpublish lesson"
                                    : "Publish lesson"
                                }
                                disabled={isPending}
                                onClick={() =>
                                  handleToggleLessonPublished(lesson)
                                }
                              >
                                {lesson.is_published ? (
                                  <Eye className="size-3.5 text-emerald-500" />
                                ) : (
                                  <EyeOff className="size-3.5 text-muted-foreground" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditLessonModal(lesson)}
                              >
                                <Edit3 className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleDeleteLesson(lesson.id)}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "resources" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Course Learning Resources
              </CardTitle>
              <CardDescription>
                Supplementary PDFs, reference guides, slide decks, and external links for students.
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                className={cn(fieldBase, "h-9 w-64")}
                value={activeCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
              >
                {data.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))}
              </select>
              <Button
                variant="gold"
                size="sm"
                disabled={!activeCourseId}
                onClick={openNewResourceModal}
              >
                <Plus className="size-4" />
                <span>Add Learning Resource</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {courseResources.length === 0 ? (
              <EmptyState
                icon={FolderPlus}
                title="No Learning Resources Yet"
                description="Upload supplementary PDFs, worksheets, or external links for this course."
              />
            ) : (
              <div className="space-y-2.5">
                {courseResources.map((resItem) => (
                  <div
                    key={resItem.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-card/60 p-3.5 text-xs"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-foreground">
                          {resItem.title}
                        </span>
                        <Badge variant="outline" className="uppercase">
                          {resItem.resource_type}
                        </Badge>
                        <Badge
                          variant={resItem.is_published ? "gold" : "outline"}
                        >
                          {resItem.is_published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      {resItem.description && (
                        <p className="mt-1 text-muted-foreground">
                          {resItem.description}
                        </p>
                      )}
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                        {resItem.file_name && <span>File: {resItem.file_name}</span>}
                        {resItem.external_url && (
                          <a
                            href={resItem.external_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-emerald-600 underline dark:text-emerald-400"
                          >
                            {resItem.external_url}
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditResourceModal(resItem)}
                      >
                        <Edit3 className="size-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleDeleteResource(resItem.id)}
                      >
                        <Trash2 className="size-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "students" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                {t.courses.tabEnrolledStudents}
              </CardTitle>
              <CardDescription>
                Students enrolled in the selected course and their completion progress.
              </CardDescription>
            </div>
            <select
              className={cn(fieldBase, "h-9 w-64")}
              value={activeCourseId}
              onChange={(e) => setSelectedCourseId(e.target.value)}
            >
              {data.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>
          </CardHeader>

          <CardContent>
            {courseEnrollments.length === 0 ? (
              <EmptyState
                icon={Users}
                title={t.common.noRecordsTitle}
                description={t.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>{t.courses.progressLabel}</TableHead>
                    <TableHead>{t.courses.enrolledAtLabel}</TableHead>
                    <TableHead className="text-right">Chat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {courseEnrollments.map((enr) => (
                    <TableRow key={enr.id}>
                      <TableCell>
                        <p className="font-semibold text-foreground">
                          {enr.studentName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {enr.studentEmail}
                        </p>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            enr.status === "completed" ? "gold" : "outline"
                          }
                        >
                          {enr.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {Number(enr.progress_percent ?? 0).toFixed(1)}%
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {enr.enrolled_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/messages?userId=${enr.student_id}&courseId=${enr.course_id}`}
                          >
                            <MessageSquare className="size-3.5" />
                            <span>Chat</span>
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* CREATE / EDIT COURSE DIALOG */}
      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingCourseId
                ? t.courses.editCourse
                : t.courses.createCourse}
            </DialogTitle>
            <DialogDescription>
              {editingCourseId
                ? `Course Code: ${editingCourseCode} (auto-generated)`
                : "Course codes are generated automatically in the database and linked to your teacher account."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="teacher-course-category">Category *</Label>
              <select
                id="teacher-course-category"
                required
                className={cn(fieldBase, "h-9 w-full")}
                value={courseCategoryName}
                onChange={(e) => {
                  const chosen = categoryOptions.find(
                    (c) => c.name === e.target.value,
                  );
                  setCourseCategoryName(e.target.value);
                  setCourseCategoryId(chosen?.id ?? "");
                }}
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.name} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Course Name *</Label>
              <Input
                required
                value={courseTitle}
                onChange={(e) => setCourseTitle(e.target.value)}
                placeholder="Advanced Artificial Intelligence & Neural Systems"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Duration *</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  required
                  value={estimatedHours}
                  onChange={(e) => setEstimatedHours(e.target.value)}
                />
                <select
                  className={cn(fieldBase, "h-9 w-28 shrink-0")}
                  value={durationUnit}
                  onChange={(e) =>
                    setDurationUnit(e.target.value as "hours" | "days")
                  }
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.passingScoreLabel}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={passingScore}
                onChange={(e) => setPassingScore(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>Description *</Label>
              <Textarea
                rows={4}
                required
                value={courseDescription}
                onChange={(e) => setCourseDescription(e.target.value)}
                placeholder="Describe what students will learn, syllabus highlights, and outcomes..."
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.courses.courseSummaryLabel} (Optional)</Label>
              <Input
                value={courseSummary}
                onChange={(e) => setCourseSummary(e.target.value)}
                placeholder="Short tagline shown on catalog cards"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.departmentLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
              >
                <option value="none">— Optional —</option>
                {data.departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.levelLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={levelId}
                onChange={(e) => setLevelId(e.target.value)}
              >
                <option value="none">— Optional —</option>
                {data.educationalLevels.map((lvl) => (
                  <option key={lvl.id} value={lvl.id}>
                    {lvl.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2.5 sm:col-span-2">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="course-cover-image-input"
                  className="flex items-center gap-2"
                >
                  <ImagePlus className="size-4 text-emerald-500" />
                  <span>Course Image * (Mandatory)</span>
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  JPG, PNG, WEBP • Max 5 MB
                </span>
              </div>

              <Input
                id="course-cover-image-input"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={uploadingThumbnail || isPending}
                onChange={handleThumbnailFileChange}
              />

              {(thumbnailPreviewUrl || thumbnailUrl) && (
                <div className="relative overflow-hidden rounded-xl border border-emerald-500/40 bg-muted/40 p-2">
                  <div className="relative h-44 w-full overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={thumbnailPreviewUrl || thumbnailUrl}
                      alt="Course cover preview"
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/45 to-transparent px-3 py-2 text-xs text-white">
                      <span className="flex items-center gap-1.5 truncate font-medium">
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-400" />
                        <span className="truncate">
                          {thumbnailFile
                            ? `Ready to upload: ${thumbnailFile.name} (${(thumbnailFile.size / (1024 * 1024)).toFixed(2)} MB)`
                            : "Current course cover image"}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={handleClearThumbnailSelection}
                        className="inline-flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-destructive"
                      >
                        <X className="size-3" />
                        <span>Remove</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setCourseDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="outline"
              disabled={isPending || uploadingThumbnail}
              onClick={() => handleSaveCourse("draft")}
            >
              {uploadingThumbnail ? "Uploading..." : "Save Draft"}
            </Button>
            <Button
              variant="gold"
              disabled={isPending || uploadingThumbnail}
              onClick={() => handleSaveCourse("published")}
            >
              {uploadingThumbnail ? "Uploading Cover..." : "Publish Course"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECTION DIALOG */}
      <Dialog open={chapterDialogOpen} onOpenChange={setChapterDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingChapterId ? "Edit Section" : "Add Section"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{t.courses.chapterTitleLabel}</Label>
              <Input
                value={chapterTitle}
                onChange={(e) => setChapterTitle(e.target.value)}
                placeholder="Section 1: Core Foundations"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t.courses.chapterSummaryLabel}</Label>
              <Textarea
                rows={2}
                value={chapterSummary}
                onChange={(e) => setChapterSummary(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>{t.courses.chapterOrderLabel}</Label>
                <Input
                  type="number"
                  value={chapterOrder}
                  onChange={(e) => setChapterOrder(e.target.value)}
                />
              </div>
              <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
                <span>{t.courses.chapterPublishedLabel}</span>
                <input
                  type="checkbox"
                  checked={chapterPublished}
                  onChange={(e) => setChapterPublished(e.target.checked)}
                />
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setChapterDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={handleSaveChapter}
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LESSON DIALOG */}
      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingLessonId ? "Edit Lesson" : t.courses.addLesson}
            </DialogTitle>
            <DialogDescription>
              Upload videos, PDFs, presentations, or write text lessons.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Section</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={lessonChapterId}
                onChange={(e) => setLessonChapterId(e.target.value)}
              >
                {courseChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    #{ch.position} — {ch.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.lessonTypeLabel}</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={lessonType}
                onChange={(e) =>
                  setLessonType(
                    e.target.value as
                      | "video"
                      | "pdf"
                      | "presentation"
                      | "article"
                      | "quiz",
                  )
                }
              >
                <option value="video">{t.courses.typeVideo}</option>
                <option value="pdf">{t.courses.typePdf}</option>
                <option value="article">Text Lesson (Article / Notes)</option>
                <option value="presentation">
                  {t.courses.typePresentation}
                </option>
                <option value="quiz">{t.courses.typeQuiz}</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.courses.lessonTitleLabel}</Label>
              <Input
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Lesson 1.1: Architecture Walkthrough"
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.durationMinutesLabel}</Label>
              <Input
                type="number"
                value={lessonDuration}
                onChange={(e) => setLessonDuration(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.chapterOrderLabel}</Label>
              <Input
                type="number"
                value={lessonOrder}
                onChange={(e) => setLessonOrder(e.target.value)}
              />
            </div>

            {(lessonType === "video" ||
              lessonType === "pdf" ||
              lessonType === "presentation") && (
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="flex items-center gap-2">
                  <Upload className="size-3.5 text-emerald-500" />
                  <span>{t.courses.uploadLessonMediaLabel}</span>
                </Label>
                <Input
                  type="file"
                  disabled={uploadingLessonMedia}
                  onChange={handleLessonMediaUpload}
                />
                {(videoStoragePath || attachmentStoragePath) && (
                  <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                    Stored path: {videoStoragePath || attachmentStoragePath}
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>{t.courses.externalResourceUrlLabel}</Label>
              <Input
                value={externalResourceUrl}
                onChange={(e) => setExternalResourceUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-1.5">
              <Label>{t.courses.scheduledPublishAtLabel}</Label>
              <Input
                type="datetime-local"
                value={scheduledPublishAt}
                onChange={(e) => setScheduledPublishAt(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.courses.lessonSummaryLabel}</Label>
              <Input
                value={lessonSummary}
                onChange={(e) => setLessonSummary(e.target.value)}
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label>{t.courses.lessonBodyLabel}</Label>
              <Textarea
                rows={5}
                value={lessonBody}
                onChange={(e) => setLessonBody(e.target.value)}
                placeholder="Write text lesson content, notes, formulas, or references..."
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>{t.courses.isPreviewLabel}</span>
              <input
                type="checkbox"
                checked={isPreview}
                onChange={(e) => setIsPreview(e.target.checked)}
              />
            </label>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>{t.courses.isPublishedLabel}</span>
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setLessonDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending || uploadingLessonMedia}
              onClick={handleSaveLesson}
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEARNING RESOURCE DIALOG */}
      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingResourceId
                ? "Edit Learning Resource"
                : "Add Learning Resource"}
            </DialogTitle>
            <DialogDescription>
              Attach PDFs, worksheets, code archives, or reference URLs to this course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Resource Type</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={resourceType}
                  onChange={(e) =>
                    setResourceType(
                      e.target.value as
                        | "pdf"
                        | "document"
                        | "link"
                        | "slides"
                        | "archive"
                        | "other",
                    )
                  }
                >
                  <option value="pdf">PDF Document</option>
                  <option value="document">Document / Worksheet</option>
                  <option value="slides">Slides</option>
                  <option value="link">External Link</option>
                  <option value="archive">Code / Archive</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="space-y-1">
                <Label>Link to Section (Optional)</Label>
                <select
                  className={cn(fieldBase, "h-9 w-full")}
                  value={resourceChapterId}
                  onChange={(e) => setResourceChapterId(e.target.value)}
                >
                  <option value="none">Course-wide</option>
                  {courseChapters.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      {ch.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <Label>Link to Lesson (Optional)</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={resourceLessonId}
                onChange={(e) => setResourceLessonId(e.target.value)}
              >
                <option value="none">None</option>
                {courseLessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <Label>Resource Title *</Label>
              <Input
                value={resourceTitle}
                onChange={(e) => setResourceTitle(e.target.value)}
                placeholder="Formula Cheat Sheet / Lab Starter Pack"
              />
            </div>

            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={resourceDescription}
                onChange={(e) => setResourceDescription(e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Upload className="size-3.5 text-emerald-500" />
                <span>Upload File (Supabase Storage)</span>
              </Label>
              <Input
                type="file"
                disabled={uploadingResourceFile}
                onChange={handleResourceFileUpload}
              />
              {resourceFileName && (
                <p className="font-mono text-[11px] text-emerald-600 dark:text-emerald-400">
                  Uploaded: {resourceFileName}
                </p>
              )}
            </div>

            <div className="space-y-1">
              <Label>Or External URL</Label>
              <Input
                value={resourceExternalUrl}
                onChange={(e) => setResourceExternalUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 font-medium">
              <span>Visible to Enrolled Students</span>
              <input
                type="checkbox"
                checked={resourcePublished}
                onChange={(e) => setResourcePublished(e.target.checked)}
              />
            </label>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setResourceDialogOpen(false)}
            >
              {t.common.cancel}
            </Button>
            <Button
              variant="gold"
              disabled={isPending || uploadingResourceFile}
              onClick={handleSaveResource}
            >
              {t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
