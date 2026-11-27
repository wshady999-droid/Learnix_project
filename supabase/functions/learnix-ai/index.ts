import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
}

interface EdgeAiRequest {
  mode: "generate" | "agent_turn";
  task?: string;
  roleContext?: "student" | "teacher" | "admin";
  courseId?: string | null;
  systemInstruction: string;
  userPrompt?: string;
  jsonMode?: boolean;
  mediaParts?: InlineMediaPart[];
  contents?: Array<Record<string, unknown>>;
  tools?: Array<Record<string, unknown>>;
}

function buildGeminiEndpoint(apiKey: string, model: string): {
  url: string;
  headers: Record<string, string>;
} {
  const cleanModel = encodeURIComponent(model.trim());
  // Vertex AI Express Mode keys start with "AQ."
  if (apiKey.startsWith("AQ.")) {
    return {
      url: `https://aiplatform.googleapis.com/v1/publishers/google/models/${cleanModel}:generateContent?key=${encodeURIComponent(apiKey)}`,
      headers: {
        "Content-Type": "application/json",
      },
    };
  }
  return {
    url: `https://generativelanguage.googleapis.com/v1beta/models/${cleanModel}:generateContent`,
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
  };
}

async function invokeGeminiGenerate(params: {
  apiKey: string;
  preferredModel: string;
  body: Record<string, unknown>;
}): Promise<{ ok: boolean; status: number; modelUsed: string; data?: unknown; errorCode?: string }> {
  const candidateModels = Array.from(
    new Set([
      params.preferredModel.trim() || "gemini-2.5-flash",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
    ]),
  );

  let lastStatus = 500;
  let lastCode = "GEMINI_UNKNOWN_ERROR";

  for (const model of candidateModels) {
    const { url, headers } = buildGeminiEndpoint(params.apiKey, model);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(params.body),
        signal: AbortSignal.timeout(32000),
      });

      lastStatus = res.status;
      if (res.ok) {
        const json = await res.json();
        return { ok: true, status: res.status, modelUsed: model, data: json };
      }

      // Retry next fallback model only on 404 (unsupported/deprecated model ID)
      if (res.status === 404) {
        lastCode = `GEMINI_MODEL_NOT_FOUND_${model}`;
        continue;
      }

      lastCode = `GEMINI_HTTP_${res.status}`;
      break;
    } catch (err) {
      const name = err instanceof Error && err.name ? err.name.toUpperCase() : "NETWORK_ERROR";
      lastCode = `GEMINI_${name}`;
      break;
    }
  }

  return {
    ok: false,
    status: lastStatus,
    modelUsed: params.preferredModel,
    errorCode: lastCode,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ ok: false, error: "Method not allowed." }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey || !authHeader) {
    return new Response(
      JSON.stringify({ ok: false, error: "Unauthorized: missing session token." }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
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
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let payload: EdgeAiRequest;
  try {
    payload = (await req.json()) as EdgeAiRequest;
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Invalid JSON request body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const provider = (Deno.env.get("AI_PROVIDER") || "gemini").trim().toLowerCase();
  const geminiKey = (Deno.env.get("GEMINI_API_KEY") || "").trim();
  const preferredModel = (Deno.env.get("GEMINI_MODEL") || "gemini-2.5-flash").trim();

  if (
    provider !== "gemini" ||
    !geminiKey ||
    geminiKey.toLowerCase().includes("your_gemini_api_key")
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: "EDGE_SECRET_NOT_SET",
        error: "GEMINI_API_KEY secret is not configured in Supabase Edge Functions.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (payload.mode === "agent_turn") {
    const geminiRes = await invokeGeminiGenerate({
      apiKey: geminiKey,
      preferredModel,
      body: {
        system_instruction: {
          parts: [{ text: payload.systemInstruction }],
        },
        contents: payload.contents ?? [],
        ...(payload.tools && payload.tools.length > 0
          ? {
              tools: [{ functionDeclarations: payload.tools }],
              toolConfig: { functionCallingConfig: { mode: "AUTO" } },
            }
          : {}),
        generationConfig: {
          temperature: 0.2,
        },
      },
    });

    if (!geminiRes.ok) {
      return new Response(
        JSON.stringify({
          ok: false,
          errorCode: geminiRes.errorCode,
          status: geminiRes.status,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        provider: `edge:gemini:${geminiRes.modelUsed}`,
        raw: geminiRes.data,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Standard "generate" mode (Quiz generation, Question replacement, Assignment grading, Summarization, Insights, Assistants)
  const userParts: Array<Record<string, unknown>> = [
    { text: payload.userPrompt ?? "" },
  ];
  for (const media of payload.mediaParts ?? []) {
    userParts.push({
      inline_data: {
        mime_type: media.mimeType,
        data: media.base64Data,
      },
    });
  }

  const geminiRes = await invokeGeminiGenerate({
    apiKey: geminiKey,
    preferredModel,
    body: {
      system_instruction: {
        parts: [{ text: payload.systemInstruction }],
      },
      contents: [{ role: "user", parts: userParts }],
      generationConfig: {
        temperature: 0.2,
        ...(payload.jsonMode ? { responseMimeType: "application/json" } : {}),
      },
    },
  });

  if (!geminiRes.ok) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: geminiRes.errorCode,
        status: geminiRes.status,
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const candidateJson = geminiRes.data as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    }>;
  };
  const text = (candidateJson.candidates?.[0]?.content?.parts ?? [])
    .filter((p) => p.thought !== true)
    .map((p) => p.text ?? "")
    .join("\n")
    .trim();

  if (!text) {
    return new Response(
      JSON.stringify({
        ok: false,
        errorCode: "GEMINI_EMPTY_CANDIDATE",
      }),
      { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      text,
      provider: `edge:gemini:${geminiRes.modelUsed}`,
    }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
