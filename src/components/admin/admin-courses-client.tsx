"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  CheckCircle2,
  Download,
  Edit3,
  FolderKanban,
  Plus,
  RotateCcw,
  Search,
  Star,
  Trash2,
  Users,
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
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import { downloadExcelCsv } from "@/lib/admin/export-and-import";
import { cn } from "@/lib/utils";
import {
  adminDeleteCategoryAction,
  adminRestoreCourseAction,
  adminSaveCategoryAction,
  adminSoftDeleteCourseAction,
  adminUpdateCourseStatusAction,
} from "@/services/admin/actions";
import type {
  AdminCategoryItem,
  AdminCourseManagementItem,
  AdminCoursesData,
} from "@/services/admin/queries";

interface AdminCoursesClientProps {
  data: AdminCoursesData;
}

export function AdminCoursesClient({ data }: AdminCoursesClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [activeTab, setActiveTab] = useState<"courses" | "categories">(
    "courses",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("active_all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);

  // Soft-Delete Course Dialog (requires mandatory reason)
  const [removingCourse, setRemovingCourse] =
    useState<AdminCourseManagementItem | null>(null);
  const [removalReason, setRemovalReason] = useState("");

  // Category Authoring Dialog
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<
    string | undefined
  >(undefined);
  const [catName, setCatName] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catIsActive, setCatIsActive] = useState(true);
  const [savingCategory, setSavingCategory] = useState(false);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.courses.filter((item) => {
      const isDeleted = Boolean(item.course.deleted_at);
      if (statusFilter === "deleted") {
        if (!isDeleted) return false;
      } else {
        if (isDeleted) return false;
        if (
          statusFilter !== "active_all" &&
          item.course.status !== statusFilter
        ) {
          return false;
        }
      }

      if (
        categoryFilter !== "all" &&
        item.course.category.toLowerCase() !== categoryFilter.toLowerCase()
      ) {
        return false;
      }
      if (
        teacherFilter !== "all" &&
        item.course.teacher_id !== teacherFilter
      ) {
        return false;
      }

      if (!q) return true;
      return (
        item.course.title.toLowerCase().includes(q) ||
        item.course.code.toLowerCase().includes(q) ||
        item.course.category.toLowerCase().includes(q) ||
        item.teacherName.toLowerCase().includes(q)
      );
    });
  }, [data.courses, searchQuery, statusFilter, categoryFilter, teacherFilter]);

  async function handleStatusChange(
    courseId: string,
    status: "draft" | "published" | "archived",
  ) {
    setBusyCourseId(courseId);
    const res = await adminUpdateCourseStatusAction({ courseId, status });
    setBusyCourseId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.courses.courseUpdatedToast);
    router.refresh();
  }

  async function handleConfirmRemoveCourse() {
    if (!removingCourse) return;
    if (removalReason.trim().length < 5) {
      toast.error("Please enter a removal reason (at least 5 characters).");
      return;
    }
    setBusyCourseId(removingCourse.course.id);
    const res = await adminSoftDeleteCourseAction({
      courseId: removingCourse.course.id,
      reason: removalReason,
    });
    setBusyCourseId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      "Course removed (academic records preserved) and teacher notified.",
    );
    setRemovingCourse(null);
    setRemovalReason("");
    router.refresh();
  }

  async function handleRestoreCourse(courseId: string) {
    setBusyCourseId(courseId);
    const res = await adminRestoreCourseAction(courseId);
    setBusyCourseId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Course restored to draft.");
    router.refresh();
  }

  function openNewCategoryModal() {
    setEditingCategoryId(undefined);
    setCatName("");
    setCatDescription("");
    setCatIsActive(true);
    setCategoryModalOpen(true);
  }

  function openEditCategoryModal(item: AdminCategoryItem) {
    setEditingCategoryId(item.category.id);
    setCatName(item.category.name);
    setCatDescription(item.category.description ?? "");
    setCatIsActive(item.category.is_active);
    setCategoryModalOpen(true);
  }

  async function handleSaveCategory() {
    setSavingCategory(true);
    const res = await adminSaveCategoryAction({
      id: editingCategoryId,
      name: catName,
      description: catDescription,
      isActive: catIsActive,
    });
    setSavingCategory(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(
      editingCategoryId ? "Category updated." : "Category created.",
    );
    setCategoryModalOpen(false);
    router.refresh();
  }

  async function handleDeleteCategory(item: AdminCategoryItem) {
    if (item.coursesCount > 0) {
      toast.error(
        `Cannot delete "${item.category.name}" while ${item.coursesCount} course(s) use it.`,
      );
      return;
    }
    const res = await adminDeleteCategoryAction(item.category.id);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Unused category deleted.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Categories & Courses Governance
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage platform-wide course categories, filter courses by category or teacher, publish/unpublish, and safely remove courses.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="gold" size="sm" onClick={openNewCategoryModal}>
            <Plus className="size-4" />
            <span>New Category</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadExcelCsv(
                "learnix-courses-report.csv",
                [
                  "Title",
                  "Category",
                  "Instructor",
                  "Status",
                  "Enrollments",
                  "Average Rating",
                ],
                filteredCourses.map((c) => [
                  c.course.title,
                  c.course.category,
                  c.teacherName,
                  c.course.status,
                  c.enrollmentsCount,
                  c.averageRating ?? "N/A",
                ]),
              )
            }
          >
            <Download className="size-4" aria-hidden="true" />
            <span>{adminT.common.exportExcel}</span>
          </Button>
        </div>
      </div>

      {/* Tabs: Courses | Categories */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={activeTab === "courses" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("courses")}
        >
          <BookOpen className="size-3.5" />
          <span>
            Courses (
            {data.courses.filter((c) => !c.course.deleted_at).length})
          </span>
        </Button>
        <Button
          variant={activeTab === "categories" ? "gold" : "outline"}
          size="sm"
          onClick={() => setActiveTab("categories")}
        >
          <FolderKanban className="size-3.5" />
          <span>Categories ({data.categories.length})</span>
        </Button>
      </div>

      {activeTab === "courses" && (
        <Card>
          <CardHeader className="gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div className="relative flex-1 sm:max-w-xs">
              <Search
                className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search courses by title, category, teacher..."
                className="ps-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filter by category"
                className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
              >
                <option value="all">All Categories</option>
                {data.categories.map((item) => (
                  <option key={item.category.id} value={item.category.name}>
                    {item.category.name} ({item.coursesCount})
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
                    {t.full_name || t.email}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label={adminT.courses.statusCol}
                className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
              >
                <option value="active_all">All Active Courses</option>
                <option value="published">{adminT.common.published}</option>
                <option value="draft">{adminT.common.draft}</option>
                <option value="archived">{adminT.common.archived}</option>
                <option value="deleted">Removed Courses</option>
              </select>
            </div>
          </CardHeader>

          <CardContent>
            {filteredCourses.length === 0 ? (
              <EmptyState
                icon={BookOpen}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{adminT.courses.courseTitleCol}</TableHead>
                    <TableHead>{adminT.courses.categoryCol}</TableHead>
                    <TableHead>{adminT.courses.teacherCol}</TableHead>
                    <TableHead>{adminT.courses.enrollmentsCol}</TableHead>
                    <TableHead>{adminT.courses.ratingCol}</TableHead>
                    <TableHead>{adminT.courses.statusCol}</TableHead>
                    <TableHead className="text-end">
                      {adminT.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCourses.map((item) => {
                    const isDeleted = Boolean(item.course.deleted_at);
                    return (
                      <TableRow key={item.course.id}>
                        <TableCell>
                          <div className="font-semibold text-foreground">
                            {item.course.title}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {item.course.language.toUpperCase()}
                          </div>
                          {item.course.deletion_reason && (
                            <p className="mt-0.5 text-[11px] text-destructive">
                              Removed: {item.course.deletion_reason}
                            </p>
                          )}
                        </TableCell>
                        <TableCell>{item.course.category}</TableCell>
                        <TableCell>
                          <div className="text-xs">
                            <p className="font-medium text-foreground">
                              {item.teacherName}
                            </p>
                            {item.teacherEmail ? (
                              <p className="font-mono text-[11px] text-muted-foreground">
                                {item.teacherEmail}
                              </p>
                            ) : null}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1 font-mono text-xs">
                            <Users
                              className="size-3.5 text-emerald-500"
                              aria-hidden="true"
                            />
                            {item.enrollmentsCount}
                          </span>
                        </TableCell>
                        <TableCell>
                          {item.averageRating !== null ? (
                            <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                              <Star
                                className="size-3.5 fill-current"
                                aria-hidden="true"
                              />
                              {item.averageRating} ({item.reviewsCount})
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              —
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              isDeleted
                                ? "destructive"
                                : item.course.status === "published"
                                  ? "success"
                                  : item.course.status === "archived"
                                    ? "neutral"
                                    : "warning"
                            }
                          >
                            {isDeleted ? "removed" : item.course.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {isDeleted ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busyCourseId === item.course.id}
                                onClick={() =>
                                  void handleRestoreCourse(item.course.id)
                                }
                              >
                                <RotateCcw className="size-3.5" />
                                <span>Restore</span>
                              </Button>
                            ) : (
                              <>
                                {item.course.status !== "published" ? (
                                  <Button
                                    variant="gold"
                                    size="sm"
                                    disabled={busyCourseId === item.course.id}
                                    onClick={() =>
                                      handleStatusChange(
                                        item.course.id,
                                        "published",
                                      )
                                    }
                                  >
                                    <CheckCircle2
                                      className="size-3.5"
                                      aria-hidden="true"
                                    />
                                    <span>Publish</span>
                                  </Button>
                                ) : (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={busyCourseId === item.course.id}
                                    onClick={() =>
                                      handleStatusChange(
                                        item.course.id,
                                        "draft",
                                      )
                                    }
                                  >
                                    Unpublish
                                  </Button>
                                )}
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  disabled={busyCourseId === item.course.id}
                                  onClick={() => {
                                    setRemovingCourse(item);
                                    setRemovalReason("");
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
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "categories" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">Course Categories</CardTitle>
              <CardDescription>
                Categories used by teachers when creating courses and by students when filtering the catalog. Categories with active courses cannot be deleted.
              </CardDescription>
            </div>
            <Button variant="gold" size="sm" onClick={openNewCategoryModal}>
              <Plus className="size-4" />
              <span>Create Category</span>
            </Button>
          </CardHeader>
          <CardContent>
            {data.categories.length === 0 ? (
              <EmptyState
                icon={FolderKanban}
                title="No Categories Found"
                description="Add your first category so teachers can classify courses."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Courses Using It</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.categories.map((item) => (
                    <TableRow key={item.category.id}>
                      <TableCell className="font-semibold text-foreground">
                        {item.category.name}
                      </TableCell>
                      <TableCell className="max-w-md text-xs text-muted-foreground">
                        {item.category.description || "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {item.coursesCount}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            item.category.is_active ? "success" : "neutral"
                          }
                        >
                          {item.category.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-end">
                        <div className="flex justify-end gap-1.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditCategoryModal(item)}
                          >
                            <Edit3 className="size-3.5" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={item.coursesCount > 0}
                            title={
                              item.coursesCount > 0
                                ? "Used by active courses"
                                : "Delete unused category"
                            }
                            onClick={() => void handleDeleteCategory(item)}
                          >
                            <Trash2 className="size-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* REMOVE COURSE CONFIRMATION DIALOG */}
      <Dialog
        open={Boolean(removingCourse)}
        onOpenChange={(open) => {
          if (!open) setRemovingCourse(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove Course</DialogTitle>
            <DialogDescription>
              Removing <strong>{removingCourse?.course.title}</strong> hides it from active listings while preserving historical student enrollments, grades, and certificates. The instructor will be notified with your reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Reason for Course Removal * (Required)</Label>
            <Textarea
              rows={3}
              value={removalReason}
              onChange={(e) => setRemovalReason(e.target.value)}
              placeholder="Explain why this course is being removed..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemovingCourse(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyCourseId === removingCourse?.course.id}
              onClick={() => void handleConfirmRemoveCourse()}
            >
              Confirm Removal & Notify Teacher
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CREATE / EDIT CATEGORY DIALOG */}
      <Dialog open={categoryModalOpen} onOpenChange={setCategoryModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCategoryId ? "Edit Category" : "Create Category"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category Name *</Label>
              <Input
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="e.g. Cybersecurity & Cryptography"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea
                rows={2}
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
              />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border p-3 text-xs font-medium">
              <span>Active & Available for New Courses</span>
              <input
                type="checkbox"
                checked={catIsActive}
                onChange={(e) => setCatIsActive(e.target.checked)}
              />
            </label>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCategoryModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="gold"
              disabled={savingCategory}
              onClick={() => void handleSaveCategory()}
            >
              {savingCategory ? "Saving..." : "Save Category"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
