// Shape of the forecast snapshot the app publishes for the calendar feed,
// shared by the client publisher and both API routes.
//
// The token in the URL is the only credential — calendar apps can't log in —
// so it must be long, random, and treated as a secret.
import type { ForecastDay } from "../scheduler/forecast";

export const FEED_VERSION = 1;
export const TOKEN_BYTES = 16; // 32 hex chars
export const MAX_DAYS = 60;
export const MAX_TITLES_PER_DAY = 40;
export const MAX_TITLE_LENGTH = 200;
export const MAX_PAYLOAD_BYTES = 128 * 1024;

export interface FeedPayload {
  v: number;
  /** when the app last pushed this snapshot */
  updatedAt: string;
  hour: number;
  minute: number;
  alarmMinutes: number | null;
  days: ForecastDay[];
}

export function isValidToken(token: unknown): token is string {
  return typeof token === "string" && /^[0-9a-f]{32}$/.test(token);
}

export function blobPathname(token: string): string {
  return `cal/${token}.json`;
}

/** Strict validation — this runs on user-supplied input from the network. */
export function validatePayload(input: unknown): FeedPayload | null {
  if (typeof input !== "object" || input === null) return null;
  const p = input as Partial<FeedPayload>;

  if (p.v !== FEED_VERSION) return null;
  if (typeof p.updatedAt !== "string" || p.updatedAt.length > 40) return null;
  if (!Number.isInteger(p.hour) || p.hour! < 0 || p.hour! > 23) return null;
  if (!Number.isInteger(p.minute) || p.minute! < 0 || p.minute! > 59) return null;
  if (
    p.alarmMinutes !== null &&
    (!Number.isInteger(p.alarmMinutes) ||
      p.alarmMinutes! < 0 ||
      p.alarmMinutes! > 1440)
  )
    return null;
  if (!Array.isArray(p.days) || p.days.length > MAX_DAYS) return null;

  const days: ForecastDay[] = [];
  for (const d of p.days) {
    if (typeof d !== "object" || d === null) return null;
    if (typeof d.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) return null;
    if (!Number.isFinite(d.count) || d.count < 0 || d.count > 500) return null;
    if (!Number.isFinite(d.minutes) || d.minutes < 0 || d.minutes > 1440) return null;
    if (!Array.isArray(d.titles) || d.titles.length > MAX_TITLES_PER_DAY) return null;
    if (d.titles.some((t) => typeof t !== "string")) return null;

    days.push({
      date: d.date,
      count: Math.round(d.count),
      minutes: Math.round(d.minutes),
      titles: d.titles.map((t) => t.slice(0, MAX_TITLE_LENGTH)),
      overflowCount: Number.isFinite(d.overflowCount)
        ? Math.max(0, Math.round(d.overflowCount))
        : 0,
      flashMode: Boolean(d.flashMode),
      capMinutes: Number.isFinite(d.capMinutes) ? Math.round(d.capMinutes) : 0,
    });
  }

  return {
    v: FEED_VERSION,
    updatedAt: p.updatedAt,
    hour: p.hour!,
    minute: p.minute!,
    alarmMinutes: p.alarmMinutes ?? null,
    days,
  };
}
