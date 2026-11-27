"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  CheckCheck,
  ExternalLink,
  Mail,
  MailOpen,
  Settings2,
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
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  sharedMarkNotificationReadAction,
  sharedUpdateNotificationPreferencesAction,
} from "@/services/shared/actions";
import type {
  NotificationPreferencesMap,
  SharedNotificationItem,
} from "@/services/shared/queries";

interface NotificationsCenterClientProps {
  userId: string;
  unreadCount: number;
  preferences: NotificationPreferencesMap;
  items: SharedNotificationItem[];
}

const DARK_GLASS_CARD =
  "border-white/10 bg-[#0F1115]/75 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-white/10 dark:bg-[#0F1115]/75";

const DARK_GLASS_ITEM =
  "border-white/10 bg-[#0F1115]/55 backdrop-blur-md";

const DARK_GLASS_UNREAD_ITEM =
  "border-[#C99A22]/50 bg-[#0F1115]/65 backdrop-blur-md shadow-[0_0_20px_rgba(201,154,34,0.1)]";

export function NotificationsCenterClient({
  userId,
  unreadCount,
  preferences: initialPreferences,
  items,
}: NotificationsCenterClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [prefs, setPrefs] =
    useState<NotificationPreferencesMap>(initialPreferences);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`learnix-notif-center-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notification_recipients",
          filter: `recipient_id=eq.${userId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, router]);

  const visibleItems =
    filter === "unread" ? items.filter((i) => !i.isRead) : items;

  function handleToggleRead(item: SharedNotificationItem) {
    startTransition(async () => {
      const res = await sharedMarkNotificationReadAction({
        recipientId: item.recipientId,
        isRead: !item.isRead,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      router.refresh();
    });
  }

  function handleMarkAllRead() {
    startTransition(async () => {
      const res = await sharedMarkNotificationReadAction({ markAll: true });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("All notifications marked as read.");
      router.refresh();
    });
  }

  function handleTogglePreference(key: keyof NotificationPreferencesMap) {
    const nextPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(nextPrefs);
    startTransition(async () => {
      const res = await sharedUpdateNotificationPreferencesAction(nextPrefs);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Notification preferences saved.");
      router.refresh();
    });
  }

  const prefItems: Array<{
    key: keyof NotificationPreferencesMap;
    label: string;
    desc: string;
  }> = [
    {
      key: "course_alerts",
      label: "Course & Assignment Alerts",
      desc: "New lessons, resources, published assignments, and course updates.",
    },
    {
      key: "exam_reminders",
      label: "Quiz & Deadline Reminders",
      desc: "Published quizzes, upcoming assessment windows, and integrity alerts.",
    },
    {
      key: "grade_notifications",
      label: "Grades & Instructor Feedback",
      desc: "Published quiz scores, assignment grades, and teacher feedback.",
    },
    {
      key: "email_updates",
      label: "Academic Digest Updates",
      desc: "Summary updates for course milestones and messages.",
    },
    {
      key: "security_alerts",
      label: "Account & Security Alerts",
      desc: "Important account status and authentication notifications.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Notifications & Alert Preferences
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Realtime alerts for assignments, quizzes, grades, messages, and course updates.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={filter === "all" ? "gold" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
          >
            All ({items.length})
          </Button>
          <Button
            variant={filter === "unread" ? "gold" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
          >
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              disabled={isPending}
              onClick={handleMarkAllRead}
              className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
            >
              <CheckCheck className="mr-1.5 size-4" />
              Mark All Read
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className={cn(DARK_GLASS_CARD, "lg:col-span-8")}>
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="size-4 text-[#C99A22]" />
              <span>Notification History</span>
            </CardTitle>
            <CardDescription>
              Delivered automatically in real time as academic events occur.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {visibleItems.length === 0 ? (
              <EmptyState
                icon={Bell}
                title={
                  filter === "unread"
                    ? "You're all caught up!"
                    : "No notifications yet"
                }
                description="New assignments, quizzes, grades, and messages will appear here in real time."
              />
            ) : (
              visibleItems.map((item) => (
                <div
                  key={item.recipientId}
                  className={cn(
                    "flex flex-col justify-between gap-3 rounded-xl border p-4 transition-colors sm:flex-row sm:items-start",
                    item.isRead ? DARK_GLASS_ITEM : DARK_GLASS_UNREAD_ITEM,
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={item.isRead ? "outline" : "gold"}>
                        {item.isAnnouncement ? "Announcement" : item.category}
                      </Badge>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {item.createdAt.slice(0, 16).replace("T", " ")}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-foreground">
                      {item.title}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {item.body}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    {item.actionUrl && (
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        className="border-white/15 bg-[#0F1115]/60 hover:bg-[#0F1115]/80"
                      >
                        <Link href={item.actionUrl}>
                          <span>Open</span>
                          <ExternalLink className="ml-1 size-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleToggleRead(item)}
                      title={item.isRead ? "Mark as unread" : "Mark as read"}
                    >
                      {item.isRead ? (
                        <>
                          <Mail className="mr-1 size-3.5" />
                          <span className="text-xs">Mark Unread</span>
                        </>
                      ) : (
                        <>
                          <MailOpen className="mr-1 size-3.5 text-[#C99A22]" />
                          <span className="text-xs">Mark Read</span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card className={cn(DARK_GLASS_CARD, "lg:col-span-4")}>
          <CardHeader className="border-b border-white/10">
            <CardTitle className="flex items-center gap-2 text-base">
              <Settings2 className="size-4 text-[#C99A22]" />
              <span>Notification Preferences</span>
            </CardTitle>
            <CardDescription>
              Control which realtime academic alerts are delivered to you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-4">
            {prefItems.map((pref) => {
              const enabled = prefs[pref.key];
              return (
                <div
                  key={pref.key}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-xl border p-3",
                    DARK_GLASS_ITEM,
                  )}
                >
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-foreground">
                      {pref.label}
                    </p>
                    <p className="text-[11px] leading-snug text-muted-foreground">
                      {pref.desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={isPending}
                    onClick={() => handleTogglePreference(pref.key)}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors",
                      enabled ? "bg-emerald-500" : "bg-muted-foreground/30",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-block size-4 transform rounded-full bg-white transition-transform",
                        enabled ? "translate-x-6" : "translate-x-1",
                      )}
                    />
                  </button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}