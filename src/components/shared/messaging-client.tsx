"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  Download,
  Megaphone,
  MessageSquare,
  Paperclip,
  Search,
  Send,
  User,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  sharedMarkConversationReadAction,
  sharedMarkNotificationReadAction,
  sharedSendMessageAction,
  sharedStartConversationAction,
} from "@/services/shared/actions";
import type { MessagingContactsData } from "@/services/shared/queries";

interface MessagingClientProps {
  data: MessagingContactsData;
}

const TRANSLUCENT_PANEL =
  "flex h-full flex-col overflow-hidden border-white/10 bg-[#0F1115]/75 text-foreground backdrop-blur-xl shadow-[0_10px_34px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.06)] dark:border-white/10 dark:bg-[#0F1115]/75";

export function MessagingClient({ data }: MessagingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [sidebarTab, setSidebarTab] = useState<
    "chats" | "contacts" | "announcements"
  >("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string>(
    searchParams.get("convId") || data.conversations[0]?.id || "",
  );
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string>(
    data.announcements[0]?.id || "",
  );

  const [replyBody, setReplyBody] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storagePath: string;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const autoOpenedUserRef = useRef<string | null>(null);

  const activeConv = useMemo(
    () =>
      data.conversations.find((c) => c.id === selectedConvId) ??
      data.conversations[0] ??
      null,
    [data.conversations, selectedConvId],
  );

  const activeAnnouncement = useMemo(
    () =>
      data.announcements.find((a) => a.id === selectedAnnouncementId) ??
      data.announcements[0] ??
      null,
    [data.announcements, selectedAnnouncementId],
  );

  useEffect(() => {
    const targetUserId = searchParams.get("userId");
    const targetCourseId = searchParams.get("courseId");
    if (!targetUserId || autoOpenedUserRef.current === targetUserId) return;
    autoOpenedUserRef.current = targetUserId;

    const existing = data.conversations.find(
      (c) => c.peerUserId === targetUserId,
    );
    if (existing) {
      setSelectedConvId(existing.id);
      setSidebarTab("chats");
      return;
    }

    startTransition(async () => {
      const res = await sharedStartConversationAction({
        recipientId: targetUserId,
        courseId: targetCourseId || null,
        subject: "Direct Academic Chat",
      });
      if (res.ok) {
        setSelectedConvId(res.data.conversationId);
        setSidebarTab("chats");
        router.refresh();
      }
    });
  }, [searchParams, data.conversations, router]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeConv && activeConv.unreadCount > 0) {
      void sharedMarkConversationReadAction(activeConv.id).then(() => {
        router.refresh();
      });
    }
  }, [activeConv?.id, activeConv?.messages.length, activeConv?.unreadCount, router]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const convIds = new Set(data.conversations.map((c) => c.id));

    const channel = supabase
      .channel(`learnix-realtime-chat-${data.userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const row = payload.new as {
            conversation_id?: string;
            sender_id?: string;
          };
          if (row.conversation_id && convIds.has(row.conversation_id)) {
            if (
              activeConv?.id === row.conversation_id &&
              row.sender_id !== data.userId
            ) {
              void sharedMarkConversationReadAction(row.conversation_id);
            }
            router.refresh();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversation_participants",
        },
        (payload) => {
          const row = payload.new as {
            conversation_id?: string;
            user_id?: string;
          };
          if (
            row.conversation_id &&
            convIds.has(row.conversation_id) &&
            row.user_id !== data.userId
          ) {
            router.refresh();
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversation_participants",
          filter: `user_id=eq.${data.userId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [data.userId, data.conversations, activeConv?.id, router]);

  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.conversations;
    return data.conversations.filter(
      (c) =>
        c.peerName.toLowerCase().includes(q) ||
        c.subject.toLowerCase().includes(q) ||
        (c.courseTitle ?? "").toLowerCase().includes(q) ||
        c.lastMessagePreview.toLowerCase().includes(q),
    );
  }, [data.conversations, searchQuery]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return data.authorizedContacts;
    return data.authorizedContacts.filter(
      (c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.courseTitle ?? "").toLowerCase().includes(q),
    );
  }, [data.authorizedContacts, searchQuery]);

  function handleOpenContactChat(
    contact: MessagingContactsData["authorizedContacts"][number],
  ) {
    const existing = data.conversations.find((c) => c.peerUserId === contact.id);
    if (existing) {
      setSelectedConvId(existing.id);
      setSidebarTab("chats");
      return;
    }

    startTransition(async () => {
      const res = await sharedStartConversationAction({
        recipientId: contact.id,
        courseId: contact.courseId,
        subject: contact.courseTitle
          ? `${contact.courseTitle} — Direct Chat`
          : `Chat with ${contact.fullName}`,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSelectedConvId(res.data.conversationId);
      setSidebarTab("chats");
      router.refresh();
    });
  }

  async function handleAttachmentUpload(
    e: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error("Attachment must be under 25 MB.");
      return;
    }

    setUploadingAttachment(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${activeConv.id}/${data.userId}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, file, {
          upsert: true,
          contentType: file.type || "application/octet-stream",
        });

      if (error) {
        toast.error(error.message);
        return;
      }

      setPendingAttachment({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileSizeBytes: file.size,
        storagePath,
      });
      toast.success("Attachment ready to send.");
    } finally {
      setUploadingAttachment(false);
      e.target.value = "";
    }
  }

  function handleSendReply() {
    if (!activeConv) return;
    const text =
      replyBody.trim() ||
      (pendingAttachment ? `Shared attachment: ${pendingAttachment.fileName}` : "");
    if (!text) return;

    startTransition(async () => {
      const res = await sharedSendMessageAction({
        conversationId: activeConv.id,
        body: text,
        attachment: pendingAttachment,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setReplyBody("");
      setPendingAttachment(null);
      router.refresh();
    });
  }

  const totalUnreadChats = data.conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0,
  );
  const unreadAnnouncements = data.announcements.filter((a) => !a.isRead).length;

  const contactsLabel =
    data.role === "student"
      ? "Teachers"
      : data.role === "teacher"
        ? "Students"
        : "Directory";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Academic Messages
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Realtime conversations, read status, file sharing, and official announcements.
          </p>
        </div>
      </div>

      <div className="grid h-[calc(100dvh-13.5rem)] min-h-[540px] gap-4 lg:grid-cols-12">
        <Card className={cn(TRANSLUCENT_PANEL, "lg:col-span-4")}>
          <CardHeader className="space-y-3 border-b border-white/10 pb-3">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setSidebarTab("chats")}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  sidebarTab === "chats"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-[#0F1115]/55 text-muted-foreground hover:text-foreground",
                )}
              >
                Chats
                {totalUnreadChats > 0 ? ` (${totalUnreadChats})` : ""}
              </button>
              <button
                type="button"
                onClick={() => setSidebarTab("contacts")}
                className={cn(
                  "flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                  sidebarTab === "contacts"
                    ? "bg-emerald-500 text-white shadow-xs"
                    : "bg-[#0F1115]/55 text-muted-foreground hover:text-foreground",
                )}
              >
                {contactsLabel} ({data.authorizedContacts.length})
              </button>
              {data.announcements.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSidebarTab("announcements")}
                  className={cn(
                    "flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    sidebarTab === "announcements"
                      ? "bg-emerald-500 text-white shadow-xs"
                      : "bg-[#0F1115]/55 text-muted-foreground hover:text-foreground",
                  )}
                >
                  Notices
                  {unreadAnnouncements > 0 ? ` (${unreadAnnouncements})` : ""}
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${sidebarTab === "contacts" ? contactsLabel.toLowerCase() : "conversations"}...`}
                className="h-9 border-white/10 bg-[#0F1115]/55 pl-8 text-xs backdrop-blur-md"
              />
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-1.5 overflow-y-auto p-2.5 text-xs">
            {sidebarTab === "chats" && (
              <>
                {filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No active chats"
                    description={`Switch to the ${contactsLabel} tab above to start a realtime conversation.`}
                  />
                ) : (
                  filteredConversations.map((conv) => {
                    const isSelected = activeConv?.id === conv.id;
                    return (
                      <button
                        key={conv.id}
                        type="button"
                        onClick={() => {
                          setSelectedConvId(conv.id);
                          if (conv.unreadCount > 0) {
                            void sharedMarkConversationReadAction(conv.id).then(
                              () => router.refresh(),
                            );
                          }
                        }}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                          isSelected
                            ? "border-emerald-500/45 bg-[#0F1115]/65"
                            : "border-transparent hover:border-white/10 hover:bg-[#0F1115]/45",
                        )}
                      >
                        {conv.peerAvatarUrl ? (
                          <img
                            src={conv.peerAvatarUrl}
                            alt={conv.peerName}
                            className="size-10 shrink-0 rounded-full border border-emerald-500/30 object-cover"
                          />
                        ) : (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400">
                            {conv.peerName.charAt(0).toUpperCase()}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="truncate font-semibold text-foreground">
                              {conv.peerName}
                            </p>
                            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                              {conv.lastMessageAt.slice(11, 16)}
                            </span>
                          </div>
                          {conv.courseTitle && (
                            <p className="truncate text-[10px] font-medium text-emerald-400">
                              {conv.courseTitle}
                            </p>
                          )}
                          <div className="mt-1 flex items-center justify-between gap-2">
                            <p className="truncate text-[11px] text-muted-foreground">
                              {conv.lastMessagePreview}
                            </p>
                            {conv.unreadCount > 0 && (
                              <span className="inline-flex min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                                {conv.unreadCount}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </>
            )}

            {sidebarTab === "contacts" && (
              <>
                {filteredContacts.length === 0 ? (
                  <EmptyState
                    icon={User}
                    title={`No ${contactsLabel.toLowerCase()} found`}
                    description={
                      data.role === "student"
                        ? "Enroll in a published course to message its instructor."
                        : "Students enrolled in your courses will appear here automatically."
                    }
                  />
                ) : (
                  filteredContacts.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      disabled={isPending}
                      onClick={() => handleOpenContactChat(contact)}
                      className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#0F1115]/45 p-3 text-left transition-colors hover:border-emerald-500/45 hover:bg-[#0F1115]/65"
                    >
                      {contact.avatarUrl ? (
                        <img
                          src={contact.avatarUrl}
                          alt={contact.fullName}
                          className="size-10 shrink-0 rounded-full border border-emerald-500/30 object-cover"
                        />
                      ) : (
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400">
                          {contact.fullName.charAt(0).toUpperCase()}
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-foreground">
                          {contact.fullName}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {contact.courseTitle || contact.email}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 capitalize"
                      >
                        Chat
                      </Badge>
                    </button>
                  ))
                )}
              </>
            )}

            {sidebarTab === "announcements" && (
              <>
                {data.announcements.map((ann) => (
                  <button
                    key={ann.id}
                    type="button"
                    onClick={() => {
                      setSelectedAnnouncementId(ann.id);
                      if (!ann.isRead) {
                        void sharedMarkNotificationReadAction({
                          recipientId: ann.recipientRowId,
                          isRead: true,
                        }).then(() => router.refresh());
                      }
                    }}
                    className={cn(
                      "w-full rounded-xl border p-3 text-left transition-colors",
                      activeAnnouncement?.id === ann.id
                        ? "border-emerald-500/45 bg-[#0F1115]/65"
                        : "border-white/10 bg-[#0F1115]/45 hover:bg-[#0F1115]/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {ann.title}
                      </span>
                      {!ann.isRead && (
                        <Badge className="bg-emerald-500 text-white">New</Badge>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {ann.body}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {ann.createdAt.slice(0, 16).replace("T", " ")}
                    </p>
                  </button>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(TRANSLUCENT_PANEL, "lg:col-span-8")}>
          {sidebarTab === "announcements" && activeAnnouncement ? (
            <div className="flex h-full flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className="bg-emerald-500 text-white">
                    <Megaphone className="mr-1 size-3.5" />
                    Official Platform Announcement
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {activeAnnouncement.createdAt.slice(0, 16).replace("T", " ")}
                  </span>
                </div>
                <CardTitle className="text-xl">
                  {activeAnnouncement.title}
                </CardTitle>
                <div className="rounded-xl border border-white/10 bg-[#0F1115]/55 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground backdrop-blur-md">
                  {activeAnnouncement.body}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0F1115]/55 px-4 py-3 text-center text-xs text-muted-foreground">
                Platform announcements from Administration are broadcast-only and do not accept replies.
              </div>
            </div>
          ) : !activeConv ? (
            <CardContent className="flex h-full items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Select a chat or contact"
                description={`Pick a ${contactsLabel.slice(0, -1).toLowerCase()} from the left panel to begin messaging in real time.`}
              />
            </CardContent>
          ) : (
            <>
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-white/10 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  {activeConv.peerAvatarUrl ? (
                    <img
                      src={activeConv.peerAvatarUrl}
                      alt={activeConv.peerName}
                      className="size-10 shrink-0 rounded-full border border-emerald-500/30 object-cover"
                    />
                  ) : (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-500/10 font-bold text-emerald-400">
                      {activeConv.peerName.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">
                      {activeConv.peerName}
                    </CardTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="capitalize">{activeConv.peerRole}</span>
                      {activeConv.courseTitle
                        ? ` • ${activeConv.courseTitle}`
                        : ""}
                    </p>
                  </div>
                </div>
                <Badge
                  variant="outline"
                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                >
                  Realtime Active
                </Badge>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between gap-3 overflow-hidden p-4">
                <div className="flex-1 space-y-3 overflow-y-auto pr-1 text-xs">
                  {activeConv.messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center text-muted-foreground">
                      Say hello to start your conversation with {activeConv.peerName}.
                    </div>
                  ) : (
                    activeConv.messages.map((msg) => {
                      const isMine = msg.senderId === data.userId;
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "max-w-[82%] rounded-2xl p-3 shadow-2xs",
                            isMine
                              ? "ml-auto bg-emerald-600/90 text-white"
                              : "mr-auto border border-white/10 bg-[#0F1115]/60 text-foreground backdrop-blur-md",
                          )}
                        >
                          {!isMine && (
                            <p className="mb-0.5 text-[10px] font-semibold text-emerald-400">
                              {msg.senderName}
                            </p>
                          )}
                          <p className="leading-relaxed whitespace-pre-wrap">
                            {msg.body}
                          </p>

                          {msg.attachments.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1.5">
                              {msg.attachments.map((att) =>
                                att.signedUrl ? (
                                  <a
                                    key={att.id}
                                    href={att.signedUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={cn(
                                      "inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                                      isMine
                                        ? "border-white/25 bg-white/10 text-white hover:bg-white/20"
                                        : "border-emerald-500/30 bg-emerald-500/10 text-foreground hover:bg-emerald-500/20",
                                    )}
                                  >
                                    <Paperclip className="size-3.5 shrink-0" />
                                    <span className="truncate">{att.fileName}</span>
                                    <Download className="ml-auto size-3.5 shrink-0" />
                                  </a>
                                ) : (
                                  <Badge key={att.id} variant="outline">
                                    <Paperclip className="mr-1 size-3" />
                                    {att.fileName}
                                  </Badge>
                                ),
                              )}
                            </div>
                          )}

                          <div
                            className={cn(
                              "mt-1.5 flex items-center justify-end gap-1 font-mono text-[10px]",
                              isMine ? "text-white/80" : "text-muted-foreground",
                            )}
                          >
                            <span>
                              {msg.createdAt.slice(0, 10) ===
                                new Date().toISOString().slice(0, 10)
                                ? msg.createdAt.slice(11, 16)
                                : `${msg.createdAt.slice(5, 10)} ${msg.createdAt.slice(11, 16)}`}
                            </span>
                            {isMine &&
                              (msg.isReadByPeer ? (
                                <CheckCheck
                                  className="size-3.5 text-emerald-300"
                                  aria-label="Read"
                                />
                              ) : (
                                <Check
                                  className="size-3.5 text-white/70"
                                  aria-label="Sent"
                                />
                              ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                <div className="space-y-2 border-t border-white/10 pt-3">
                  {pendingAttachment && (
                    <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs">
                      <span className="inline-flex items-center gap-1.5 truncate font-medium">
                        <Paperclip className="size-3.5 text-emerald-400" />
                        {pendingAttachment.fileName}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPendingAttachment(null)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Remove attachment"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex items-end gap-2">
                    <label
                      className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#0F1115]/55 px-3 text-muted-foreground backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-foreground"
                      title="Attach PDF, image, text, or ZIP (max 25 MB)"
                    >
                      <Paperclip className="size-4 text-emerald-400" />
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.zip"
                        className="hidden"
                        disabled={uploadingAttachment}
                        onChange={handleAttachmentUpload}
                      />
                    </label>

                    <Textarea
                      rows={2}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                      placeholder={
                        uploadingAttachment
                          ? "Uploading attachment..."
                          : "Type a message (Enter to send, Shift+Enter for new line)..."
                      }
                      className="min-h-10 flex-1 resize-none border-white/10 bg-[#0F1115]/55 backdrop-blur-md"
                    />

                    <Button
                      className="h-10 shrink-0 bg-emerald-500 text-white hover:bg-emerald-600"
                      disabled={
                        isPending ||
                        uploadingAttachment ||
                        (!replyBody.trim() && !pendingAttachment)
                      }
                      onClick={handleSendReply}
                    >
                      <Send className="size-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}