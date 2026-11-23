import { NextResponse, type NextRequest } from "next/server";

import {
  publicContactMessageSchema,
  submitPublicContactMessage,
} from "@/services/db/messaging";

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const parsed = publicContactMessageSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: parsed.error.issues[0]?.message ?? "Invalid contact request payload.",
        },
        { status: 400 },
      );
    }

    const result = await submitPublicContactMessage(parsed.data);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
    }

    return NextResponse.json({ ok: true, data: result.data }, { status: 201 });
  } catch {
    return NextResponse.json(
      { ok: false, error: "Malformed JSON request body." },
      { status: 400 },
    );
  }
}
