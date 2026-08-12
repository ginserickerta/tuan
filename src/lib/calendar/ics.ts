// Builds an .ics file from the workload forecast (RFC 5545).
//
// Times are written as *floating* local times — no TZID, no Z — so a 19:00 block
// stays 19:00 in whatever timezone the phone is in, and we avoid shipping a
// VTIMEZONE definition for Asia/Bangkok.
//
// Each day gets a stable UID (tuan-<date>@tuan.local), so re-importing a fresh
// export updates the existing events instead of piling up duplicates.
import { parseISO, toISODate } from "../scheduler/dates";
import type { ForecastDay } from "../scheduler/forecast";

export interface CalendarOptions {
  /** local start time of the daily review block */
  hour: number;
  minute: number;
  /** minutes before the block to fire a reminder; null = no alarm */
  alarmMinutes: number | null;
}

const CAL_NAME = "ทวน";
const MIN_BLOCK_MINUTES = 10; // keep short days visible in month view
const MAX_TITLES_IN_DESCRIPTION = 12;

/** Escape a TEXT value: backslash, semicolon, comma, newline (RFC 5545 §3.3.11). */
function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to ≤75 *octets* per line. Thai is 3 bytes/char in UTF-8, so folding by
 * character count would produce lines that break strict parsers.
 */
function fold(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;

  const parts: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > 75) {
      parts.push(cur);
      cur = " " + ch; // continuation lines begin with a space
      bytes = 1 + size;
    } else {
      cur += ch;
      bytes += size;
    }
  }
  parts.push(cur);
  return parts.join("\r\n");
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Floating local timestamp: YYYYMMDDTHHMMSS */
function localStamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** UTC timestamp for DTSTAMP: YYYYMMDDTHHMMSSZ */
function utcStamp(d: Date): string {
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

function describe(day: ForecastDay): string {
  const lines: string[] = [];
  const shown = day.titles.slice(0, MAX_TITLES_IN_DESCRIPTION);
  lines.push(...shown.map((t) => `• ${t}`));
  if (day.titles.length > shown.length)
    lines.push(`• …และอีก ${day.titles.length - shown.length} หัวข้อ`);
  if (day.flashMode)
    lines.push("", "⚡ โหมดเร่ง — งานค้างเยอะ ทุกหัวข้อเหลือ 1 นาที");
  if (day.overflowCount > 0)
    lines.push(`(อีก ${day.overflowCount} หัวข้อเกินเพดาน ยกไปวันถัดไป)`);
  lines.push("", "คาดการณ์จากตารางปัจจุบัน — ของจริงดูในแอป");
  return lines.join("\n");
}

export function buildIcs(days: ForecastDay[], opts: CalendarOptions): string {
  const now = new Date();
  const dtstamp = utcStamp(now);
  // bumped on every export so calendar clients accept the update
  const sequence = Math.floor(now.getTime() / 1000);

  const out: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//tuan//spaced repetition//TH",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(CAL_NAME)}`,
    "X-WR-TIMEZONE:Asia/Bangkok",
  ];

  for (const day of days) {
    if (day.count === 0) continue; // no work, no clutter

    const start = parseISO(day.date);
    start.setHours(opts.hour, opts.minute, 0, 0);
    const end = new Date(start.getTime() + Math.max(day.minutes, MIN_BLOCK_MINUTES) * 60_000);

    out.push(
      "BEGIN:VEVENT",
      `UID:tuan-${day.date}@tuan.local`,
      `DTSTAMP:${dtstamp}`,
      `SEQUENCE:${sequence}`,
      `DTSTART:${localStamp(start)}`,
      `DTEND:${localStamp(end)}`,
      fold(`SUMMARY:${esc(`ทวน ${day.count} หัวข้อ · ~${day.minutes} นาที`)}`),
      fold(`DESCRIPTION:${esc(describe(day))}`),
      `CATEGORIES:${esc(CAL_NAME)}`,
      "TRANSP:OPAQUE",
    );

    if (opts.alarmMinutes !== null) {
      out.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(`ทวน ${day.count} หัวข้อ`)}`),
        `TRIGGER:-PT${opts.alarmMinutes}M`,
        "END:VALARM",
      );
    }

    out.push("END:VEVENT");
  }

  out.push("END:VCALENDAR");
  return out.join("\r\n") + "\r\n"; // RFC 5545 requires CRLF throughout
}

export function icsFilename(today = toISODate(new Date())): string {
  return `tuan-calendar-${today}.ics`;
}

/** Trigger a download of the given .ics content. */
export function downloadIcs(content: string, filename = icsFilename()): void {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
