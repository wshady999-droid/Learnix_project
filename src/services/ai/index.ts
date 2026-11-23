import "server-only";

import type { UserRole } from "@/types/navigation";

export interface AiPromptContext {
  role: UserRole;
  locale: "en" | "ar";
  courseId?: string;
}

export interface AiCompletionRequest {
  prompt: string;
  context: AiPromptContext;
  maxTokens?: number;
}

export interface AiCompletionResponse {
  content: string;
  model: string;
  createdAt: string;
}

/**
 * Contract for server-side AI services (tutoring, quiz generation, rubric grading).
 * Implementations are wired in later parts using server-only credentials.
 */
export interface AiServiceProvider {
  readonly name: string;
  complete(request: AiCompletionRequest): Promise<AiCompletionResponse>;
}
