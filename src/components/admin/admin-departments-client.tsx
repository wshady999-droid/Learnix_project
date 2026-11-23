"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Edit3, Layers, Plus, Trash2, Users } from "lucide-react";

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
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, fieldBase } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import {
  adminAssignStudentToTeacherAction,
  adminDeleteClassAction,
  adminDeleteDepartmentAction,
  adminDeleteEducationalLevelAction,
  adminDeleteStudentTeacherAssignmentAction,
  adminSaveClassAction,
  adminSaveDepartmentAction,
  adminSaveEducationalLevelAction,
} from "@/services/admin/actions";
import type { AdminDepartmentsData } from "@/services/admin/queries";

interface AdminDepartmentsClientProps {
  data: AdminDepartmentsData;
}

export function AdminDepartmentsClient({ data }: AdminDepartmentsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [activeTab, setActiveTab] = useState<
    "departments" | "levels" | "classes" | "assignments"
  >("departments");

  // Department form state
  const [editingDeptId, setEditingDeptId] = useState<string | undefined>(undefined);
  const [deptCode, setDeptCode] = useState("");
  const [deptName, setDeptName] = useState("");
  const [deptDesc, setDeptDesc] = useState("");
  const [deptHeadId, setDeptHeadId] = useState("");
  const [savingDept, setSavingDept] = useState(false);

  // Level form state
  const [levelCode, setLevelCode] = useState("");
  const [levelName, setLevelName] = useState("");
  const [levelDeptId, setLevelDeptId] = useState("");
  const [levelOrder, setLevelOrder] = useState(1);
  const [savingLevel, setSavingLevel] = useState(false);

  // Class form state
  const [classCode, setClassCode] = useState("");
  const [className, setClassName] = useState("");
  const [classDeptId, setClassDeptId] = useState("");
  const [classLevelId, setClassLevelId] = useState("");
  const [classAdvisorId, setClassAdvisorId] = useState("");
  const [classYear, setClassYear] = useState("2026-2027");
  const [classCap, setClassCap] = useState(40);
  const [savingClass, setSavingClass] = useState(false);

  // Assignment form state
  const [assignStudentId, setAssignStudentId] = useState("");
  const [assignTeacherId, setAssignTeacherId] = useState("");
  const [assignClassId, setAssignClassId] = useState("");
  const [savingAssign, setSavingAssign] = useState(false);

  // Safe Delete Confirmation modal
  const [pendingDelete, setPendingDelete] = useState<{
    kind: "department" | "level" | "class" | "assignment";
    id: string;
    label: string;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const teachersById = new Map(data.teachers.map((t) => [t.id, t]));
  const studentsById = new Map(data.students.map((s) => [s.id, s]));
  const deptsById = new Map(data.departments.map((d) => [d.id, d]));
  const levelsById = new Map(data.educationalLevels.map((l) => [l.id, l]));
  const classesById = new Map(data.classes.map((c) => [c.id, c]));

  async function handleSaveDepartment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingDept(true);
    const res = await adminSaveDepartmentAction({
      id: editingDeptId,
      code: deptCode,
      name: deptName,
      description: deptDesc || undefined,
      headTeacherId: deptHeadId || null,
    });
    setSavingDept(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    setEditingDeptId(undefined);
    setDeptCode("");
    setDeptName("");
    setDeptDesc("");
    setDeptHeadId("");
    router.refresh();
  }

  async function handleSaveLevel(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingLevel(true);
    const res = await adminSaveEducationalLevelAction({
      code: levelCode,
      name: levelName,
      departmentId: levelDeptId || null,
      rankOrder: Number(levelOrder) || 1,
    });
    setSavingLevel(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    setLevelCode("");
    setLevelName("");
    router.refresh();
  }

  async function handleSaveClass(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!classDeptId || !classLevelId) {
      toast.error("Please select both a Department and an Educational Level.");
      return;
    }
    setSavingClass(true);
    const res = await adminSaveClassAction({
      code: classCode,
      name: className,
      departmentId: classDeptId,
      educationalLevelId: classLevelId,
      advisorTeacherId: classAdvisorId || null,
      academicYear: classYear,
      maxCapacity: Number(classCap) || 40,
    });
    setSavingClass(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    setClassCode("");
    setClassName("");
    router.refresh();
  }

  async function handleAssignStudent(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignStudentId || !assignTeacherId) {
      toast.error("Please select both a Student and a Teacher.");
      return;
    }
    setSavingAssign(true);
    const res = await adminAssignStudentToTeacherAction({
      studentId: assignStudentId,
      teacherId: assignTeacherId,
      classId: assignClassId || null,
    });
    setSavingAssign(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    router.refresh();
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setDeleting(true);

    let res: { ok: boolean; error?: string };
    if (pendingDelete.kind === "department") {
      res = await adminDeleteDepartmentAction(pendingDelete.id);
    } else if (pendingDelete.kind === "level") {
      res = await adminDeleteEducationalLevelAction(pendingDelete.id);
    } else if (pendingDelete.kind === "class") {
      res = await adminDeleteClassAction(pendingDelete.id);
    } else {
      res = await adminDeleteStudentTeacherAssignmentAction(pendingDelete.id);
    }

    setDeleting(false);
    if (!res.ok) {
      toast.error(res.error || "Unable to delete record.");
      return;
    }

    toast.success(adminT.departments.deletedToast);
    setPendingDelete(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {adminT.departments.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {adminT.departments.subtitle}
        </p>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted p-1">
        {(
          [
            {
              id: "departments",
              label: `${adminT.departments.tabDepartments} (${data.departments.length})`,
            },
            {
              id: "levels",
              label: `${adminT.departments.tabLevels} (${data.educationalLevels.length})`,
            },
            {
              id: "classes",
              label: `${adminT.departments.tabClasses} (${data.classes.length})`,
            },
            {
              id: "assignments",
              label: `${adminT.departments.tabAssignments} (${data.assignments.length})`,
            },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: DEPARTMENTS */}
      {activeTab === "departments" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <Card variant="premium">
            <CardHeader>
              <CardTitle className="text-base">
                {editingDeptId
                  ? adminT.common.edit
                  : adminT.departments.createDepartment}
              </CardTitle>
              <CardDescription>{adminT.departments.subtitle}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveDepartment} className="space-y-3.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-code">{adminT.departments.codeLabel}</Label>
                  <Input
                    id="dept-code"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value)}
                    placeholder="e.g. CS"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-name">{adminT.departments.nameLabel}</Label>
                  <Input
                    id="dept-name"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="e.g. Computer Science"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-head">
                    {adminT.departments.headTeacherLabel}
                  </Label>
                  <select
                    id="dept-head"
                    value={deptHeadId}
                    onChange={(e) => setDeptHeadId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="">—</option>
                    {data.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="dept-desc">
                    {adminT.departments.descriptionLabel}
                  </Label>
                  <Input
                    id="dept-desc"
                    value={deptDesc}
                    onChange={(e) => setDeptDesc(e.target.value)}
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  {editingDeptId ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingDeptId(undefined);
                        setDeptCode("");
                        setDeptName("");
                        setDeptDesc("");
                        setDeptHeadId("");
                      }}
                    >
                      {adminT.common.cancel}
                    </Button>
                  ) : null}
                  <Button type="submit" variant="gold" size="sm" loading={savingDept}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span>{adminT.common.save}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.tabDepartments}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.departments.length === 0 ? (
                <EmptyState
                  icon={Building2}
                  title={adminT.common.noRecordsTitle}
                  description={adminT.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminT.departments.codeLabel}</TableHead>
                      <TableHead>{adminT.departments.nameLabel}</TableHead>
                      <TableHead>{adminT.departments.headTeacherLabel}</TableHead>
                      <TableHead className="text-end">
                        {adminT.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.departments.map((dept) => {
                      const head = dept.head_teacher_id
                        ? teachersById.get(dept.head_teacher_id)
                        : null;
                      return (
                        <TableRow key={dept.id}>
                          <TableCell>
                            <Badge variant="gold-subtle" className="font-mono">
                              {dept.code}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium text-foreground">
                            {dept.name}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {head ? head.full_name || head.email : "—"}
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={adminT.common.edit}
                                onClick={() => {
                                  setEditingDeptId(dept.id);
                                  setDeptCode(dept.code);
                                  setDeptName(dept.name);
                                  setDeptDesc(dept.description ?? "");
                                  setDeptHeadId(dept.head_teacher_id ?? "");
                                }}
                              >
                                <Edit3 className="size-4" aria-hidden="true" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                aria-label={adminT.common.delete}
                                onClick={() =>
                                  setPendingDelete({
                                    kind: "department",
                                    id: dept.id,
                                    label: `${dept.name} (${dept.code})`,
                                  })
                                }
                              >
                                <Trash2
                                  className="size-4 text-destructive"
                                  aria-hidden="true"
                                />
                              </Button>
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
        </div>
      ) : null}

      {/* TAB 2: EDUCATIONAL LEVELS */}
      {activeTab === "levels" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <Card variant="premium">
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.createLevel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveLevel} className="space-y-3.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="lvl-code">{adminT.departments.codeLabel}</Label>
                  <Input
                    id="lvl-code"
                    value={levelCode}
                    onChange={(e) => setLevelCode(e.target.value)}
                    placeholder="e.g. L1"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lvl-name">{adminT.departments.nameLabel}</Label>
                  <Input
                    id="lvl-name"
                    value={levelName}
                    onChange={(e) => setLevelName(e.target.value)}
                    placeholder="e.g. Year 1 — Foundations"
                    required
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lvl-dept">{adminT.users.departmentLabel}</Label>
                  <select
                    id="lvl-dept"
                    value={levelDeptId}
                    onChange={(e) => setLevelDeptId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="">—</option>
                    {data.departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="lvl-rank">
                    {adminT.departments.rankOrderLabel}
                  </Label>
                  <Input
                    id="lvl-rank"
                    type="number"
                    min={1}
                    value={levelOrder}
                    onChange={(e) => setLevelOrder(Number(e.target.value) || 1)}
                    required
                  />
                </div>
                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="gold" size="sm" loading={savingLevel}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span>{adminT.common.create}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.tabLevels}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.educationalLevels.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title={adminT.common.noRecordsTitle}
                  description={adminT.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>{adminT.departments.codeLabel}</TableHead>
                      <TableHead>{adminT.departments.nameLabel}</TableHead>
                      <TableHead>{adminT.users.departmentLabel}</TableHead>
                      <TableHead className="text-end">
                        {adminT.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.educationalLevels.map((lvl) => (
                      <TableRow key={lvl.id}>
                        <TableCell className="font-mono text-xs">
                          {lvl.rank_order}
                        </TableCell>
                        <TableCell>
                          <Badge variant="gold-subtle" className="font-mono">
                            {lvl.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {lvl.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {lvl.department_id
                            ? deptsById.get(lvl.department_id)?.name ?? "—"
                            : "All"}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={adminT.common.delete}
                            onClick={() =>
                              setPendingDelete({
                                kind: "level",
                                id: lvl.id,
                                label: `${lvl.name} (${lvl.code})`,
                              })
                            }
                          >
                            <Trash2
                              className="size-4 text-destructive"
                              aria-hidden="true"
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* TAB 3: CLASSES */}
      {activeTab === "classes" ? (
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
          <Card variant="premium">
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.createClass}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveClass} className="space-y-3.5">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-code">{adminT.departments.codeLabel}</Label>
                    <Input
                      id="cls-code"
                      value={classCode}
                      onChange={(e) => setClassCode(e.target.value)}
                      placeholder="CS-2026-A"
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-year">
                      {adminT.departments.academicYearLabel}
                    </Label>
                    <Input
                      id="cls-year"
                      value={classYear}
                      onChange={(e) => setClassYear(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="cls-name">{adminT.departments.nameLabel}</Label>
                  <Input
                    id="cls-name"
                    value={className}
                    onChange={(e) => setClassName(e.target.value)}
                    placeholder="Cohort A — Artificial Intelligence"
                    required
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-dept">{adminT.users.departmentLabel}</Label>
                    <select
                      id="cls-dept"
                      value={classDeptId}
                      onChange={(e) => setClassDeptId(e.target.value)}
                      className={cn(fieldBase, "h-10 py-2")}
                      required
                    >
                      <option value="">—</option>
                      {data.departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name} ({d.code})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-lvl">{adminT.users.levelLabel}</Label>
                    <select
                      id="cls-lvl"
                      value={classLevelId}
                      onChange={(e) => setClassLevelId(e.target.value)}
                      className={cn(fieldBase, "h-10 py-2")}
                      required
                    >
                      <option value="">—</option>
                      {data.educationalLevels.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name} ({l.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-advisor">
                      {adminT.departments.advisorTeacherLabel}
                    </Label>
                    <select
                      id="cls-advisor"
                      value={classAdvisorId}
                      onChange={(e) => setClassAdvisorId(e.target.value)}
                      className={cn(fieldBase, "h-10 py-2")}
                    >
                      <option value="">—</option>
                      {data.teachers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name || t.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="cls-cap">
                      {adminT.departments.maxCapacityLabel}
                    </Label>
                    <Input
                      id="cls-cap"
                      type="number"
                      min={1}
                      value={classCap}
                      onChange={(e) => setClassCap(Number(e.target.value) || 40)}
                      required
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="gold" size="sm" loading={savingClass}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span>{adminT.common.create}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.tabClasses}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.classes.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={adminT.common.noRecordsTitle}
                  description={adminT.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminT.departments.codeLabel}</TableHead>
                      <TableHead>{adminT.departments.nameLabel}</TableHead>
                      <TableHead>{adminT.users.departmentLabel}</TableHead>
                      <TableHead>{adminT.users.levelLabel}</TableHead>
                      <TableHead className="text-end">
                        {adminT.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.classes.map((cls) => (
                      <TableRow key={cls.id}>
                        <TableCell>
                          <Badge variant="gold-subtle" className="font-mono">
                            {cls.code}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium text-foreground">
                          {cls.name}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {deptsById.get(cls.department_id)?.code ?? "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {levelsById.get(cls.educational_level_id)?.code ?? "—"}
                        </TableCell>
                        <TableCell className="text-end">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={adminT.common.delete}
                            onClick={() =>
                              setPendingDelete({
                                kind: "class",
                                id: cls.id,
                                label: `${cls.name} (${cls.code})`,
                              })
                            }
                          >
                            <Trash2
                              className="size-4 text-destructive"
                              aria-hidden="true"
                            />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* TAB 4: TEACHER-STUDENT ASSIGNMENTS */}
      {activeTab === "assignments" ? (
        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.4fr]">
          <Card variant="premium">
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.createAssignment}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAssignStudent} className="space-y-3.5">
                <div className="grid gap-1.5">
                  <Label htmlFor="sta-student">
                    {adminT.departments.studentLabel}
                  </Label>
                  <select
                    id="sta-student"
                    value={assignStudentId}
                    onChange={(e) => setAssignStudentId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.students.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.full_name || s.email} ({s.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sta-teacher">
                    {adminT.departments.teacherLabel}
                  </Label>
                  <select
                    id="sta-teacher"
                    value={assignTeacherId}
                    onChange={(e) => setAssignTeacherId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || t.email} ({t.email})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="sta-class">{adminT.departments.classLabel}</Label>
                  <select
                    id="sta-class"
                    value={assignClassId}
                    onChange={(e) => setAssignClassId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="">—</option>
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" variant="gold" size="sm" loading={savingAssign}>
                    <Plus className="size-4" aria-hidden="true" />
                    <span>{adminT.common.create}</span>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {adminT.departments.tabAssignments}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.assignments.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title={adminT.common.noRecordsTitle}
                  description={adminT.common.noRecordsDescription}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{adminT.departments.studentLabel}</TableHead>
                      <TableHead>{adminT.departments.teacherLabel}</TableHead>
                      <TableHead>{adminT.departments.classLabel}</TableHead>
                      <TableHead className="text-end">
                        {adminT.common.actions}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.assignments.map((row) => {
                      const st = studentsById.get(row.student_id);
                      const tc = teachersById.get(row.teacher_id);
                      const cl = row.class_id ? classesById.get(row.class_id) : null;
                      return (
                        <TableRow key={row.id}>
                          <TableCell className="font-medium text-foreground">
                            {st?.full_name || st?.email || row.student_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {tc?.full_name || tc?.email || row.teacher_id.slice(0, 8)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {cl ? `${cl.name} (${cl.code})` : "—"}
                          </TableCell>
                          <TableCell className="text-end">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              aria-label={adminT.common.delete}
                              onClick={() =>
                                setPendingDelete({
                                  kind: "assignment",
                                  id: row.id,
                                  label: `${st?.email ?? row.student_id} → ${tc?.email ?? row.teacher_id}`,
                                })
                              }
                            >
                              <Trash2
                                className="size-4 text-destructive"
                                aria-hidden="true"
                              />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Safe Deletion Confirmation Dialog */}
      <Dialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {adminT.departments.safeDeleteConfirmTitle}
            </DialogTitle>
            <DialogDescription>
              {adminT.departments.safeDeleteConfirmDescription}
            </DialogDescription>
          </DialogHeader>
          {pendingDelete ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 font-mono text-xs text-foreground">
              {pendingDelete.label}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">{adminT.common.cancel}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              loading={deleting}
              onClick={handleConfirmDelete}
            >
              {adminT.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
