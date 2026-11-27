"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  Download,
  Laptop,
  Lock,
  ShieldAlert,
  ShieldCheck,
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
import { Textarea, fieldBase } from "@/components/ui/input";
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
  adminChangeUserStatusAction,
  adminToggleDeviceTrustAction,
  adminToggleRolePermissionAction,
} from "@/services/admin/actions";
import type { AdminSecurityControlData } from "@/services/admin/queries";

interface AdminSecurityClientProps {
  data: AdminSecurityControlData;
}

export function AdminSecurityClient({ data }: AdminSecurityClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [activeTab, setActiveTab] = useState<
    "events" | "suspicious" | "audit" | "devices" | "roles" | "backups"
  >("events");
  const [eventFilter, setEventFilter] = useState<string>("all");

  // Suspend user dialog state
  const [suspendingTarget, setSuspendingTarget] = useState<{
    id: string;
    label: string;
  } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const profilesById = useMemo(
    () => new Map(data.profiles.map((p) => [p.id, p])),
    [data.profiles],
  );

  const filteredSecurityEvents = useMemo(() => {
    if (eventFilter === "all") return data.securityEvents;
    if (eventFilter === "login_failed") {
      return data.securityEvents.filter((e) =>
        e.event_type.includes("failed"),
      );
    }
    if (eventFilter === "login") {
      return data.securityEvents.filter((e) =>
        e.event_type.includes("login"),
      );
    }
    if (eventFilter === "registration") {
      return data.securityEvents.filter((e) =>
        e.event_type.includes("registration"),
      );
    }
    if (eventFilter === "account") {
      return data.securityEvents.filter((e) =>
        e.event_type.includes("account"),
      );
    }
    return data.securityEvents;
  }, [data.securityEvents, eventFilter]);

  const failedLoginsCount = data.securityEvents.filter((e) =>
    e.event_type.includes("failed"),
  ).length;
  const registrationEventsCount = data.securityEvents.filter((e) =>
    e.event_type.includes("registration"),
  ).length;
  const suspendedAccountsCount = data.profiles.filter(
    (p) => p.status === "suspended",
  ).length;

  async function handleToggleDeviceTrust(deviceId: string, isTrusted: boolean) {
    const res = await adminToggleDeviceTrustAction({ deviceId, isTrusted });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    router.refresh();
  }

  async function handleConfirmSuspend() {
    if (!suspendingTarget) return;
    if (suspendReason.trim().length < 3) {
      toast.error("Please enter a suspension reason.");
      return;
    }
    const res = await adminChangeUserStatusAction({
      targetUserId: suspendingTarget.id,
      status: "suspended",
      reason: suspendReason,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Account suspended.");
    setSuspendingTarget(null);
    setSuspendReason("");
    router.refresh();
  }

  async function handleReactivateUser(userId: string) {
    const res = await adminChangeUserStatusAction({
      targetUserId: userId,
      status: "active",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success("Account reactivated.");
    router.refresh();
  }

  async function handleToggleRolePermission(
    roleId: string,
    permissionId: string,
    enable: boolean,
  ) {
    const res = await adminToggleRolePermissionAction({
      roleId,
      permissionId,
      enable,
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.users.permissionUpdatedToast);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {adminT.security.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Monitor authentication events, failed logins, suspicious quiz activity, devices, and account security. Passwords and tokens are never exposed.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadExcelCsv(
              "learnix-security-events.csv",
              ["Timestamp", "Event Type", "Severity", "Email", "Description"],
              data.securityEvents.map((ev) => [
                ev.created_at,
                ev.event_type,
                ev.severity,
                ev.email ?? "",
                ev.description ?? "",
              ]),
            )
          }
        >
          <Download className="size-4" aria-hidden="true" />
          <span>{adminT.common.exportExcel}</span>
        </Button>
      </div>

      {/* Security Summary Strip */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Security Events</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {data.securityEvents.length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Failed Login Attempts
            </p>
            <p className="mt-1 text-2xl font-bold text-destructive">
              {failedLoginsCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">
              Registration Events
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {registrationEventsCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Suspended Accounts</p>
            <p className="mt-1 text-2xl font-bold text-foreground">
              {suspendedAccountsCount}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted p-1">
        {(
          [
            {
              id: "events",
              label: `Auth & Security Events (${data.securityEvents.length})`,
            },
            {
              id: "suspicious",
              label: `Suspicious Quiz Activity (${data.examViolations.length})`,
            },
            {
              id: "audit",
              label: `${adminT.security.tabAuditLogs} (${data.auditLogs.length})`,
            },
            {
              id: "devices",
              label: `Devices & Account Status (${data.devices.length})`,
            },
            { id: "roles", label: adminT.security.tabRolePermissions },
            { id: "backups", label: adminT.security.tabBackups },
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

      {/* TAB 1: SECURITY EVENTS (LOGINS, REGISTRATIONS, FAILED LOGINS, ACCOUNT CHANGES) */}
      {activeTab === "events" && (
        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle className="text-base">
                Authentication & Security Telemetry
              </CardTitle>
              <CardDescription>
                Login attempts, registration events, failed logins, and account status actions.
              </CardDescription>
            </div>
            <select
              value={eventFilter}
              onChange={(e) => setEventFilter(e.target.value)}
              className={cn(fieldBase, "h-9 w-52 py-1 text-xs")}
            >
              <option value="all">All Security Events</option>
              <option value="login">Login Attempts</option>
              <option value="login_failed">Failed Login Attempts</option>
              <option value="registration">Registration Events</option>
              <option value="account">Account Suspensions / Deletions</option>
            </select>
          </CardHeader>
          <CardContent>
            {filteredSecurityEvents.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title="No Matching Security Events"
                description="Authentication, registration, and suspension events appear here in real time."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Account / Email</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-end">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSecurityEvents.map((ev) => {
                    const userProf = ev.user_id
                      ? profilesById.get(ev.user_id)
                      : undefined;
                    return (
                      <TableRow key={ev.id}>
                        <TableCell className="font-mono text-xs font-semibold">
                          {ev.event_type}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium text-foreground">
                            {userProf?.full_name || ev.email || "Unknown"}
                          </div>
                          {userProf && (
                            <Badge
                              variant={
                                userProf.status === "suspended"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="mt-0.5"
                            >
                              {userProf.status}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              ev.severity === "high" ||
                              ev.severity === "critical"
                                ? "destructive"
                                : ev.severity === "warning"
                                  ? "warning"
                                  : "success"
                            }
                          >
                            {ev.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-sm text-xs text-muted-foreground">
                          {ev.description || "—"}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {ev.created_at.replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-end">
                          {userProf && userProf.role !== "admin" && (
                            userProf.status === "suspended" ? (
                              <Button
                                variant="gold"
                                size="sm"
                                onClick={() =>
                                  void handleReactivateUser(userProf.id)
                                }
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  setSuspendingTarget({
                                    id: userProf.id,
                                    label:
                                      userProf.full_name || userProf.email,
                                  })
                                }
                              >
                                Block / Suspend
                              </Button>
                            )
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
      )}

      {/* TAB 2: SUSPICIOUS QUIZ ACTIVITY */}
      {activeTab === "suspicious" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Suspicious Quiz Focus & Tab-Switch Activity
            </CardTitle>
            <CardDescription>
              Repeated tab switches and focus changes logged during timed student assessments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.examViolations.length === 0 ? (
              <EmptyState
                icon={AlertTriangle}
                title="No Suspicious Quiz Flags"
                description="Focus loss and tab-switch flags recorded during quizzes appear here."
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Violation Type</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead className="text-end">Account Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.examViolations.map((v) => {
                    const stu = profilesById.get(v.student_id);
                    return (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {v.studentName}
                          </div>
                          <div className="font-mono text-xs text-muted-foreground">
                            {v.studentEmail}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {v.violation_type}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              v.severity === "high" || v.severity === "critical"
                                ? "destructive"
                                : "warning"
                            }
                          >
                            {v.severity}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {v.occurred_at.replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-end">
                          {stu &&
                            stu.role !== "admin" &&
                            (stu.status === "suspended" ? (
                              <Button
                                variant="gold"
                                size="sm"
                                onClick={() => void handleReactivateUser(stu.id)}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() =>
                                  setSuspendingTarget({
                                    id: stu.id,
                                    label: stu.full_name || stu.email,
                                  })
                                }
                              >
                                Suspend
                              </Button>
                            ))}
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

      {/* TAB 3: AUDIT LOGS */}
      {activeTab === "audit" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.security.tabAuditLogs}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.auditLogs.length === 0 ? (
              <EmptyState
                icon={ShieldCheck}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{adminT.security.actorCol}</TableHead>
                    <TableHead>{adminT.security.actionCol}</TableHead>
                    <TableHead>{adminT.security.entityCol}</TableHead>
                    <TableHead>{adminT.security.ipDeviceCol}</TableHead>
                    <TableHead className="text-end">
                      {adminT.security.timestampCol}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.auditLogs.map((log) => {
                    const actor = log.actor_id
                      ? profilesById.get(log.actor_id)
                      : null;
                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {actor?.full_name || actor?.email || "System"}
                          </div>
                          {actor ? (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              {actor.email}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              log.action.includes("blocked") ||
                              log.action.includes("suspended") ||
                              log.action.includes("deleted")
                                ? "destructive"
                                : "gold-subtle"
                            }
                            className="font-mono"
                          >
                            {log.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {log.entity_type}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                          {log.ip_address || log.user_agent || "—"}
                        </TableCell>
                        <TableCell className="text-end font-mono text-xs text-muted-foreground">
                          {log.created_at.replace("T", " ").slice(0, 19)}
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

      {/* TAB 4: ACTIVE DEVICES & ACCOUNT STATUS */}
      {activeTab === "devices" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Active Devices & Account Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.devices.length === 0 ? (
              <EmptyState
                icon={Laptop}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Browser / Client</TableHead>
                    <TableHead>Trust Status</TableHead>
                    <TableHead>Last Active</TableHead>
                    <TableHead className="text-end">
                      {adminT.common.actions}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.devices.map((dev) => {
                    const owner = profilesById.get(dev.user_id);
                    return (
                      <TableRow key={dev.id}>
                        <TableCell>
                          <div className="font-medium text-foreground">
                            {owner?.full_name || owner?.email || dev.user_id}
                          </div>
                          {owner ? (
                            <div className="font-mono text-xs text-muted-foreground">
                              {owner.email} ({owner.status})
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell className="max-w-xs truncate font-mono text-xs text-muted-foreground">
                          {dev.browser || dev.device_fingerprint}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={dev.is_trusted ? "success" : "neutral"}
                          >
                            {dev.is_trusted ? "Trusted" : "Standard"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {dev.last_active_at.replace("T", " ").slice(0, 19)}
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                handleToggleDeviceTrust(dev.id, !dev.is_trusted)
                              }
                            >
                              {dev.is_trusted
                                ? adminT.security.untrustDevice
                                : adminT.security.trustDevice}
                            </Button>
                            {owner && owner.role !== "admin" ? (
                              owner.status === "suspended" ? (
                                <Button
                                  variant="gold"
                                  size="sm"
                                  onClick={() =>
                                    void handleReactivateUser(owner.id)
                                  }
                                >
                                  Reactivate
                                </Button>
                              ) : (
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() =>
                                    setSuspendingTarget({
                                      id: owner.id,
                                      label: owner.full_name || owner.email,
                                    })
                                  }
                                >
                                  {adminT.users.suspendAccount}
                                </Button>
                              )
                            ) : null}
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

      {/* TAB 5: ROLE PERMISSIONS MATRIX */}
      {activeTab === "roles" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.security.tabRolePermissions}
            </CardTitle>
            <CardDescription>
              Configure default permission assignments for canonical platform roles.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Permission Code</TableHead>
                  <TableHead>Description</TableHead>
                  {data.roles.map((r) => (
                    <TableHead key={r.id} className="text-center capitalize">
                      {r.code}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.permissions.map((perm) => (
                  <TableRow key={perm.id}>
                    <TableCell className="font-mono text-xs font-semibold">
                      {perm.code}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {perm.description}
                    </TableCell>
                    {data.roles.map((role) => {
                      const isAdminRole = role.code === "admin";
                      const hasMapping =
                        isAdminRole ||
                        data.rolePermissions.some(
                          (rp) =>
                            rp.role_id === role.id &&
                            rp.permission_id === perm.id,
                        );
                      return (
                        <TableCell key={role.id} className="text-center">
                          <input
                            type="checkbox"
                            checked={hasMapping}
                            disabled={isAdminRole}
                            onChange={(e) =>
                              handleToggleRolePermission(
                                role.id,
                                perm.id,
                                e.target.checked,
                              )
                            }
                            aria-label={`${perm.code} for ${role.code}`}
                            className="size-4 rounded border-input accent-emerald-600"
                          />
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* TAB 6: BACKUP STATUS & RLS DOCUMENTATION */}
      {activeTab === "backups" && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card variant="premium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>{adminT.security.backupStatusHealthy}</span>
                </Badge>
                <Database
                  className="size-5 text-emerald-500"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="pt-1 text-base">
                {adminT.security.backupPitrTitle}
              </CardTitle>
              <CardDescription>
                {adminT.security.backupPitrDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p className="font-mono text-foreground">
                Engine: PostgreSQL 17 · Supabase Managed Infrastructure
              </p>
              <p>
                All schema migrations are tracked deterministically in{" "}
                <code>supabase/migrations/</code> and{" "}
                <code>supabase_migrations.schema_migrations</code>.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="gold-subtle">
                  <Lock className="size-3.5" aria-hidden="true" />
                  <span>Zero Exposed Secrets</span>
                </Badge>
                <ShieldAlert
                  className="size-5 text-emerald-500"
                  aria-hidden="true"
                />
              </div>
              <CardTitle className="pt-1 text-base">
                {adminT.security.backupRlsVerificationTitle}
              </CardTitle>
              <CardDescription>
                {adminT.security.backupRlsVerificationDescription}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-xs text-muted-foreground">
              <p>
                • Every database table is protected by Row-Level Security (RLS).
              </p>
              <p>
                • AI API keys live exclusively inside Supabase Edge Function Secrets (`learnix-ai`).
              </p>
              <p>
                • No password hashes, JWT secrets, or service_role keys are ever returned to the client.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* SUSPEND ACCOUNT DIALOG */}
      <Dialog
        open={Boolean(suspendingTarget)}
        onOpenChange={(open) => {
          if (!open) setSuspendingTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Block / Suspend Account</DialogTitle>
            <DialogDescription>
              Provide a mandatory security reason to suspend{" "}
              <strong>{suspendingTarget?.label}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label>Security Reason *</Label>
            <Textarea
              rows={3}
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
              placeholder="Suspicious login pattern / repeated exam integrity violation..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSuspendingTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleConfirmSuspend()}
            >
              Confirm Block
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
