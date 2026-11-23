import "server-only";

import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getAuthenticatedActor, requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export type NotificationRow = TableRow<"notifications">;
export type NotificationRecipientRow = TableRow<"notification_recipients">;

const broadcastNotificationSchema = z.object({
  course_id: z.string().uuid().nullable().optional(),
  notification_type: z
    .enum(["system", "course", "exam", "assignment", "grade", "message", "attendance"])
    .default("system"),
  title: z.string().trim().min(2).max(160),
  body: z.string().trim().min(2).max(2000),
  action_url: z.string().trim().max(500).nullable().optional(),
  recipient_ids: z.array(z.string().uuid()).min(1),
});

export async function listMyNotifications(): Promise<
  ServiceResult<Array<NotificationRecipientRow & { notification: NotificationRow | null }>>
> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .select("*, notification:notifications(*)")
    .eq("recipient_id", actorResult.data.userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data ?? [] };
}

export async function markNotificationRead(
  notificationRecipientId: string,
): Promise<ServiceResult<NotificationRecipientRow>> {
  const actorResult = await getAuthenticatedActor();
  if (!actorResult.ok) return actorResult;
  if (!actorResult.data) return { ok: false, error: "Authentication required." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notification_recipients")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationRecipientId)
    .eq("recipient_id", actorResult.data.userId)
    .select("*")
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, data };
}

export async function broadcastNotification(
  input: z.infer<typeof broadcastNotificationSchema>,
): Promise<ServiceResult<NotificationRow>> {
  const parsed = broadcastNotificationSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid notification payload.",
    };
  }

  const actorResult = await requireRole(["teacher", "admin"]);
  if (!actorResult.ok) return actorResult;

  const supabase = await createSupabaseServerClient();
  const { data: notification, error: notifError } = await supabase
    .from("notifications")
    .insert({
      sender_id: actorResult.data.userId,
      course_id: parsed.data.course_id ?? null,
      notification_type: parsed.data.notification_type,
      title: parsed.data.title,
      body: parsed.data.body,
      action_url: parsed.data.action_url ?? null,
    })
    .select("*")
    .single();

  if (notifError || !notification) {
    return { ok: false, error: notifError?.message ?? "Failed to create notification." };
  }

  const recipientsPayload = parsed.data.recipient_ids.map((recipientId) => ({
    notification_id: notification.id,
    recipient_id: recipientId,
  }));

  const { error: recipientsError } = await supabase
    .from("notification_recipients")
    .insert(recipientsPayload);

  if (recipientsError) return { ok: false, error: recipientsError.message };
  return { ok: true, data: notification };
}
