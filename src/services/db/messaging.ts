import "server-only";

import { z } from "zod";

import { isSupabaseConfigured } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type ConversationRow = TableRow<"conversations">;
export type MessageRow = TableRow<"messages">;
export type MessageAttachmentRow = TableRow<"message_attachments">;
export type ContactMessageRow = TableRow<"contact_messages">;

export const publicContactMessageSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(160),
  subject: z.string().trim().min(4).max(120),
  message: z.string().trim().min(15).max(1500),
  locale: z.enum(["en", "ar", "de", "it", "fr"]).default("en"),
});

export async function submitPublicContactMessage(
  input: z.infer<typeof publicContactMessageSchema>,
): Promise<ServiceResult<{ submitted: true }>> {
  const parsed = publicContactMessageSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid contact message input.",
    };
  }

  if (!isSupabaseConfigured()) {
    return { ok: true, data: { submitted: true } };
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("contact_messages").insert({
    full_name: parsed.data.fullName,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    locale: parsed.data.locale,
    status: "pending",
  });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { submitted: true } };
}

export async function listMyConversations(): Promise<ServiceResult<ConversationRow[]>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("*")
    .order("last_message_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function sendConversationMessage(params: {
  conversationId: string;
  body: string;
  replyToId?: string | null;
}): Promise<ServiceResult<MessageRow>> {
  const trimmed = params.body.trim();
  if (!trimmed) {
    return { ok: false, error: "Message body cannot be empty." };
  }

  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      sender_id: actorResult.data.userId,
      body: trimmed,
      reply_to_id: params.replyToId ?? null,
    })
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}
