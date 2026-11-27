import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const GROQ_BASE_URL = "https://api.groq.com/openai/v1";
const GROQ_CHAT_COMPLETIONS_URL = `${GROQ_BASE_URL}/chat/completions`;
const GROQ_AUDIO_TRANSCRIPTIONS_URL = `${GROQ_BASE_URL}/audio/transcriptions`;
const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface InlineMediaPart {
  fileName?: string;
  mimeType: string;
  base64Data: string;
  kind?: "image" | "audio" | "document";
}

interface GroqToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface GroqChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | null;
  tool_calls?: GroqToolCall[];
  tool_call_id?: string;
  name?: string;
}

interface EdgeAiRequest {
  mode: "generate" | "agent_turn";
  task?: string;
  roleContext?: "student" | "teacher" | "admin";
  courseId?: string | null;
  systemInstruction: string;
  userPrompt?: string;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  mediaParts?: InlineMediaPart[];
  messages?: GroqChatMessage[];
  tools?: Array<Record<string, unknown>>;
}

interface GroqCallOutcome {
  ok: boolean;
  status: number;
  modelUsed: string;
  message?: {
    role?: string;
    content?: string | null;
    tool_calls?: GroqToolCall[];
  };
  errorCode?: string;
  errorMessage?: string;
  retryAfterSeconds?: number;
}

/**
 * Models on Groq known to support OpenAI-compatible JSON object mode (`response_format: { type: "json_object" }`).
 */
function supportsGroqJsonObjectMode(model: string): boolean {
  const lower = model.toLowerCase();
  return (
    lower.includes("gpt-oss") ||
    lower.startsWith("openai/") ||
    lower.includes("qwen") ||
    lower.includes("llama-3") ||
    lower.includes("llama3") ||
    lower.includes("mixtral") ||
    lower.includes("gemma") ||
    lower.includes("deepseek")
  );
}

/**
 * Recursively normalizes tool parameter schemas (including legacy uppercase types)
 * into strict lowercase JSON Schema required by Groq's OpenAI-compatible tool calling.
 */
function normalizeJsonSchema(schema: unknown): Record<string, unknown> {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return { type: "object", properties: {} };
  }

  const raw = schema as Record<string, unknown>;
  const normalized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (key === "type" && typeof value === "string") {
      normalized.type = value.toLowerCase();
    } else if (
      key === "properties" &&
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    ) {
      const props: Record<string, unknown> = {};
      for (const [propName, propVal] of Object.entries(
        value as Record<string, unknown>,
      )) {
        props[propName] = normalizeJsonSchema(propVal);
      }
      normalized.properties = props;
    } else if (key === "items" && value && typeof value === "object") {
      normalized.items = normalizeJsonSchema(value);
    } else {
      normalized[key] = value;
    }
  }

  if (normalized.type === "object" && !normalized.properties) {
    normalized.properties = {};
  }

  return normalized;
}

function normalizeToolsForGroq(
  rawTools: Array<Record<string, unknown>> | undefined,
): Array<Record<string, unknown>> {
  if (!rawTools || rawTools.length === 0) return [];

  return rawTools
    .map((tool) => {
      if (
        tool.type === "function" &&
        tool.function &&
        typeof tool.function === "object"
      ) {
        const fn = tool.function as Record<string, unknown>;
        return {
          type: "function",
          function: {
            name: String(fn.name ?? ""),
            description: String(fn.description ?? ""),
            parameters: normalizeJsonSchema(fn.parameters),
          },
        };
      }

      return {
        type: "function",
        function: {
          name: String(tool.name ?? ""),
          description: String(tool.description ?? ""),
          parameters: normalizeJsonSchema(tool.parameters),
        },
      };
    })
    .filter(
      (t) =>
        typeof (t.function as { name?: string }).name === "string" &&
        (t.function as { name: string }).name.trim().length > 0,
    );
}

/**
 * Recovers valid tool calls if Llama 3.3 emits XML-style `<function=name>{...}</function>`
 * (`tool_use_failed` on Groq) for zero-arg or simple tool invocations.
 */
function parseFailedGenerationToolCalls(
  failedGeneration: string | undefined,
): GroqToolCall[] {
  if (!failedGeneration) return [];
  const calls: GroqToolCall[] = [];
  const regex =
    /<function=([a-zA-Z0-9_]+)(?:>|\s+)(\{[\s\S]*?\})?\s*<\/function>/g;
  let match: RegExpExecArray | null = regex.exec(failedGeneration);
  let idx = 0;

  while (match !== null) {
    const fnName = match[1]?.trim();
    const rawJson = match[2]?.trim() || "{}";
    if (fnName) {
      try {
        // Ensure arguments is valid JSON string
        const parsedArgs = JSON.parse(rawJson);
        calls.push({
          id: `call_recovered_${idx++}`,
          type: "function",
          function: {
            name: fnName,
            arguments: JSON.stringify(parsedArgs ?? {}),
          },
        });
      } catch {
        // Ignore unparseable fragment
      }
    }
    match = regex.exec(failedGeneration);
  }

  return calls;
}

function stripThinkingAndJsonFences(
  rawText: string,
  jsonMode: boolean,
): string {
  const withoutThink = rawText.replace(/^<think>[\s\S]*?<\/think>\s*/i, "").trim();
  if (jsonMode && withoutThink.startsWith("```")) {
    return withoutThink
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }
  return withoutThink;
}

function decodeBase64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Optionally transcribes audio attachments via Groq's OpenAI-compatible Whisper endpoint
 * since `llama-3.3-70b-versatile` is a text/tool-calling model and does not accept raw audio blobs in chat messages.
 */
async function transcribeAudioPartsWithGroq(
  apiKey: string,
  mediaParts: InlineMediaPart[] | undefined,
): Promise<string[]> {
  if (!mediaParts || mediaParts.length === 0) return [];
  const transcripts: string[] = [];

  for (const part of mediaParts) {
    const isAudio =
      part.kind === "audio" || part.mimeType.toLowerCase().startsWith("audio/");
    if (!isAudio || !part.base64Data) continue;

    try {
      const bytes = decodeBase64ToBytes(part.base64Data);
      if (bytes.byteLength === 0 || bytes.byteLength > 15 * 1024 * 1024) {
        continue;
      }
      const blob = new Blob([bytes], { type: part.mimeType || "audio/webm" });
      const form = new FormData();
      form.append("file", blob, part.fileName || "voice-message.webm");
      form.append("model", "whisper-large-v3-turbo");

      const res = await fetch(GROQ_AUDIO_TRANSCRIPTIONS_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
        signal: AbortSignal.timeout(20000),
      });

      if (res.ok) {
        const json = (await res.json()) as { text?: string };
        if (json.text?.trim()) {
          transcripts.push(
            `[Audio Transcription (${part.fileName || "audio"})]: ${json.text.trim()}`,
          );
        }
      }
    } catch {
      // Non-fatal: continue with text prompt if audio transcription is unavailable
    }
  }

  return transcripts;
}

async function invokeGroqChatCompletion(params: {
  apiKey: string;
  model: string;
  messages: GroqChatMessage[];
  tools?: Array<Record<string, unknown>>;
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
}): Promise<GroqCallOutcome> {
  const modelToUse = params.model.trim() || DEFAULT_GROQ_MODEL;
  const hasTools = Boolean(params.tools && params.tools.length > 0);
  const useJsonObjectFormat =
    Boolean(params.jsonMode) &&
    !hasTools &&
    supportsGroqJsonObjectMode(modelToUse);

  const requestBody: Record<string, unknown> = {
    model: modelToUse,
    messages: params.messages,
    temperature:
      typeof params.temperature === "number" ? params.temperature : 0.2,
    ...(typeof params.maxTokens === "number"
      ? { max_tokens: params.maxTokens }
      : {}),
    ...(hasTools
      ? {
          tools: params.tools,
          tool_choice: "auto",
        }
      : {}),
    ...(useJsonObjectFormat
      ? { response_format: { type: "json_object" } }
      : {}),
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${params.apiKey}`,
        },
        body: JSON.stringify(requestBody),
        signal: AbortSignal.timeout(30000),
      });

      const retryAfterHeader = res.headers.get("retry-after");
      const retryAfterSeconds = retryAfterHeader
        ? Math.max(1, Number.parseInt(retryAfterHeader, 10) || 60)
        : undefined;

      if (res.status === 429 && attempt === 0) {
        const retrySec = Number.parseFloat(retryAfterHeader || "4");
        const waitMs = Math.min(Math.max(retrySec * 1000, 1500), 7000);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (res.ok) {
        let json: {
          model?: string;
          choices?: Array<{
            message?: {
              role?: string;
              content?: string | null;
              tool_calls?: GroqToolCall[];
            };
          }>;
        };
        try {
          json = await res.json();
        } catch {
          return {
            ok: false,
            status: 502,
            modelUsed: modelToUse,
            errorCode: "GROQ_MALFORMED_PROVIDER_RESPONSE",
            errorMessage: "AI provider returned an unreadable JSON payload.",
          };
        }

        const firstChoice = json.choices?.[0]?.message;
        if (!firstChoice) {
          return {
            ok: false,
            status: 502,
            modelUsed: json.model || modelToUse,
            errorCode: "GROQ_EMPTY_RESPONSE",
            errorMessage: "AI provider returned an empty completion.",
          };
        }

        return {
          ok: true,
          status: 200,
          modelUsed: json.model || modelToUse,
          message: firstChoice,
        };
      }

      // Parse error metadata safely without leaking any credentials
      let providerErrCode = "";
      let providerErrMessage = "";
      let failedGeneration: string | undefined;
      try {
        const errJson = (await res.json()) as {
          error?: {
            code?: string;
            type?: string;
            message?: string;
            failed_generation?: string;
          };
        };
        providerErrCode = (
          errJson.error?.code ||
          errJson.error?.type ||
          ""
        ).toLowerCase();
        providerErrMessage = (errJson.error?.message || "").toLowerCase();
        failedGeneration = errJson.error?.failed_generation;
      } catch {
        // Ignore unparseable provider error body
      }

      // Recover tool calls if model emitted XML tool syntax on `tool_use_failed`
      if (res.status === 400 && providerErrCode === "tool_use_failed") {
        const recoveredCalls = parseFailedGenerationToolCalls(failedGeneration);
        if (recoveredCalls.length > 0) {
          return {
            ok: true,
            status: 200,
            modelUsed: modelToUse,
            message: {
              role: "assistant",
              content: null,
              tool_calls: recoveredCalls,
            },
          };
        }
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          status: res.status,
          modelUsed: modelToUse,
          errorCode: "GROQ_INVALID_API_KEY",
          errorMessage: "AI provider authentication failed. Check GROQ_API_KEY.",
        };
      }

      if (
        providerErrCode.includes("model_not_found") ||
        providerErrCode.includes("model_decommissioned") ||
        (res.status === 404 && providerErrMessage.includes("model"))
      ) {
        return {
          ok: false,
          status: res.status,
          modelUsed: modelToUse,
          errorCode: "GROQ_INVALID_MODEL",
          errorMessage:
            "The configured GROQ_MODEL does not exist, was decommissioned, or is not enabled for this API key.",
        };
      }

      if (res.status === 404) {
        return {
          ok: false,
          status: 404,
          modelUsed: modelToUse,
          errorCode: "GROQ_ENDPOINT_NOT_FOUND",
          errorMessage: "Groq API endpoint returned HTTP 404 Not Found.",
        };
      }

      if (res.status === 429) {
        return {
          ok: false,
          status: 429,
          modelUsed: modelToUse,
          errorCode: "GROQ_RATE_LIMITED",
          errorMessage:
            "AI provider rate limit reached. Please wait a moment and try again.",
          retryAfterSeconds: retryAfterSeconds ?? 30,
        };
      }

      if (res.status >= 400 && res.status < 500) {
        return {
          ok: false,
          status: res.status,
          modelUsed: modelToUse,
          errorCode: "GROQ_INVALID_REQUEST",
          errorMessage: "AI provider could not process the request parameters.",
        };
      }

      return {
        ok: false,
        status: res.status,
        modelUsed: modelToUse,
        errorCode: `GROQ_PROVIDER_HTTP_${res.status}`,
        errorMessage: "AI provider is temporarily unavailable.",
      };
    } catch (err) {
      const errName =
        err instanceof Error && err.name ? err.name.toUpperCase() : "NETWORK_ERROR";
      const isTimeout =
        errName.includes("TIMEOUT") || errName.includes("ABORT");
      return {
        ok: false,
        status: isTimeout ? 504 : 502,
        modelUsed: modelToUse,
        errorCode: isTimeout ? "GROQ_TIMEOUT" : `GROQ_${errName}`,
        errorMessage: isTimeout
          ? "AI request timed out. Please try again."
          : "Network error while contacting AI provider.",
      };
    }
  }

  return {
    ok: false,
    status: 429,
    modelUsed: modelToUse,
    errorCode: "GROQ_RATE_LIMITED",
    errorMessage:
      "AI provider rate limit reached. Please wait a moment and try again.",
    retryAfterSeconds: 30,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed." }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unauthorized: missing session token.",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized: invalid session." }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.status !== "active") {
    return new Response(
      JSON.stringify({ ok: false, error: "Forbidden: account is not active." }),
      {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  let payload: EdgeAiRequest;
  try {
    payload = (await req.json()) as EdgeAiRequest;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON request body." }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const provider = (Deno.env.get("AI_PROVIDER") || "groq").trim().toLowerCase();
  const groqApiKey = (Deno.env.get("GROQ_API_KEY") || "").trim();
  const configuredModel = (
    Deno.env.get("GROQ_MODEL") || DEFAULT_GROQ_MODEL
  ).trim();

  if (
    provider !== "groq" ||
    !groqApiKey ||
    groqApiKey.toLowerCase().includes("your_groq_api_key")
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: "EDGE_SECRET_NOT_SET",
        error:
          "GROQ_API_KEY or AI_PROVIDER=groq secret is not configured in Supabase Edge Functions.",
      }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---------------------------------------------------------------------------
  // MODE 1: AGENT TURN (Multi-turn Student AI Assistant with Tool Calling)
  // ---------------------------------------------------------------------------
  if (payload.mode === "agent_turn") {
    const normalizedTools = normalizeToolsForGroq(payload.tools);
    const messages: GroqChatMessage[] = [
      {
        role: "system",
        content: payload.systemInstruction || "You are Learnix AI Assistant.",
      },
      ...(Array.isArray(payload.messages) ? payload.messages : []),
    ];

    const groqRes = await invokeGroqChatCompletion({
      apiKey: groqApiKey,
      model: configuredModel,
      messages,
      tools: normalizedTools,
      temperature: payload.temperature ?? 0.2,
      maxTokens: payload.maxTokens,
    });

    if (!groqRes.ok || !groqRes.message) {
      const httpOut =
        groqRes.status === 429
          ? 429
          : groqRes.status === 504
            ? 504
            : 502;
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: groqRes.errorCode ?? "GROQ_AGENT_ERROR",
          error: groqRes.errorMessage ?? "AI assistant request failed.",
          status: groqRes.status,
          ...(groqRes.retryAfterSeconds
            ? { retryAfterSeconds: groqRes.retryAfterSeconds }
            : {}),
        }),
        {
          status: httpOut,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const toolCalls = Array.isArray(groqRes.message.tool_calls)
      ? groqRes.message.tool_calls
      : [];
    const textContent = stripThinkingAndJsonFences(
      groqRes.message.content ?? "",
      false,
    );

    if (toolCalls.length === 0 && !textContent) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: "GROQ_EMPTY_RESPONSE",
          error: "AI model returned neither tool calls nor text.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        provider: `edge:groq:${groqRes.modelUsed}`,
        message: {
          role: "assistant",
          content: textContent || null,
          ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  // ---------------------------------------------------------------------------
  // MODE 2: GENERATE (Quiz Generation, Question Replacement, Grading, Teacher AI)
  // ---------------------------------------------------------------------------
  const audioTranscripts = await transcribeAudioPartsWithGroq(
    groqApiKey,
    payload.mediaParts,
  );
  const nonAudioAttachmentNotes = (payload.mediaParts ?? [])
    .filter(
      (m) =>
        m.kind !== "audio" && !m.mimeType.toLowerCase().startsWith("audio/"),
    )
    .map(
      (m) =>
        `[Attached File Metadata: ${m.fileName || "attachment"} (${m.mimeType})]`,
    );

  const baseUserPrompt = (payload.userPrompt ?? "").trim();
  const combinedUserContent = [
    baseUserPrompt,
    ...audioTranscripts,
    ...nonAudioAttachmentNotes,
  ]
    .filter(Boolean)
    .join("\n\n");

  let systemContent = (payload.systemInstruction ?? "").trim();
  if (
    payload.jsonMode &&
    !/\bjson\b/i.test(`${systemContent} ${combinedUserContent}`)
  ) {
    systemContent = `${systemContent}\nRespond strictly with a valid JSON object.`.trim();
  }

  const groqRes = await invokeGroqChatCompletion({
    apiKey: groqApiKey,
    model: configuredModel,
    messages: [
      { role: "system", content: systemContent },
      { role: "user", content: combinedUserContent || "Proceed." },
    ],
    jsonMode: Boolean(payload.jsonMode),
    temperature: payload.temperature ?? 0.2,
    maxTokens: payload.maxTokens,
  });

  if (!groqRes.ok || !groqRes.message) {
    const httpOut =
      groqRes.status === 429
        ? 429
        : groqRes.status === 504
          ? 504
          : 502;
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: groqRes.errorCode ?? "GROQ_GENERATE_ERROR",
        error: groqRes.errorMessage ?? "AI generation request failed.",
        status: groqRes.status,
        ...(groqRes.retryAfterSeconds
          ? { retryAfterSeconds: groqRes.retryAfterSeconds }
          : {}),
      }),
      {
        status: httpOut,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const rawText = (groqRes.message.content ?? "").trim();
  if (!rawText) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: "GROQ_EMPTY_RESPONSE",
        error: "AI model returned an empty completion.",
      }),
      {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  const finalText = stripThinkingAndJsonFences(
    rawText,
    Boolean(payload.jsonMode),
  );

  if (payload.jsonMode) {
    try {
      JSON.parse(finalText);
    } catch {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: "GROQ_MALFORMED_JSON",
          error: "AI model returned malformed JSON output.",
        }),
        {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      text: finalText,
      provider: `edge:groq:${groqRes.modelUsed}`,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
});
