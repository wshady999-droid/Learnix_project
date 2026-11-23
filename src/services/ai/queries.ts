import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireRole, type TableRow } from "@/services/db/utils";
import type { ServiceResult } from "@/types";

export interface AiWorkspaceHistoryData {
  conversations: Array<TableRow<"ai_conversations">>;
  messages: Array<TableRow<"ai_messages">>;
  indexedDocuments: Array<{
    sourceTitle: string;
    sourceType: string;
    courseId: string;
    chunksCount: number;
  }>;
  hasActiveOfficialExam: boolean;
}

export async function getAiWorkspaceHistoryData(
  roleContext: "student" | "teacher",
): Promise<ServiceResult<AiWorkspaceHistoryData>> {
  const auth = await requireRole(
    roleContext === "teacher"
      ? ["teacher", "admin"]
      : ["student", "teacher", "admin"],
  );
  if (!auth.ok) return auth;

  const supabase = await createSupabaseServerClient();
  const userId = auth.data.userId;

  const [convsRes, chunksRes, activeExamRes] = await Promise.all([
    supabase
      .from("ai_conversations")
      .select("*")
      .eq("user_id", userId)
      .eq("role_context", roleContext)
      .order("updated_at", { ascending: false })
      .limit(20),
    supabase
      .from("ai_document_chunks")
      .select("course_id, source_title, source_type")
      .order("created_at", { ascending: false })
      .limit(200),
    roleContext === "student"
      ? supabase
          .from("exam_attempts")
          .select("id")
          .eq("student_id", userId)
          .eq("status", "in_progress")
          .gt("expires_at", new Date().toISOString())
          .limit(1)
      : Promise.resolve({ data: [] as Array<{ id: string }>, error: null }),
  ]);

  const conversations = convsRes.data ?? [];
  const convIds = conversations.map((c) => c.id);

  const messagesRes =
    convIds.length > 0
      ? await supabase
          .from("ai_messages")
          .select("*")
          .in("conversation_id", convIds)
          .eq("user_id", userId)
          .order("created_at", { ascending: true })
      : { data: [] as Array<TableRow<"ai_messages">>, error: null };

  const docMap = new Map<
    string,
    { sourceTitle: string; sourceType: string; courseId: string; chunksCount: number }
  >();
  for (const ch of chunksRes.data ?? []) {
    const key = `${ch.course_id}::${ch.source_title}`;
    const existing = docMap.get(key);
    if (existing) {
      existing.chunksCount += 1;
    } else {
      docMap.set(key, {
        sourceTitle: ch.source_title,
        sourceType: ch.source_type,
        courseId: ch.course_id,
        chunksCount: 1,
      });
    }
  }

  return {
    ok: true,
    data: {
      conversations,
      messages: messagesRes.data ?? [],
      indexedDocuments: Array.from(docMap.values()),
      hasActiveOfficialExam: (activeExamRes.data ?? []).length > 0,
    },
  };
}
