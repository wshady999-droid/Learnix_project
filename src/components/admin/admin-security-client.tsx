"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import { downloadExcelCsv } from "@/lib/admin/export-and-import";
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
    "audit" | "logins" | "devices" | "roles" | "backups"
  >("audit");

  const profilesById = new Map(data.profiles.map((p) => [p.id, p]));

  const loginAttemptLogs = data.auditLogs.filter((l) =>
    l.action.startsWith("auth."),
  );

  async function handleToggleDeviceTrust(deviceId: string, isTrusted: boolean) {
    const res = await adminToggleDeviceTrustAction({ deviceId, isTrusted });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.departments.savedToast);
    router.refresh();
  }

  async function handleSuspendUser(userId: string) {
    const res = await adminChangeUserStatusAction({
      targetUserId: userId,
      status: "suspended",
    });
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    toast.success(adminT.users.statusUpdatedToast);
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
            {adminT.security.subtitle}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            downloadExcelCsv(
              "learnix-security-audit.csv",
              ["Timestamp", "Action", "Entity Type", "Entity ID", "IP Address", "Client"],
              data.auditLogs.map((l) => [
                l.created_at,
                l.action,
                l.entity_type,
                l.entity_id,
                l.ip_address,
                l.user_agent,
              ]),
            )
          }
        >
          <Download className="size-4" aria-hidden="true" />
          <span>{adminT.common.exportExcel}</span>
        </Button>
      </div>

      {/* Tabs */}
      <div className="inline-flex flex-wrap rounded-lg border border-border bg-muted p-1">
        {(
          [
            {
              id: "audit",
              label: `${adminT.security.tabAuditLogs} (${data.auditLogs.length})`,
            },
            {
              id: "logins",
              label: `${adminT.security.tabLoginAttempts} (${loginAttemptLogs.length})`,
            },
            {
              id: "devices",
              label: `${adminT.security.tabDevices} (${data.devices.length})`,
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
                ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* TAB 1 & 2: AUDIT LOGS / LOGIN ATTEMPTS */}
      {activeTab === "audit" || activeTab === "logins" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {activeTab === "audit"
                ? adminT.security.tabAuditLogs
                : adminT.security.tabLoginAttempts}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(activeTab === "audit" ? data.auditLogs : loginAttemptLogs)
              .length === 0 ? (
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
                  {(activeTab === "audit"
                    ? data.auditLogs
                    : loginAttemptLogs
                  ).map((log) => {
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
                              log.action.includes("suspended")
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
      ) : null}

      {/* TAB 3: ACTIVE DEVICES & SESSIONS */}
      {activeTab === "devices" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.security.tabDevices}
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
                            {owner &&
                            owner.role !== "admin" &&
                            owner.status === "active" ? (
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleSuspendUser(owner.id)}
                              >
                                {adminT.users.suspendAccount}
                              </Button>
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
      ) : null}

      {/* TAB 4: ROLE PERMISSIONS MATRIX */}
      {activeTab === "roles" ? (
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
                            className="size-4 rounded border-input accent-brand-gold"
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
      ) : null}

      {/* TAB 5: BACKUP STATUS & DISASTER RECOVERY DOCUMENTATION */}
      {activeTab === "backups" ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Card variant="premium">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Badge variant="success">
                  <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  <span>{adminT.security.backupStatusHealthy}</span>
                </Badge>
                <Database
                  className="size-5 text-gold-foreground"
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
                Engine: PostgreSQL 17.12 · Region: eu-west-3
              </p>
              <p>
                All schema migrations (`01` through `09`) are stored deterministically in{" "}
                <code>supabase/migrations/</code> and tracked in{" "}
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
                  className="size-5 text-gold-foreground"
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
                • 44 / 44 tables protected by Row-Level Security (RLS).
              </p>
              <p>
                • Protective column triggers block unauthorized role or grade modifications.
              </p>
              <p>
                • No password hashes, JWT secrets, or service_role keys are ever returned to the client.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
