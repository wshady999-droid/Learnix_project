"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Download,
  Search,
  Star,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { Input, fieldBase } from "@/components/ui/input";
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
  adminAssignCourseTeacherAction,
  adminUpdateCourseStatusAction,
} from "@/services/admin/actions";
import type { AdminCoursesData } from "@/services/admin/queries";

interface AdminCoursesClientProps {
  data: AdminCoursesData;
}

export function AdminCoursesClient({ data }: AdminCoursesClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [busyCourseId, setBusyCourseId] = useState<string | null>(null);

  const filteredCourses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.courses.filter((item) => {
      if (statusFilter !== "all" && item.course.status !== statusFilter) {
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
  }, [data.courses, searchQuery, statusFilter]);

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

  async function handleReassignTeacher(courseId: string, teacherId: string) {
    setBusyCourseId(courseId);
    const res = await adminAssignCourseTeacherAction({ courseId, teacherId });
    setBusyCourseId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.courses.courseUpdatedToast);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {adminT.courses.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {adminT.courses.subtitle}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadExcelCsv(
              "learnix-courses-report.csv",
              [
                "Code",
                "Title",
                "Category",
                "Instructor",
                "Status",
                "Enrollments",
                "Average Rating",
              ],
              filteredCourses.map((c) => [
                c.course.code,
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

      <Card>
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 sm:max-w-xs">
            <Search
              className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={adminT.common.searchPlaceholder}
              className="ps-9"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label={adminT.courses.statusCol}
            className={cn(fieldBase, "h-9 w-auto py-1 text-xs")}
          >
            <option value="all">{adminT.common.allFilter}</option>
            <option value="published">{adminT.common.published}</option>
            <option value="draft">{adminT.common.draft}</option>
            <option value="archived">{adminT.common.archived}</option>
          </select>
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
                {filteredCourses.map((item) => (
                  <TableRow key={item.course.id}>
                    <TableCell>
                      <div className="font-semibold text-foreground">
                        {item.course.title}
                      </div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {item.course.code} · {item.course.language.toUpperCase()}
                      </div>
                    </TableCell>
                    <TableCell>{item.course.category}</TableCell>
                    <TableCell>
                      <select
                        value={item.course.teacher_id}
                        disabled={busyCourseId === item.course.id}
                        onChange={(e) =>
                          handleReassignTeacher(item.course.id, e.target.value)
                        }
                        aria-label={adminT.courses.assignTeacher}
                        className={cn(fieldBase, "h-8 w-44 py-1 text-xs")}
                      >
                        {data.teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name || t.email}
                          </option>
                        ))}
                      </select>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 font-mono text-xs">
                        <Users
                          className="size-3.5 text-gold-foreground"
                          aria-hidden="true"
                        />
                        {item.enrollmentsCount}
                      </span>
                    </TableCell>
                    <TableCell>
                      {item.averageRating !== null ? (
                        <span className="inline-flex items-center gap-1 font-mono text-xs font-semibold text-gold-foreground">
                          <Star className="size-3.5 fill-current" aria-hidden="true" />
                          {item.averageRating} ({item.reviewsCount})
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.course.status === "published"
                            ? "success"
                            : item.course.status === "archived"
                              ? "neutral"
                              : "warning"
                        }
                      >
                        {item.course.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        {item.course.status !== "published" ? (
                          <Button
                            variant="gold"
                            size="sm"
                            disabled={busyCourseId === item.course.id}
                            onClick={() =>
                              handleStatusChange(item.course.id, "published")
                            }
                          >
                            <CheckCircle2 className="size-3.5" aria-hidden="true" />
                            <span>{adminT.courses.approvePublish}</span>
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={busyCourseId === item.course.id}
                            onClick={() =>
                              handleStatusChange(item.course.id, "draft")
                            }
                          >
                            {adminT.courses.setDraft}
                          </Button>
                        )}
                        {item.course.status !== "archived" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={busyCourseId === item.course.id}
                            onClick={() =>
                              handleStatusChange(item.course.id, "archived")
                            }
                          >
                            <Archive className="size-3.5" aria-hidden="true" />
                            <span>{adminT.courses.archiveCourse}</span>
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
