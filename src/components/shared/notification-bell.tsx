"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  sharedDeleteNotificationAction,
  sharedMarkNotificationReadAction,
} from "@/services/shared/actions";

interface BellItem {
  recipientId: string;
  title: string;
  body: string;
  category: string;
  actionUrl: string | null;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<BellItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const userIdRef = useRef<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    let uid = userIdRef.current;
    if (!uid) {
      const { data: userData } = await supabase.auth.getUser();
      uid = userData.user?.id ?? null;
      userIdRef.current = uid;
    }
    if (!uid) return null;

    const { data: recipients } = await supabase
      .from("notification_recipients")
      .select(
        "id, notification_id, is_read, created_at, notifications(id, title, body, notification_type, action_url)",
      )
      .eq("recipient_id", uid)
      .order("created_at", { ascending: false })
      .limit(15);

    const recList = recipients ?? [];
    if (recList.length === 0) {
      setItems([]);
      setUnreadCount(0);
      return uid;
    }

    const mapped: BellItem[] = recList
      .map((r) => {
        const rawNotif = r.notifications;
        const n = Array.isArray(rawNotif) ? rawNotif[0] : rawNotif;
        if (!n) return null;
        return {
          recipientId: r.id,
          title: n.title,
          body: n.body,
          category: n.notification_type,
          actionUrl: n.action_url,
          isRead: r.is_read,
          createdAt: r.created_at,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    setItems(mapped);
    setUnreadCount(mapped.filter((m) => !m.isRead).length);
    return uid;
  }, []);

  useEffect(() => {
    let active = true;
    const supabase = createSupabaseBrowserClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function init() {
      const uid = await loadNotifications();
      if (!active || !uid) return;

      channel = supabase
        .channel(`learnix-notifications-bell-${uid}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_recipients",
            filter: `recipient_id=eq.${uid}`,
          },
          () => {
            if (active) {
              void loadNotifications();
            }
          },
        )
        .subscribe();
    }

    const timer = window.setTimeout(() => {
      void init();
    }, 0);

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [loadNotifications]);

  function handleMarkAllRead() {
    startTransition(async () => {
      await sharedMarkNotificationReadAction({ markAll: true });
      await loadNotifications();
    });
  }

  function handleDeleteItem(e: React.MouseEvent, recipientId: string) {
    e.stopPropagation();
    startTransition(async () => {
      await sharedDeleteNotificationAction({ recipientId });
      await loadNotifications();
      router.refresh();
    });
  }

  function handleItemClick(item: BellItem) {
    startTransition(async () => {
      if (!item.isRead) {
        await sharedMarkNotificationReadAction({
          recipientId: item.recipientId,
          isRead: true,
        });
        await loadNotifications();
      }
      if (item.actionUrl) {
        router.push(item.actionUrl);
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Notifications"
          className="relative"
        >
          <Bell className="size-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-gold-primary font-mono text-[10px] font-bold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-3 py-2.5">
          <span className="text-xs font-semibold">
            Notifications ({unreadCount} unread)
          </span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[11px]"
              disabled={isPending}
              onClick={handleMarkAllRead}
            >
              <CheckCheck className="mr-1 size-3" />
              Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-80 space-y-1 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            items.map((item) => (
              <div
                key={item.recipientId}
                role="button"
                tabIndex={0}
                onClick={() => handleItemClick(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleItemClick(item);
                  }
                }}
                className={
                  item.isRead
                    ? "cursor-pointer rounded-lg p-2.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                    : "cursor-pointer rounded-lg border border-gold-primary/40 bg-gold-primary/5 p-2.5 text-xs text-foreground transition-colors hover:bg-gold-primary/10"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{item.title}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant={item.isRead ? "outline" : "gold"}>
                      {item.category}
                    </Badge>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={(e) => handleDeleteItem(e, item.recipientId)}
                      title="Delete notification"
                      className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px]">{item.body}</p>
                <p className="mt-1 font-mono text-[10px] opacity-70">
                  {item.createdAt.slice(0, 16).replace("T", " ")}
                </p>
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-3 py-2 text-[11px]">
          <Link
            href="/notifications"
            className="font-semibold text-gold-foreground hover:underline"
          >
            All & Preferences
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/calendar"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Calendar
            </Link>
            <Link
              href="/messages"
              className="font-medium text-muted-foreground hover:text-foreground"
            >
              Messages
            </Link>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
