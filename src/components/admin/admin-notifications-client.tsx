"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Megaphone, Send } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { cn } from "@/lib/utils";
import { adminDispatchNotificationAction } from "@/services/admin/actions";
import type { AdminNotificationsData } from "@/services/admin/queries";

interface AdminNotificationsClientProps {
  data: AdminNotificationsData;
}

export function AdminNotificationsClient({
  data,
}: AdminNotificationsClientProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const [targetScope, setTargetScope] = useState<
    | "all_students"
    | "all_teachers"
    | "all_users"
    | "department"
    | "class"
    | "individual"
  >("all_students");
  const [targetId, setTargetId] = useState("");
  const [notificationType, setNotificationType] = useState<
    "system" | "course" | "exam" | "assignment" | "grade" | "message" | "attendance"
  >("system");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [isAnnouncement, setIsAnnouncement] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleDispatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSending(true);
    const res = await adminDispatchNotificationAction({
      targetScope,
      targetId: targetId || undefined,
      notificationType,
      title,
      body,
      scheduledFor: scheduledFor || undefined,
      isAnnouncement,
    });
    setSending(false);

    if (!res.ok) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `${adminT.notifications.sentSuccessToast} (${res.data.recipientCount})`,
    );
    setTitle("");
    setBody("");
    setScheduledFor("");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          {adminT.notifications.title}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {adminT.notifications.subtitle}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.95fr_1.35fr]">
        <Card variant="premium">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Megaphone
                className="size-4 text-gold-foreground"
                aria-hidden="true"
              />
              <span>{adminT.notifications.composeTitle}</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleDispatch} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="notif-scope">
                    {adminT.notifications.audienceLabel}
                  </Label>
                  <select
                    id="notif-scope"
                    value={targetScope}
                    onChange={(e) => {
                      setTargetScope(
                        e.target.value as typeof targetScope,
                      );
                      setTargetId("");
                    }}
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="all_students">
                      {adminT.notifications.audienceAllStudents}
                    </option>
                    <option value="all_teachers">
                      {adminT.notifications.audienceAllTeachers}
                    </option>
                    <option value="all_users">
                      {adminT.notifications.audienceAllUsers}
                    </option>
                    <option value="department">
                      {adminT.notifications.audienceDepartment}
                    </option>
                    <option value="class">
                      {adminT.notifications.audienceClass}
                    </option>
                    <option value="individual">
                      {adminT.notifications.audienceIndividual}
                    </option>
                  </select>
                </div>

                <div className="grid gap-1.5">
                  <Label htmlFor="notif-type">
                    {adminT.notifications.typeLabel}
                  </Label>
                  <select
                    id="notif-type"
                    value={notificationType}
                    onChange={(e) =>
                      setNotificationType(
                        e.target.value as typeof notificationType,
                      )
                    }
                    className={cn(fieldBase, "h-10 py-2")}
                  >
                    <option value="system">System</option>
                    <option value="course">Course</option>
                    <option value="exam">Exam</option>
                    <option value="assignment">Assignment</option>
                    <option value="grade">Grade</option>
                    <option value="attendance">Attendance</option>
                  </select>
                </div>
              </div>

              {targetScope === "department" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="notif-dept">{adminT.users.departmentLabel}</Label>
                  <select
                    id="notif-dept"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
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
              ) : null}

              {targetScope === "class" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="notif-class">{adminT.departments.classLabel}</Label>
                  <select
                    id="notif-class"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.classes.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              {targetScope === "individual" ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="notif-user">User</Label>
                  <select
                    id="notif-user"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className={cn(fieldBase, "h-10 py-2")}
                    required
                  >
                    <option value="">—</option>
                    {data.profiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.full_name || p.email} ({p.role})
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="notif-title">
                  {adminT.notifications.titleLabel}
                </Label>
                <Input
                  id="notif-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notif-body">
                  {adminT.notifications.bodyLabel}
                </Label>
                <Textarea
                  id="notif-body"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  required
                />
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="notif-schedule">
                  {adminT.notifications.scheduleForLabel}
                </Label>
                <Input
                  id="notif-schedule"
                  type="datetime-local"
                  value={scheduledFor}
                  onChange={(e) => setScheduledFor(e.target.value)}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground select-none">
                <input
                  type="checkbox"
                  checked={isAnnouncement}
                  onChange={(e) => setIsAnnouncement(e.target.checked)}
                  className="size-4 rounded border-input accent-brand-gold"
                />
                <span>{adminT.notifications.isAnnouncementLabel}</span>
              </label>

              <div className="flex justify-end pt-2">
                <Button type="submit" variant="gold" loading={sending}>
                  <Send className="size-4" aria-hidden="true" />
                  <span>{adminT.notifications.sendNotificationButton}</span>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.notifications.historyTitle}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.notifications.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={adminT.common.noRecordsTitle}
                description={adminT.common.noRecordsDescription}
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{adminT.notifications.titleLabel}</TableHead>
                    <TableHead>{adminT.notifications.audienceLabel}</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead className="text-end">Scheduled / Sent</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.notifications.map((n) => (
                    <TableRow key={n.id}>
                      <TableCell>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <span>{n.title}</span>
                          {n.is_announcement ? (
                            <Badge variant="gold">Announcement</Badge>
                          ) : null}
                        </div>
                        <div className="max-w-sm truncate text-xs text-muted-foreground">
                          {n.body}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="gold-subtle" className="font-mono">
                          {n.target_scope}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs capitalize">
                        {n.notification_type}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs text-muted-foreground">
                        {(n.scheduled_for || n.created_at)
                          .replace("T", " ")
                          .slice(0, 16)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
