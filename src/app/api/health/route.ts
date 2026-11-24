import { NextResponse } from "next/server";

import { isSupabaseConfigured } from "@/lib/env";

export async function GET() {
  return NextResponse.json(
    {
      status: "ok",
      platform: "Learnix",
      supabaseConfigured: isSupabaseConfigured(),
    },
    {
      headers: {
        "Cache-Control": "public, max-age=10, stale-while-revalidate=30",
      },
    },
  );
}

