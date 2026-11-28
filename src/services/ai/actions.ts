"use server";

import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export async function aiSubmitMessageFeedbackAction(params: {
  messageId: string;
  rating: -1 | 1;
}): Promise<ServiceResult<{ saved: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("ai_messages")
    .update({ feedback_rating: params.rating })
    .eq("id", params.messageId)
    .eq("user_id", auth.data.userId);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/student/ai-assistant");
  revalidatePath("/teacher/ai-assistant");
  return { ok: true, data: { saved: true } };
}

export async function aiDeleteConversationAction(
  conversationId: string,
): Promise<ServiceResult<{ deleted: boolean }>> {
  const auth = await requireRole(["student", "teacher", "admin"]);
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  
  // حذف المحادثة بشرط أن تكون ملك المستخدم الحالي
  const { error } = await supabase
    .from("ai_conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", auth.data.userId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/student/ai-assistant");
  revalidatePath("/teacher/ai-assistant");
  return { ok: true, data: { deleted: true } };
}