"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";

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
import { sharedMarkNotificationReadAction } from "@/services/shared/actions";

interface BellItem {
  recipientId: string;
  title: string;
  body: string;
  category: string;
  isRead: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const [items, setItems] = useState<BellItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isPending, startTransition] = useTransition();
  const userIdRef = useRef<string | null>(null);

  const loadNotifications = useCallback(async () => {
    const supabase = createSupabaseBrowserClient();
    let uid = userIdRef.current;
    if (!uid) {
      const { data: sessionData } = await supabase.auth.getSession();
      uid = sessionData.session?.user?.id ?? null;
      if (!uid) {
        const { data: userData } = await supabase.auth.getUser();
        uid = userData.user?.id ?? null;
      }
      userIdRef.current = uid;
    }
    if (!uid) return null;

    const { data: recipients } = await supabase
      .from("notification_recipients")
      .select(
        "id, notification_id, is_read, created_at, notifications(id, title, body, notification_type)",
      )
      .eq("recipient_id", uid)
      .order("created_at", { ascending: false })
      .limit(12);

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

  function handleMarkSingleRead(recipientId: string, isRead: boolean) {
    if (isRead || isPending) return;
    startTransition(async () => {
      await sharedMarkNotificationReadAction({ recipientId });
      await loadNotifications();
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
                role={item.isRead ? undefined : "button"}
                tabIndex={item.isRead ? undefined : 0}
                onClick={() => handleMarkSingleRead(item.recipientId, item.isRead)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleMarkSingleRead(item.recipientId, item.isRead);
                  }
                }}
                className={
                  item.isRead
                    ? "rounded-lg p-2.5 text-xs text-muted-foreground"
                    : "cursor-pointer rounded-lg border border-gold-primary/40 bg-gold-primary/5 p-2.5 text-xs text-foreground transition-colors hover:bg-gold-primary/10"
                }
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{item.title}</span>
                  <Badge variant={item.isRead ? "outline" : "gold"}>
                    {item.category}
                  </Badge>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px]">{item.body}</p>
              </div>
            ))
          )}
        </div>
        <DropdownMenuSeparator />
        <div className="flex items-center justify-between px-3 py-2 text-[11px]">
          <Link
            href="/calendar"
            className="font-medium text-gold-foreground hover:underline"
          >
            Smart Calendar
          </Link>
          <Link
            href="/messages"
            className="font-medium text-gold-foreground hover:underline"
          >
            Messages
          </Link>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
