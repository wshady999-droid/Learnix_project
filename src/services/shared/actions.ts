"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export async function sharedMarkNotificationReadAction(params: {
  recipientId?: string;
  markAll?: boolean;
}): Promise<ServiceResult<{ updated: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();

  if (params.markAll) {
    const { error } = await supabase
      .from("notification_recipients")
      .update({ is_read: true, read_at: nowIso })
      .eq("recipient_id", auth.data.userId)
      .eq("is_read", false);
    if (error) return { ok: false, error: error.message };
  } else if (params.recipientId) {
    const { error } = await supabase
      .from("notification_recipients")
      .update({ is_read: true, read_at: nowIso })
      .eq("id", params.recipientId)
      .eq("recipient_id", auth.data.userId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

const createConversationSchema = z.object({
  recipientId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().min(2).max(160),
  body: z.string().trim().min(1).max(4000),
});

export async function sharedStartConversationAction(
  input: z.infer<typeof createConversationSchema>,
): Promise<ServiceResult<{ conversationId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = createConversationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message payload.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const senderId = auth.data.userId;

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      created_by: senderId,
      course_id: parsed.data.courseId ?? null,
      subject: parsed.data.subject,
      is_group: false,
    })
    .select("id")
    .single();

  if (convErr || !conv) {
    return {
      ok: false,
      error: convErr?.message ?? "Failed to start conversation.",
    };
  }

  const { error: partErr } = await supabase
    .from("conversation_participants")
    .insert([
      { conversation_id: conv.id, user_id: senderId },
      { conversation_id: conv.id, user_id: parsed.data.recipientId },
    ]);

  if (partErr) return { ok: false, error: partErr.message };

  const { error: msgErr } = await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: senderId,
    body: parsed.data.body,
  });

  if (msgErr) return { ok: false, error: msgErr.message };

  // Send notification to recipient
  const { data: notif } = await supabase
    .from("notifications")
    .insert({
      title: `New Message: ${parsed.data.subject}`,
      body: parsed.data.body.slice(0, 180),
      notification_type: "message",
      target_scope: "direct",
      course_id: parsed.data.courseId ?? null,
      sender_id: senderId,
      action_url: "/messages",
      sent_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (notif) {
    await supabase.from("notification_recipients").insert({
      notification_id: notif.id,
      recipient_id: parsed.data.recipientId,
      is_read: false,
    });
  }

  revalidatePath("/messages");
  return { ok: true, data: { conversationId: conv.id } };
}

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  attachment: z
    .object({
      fileName: z.string().min(1).max(200),
      mimeType: z.string().min(1).max(120),
      fileSizeBytes: z.number().int().min(1).max(25 * 1024 * 1024),
      storagePath: z.string().min(1).max(500),
    })
    .nullable()
    .optional(),
});

export async function sharedSendMessageAction(
  input: z.infer<typeof sendMessageSchema>,
): Promise<ServiceResult<{ messageId: string }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid message.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const senderId = auth.data.userId;
  const nowIso = new Date().toISOString();

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: senderId,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (msgErr || !msg) {
    return { ok: false, error: msgErr?.message ?? "Failed to send message." };
  }

  if (parsed.data.attachment) {
    await supabase.from("message_attachments").insert({
      message_id: msg.id,
      file_name: parsed.data.attachment.fileName,
      mime_type: parsed.data.attachment.mimeType,
      file_size_bytes: parsed.data.attachment.fileSizeBytes,
      storage_path: parsed.data.attachment.storagePath,
    });
  }

  await supabase
    .from("conversations")
    .update({ last_message_at: nowIso })
    .eq("id", parsed.data.conversationId);

  await supabase
    .from("conversation_participants")
    .update({ last_read_at: nowIso })
    .eq("conversation_id", parsed.data.conversationId)
    .eq("user_id", senderId);

  revalidatePath("/messages");
  return { ok: true, data: { messageId: msg.id } };
}
