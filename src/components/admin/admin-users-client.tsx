"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Download,
  FileSpreadsheet,
  KeyRound,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";

import { PasswordStrengthChecklist } from "@/components/auth/password-strength-checklist";
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
  DialogTrigger,
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
import { getAuthDictionary } from "@/i18n/auth-dictionaries";
import {
  downloadExcelCsv,
  parseAndValidateBulkUsers,
  type BulkImportParseResult,
} from "@/lib/admin/export-and-import";
import { evaluatePasswordStrength } from "@/lib/auth/validation";
import { cn } from "@/lib/utils";
import {
  adminBulkImportUsersAction,
  adminChangeUserStatusAction,
  adminCreateUserAccountAction,
  adminDeleteUserAccountAction,
  adminReviewTeacherRequestAction,
  adminSendPasswordResetEmailAction,
  adminSetUserCustomPermissionAction,
} from "@/services/admin/actions";
import type { AdminUsersManagementData } from "@/services/admin/queries";
import type { ProfileRow } from "@/services/db/users";
import type { UserRole } from "@/types";

interface AdminUsersClientProps {
  data: AdminUsersManagementData;
}

const PAGE_SIZE = 10;

export function AdminUsersClient({ data }: AdminUsersClientProps) {
  const router = useRouter();
  const { locale, t } = useLocale();
  const adminT = getAdminDictionary(locale);
  const authT = getAuthDictionary(locale);

  const [activeTab, setActiveTab] = useState<"users" | "requests" | "bulk">(
    "users",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPreset, setQuickPreset] = useState<
    "all" | "students" | "teachers" | "suspended"
  >("all");
  const [page, setPage] = useState(1);

  // Add User Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<UserRole>("student");
  const [newPhone, setNewPhone] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Inspect User Details, Activity & Custom Permissions dialog
  const [inspectedUser, setInspectedUser] = useState<ProfileRow | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  // Suspend User Confirmation Dialog (requires mandatory reason)
  const [suspendingUser, setSuspendingUser] = useState<ProfileRow | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");

  // Delete User Confirmation Dialog
  const [deletingUser, setDeletingUser] = useState<ProfileRow | null>(null);

  // Bulk Import state
  const [rawBulkText, setRawBulkText] = useState("");
  const [bulkValidation, setBulkValidation] =
    useState<BulkImportParseResult | null>(null);
  const [importingBulk, setImportingBulk] = useState(false);

  const filteredProfiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data.profiles.filter((p) => {
      if (quickPreset === "students" && p.role !== "student") return false;
      if (quickPreset === "teachers" && p.role !== "teacher") return false;
      if (quickPreset === "suspended" && p.status !== "suspended") return false;
      if (!q) return true;
      return (
        (p.full_name ?? "").toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        (p.phone ?? "").toLowerCase().includes(q)
      );
    });
  }, [data.profiles, searchQuery, quickPreset]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProfiles.length / PAGE_SIZE),
  );
  const currentPage = Math.min(page, totalPages);
  const paginatedProfiles = filteredProfiles.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  const profilesById = useMemo(
    () => new Map(data.profiles.map((p) => [p.id, p])),
    [data.profiles],
  );

  async function handleCreateUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const strength = evaluatePasswordStrength(newPassword);
    if (!strength.isValid) {
      toast.error(authT.passwordRules.heading);
      return;
    }

    setCreatingUser(true);
    const res = await adminCreateUserAccountAction({
      fullName: newFullName,
      email: newEmail,
      password: newPassword,
      role: newRole,
      phone: newPhone || undefined,
    });
    setCreatingUser(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success("User account created.");
    setAddOpen(false);
    setNewFullName("");
    setNewEmail("");
    setNewPassword("");
    setNewPhone("");
    router.refresh();
  }

  async function handleReactivateUser(user: ProfileRow) {
    setBusyUserId(user.id);
    const res = await adminChangeUserStatusAction({
      targetUserId: user.id,
      status: "active",
    });
    setBusyUserId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Account reactivated.");
    router.refresh();
  }

  async function handleConfirmSuspendUser() {
    if (!suspendingUser) return;
    if (suspensionReason.trim().length < 3) {
      toast.error("Please enter a suspension reason.");
      return;
    }
    setBusyUserId(suspendingUser.id);
    const res = await adminChangeUserStatusAction({
      targetUserId: suspendingUser.id,
      status: "suspended",
      reason: suspensionReason,
    });
    setBusyUserId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("User suspended and audit logged.");
    setSuspendingUser(null);
    setSuspensionReason("");
    router.refresh();
  }

  async function handleConfirmDeleteUser() {
    if (!deletingUser) return;
    setBusyUserId(deletingUser.id);
    const res = await adminDeleteUserAccountAction({
      targetUserId: deletingUser.id,
    });
    setBusyUserId(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("User account deleted.");
    setDeletingUser(null);
    router.refresh();
  }

  async function handleSendPasswordReset(email: string) {
    const res = await adminSendPasswordResetEmailAction(email);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.users.passwordResetSentToast);
  }

  async function handleToggleUserPermission(
    userId: string,
    permissionId: string,
    isGranted: boolean,
  ) {
    const res = await adminSetUserCustomPermissionAction({
      userId,
      permissionId,
      isGranted,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.users.permissionUpdatedToast);
    router.refresh();
  }

  async function handleReviewTeacherRequest(
    requestId: string,
    approve: boolean,
  ) {
    const res = await adminReviewTeacherRequestAction({
      requestId,
      approve,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.users.teacherRequestReviewedToast);
    router.refresh();
  }

  function handleBulkFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      setRawBulkText(content);
      setBulkValidation(parseAndValidateBulkUsers(content));
    };
    reader.readAsText(file);
  }

  function handleValidateBulkText() {
    setBulkValidation(parseAndValidateBulkUsers(rawBulkText));
  }

  async function handleExecuteBulkImport() {
    if (!bulkValidation || bulkValidation.validRows.length === 0) return;
    setImportingBulk(true);
    const res = await adminBulkImportUsersAction(bulkValidation.validRows);
    setImportingBulk(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `${adminT.users.bulkSuccessToast} (${res.data.importedCount}/${bulkValidation.validRows.length})`,
    );
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {adminT.users.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {adminT.users.subtitle}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              downloadExcelCsv(
                "learnix-users.csv",
                [
                  "Full Name",
                  "Email",
                  "Role",
                  "Status",
                  "Suspension Reason",
                  "Phone",
                  "Created At",
                ],
                filteredProfiles.map((p) => [
                  p.full_name,
                  p.email,
                  p.role,
                  p.status,
                  p.suspension_reason ?? "",
                  p.phone,
                  p.created_at,
                ]),
              )
            }
          >
            <Download className="size-4" aria-hidden="true" />
            <span>{adminT.common.exportExcel}</span>
          </Button>

          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button variant="gold" size="sm">
                <UserPlus className="size-4" aria-hidden="true" />
                <span>{adminT.users.addUserButton}</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{adminT.users.addUserDialogTitle}</DialogTitle>
                <DialogDescription>
                  {adminT.users.addUserDialogDescription}
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="admin-new-name">
                      {adminT.users.fullNameLabel}
                    </Label>
                    <Input
                      id="admin-new-name"
                      value={newFullName}
                      onChange={(e) => setNewFullName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="admin-new-email">
                      {adminT.users.emailLabel}
                    </Label>
                    <Input
                      id="admin-new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="admin-new-role">
                      {adminT.users.roleLabel}
                    </Label>
                    <select
                      id="admin-new-role"
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className={cn(fieldBase, "h-10 py-2")}
                    >
                      <option value="student">{t.roles.student}</option>
                      <option value="teacher">{t.roles.teacher}</option>
                      <option value="admin">{t.roles.admin}</option>
                    </select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="admin-new-phone">
                      {adminT.users.phoneLabel}
                    </Label>
                    <Input
                      id="admin-new-phone"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+15550192834"
                    />
                  </div>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="admin-new-password">
                    {authT.signup.passwordLabel}
                  </Label>
                  <Input
                    id="admin-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>

                <PasswordStrengthChecklist
                  password={newPassword}
                  labels={authT.passwordRules}
                />

                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="secondary">
                      {adminT.common.cancel}
                    </Button>
                  </DialogClose>
                  <Button type="submit" variant="gold" loading={creatingUser}>
                    {adminT.common.create}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Tabs: Users | Teacher Approvals | Bulk Import */}
      <div className="inline-flex rounded-lg border border-border bg-muted p-1">
        {(
          [
            {
              id: "users",
              label: `${adminT.users.tabUsers} (${data.profiles.length})`,
            },
            {
              id: "requests",
              label: `${adminT.users.tabTeacherRequests} (${
                data.teacherRequests.filter((r) => r.status === "pending")
                  .length
              })`,
            },
            { id: "bulk", label: adminT.users.tabBulkImport },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-emerald-600 font-semibold text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1: ALL USERS */}
      {activeTab === "users" ? (
        <Card>
          <CardHeader className="space-y-4">
            {/* Quick Filters: All Users | Students | Teachers | Suspended Users */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["all", `All Users (${data.profiles.length})`],
                    [
                      "students",
                      `Students (${data.profiles.filter((p) => p.role === "student").length})`,
                    ],
                    [
                      "teachers",
                      `Teachers (${data.profiles.filter((p) => p.role === "teacher").length})`,
                    ],
                    [
                      "suspended",
                      `Suspended Users (${data.profiles.filter((p) => p.status === "suspended").length})`,
                    ],
                  ] as const
                ).map(([key, label]) => (
                  <Button
                    key={key}
                    size="sm"
                    variant={quickPreset === key ? "gold" : "outline"}
                    onClick={() => {
                      setQuickPreset(key);
                      setPage(1);
                    }}
                  >
                    {label}
                  </Button>
                ))}
              </div>

              <div className="relative w-full sm:max-w-xs">
                <Search
                  className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Search by name or email..."
                  className="ps-9"
                />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {paginatedProfiles.length === 0 ? (
              <EmptyState
                icon={Users}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{adminT.users.fullNameLabel}</TableHead>
                    <TableHead>{adminT.users.emailLabel}</TableHead>
                    <TableHead>{adminT.users.roleLabel}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">
                      {adminT.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProfiles.map((user) => {
                    const isSelf = user.id === data.currentAdminId;
                    return (
                      <TableRow key={user.id}>
                        <TableCell>
                          <p className="font-medium text-foreground">
                            {user.full_name || "—"}
                          </p>
                          {user.status === "suspended" &&
                            user.suspension_reason && (
                              <p className="mt-0.5 text-[11px] text-destructive">
                                Reason: {user.suspension_reason}
                              </p>
                            )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {user.email}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="capitalize">
                            {t.roles[user.role]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              user.status === "active"
                                ? "success"
                                : user.status === "suspended"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {user.status === "active"
                              ? adminT.common.active
                              : adminT.common.suspended}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setInspectedUser(user)}
                            >
                              <ShieldCheck
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              <span>View</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleSendPasswordReset(user.email)
                              }
                            >
                              <KeyRound
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              <span>Reset Password</span>
                            </Button>
                            {user.status === "suspended" ? (
                              <Button
                                variant="gold"
                                size="sm"
                                disabled={busyUserId === user.id}
                                onClick={() => void handleReactivateUser(user)}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                disabled={busyUserId === user.id || isSelf}
                                onClick={() => {
                                  setSuspendingUser(user);
                                  setSuspensionReason("");
                                }}
                              >
                                Suspend
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Delete account"
                              disabled={busyUserId === user.id || isSelf}
                              onClick={() => setDeletingUser(user)}
                            >
                              <Trash2 className="size-3.5 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {adminT.common.pageOf} {currentPage} / {totalPages} (
                {filteredProfiles.length})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  {adminT.common.previous}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  {adminT.common.next}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* TAB 2: TEACHER REQUESTS */}
      {activeTab === "requests" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.users.tabTeacherRequests}
            </CardTitle>
            <CardDescription>{adminT.users.subtitle}</CardDescription>
          </CardHeader>
          <CardContent>
            {data.teacherRequests.length === 0 ? (
              <EmptyState
                icon={UserCheck}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{adminT.users.fullNameLabel}</TableHead>
                    <TableHead>{authT.signup.specializationLabel}</TableHead>
                    <TableHead>{authT.signup.qualificationsLabel}</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">
                      {adminT.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.teacherRequests.map((req) => {
                    const applicant = profilesById.get(req.user_id);
                    return (
                      <TableRow key={req.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {applicant?.full_name || "Applicant"}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {applicant?.email || req.user_id}
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {req.specialization}
                        </TableCell>
                        <TableCell className="max-w-md whitespace-normal text-xs text-muted-foreground">
                          {req.qualifications}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              req.status === "approved"
                                ? "success"
                                : req.status === "rejected"
                                  ? "destructive"
                                  : "warning"
                            }
                          >
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          {req.status === "pending" ? (
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="gold"
                                size="sm"
                                onClick={() =>
                                  handleReviewTeacherRequest(req.id, true)
                                }
                              >
                                <CheckCircle2
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                <span>
                                  {adminT.users.teacherRequestApprove}
                                </span>
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  handleReviewTeacherRequest(req.id, false)
                                }
                              >
                                <XCircle
                                  className="size-3.5"
                                  aria-hidden="true"
                                />
                                <span>{adminT.users.teacherRequestReject}</span>
                              </Button>
                            </div>
                          ) : (
                            <span className="font-mono text-xs text-muted-foreground">
                              {req.reviewed_at?.slice(0, 10) ?? "—"}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* TAB 3: BULK EXCEL / CSV IMPORT */}
      {activeTab === "bulk" ? (
        <Card variant="premium">
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileSpreadsheet
                  className="size-5 text-emerald-500"
                  aria-hidden="true"
                />
                <span>{adminT.users.bulkImportTitle}</span>
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadExcelCsv(
                    "learnix-bulk-import-template.csv",
                    ["full_name", "email", "role", "phone"],
                    [
                      [
                        "Student Example",
                        "student.cohort1@example.edu",
                        "student",
                        "+15550109911",
                      ],
                    ],
                  )
                }
              >
                <Download className="size-4" aria-hidden="true" />
                <span>{adminT.users.bulkTemplateDownload}</span>
              </Button>
            </div>
            <CardDescription>
              {adminT.users.bulkImportDescription}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <Label htmlFor="bulk-file-input">
                {adminT.users.bulkUploadLabel}
              </Label>
              <Input
                id="bulk-file-input"
                type="file"
                accept=".csv,.tsv,.txt"
                onChange={handleBulkFileSelect}
              />
              <Textarea
                rows={5}
                value={rawBulkText}
                onChange={(e) => setRawBulkText(e.target.value)}
                placeholder="full_name,email,role,phone"
                className="font-mono text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Button variant="outline" onClick={handleValidateBulkText}>
                {adminT.users.bulkValidateButton}
              </Button>
              {bulkValidation && bulkValidation.validRows.length > 0 ? (
                <Button
                  variant="gold"
                  loading={importingBulk}
                  onClick={handleExecuteBulkImport}
                >
                  <Upload className="size-4" aria-hidden="true" />
                  <span>
                    {adminT.users.bulkImportValidButton} (
                    {bulkValidation.validRows.length})
                  </span>
                </Button>
              ) : null}
            </div>

            {bulkValidation ? (
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap gap-3">
                  <Badge variant="success">
                    {adminT.users.bulkValidRowsCount}:{" "}
                    {bulkValidation.validRows.length}
                  </Badge>
                  <Badge
                    variant={
                      bulkValidation.issues.length > 0
                        ? "destructive"
                        : "neutral"
                    }
                  >
                    {adminT.users.bulkIssuesCount}:{" "}
                    {bulkValidation.issues.length}
                  </Badge>
                </div>

                {bulkValidation.issues.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row #</TableHead>
                        <TableHead>{adminT.users.emailLabel}</TableHead>
                        <TableHead>Validation Error</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkValidation.issues.map((issue) => (
                        <TableRow key={`${issue.rowNumber}-${issue.rawEmail}`}>
                          <TableCell className="font-mono text-xs">
                            #{issue.rowNumber}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {issue.rawEmail}
                          </TableCell>
                          <TableCell className="text-xs text-destructive">
                            <span className="inline-flex items-center gap-1.5">
                              <ShieldAlert
                                className="size-3.5"
                                aria-hidden="true"
                              />
                              {issue.message}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {/* Dialog: Suspend User Confirmation with Mandatory Reason */}
      <Dialog
        open={Boolean(suspendingUser)}
        onOpenChange={(open) => {
          if (!open) setSuspendingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Suspend User Account</DialogTitle>
            <DialogDescription>
              Suspending{" "}
              <strong>
                {suspendingUser?.full_name || suspendingUser?.email}
              </strong>{" "}
              blocks access immediately and records an audit & security event.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Suspension Reason * (Required)</Label>
            <Textarea
              rows={3}
              value={suspensionReason}
              onChange={(e) => setSuspensionReason(e.target.value)}
              placeholder="Explain the policy violation or administrative reason..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendingUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyUserId === suspendingUser?.id}
              onClick={() => void handleConfirmSuspendUser()}
            >
              Confirm Suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Delete User Confirmation */}
      <Dialog
        open={Boolean(deletingUser)}
        onOpenChange={(open) => {
          if (!open) setDeletingUser(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete User Account Permanently</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              <strong>{deletingUser?.full_name || deletingUser?.email}</strong>?
              If you want to preserve academic history while revoking access, use{" "}
              <strong>Suspend</strong> instead.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingUser(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={busyUserId === deletingUser?.id}
              onClick={() => void handleConfirmDeleteUser()}
            >
              Delete User Account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Inspect User Details, Activity History & Custom Permissions */}
      <Dialog
        open={Boolean(inspectedUser)}
        onOpenChange={(open) => {
          if (!open) setInspectedUser(null);
        }}
      >
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          {inspectedUser ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  {inspectedUser.full_name || inspectedUser.email}
                </DialogTitle>
                <DialogDescription className="font-mono text-xs">
                  {inspectedUser.email} · {t.roles[inspectedUser.role]} ·{" "}
                  {inspectedUser.status}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                {inspectedUser.suspension_reason && (
                  <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                    <strong>Suspension Reason:</strong>{" "}
                    {inspectedUser.suspension_reason}
                  </div>
                )}

                {/* Custom Permissions */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {adminT.users.customPermissionsTitle}
                  </h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {data.permissions.map((perm) => {
                      const override = data.userPermissions.find(
                        (up) =>
                          up.user_id === inspectedUser.id &&
                          up.permission_id === perm.id,
                      );
                      const isGranted = override?.is_granted === true;
                      return (
                        <div
                          key={perm.id}
                          className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs"
                        >
                          <div>
                            <p className="font-mono font-semibold text-foreground">
                              {perm.code}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {perm.description}
                            </p>
                          </div>
                          <Button
                            size="sm"
                            variant={isGranted ? "gold" : "outline"}
                            onClick={() =>
                              handleToggleUserPermission(
                                inspectedUser.id,
                                perm.id,
                                !isGranted,
                              )
                            }
                          >
                            {isGranted
                              ? adminT.users.revokePermission
                              : adminT.users.grantPermission}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Individual Activity History */}
                <div className="space-y-2.5">
                  <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    {adminT.users.activityHistoryTitle}
                  </h4>
                  <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
                    {data.recentAuditLogs.filter(
                      (l) =>
                        l.actor_id === inspectedUser.id ||
                        l.entity_id === inspectedUser.id,
                    ).length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted-foreground">
                        {adminT.common.noRecordsTitle}
                      </p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{adminT.security.actionCol}</TableHead>
                            <TableHead>
                              {adminT.security.timestampCol}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.recentAuditLogs
                            .filter(
                              (l) =>
                                l.actor_id === inspectedUser.id ||
                                l.entity_id === inspectedUser.id,
                            )
                            .slice(0, 15)
                            .map((log) => (
                              <TableRow key={log.id}>
                                <TableCell className="font-mono text-xs">
                                  {log.action}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {log.created_at
                                    .replace("T", " ")
                                    .slice(0, 19)}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
