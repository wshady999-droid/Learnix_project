"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  MessageSquare,
  Paperclip,
  Plus,
  Send,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input, Textarea, fieldBase } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  sharedSendMessageAction,
  sharedStartConversationAction,
} from "@/services/shared/actions";
import type { MessagingContactsData } from "@/services/shared/queries";

interface MessagingClientProps {
  data: MessagingContactsData;
}

export function MessagingClient({ data }: MessagingClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [selectedConvId, setSelectedConvId] = useState<string>(
    data.conversations[0]?.id ?? "",
  );
  const [replyBody, setReplyBody] = useState("");
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    storagePath: string;
  } | null>(null);

  // New conversation dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [recipientId, setRecipientId] = useState(
    data.authorizedContacts[0]?.id ?? "",
  );
  const [subject, setSubject] = useState("");
  const [firstBody, setFirstBody] = useState("");

  const activeConv =
    data.conversations.find((c) => c.id === selectedConvId) ??
    data.conversations[0] ??
    null;

  const dashboardHref =
    data.role === "admin"
      ? "/admin"
      : data.role === "teacher"
        ? "/teacher"
        : "/student";

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
      const storagePath = `${activeConv.id}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage
        .from("message-attachments")
        .upload(storagePath, file, { upsert: true });

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

  function handleStartConversation() {
    const contact = data.authorizedContacts.find((c) => c.id === recipientId);
    if (!contact) {
      toast.error("Select an authorized recipient.");
      return;
    }

    startTransition(async () => {
      const res = await sharedStartConversationAction({
        recipientId: contact.id,
        courseId: contact.courseId,
        subject,
        body: firstBody,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Conversation started and recipient notified.");
      setNewDialogOpen(false);
      setSubject("");
      setFirstBody("");
      setSelectedConvId(res.data.conversationId);
      router.refresh();
    });
  }

  function handleSendReply() {
    if (!activeConv || !replyBody.trim()) return;
    startTransition(async () => {
      const res = await sharedSendMessageAction({
        conversationId: activeConv.id,
        body: replyBody.trim(),
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

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={dashboardHref}>
              <ArrowLeft className="size-4" />
              <span>Back to Dashboard</span>
            </Link>
          </Button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Internal Academic Messaging
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Secure student-teacher communication with file attachments and notification alerts.
          </p>
        </div>

        <Button
          variant="gold"
          size="sm"
          disabled={data.authorizedContacts.length === 0}
          onClick={() => setNewDialogOpen(true)}
        >
          <Plus className="size-4" />
          <span>New Conversation</span>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="lg:col-span-4">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">
              Conversations ({data.conversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            {data.conversations.length === 0 ? (
              <EmptyState
                icon={MessageSquare}
                title="No conversations yet"
                description="Start a secure message thread with an authorized teacher or student."
              />
            ) : (
              data.conversations.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onClick={() => setSelectedConvId(conv.id)}
                  className={
                    activeConv?.id === conv.id
                      ? "w-full rounded-xl border border-gold-primary bg-gold-primary/10 p-3 text-left"
                      : "w-full rounded-xl border border-border/70 p-3 text-left hover:bg-muted/50"
                  }
                >
                  <p className="truncate font-semibold text-foreground">
                    {conv.subject}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                    {conv.participantNames.join(", ")}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    {conv.lastMessageAt.slice(0, 16).replace("T", " ")}
                  </p>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col lg:col-span-8">
          {!activeConv ? (
            <CardContent className="flex h-80 items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Select a conversation"
                description="Choose a thread from the left or start a new authorized conversation."
              />
            </CardContent>
          ) : (
            <>
              <CardHeader className="border-b border-border/70 pb-3">
                <CardTitle className="text-base">{activeConv.subject}</CardTitle>
                <CardDescription className="text-xs">
                  Participants: {activeConv.participantNames.join(", ")}
                  {activeConv.courseTitle ? ` • ${activeConv.courseTitle}` : ""}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col justify-between gap-4 pt-4">
                <div className="max-h-[400px] min-h-[240px] space-y-3 overflow-y-auto pr-1 text-xs">
                  {activeConv.messages.map((msg) => {
                    const isMine = msg.senderId === data.userId;
                    return (
                      <div
                        key={msg.id}
                        className={
                          isMine
                            ? "ml-auto max-w-[82%] rounded-2xl bg-charcoal p-3 text-white"
                            : "mr-auto max-w-[82%] rounded-2xl border border-border/80 bg-muted/40 p-3 text-foreground"
                        }
                      >
                        <div className="flex items-center justify-between gap-3 text-[10px] opacity-75">
                          <span className="font-semibold">{msg.senderName}</span>
                          <span className="font-mono">
                            {msg.createdAt.slice(11, 16)}
                          </span>
                        </div>
                        <p className="mt-1 whitespace-pre-wrap">{msg.body}</p>
                        {msg.attachments.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {msg.attachments.map((att) => (
                              <Badge key={att.id} variant="gold">
                                <Paperclip className="mr-1 size-3" />
                                {att.fileName}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-2 border-t border-border/70 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <label className="flex cursor-pointer items-center gap-1.5 text-muted-foreground hover:text-foreground">
                      <Paperclip className="size-3.5 text-gold-foreground" />
                      <span>
                        {uploadingAttachment
                          ? "Uploading attachment..."
                          : pendingAttachment
                            ? `Attached: ${pendingAttachment.fileName}`
                            : "Attach PDF / Image (≤ 25 MB)"}
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        disabled={uploadingAttachment}
                        onChange={handleAttachmentUpload}
                      />
                    </label>
                  </div>

                  <div className="flex gap-2">
                    <Textarea
                      rows={2}
                      value={replyBody}
                      onChange={(e) => setReplyBody(e.target.value)}
                      placeholder="Write a message..."
                      className="flex-1"
                    />
                    <Button
                      variant="gold"
                      disabled={isPending || !replyBody.trim()}
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

      {/* NEW CONVERSATION DIALOG */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Start Authorized Conversation</DialogTitle>
            <DialogDescription>
              Only authorized course teachers and enrolled students appear in your contact list.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Recipient</Label>
              <select
                className={cn(fieldBase, "h-9 w-full")}
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
              >
                {data.authorizedContacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.role})
                    {c.courseTitle ? ` — ${c.courseTitle}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Question about Module 2 / Assignment clarification"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea
                rows={4}
                value={firstBody}
                onChange={(e) => setFirstBody(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="gold"
              disabled={isPending}
              onClick={handleStartConversation}
            >
              Send Message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
