"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Check,
  CheckCheck,
  Download,
  Loader2,
  Megaphone,
  MessageSquare,
  Mic,
  Paperclip,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  Users,
  X,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  sharedCreateGroupConversationAction,
  sharedDeleteNotificationAction,
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

function formatDuration(seconds: number | null | undefined): string {
  const safe = Math.max(0, Math.round(seconds ?? 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

function resolveSupportedAudioMime(): { mimeType: string; ext: string } {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return { mimeType: "audio/webm", ext: "webm" };
  }
  const candidates: Array<{ mimeType: string; ext: string }> = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/mp4", ext: "m4a" },
  ];
  for (const c of candidates) {
    if (MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: "audio/webm", ext: "webm" };
}

export function MessagingClient({ data }: MessagingClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [sidebarTab, setSidebarTab] = useState<
    "chats" | "contacts" | "announcements"
  >("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedConvId, setSelectedConvId] = useState<string>(() => {
    const byId = searchParams.get("convId");
    if (byId) return byId;
    const byUser = searchParams.get("userId");
    if (byUser) {
      const match = data.conversations.find(
        (c) => !c.isGroup && c.peerUserId === byUser,
      );
      if (match) return match.id;
    }
    return data.conversations[0]?.id || "";
  });
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

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingStartMsRef = useRef<number>(0);
  const recordingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null,
  );

  // Group chat creation dialog state (teachers & admins)
  const canCreateGroup = data.role === "teacher" || data.role === "admin";
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [groupSubject, setGroupSubject] = useState("");
  const [groupCourseId, setGroupCourseId] = useState<string>(
    data.teacherCourses[0]?.id ?? "",
  );
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  const [groupInitialMessage, setGroupInitialMessage] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState("");

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
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  useEffect(() => {
    const targetUserId = searchParams.get("userId");
    const targetCourseId = searchParams.get("courseId");
    if (!targetUserId || autoOpenedUserRef.current === targetUserId) return;
    autoOpenedUserRef.current = targetUserId;

    const existing = data.conversations.find(
      (c) => !c.isGroup && c.peerUserId === targetUserId,
    );
    if (existing) {
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

  const activeConvId = activeConv?.id;
  const activeConvUnread = activeConv?.unreadCount ?? 0;
  const activeConvMsgCount = activeConv?.messages.length ?? 0;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    if (activeConvId && activeConvUnread > 0) {
      void sharedMarkConversationReadAction(activeConvId).then(() => {
        router.refresh();
      });
    }
  }, [activeConvId, activeConvMsgCount, activeConvUnread, router]);

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
        c.lastMessagePreview.toLowerCase().includes(q) ||
        c.participantNames.some((p) => p.toLowerCase().includes(q)),
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

  const groupCandidateContacts = useMemo(() => {
    const q = groupMemberSearch.trim().toLowerCase();
    return data.authorizedContacts.filter((c) => {
      const matchesCourse =
        !groupCourseId || !c.courseId || c.courseId === groupCourseId;
      const matchesSearch =
        !q ||
        c.fullName.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.courseTitle ?? "").toLowerCase().includes(q);
      return matchesCourse && matchesSearch;
    });
  }, [data.authorizedContacts, groupCourseId, groupMemberSearch]);

  function handleOpenContactChat(
    contact: MessagingContactsData["authorizedContacts"][number],
  ) {
    const existing = data.conversations.find(
      (c) => !c.isGroup && c.peerUserId === contact.id,
    );
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

  function handleCreateGroupChat() {
    if (!groupSubject.trim()) {
      toast.error("Enter a group chat name.");
      return;
    }
    if (groupMemberIds.length === 0) {
      toast.error("Select at least one student for the group chat.");
      return;
    }

    startTransition(async () => {
      const res = await sharedCreateGroupConversationAction({
        subject: groupSubject.trim(),
        courseId: groupCourseId || null,
        participantIds: groupMemberIds,
        initialMessage: groupInitialMessage.trim() || undefined,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Group chat created.");
      setGroupDialogOpen(false);
      setGroupSubject("");
      setGroupMemberIds([]);
      setGroupInitialMessage("");
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
          upsert: false,
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

  async function startVoiceRecording() {
    if (!activeConv) return;
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      toast.error("Voice recording is not supported in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType } = resolveSupportedAudioMime();
      const recorder = MediaRecorder.isTypeSupported(mimeType)
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];
      recordingStartMsRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecordingVoice(true);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordedChunksRef.current.push(ev.data);
        }
      };

      recorder.start(250);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingSeconds(
          Math.max(
            0,
            Math.floor((Date.now() - recordingStartMsRef.current) / 1000),
          ),
        );
      }, 500);
    } catch {
      toast.error(
        "Microphone access denied. Allow microphone permissions to send voice messages.",
      );
    }
  }

  function cleanupRecorder() {
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }

  function cancelVoiceRecording() {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== "inactive"
    ) {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    recordedChunksRef.current = [];
    cleanupRecorder();
  }

  async function finishAndSendVoiceMessage() {
    const conv = activeConv;
    const recorder = mediaRecorderRef.current;
    if (!conv || !recorder) return;

    const elapsedSeconds = Math.max(
      1,
      Math.round((Date.now() - recordingStartMsRef.current) / 1000),
    );
    const { ext } = resolveSupportedAudioMime();

    setSendingVoice(true);
    try {
      const audioBlob = await new Promise<Blob>((resolve) => {
        if (recorder.state === "inactive") {
          const rawMime = recorder.mimeType || "audio/webm";
          const normalizedMime = rawMime.split(";")[0] || "audio/webm";
          resolve(new Blob(recordedChunksRef.current, { type: normalizedMime }));
          return;
        }
        recorder.onstop = () => {
          const rawMime = recorder.mimeType || "audio/webm";
          const normalizedMime = rawMime.split(";")[0] || "audio/webm";
          resolve(new Blob(recordedChunksRef.current, { type: normalizedMime }));
        };
        recorder.stop();
      });

      cleanupRecorder();

      if (audioBlob.size < 200) {
        toast.error("Voice recording was too short.");
        return;
      }

      const baseMime = (audioBlob.type || "audio/webm").split(";")[0] || "audio/webm";
      const fileName = `voice_${Date.now()}.${ext}`;
      const storagePath = `${conv.id}/${data.userId}/${fileName}`;

      const supabase = createSupabaseBrowserClient();
      const { error: uploadErr } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, audioBlob, {
          upsert: false,
          contentType: baseMime,
        });

      if (uploadErr) {
        toast.error(uploadErr.message);
        return;
      }

      const res = await sharedSendMessageAction({
        conversationId: conv.id,
        body: "Voice message",
        messageType: "voice",
        voiceDurationSeconds: elapsedSeconds,
        attachment: {
          fileName,
          mimeType: baseMime,
          fileSizeBytes: audioBlob.size,
          storagePath,
        },
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      router.refresh();
    } finally {
      setSendingVoice(false);
      recordedChunksRef.current = [];
    }
  }

  function handleSendReply() {
    if (!activeConv) return;
    const text =
      replyBody.trim() ||
      (pendingAttachment
        ? `Shared attachment: ${pendingAttachment.fileName}`
        : "");
    if (!text) return;

    startTransition(async () => {
      const res = await sharedSendMessageAction({
        conversationId: activeConv.id,
        body: text,
        messageType: pendingAttachment
          ? pendingAttachment.mimeType.startsWith("audio/")
            ? "voice"
            : "file"
          : "text",
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

  function handleDeleteAnnouncement(recipientRowId: string) {
    startTransition(async () => {
      const res = await sharedDeleteNotificationAction({
        recipientId: recipientRowId,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Announcement deleted.");
      router.refresh();
    });
  }

  const totalUnreadChats = data.conversations.reduce(
    (sum, c) => sum + c.unreadCount,
    0,
  );
  const unreadAnnouncements = data.announcements.filter(
    (a) => !a.isRead,
  ).length;

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
            Private chats, voice messages, course group chats, and official
            announcements.
          </p>
        </div>

        {canCreateGroup && (
          <Button
            type="button"
            variant="gold"
            size="sm"
            onClick={() => setGroupDialogOpen(true)}
          >
            <Users className="size-4" />
            <span>New Group Chat</span>
          </Button>
        )}
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

            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Search ${sidebarTab === "contacts" ? contactsLabel.toLowerCase() : "chats & groups"}...`}
                  className="h-9 border-white/10 bg-[#0F1115]/55 pl-8 text-xs backdrop-blur-md"
                />
              </div>
              {canCreateGroup && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 shrink-0 px-2.5"
                  title="Create Group Chat"
                  onClick={() => setGroupDialogOpen(true)}
                >
                  <Plus className="size-3.5 text-emerald-400" />
                  <Users className="size-3.5 text-emerald-400" />
                </Button>
              )}
            </div>
          </CardHeader>

          <CardContent className="flex-1 space-y-1.5 overflow-y-auto p-2.5 text-xs">
            {sidebarTab === "chats" && (
              <>
                {filteredConversations.length === 0 ? (
                  <EmptyState
                    icon={MessageSquare}
                    title="No active chats"
                    description={`Switch to the ${contactsLabel} tab above to start a direct chat${canCreateGroup ? " or create a group chat" : ""}.`}
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
                        {conv.isGroup ? (
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                            <Users className="size-4" />
                          </span>
                        ) : conv.peerAvatarUrl ? (
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
                            <div className="flex min-w-0 items-center gap-1.5">
                              <p className="truncate font-semibold text-foreground">
                                {conv.peerName}
                              </p>
                              {conv.isGroup && (
                                <Badge
                                  variant="outline"
                                  className="shrink-0 border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0 text-[9px] text-emerald-400"
                                >
                                  Group
                                </Badge>
                              )}
                            </div>
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
                  <div
                    key={ann.id}
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
                      "group relative w-full cursor-pointer rounded-xl border p-3 text-left transition-colors",
                      activeAnnouncement?.id === ann.id
                        ? "border-emerald-500/45 bg-[#0F1115]/65"
                        : "border-white/10 bg-[#0F1115]/45 hover:bg-[#0F1115]/60",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 pe-6">
                      <span className="truncate font-semibold text-foreground">
                        {ann.title}
                      </span>
                      {!ann.isRead && (
                        <Badge className="bg-emerald-500 text-white">New</Badge>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteAnnouncement(ann.recipientRowId);
                      }}
                      className="absolute top-2.5 right-2.5 rounded-md p-1 text-muted-foreground opacity-70 transition-colors hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
                      title="Delete announcement"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {ann.body}
                    </p>
                    <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                      {ann.createdAt.slice(0, 16).replace("T", " ")}
                    </p>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <Card className={cn(TRANSLUCENT_PANEL, "lg:col-span-8")}>
          {sidebarTab === "announcements" && activeAnnouncement ? (
            <div className="flex h-full flex-col justify-between p-6">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500 text-white">
                      <Megaphone className="mr-1 size-3.5" />
                      Official Platform Announcement
                    </Badge>
                    <span className="font-mono text-xs text-muted-foreground">
                      {activeAnnouncement.createdAt
                        .slice(0, 16)
                        .replace("T", " ")}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isPending}
                    onClick={() =>
                      handleDeleteAnnouncement(
                        activeAnnouncement.recipientRowId,
                      )
                    }
                    className="border-destructive/30 text-destructive hover:bg-destructive/15"
                  >
                    <Trash2 className="size-3.5" />
                    <span>Delete</span>
                  </Button>
                </div>
                <CardTitle className="text-xl">
                  {activeAnnouncement.title}
                </CardTitle>
                <div className="rounded-xl border border-white/10 bg-[#0F1115]/55 p-4 text-sm leading-relaxed whitespace-pre-wrap text-foreground backdrop-blur-md">
                  {activeAnnouncement.body}
                </div>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#0F1115]/55 px-4 py-3 text-center text-xs text-muted-foreground">
                Platform announcements remain visible until you explicitly
                delete them.
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
                  {activeConv.isGroup ? (
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/15 text-emerald-400">
                      <Users className="size-5" />
                    </span>
                  ) : activeConv.peerAvatarUrl ? (
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
                    <div className="flex items-center gap-2">
                      <CardTitle className="truncate text-base">
                        {activeConv.peerName}
                      </CardTitle>
                      {activeConv.isGroup && (
                        <Badge
                          variant="outline"
                          className="border-emerald-500/30 bg-emerald-500/10 text-[10px] text-emerald-400"
                        >
                          Group Chat
                        </Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted-foreground">
                      <span className="capitalize">{activeConv.peerRole}</span>
                      {activeConv.courseTitle
                        ? ` • ${activeConv.courseTitle}`
                        : ""}
                      {activeConv.isGroup &&
                      activeConv.participantNames.length > 0
                        ? ` • ${activeConv.participantNames.join(", ")}`
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
                      Say hello or record a voice message to start your
                      conversation with {activeConv.peerName}.
                    </div>
                  ) : (
                    activeConv.messages.map((msg) => {
                      const isMine = msg.senderId === data.userId;
                      const hasVoiceAttachment = msg.attachments.some(
                        (a) =>
                          msg.messageType === "voice" ||
                          a.mimeType.startsWith("audio/") ||
                          a.fileName.startsWith("voice_"),
                      );
                      const showBodyText =
                        !hasVoiceAttachment ||
                        (msg.body.trim() !== "Voice message" &&
                          msg.body.trim().length > 0);

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

                          {showBodyText && (
                            <p className="leading-relaxed whitespace-pre-wrap">
                              {msg.body}
                            </p>
                          )}

                          {msg.attachments.length > 0 && (
                            <div
                              className={cn(
                                "flex flex-col gap-2",
                                showBodyText ? "mt-2" : "",
                              )}
                            >
                              {msg.attachments.map((att) => {
                                const isAudio =
                                  msg.messageType === "voice" ||
                                  att.mimeType.startsWith("audio/") ||
                                  att.fileName.startsWith("voice_");

                                if (isAudio && att.signedUrl) {
                                  return (
                                    <div
                                      key={att.id}
                                      className={cn(
                                        "flex flex-col gap-1 rounded-xl border p-2",
                                        isMine
                                          ? "border-white/20 bg-black/20"
                                          : "border-emerald-500/25 bg-emerald-500/10",
                                      )}
                                    >
                                      <div className="flex items-center justify-between gap-2 text-[10px]">
                                        <span className="inline-flex items-center gap-1 font-medium">
                                          <Mic className="size-3" />
                                          Voice Message
                                          {msg.voiceDurationSeconds
                                            ? ` (${formatDuration(msg.voiceDurationSeconds)})`
                                            : ""}
                                        </span>
                                        <a
                                          href={att.signedUrl}
                                          download={att.fileName}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 opacity-80 hover:opacity-100"
                                          title="Download voice message"
                                        >
                                          <Download className="size-3" />
                                        </a>
                                      </div>
                                      <audio
                                        controls
                                        preload="metadata"
                                        src={att.signedUrl}
                                        className="h-9 w-full min-w-[210px] max-w-[270px]"
                                      />
                                    </div>
                                  );
                                }

                                return att.signedUrl ? (
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
                                    <span className="truncate">
                                      {att.fileName}
                                    </span>
                                    <Download className="ml-auto size-3.5 shrink-0" />
                                  </a>
                                ) : (
                                  <Badge key={att.id} variant="outline">
                                    <Paperclip className="mr-1 size-3" />
                                    {att.fileName}
                                  </Badge>
                                );
                              })}
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
                              !activeConv.isGroup &&
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

                  {isRecordingVoice || sendingVoice ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5">
                      <div className="flex items-center gap-2.5 text-xs font-semibold text-emerald-300">
                        <span className="size-2.5 animate-pulse rounded-full bg-rose-500" />
                        <span>
                          {sendingVoice
                            ? "Uploading & sending voice message..."
                            : `Recording voice message • ${formatDuration(recordingSeconds)}`}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={sendingVoice}
                          onClick={cancelVoiceRecording}
                          className="h-8 border-white/15 px-2.5 text-xs"
                        >
                          <Trash2 className="size-3.5 text-rose-400" />
                          <span>Cancel</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          disabled={sendingVoice}
                          onClick={() => void finishAndSendVoiceMessage()}
                          className="h-8 bg-emerald-500 px-3 text-xs text-white hover:bg-emerald-600"
                        >
                          {sendingVoice ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Send className="size-3.5" />
                          )}
                          <span>Send Voice</span>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-end gap-2">
                      <label
                        className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-white/10 bg-[#0F1115]/55 px-3 text-muted-foreground backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-foreground"
                        title="Attach document, image, audio, or ZIP (max 25 MB)"
                      >
                        <Paperclip className="size-4 text-emerald-400" />
                        <input
                          type="file"
                          accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.txt,.zip,.mp3,.wav,.m4a,.ogg,.webm"
                          className="hidden"
                          disabled={uploadingAttachment}
                          onChange={handleAttachmentUpload}
                        />
                      </label>

                      <button
                        type="button"
                        disabled={isPending || uploadingAttachment}
                        onClick={() => void startVoiceRecording()}
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-[#0F1115]/55 px-3 text-muted-foreground backdrop-blur-md transition-colors hover:border-emerald-500/50 hover:text-foreground disabled:opacity-50"
                        title="Record voice message"
                      >
                        <Mic className="size-4 text-emerald-400" />
                      </button>

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
                            : "Type a message or click the mic to send a voice note..."
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
                  )}
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>

      {/* Teacher / Admin Create Group Chat Modal */}
      {canCreateGroup && (
        <Dialog open={groupDialogOpen} onOpenChange={setGroupDialogOpen}>
          <DialogContent className="border-white/10 bg-[#0F1115]/95 text-foreground backdrop-blur-xl sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="size-5 text-emerald-400" />
                <span>Create Course Group Chat</span>
              </DialogTitle>
              <DialogDescription>
                Start a collaborative study or course announcement group chat
                with your enrolled students.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-1 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Group Chat Name
                </label>
                <Input
                  value={groupSubject}
                  onChange={(e) => setGroupSubject(e.target.value)}
                  placeholder="e.g., Midterm Review Group or Project Q&A"
                  className="border-white/10 bg-[#141922]"
                />
              </div>

              {data.teacherCourses.length > 0 && (
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Course Scope
                  </label>
                  <select
                    value={groupCourseId}
                    onChange={(e) => {
                      setGroupCourseId(e.target.value);
                      setGroupMemberIds([]);
                    }}
                    className="h-9 w-full rounded-lg border border-white/10 bg-[#141922] px-3 text-xs text-foreground"
                  >
                    <option value="">All My Courses</option>
                    {data.teacherCourses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-semibold text-foreground">
                    Select Students ({groupMemberIds.length} selected)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setGroupMemberIds(
                          groupCandidateContacts.map((c) => c.id),
                        )
                      }
                      className="text-[11px] font-semibold text-emerald-400 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      type="button"
                      onClick={() => setGroupMemberIds([])}
                      className="text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <Input
                  value={groupMemberSearch}
                  onChange={(e) => setGroupMemberSearch(e.target.value)}
                  placeholder="Filter students by name or email..."
                  className="h-8 border-white/10 bg-[#141922] text-xs"
                />

                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-white/10 bg-[#141922]/75 p-2">
                  {groupCandidateContacts.length === 0 ? (
                    <p className="py-6 text-center text-muted-foreground">
                      No enrolled students match this filter.
                    </p>
                  ) : (
                    groupCandidateContacts.map((stu) => {
                      const checked = groupMemberIds.includes(stu.id);
                      return (
                        <label
                          key={stu.id}
                          className={cn(
                            "flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 transition-colors",
                            checked
                              ? "bg-emerald-500/15 text-foreground"
                              : "hover:bg-white/5",
                          )}
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground">
                              {stu.fullName}
                            </p>
                            <p className="truncate text-[10px] text-muted-foreground">
                              {stu.courseTitle || stu.email}
                            </p>
                          </div>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setGroupMemberIds((prev) => [...prev, stu.id]);
                              } else {
                                setGroupMemberIds((prev) =>
                                  prev.filter((id) => id !== stu.id),
                                );
                              }
                            }}
                            className="size-4 accent-emerald-500"
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">
                  Initial Message (optional)
                </label>
                <Textarea
                  rows={2}
                  value={groupInitialMessage}
                  onChange={(e) => setGroupInitialMessage(e.target.value)}
                  placeholder="Welcome everyone! Feel free to post your course questions here."
                  className="border-white/10 bg-[#141922] text-xs"
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setGroupDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="gold"
                disabled={isPending || !groupSubject.trim() || groupMemberIds.length === 0}
                onClick={handleCreateGroupChat}
              >
                {isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Users className="size-4" />
                )}
                <span>Create Group ({groupMemberIds.length})</span>
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
