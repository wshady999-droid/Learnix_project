"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export async function sharedMarkNotificationReadAction(params: {
  recipientId?: string;
  isRead?: boolean;
  markAll?: boolean;
}): Promise<ServiceResult<{ updated: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const nowIso = new Date().toISOString();
  const nextRead = params.isRead ?? true;

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
      .update({
        is_read: nextRead,
        read_at: nextRead ? nowIso : null,
      })
      .eq("id", params.recipientId)
      .eq("recipient_id", auth.data.userId);
    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/notifications");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  return { ok: true, data: { updated: true } };
}

/**
 * Explicitly deletes an individual notification recipient entry or all notifications
 * for the signed-in user. Notifications remain persistently until explicitly deleted.
 */
export async function sharedDeleteNotificationAction(params: {
  recipientId?: string;
  deleteAll?: boolean;
}): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();

  if (params.deleteAll) {
    const { error } = await supabase
      .from("notification_recipients")
      .delete()
      .eq("recipient_id", auth.data.userId);
    if (error) return { ok: false, error: error.message };
  } else if (params.recipientId) {
    const { error } = await supabase
      .from("notification_recipients")
      .delete()
      .eq("id", params.recipientId)
      .eq("recipient_id", auth.data.userId);
    if (error) return { ok: false, error: error.message };
  } else {
    return { ok: false, error: "Select a notification to delete." };
  }

  revalidatePath("/notifications");
  revalidatePath("/messages");
  revalidatePath("/student");
  revalidatePath("/teacher");
  revalidatePath("/admin");
  return { ok: true, data: { deleted: true } };
}

const notifPrefsSchema = z.object({
  email_updates: z.boolean(),
  course_alerts: z.boolean(),
  exam_reminders: z.boolean(),
  grade_notifications: z.boolean(),
  security_alerts: z.boolean(),
});

export async function sharedUpdateNotificationPreferencesAction(
  input: z.infer<typeof notifPrefsSchema>,
): Promise<ServiceResult<{ updated: true }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = notifPrefsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid notification preferences." };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("profiles")
    .update({ notification_preferences: parsed.data })
    .eq("id", auth.data.userId);

  if (error) return { ok: false, error: error.message };

  revalidatePath("/notifications");
  revalidatePath("/profile");
  revalidatePath("/student/profile");
  return { ok: true, data: { updated: true } };
}

const createConversationSchema = z.object({
  recipientId: z.string().uuid(),
  courseId: z.string().uuid().nullable().optional(),
  subject: z.string().trim().min(2).max(160).optional(),
  body: z.string().trim().max(4000).optional(),
});

/**
 * Opens an existing 1-on-1 conversation with `recipientId` if one exists,
 * or creates a new authorized conversation (and optionally sends the initial message).
 */
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
  const senderName = auth.data.fullName?.trim() || auth.data.email || "User";
  const nowIso = new Date().toISOString();

  // Check if a 1-on-1 direct conversation already exists between senderId & recipientId
  const { data: myParts } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("user_id", senderId);

  const myConvIds = (myParts ?? []).map((p) => p.conversation_id);
  let convId: string | null = null;

  if (myConvIds.length > 0) {
    const { data: sharedParts } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .in("conversation_id", myConvIds)
      .eq("user_id", parsed.data.recipientId);

    const candidateIds = (sharedParts ?? []).map((p) => p.conversation_id);
    if (candidateIds.length > 0) {
      const { data: directConv } = await supabase
        .from("conversations")
        .select("id")
        .in("id", candidateIds)
        .eq("is_group", false)
        .order("last_message_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (directConv) {
        convId = directConv.id;
      }
    }
  }

  if (!convId) {
    const { data: conv, error: convErr } = await supabase
      .from("conversations")
      .insert({
        created_by: senderId,
        course_id: parsed.data.courseId ?? null,
        subject: parsed.data.subject?.trim() || "Direct Academic Chat",
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

    convId = conv.id;

    const { error: partErr } = await supabase
      .from("conversation_participants")
      .insert([
        { conversation_id: convId, user_id: senderId, last_read_at: nowIso },
        { conversation_id: convId, user_id: parsed.data.recipientId },
      ]);

    if (partErr) return { ok: false, error: partErr.message };
  }

  const trimmedBody = parsed.data.body?.trim() ?? "";
  if (trimmedBody.length > 0) {
    const { error: msgErr } = await supabase.from("messages").insert({
      conversation_id: convId,
      sender_id: senderId,
      body: trimmedBody,
      message_type: "text",
    });

    if (msgErr) return { ok: false, error: msgErr.message };

    await supabase.rpc("dispatch_event_notification", {
      p_recipient_ids: [parsed.data.recipientId],
      p_type: "message",
      p_title: `New Message from ${senderName}`,
      p_body: trimmedBody.slice(0, 180),
      p_course_id: parsed.data.courseId ?? undefined,
      p_action_url: `/messages?convId=${convId}`,
      p_metadata: { conversationId: convId },
      p_is_announcement: false,
      p_target_scope: "individual",
    });
  }

  revalidatePath("/messages");
  return { ok: true, data: { conversationId: convId } };
}

const createGroupChatSchema = z.object({
  subject: z.string().trim().min(2, "Group name is required.").max(140),
  courseId: z.string().uuid().nullable().optional(),
  participantIds: z
    .array(z.string().uuid())
    .min(1, "Select at least one student for the group chat."),
  initialMessage: z.string().trim().max(2000).optional(),
});

/**
 * Allows teachers (and admins) to create a course/study group chat with enrolled students.
 */
export async function sharedCreateGroupConversationAction(
  input: z.infer<typeof createGroupChatSchema>,
): Promise<ServiceResult<{ conversationId: string }>> {
  const auth = await requireRole(["teacher", "admin"]);
  if (!auth.ok) return auth;

  const parsed = createGroupChatSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid group chat details.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const creatorId = auth.data.userId;
  const creatorName =
    auth.data.fullName?.trim() || auth.data.email || "Instructor";
  const nowIso = new Date().toISOString();

  if (auth.data.role === "teacher" && parsed.data.courseId) {
    const { data: courseRow } = await supabase
      .from("courses")
      .select("id, teacher_id")
      .eq("id", parsed.data.courseId)
      .maybeSingle();
    if (!courseRow || courseRow.teacher_id !== creatorId) {
      return { ok: false, error: "You do not own the selected course." };
    }
  }

  const uniqueMemberIds = Array.from(
    new Set(parsed.data.participantIds.filter((id) => id !== creatorId)),
  );
  if (uniqueMemberIds.length === 0) {
    return {
      ok: false,
      error: "Select at least one student to add to the group chat.",
    };
  }

  const { data: conv, error: convErr } = await supabase
    .from("conversations")
    .insert({
      created_by: creatorId,
      course_id: parsed.data.courseId ?? null,
      subject: parsed.data.subject,
      is_group: true,
    })
    .select("id")
    .single();

  if (convErr || !conv) {
    return {
      ok: false,
      error: convErr?.message ?? "Failed to create group chat.",
    };
  }

  const participantRows = [
    { conversation_id: conv.id, user_id: creatorId, last_read_at: nowIso },
    ...uniqueMemberIds.map((uid) => ({
      conversation_id: conv.id,
      user_id: uid,
    })),
  ];

  const { error: partErr } = await supabase
    .from("conversation_participants")
    .insert(participantRows);

  if (partErr) {
    return { ok: false, error: partErr.message };
  }

  const welcomeBody =
    parsed.data.initialMessage?.trim() ||
    `Welcome to "${parsed.data.subject}"!`;

  await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: creatorId,
    body: welcomeBody,
    message_type: "text",
  });

  await supabase.rpc("dispatch_event_notification", {
    p_recipient_ids: uniqueMemberIds,
    p_type: "message",
    p_title: `Added to Group Chat: ${parsed.data.subject}`,
    p_body: `${creatorName} added you to "${parsed.data.subject}".`,
    p_course_id: parsed.data.courseId ?? undefined,
    p_action_url: `/messages?convId=${conv.id}`,
    p_metadata: { conversationId: conv.id, isGroup: true },
    p_is_announcement: false,
    p_target_scope: "class",
  });

  revalidatePath("/messages");
  return { ok: true, data: { conversationId: conv.id } };
}

const sendMessageSchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(4000),
  messageType: z.enum(["text", "voice", "file", "system"]).default("text"),
  voiceDurationSeconds: z.coerce.number().int().min(0).max(3600).nullable().optional(),
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
  const senderName = auth.data.fullName?.trim() || auth.data.email || "User";
  const nowIso = new Date().toISOString();

  const resolvedType =
    parsed.data.messageType !== "text"
      ? parsed.data.messageType
      : parsed.data.attachment
        ? parsed.data.attachment.mimeType.startsWith("audio/")
          ? "voice"
          : "file"
        : "text";

  const { data: msg, error: msgErr } = await supabase
    .from("messages")
    .insert({
      conversation_id: parsed.data.conversationId,
      sender_id: senderId,
      body: parsed.data.body,
      message_type: resolvedType,
      voice_duration_seconds: parsed.data.voiceDurationSeconds ?? null,
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
    .from("conversation_participants")
    .update({ last_read_at: nowIso })
    .eq("conversation_id", parsed.data.conversationId)
    .eq("user_id", senderId);

  // Notify all other conversation participants
  const [{ data: otherParts }, { data: convRow }] = await Promise.all([
    supabase
      .from("conversation_participants")
      .select("user_id")
      .eq("conversation_id", parsed.data.conversationId)
      .neq("user_id", senderId),
    supabase
      .from("conversations")
      .select("course_id, is_group, subject")
      .eq("id", parsed.data.conversationId)
      .maybeSingle(),
  ]);

  const recipientIds = (otherParts ?? []).map((p) => p.user_id);
  if (recipientIds.length > 0) {
    const title = convRow?.is_group
      ? `${senderName} in ${convRow.subject || "Group Chat"}`
      : `New Message from ${senderName}`;
    const previewBody =
      resolvedType === "voice"
        ? "Sent a voice message"
        : parsed.data.body.slice(0, 180);

    await supabase.rpc("dispatch_event_notification", {
      p_recipient_ids: recipientIds,
      p_type: "message",
      p_title: title,
      p_body: previewBody,
      p_course_id: convRow?.course_id ?? undefined,
      p_action_url: `/messages?convId=${parsed.data.conversationId}`,
      p_metadata: { conversationId: parsed.data.conversationId },
      p_is_announcement: false,
      p_target_scope: convRow?.is_group ? "class" : "individual",
    });
  }

  revalidatePath("/messages");
  return { ok: true, data: { messageId: msg.id } };
}

export async function sharedMarkConversationReadAction(
  conversationId: string,
): Promise<ServiceResult<{ marked: true }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("user_id", auth.data.userId);

  return { ok: true, data: { marked: true } };
}
