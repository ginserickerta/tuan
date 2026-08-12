// Receives the app's forecast snapshot and stores it under the caller's token.
//
// There is no login: the token IS the credential. It's 128 bits of randomness
// generated in the browser, so a snapshot can't be targeted without it — but
// the payload is still validated strictly before anything is written.
import { NextResponse } from "next/server";
import { del, put } from "@vercel/blob";
import {
  MAX_PAYLOAD_BYTES,
  blobPathname,
  isValidToken,
  validatePayload,
} from "@/lib/calendar/feed";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const { token, payload } = (body ?? {}) as Record<string, unknown>;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }

  const clean = validatePayload(payload);
  if (!clean) {
    return NextResponse.json({ error: "invalid payload" }, { status: 400 });
  }

  try {
    await put(blobPathname(token), JSON.stringify(clean), {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
    });
  } catch (e) {
    console.error("calendar publish failed", e);
    return NextResponse.json({ error: "storage unavailable" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, days: clean.days.length });
}

export async function DELETE(request: Request) {
  const token = new URL(request.url).searchParams.get("token");
  if (!isValidToken(token)) {
    return NextResponse.json({ error: "invalid token" }, { status: 400 });
  }
  try {
    await del(blobPathname(token));
  } catch {
    // already gone is a success from the caller's point of view
  }
  return NextResponse.json({ ok: true });
}
