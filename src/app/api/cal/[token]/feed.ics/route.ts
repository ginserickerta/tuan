// The subscribable calendar feed.
//
// Apple Calendar (webcal://) and Google Calendar ("from URL") poll this on their
// own schedule, so it must stay cheap and never require a session.
import { get } from "@vercel/blob";
import { buildIcs } from "@/lib/calendar/ics";
import { blobPathname, isValidToken, validatePayload } from "@/lib/calendar/feed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isValidToken(token)) {
    return new Response("not found", { status: 404 });
  }

  let payload;
  try {
    const blob = await get(blobPathname(token), {
      access: "private",
      useCache: false, // the schedule changes; never serve a stale snapshot
    });
    if (!blob?.stream) return new Response("not found", { status: 404 });
    payload = validatePayload(await new Response(blob.stream).json());
  } catch (e) {
    console.error("calendar feed read failed", e);
    return new Response("temporarily unavailable", { status: 503 });
  }

  if (!payload) return new Response("not found", { status: 404 });

  const ics = buildIcs(payload.days, {
    hour: payload.hour,
    minute: payload.minute,
    alarmMinutes: payload.alarmMinutes,
  });

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="tuan.ics"',
      // clients poll far slower than this; a short cache just absorbs retries
      "Cache-Control": "public, max-age=300, s-maxage=300",
      // keep the schedule out of search engines
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
