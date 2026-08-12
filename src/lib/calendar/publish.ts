"use client";
// Keeps the server-side calendar snapshot in step with the local database.
//
// This is deliberately NOT a sync engine: it pushes a one-way, read-only
// forecast so Apple/Google Calendar have something to poll. Nothing is ever
// read back, so there are no conflicts to resolve.
import { db, deleteSetting, getSetting, setSetting } from "../db";
import { forecast } from "../scheduler/forecast";
import { todayISO } from "../scheduler/dates";
import { FEED_VERSION, TOKEN_BYTES, type FeedPayload } from "./feed";

const TOKEN_KEY = "calendarToken";
const OPTIONS_KEY = "calendarOptions";
const STATUS_KEY = "calendarStatus";

export interface CalendarSettings {
  hour: number;
  minute: number;
  alarmMinutes: number | null;
  horizonDays: number;
  /** false = publish only counts and minutes, no topic names */
  includeTitles: boolean;
}

export const DEFAULT_SETTINGS: CalendarSettings = {
  hour: 19,
  minute: 0,
  alarmMinutes: 15,
  horizonDays: 30,
  includeTitles: true,
};

export interface CalendarStatus {
  lastPublishedAt: string | null;
  lastError: string | null;
}

export async function getCalendarToken(): Promise<string | null> {
  return (await getSetting<string>(TOKEN_KEY)) ?? null;
}

export async function getCalendarSettings(): Promise<CalendarSettings> {
  const saved = await getSetting<Partial<CalendarSettings>>(OPTIONS_KEY);
  return { ...DEFAULT_SETTINGS, ...(saved ?? {}) };
}

export async function saveCalendarSettings(s: CalendarSettings): Promise<void> {
  await setSetting(OPTIONS_KEY, s);
}

export async function getCalendarStatus(): Promise<CalendarStatus> {
  return (
    (await getSetting<CalendarStatus>(STATUS_KEY)) ?? {
      lastPublishedAt: null,
      lastError: null,
    }
  );
}

function newToken(): string {
  const bytes = new Uint8Array(TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** https://host/api/cal/<token>/feed.ics — what Google Calendar wants. */
export function feedUrl(token: string, origin = window.location.origin): string {
  return `${origin}/api/cal/${token}/feed.ics`;
}

/** webcal://… — tapping this on iOS/macOS opens Calendar's subscribe prompt. */
export function webcalUrl(token: string, origin = window.location.origin): string {
  return feedUrl(token, origin).replace(/^https?:\/\//, "webcal://");
}

async function buildPayload(settings: CalendarSettings): Promise<FeedPayload> {
  const topics = await db.topics.toArray();
  const days = forecast(topics, todayISO(), settings.horizonDays);
  return {
    v: FEED_VERSION,
    updatedAt: new Date().toISOString(),
    hour: settings.hour,
    minute: settings.minute,
    alarmMinutes: settings.alarmMinutes,
    days: settings.includeTitles ? days : days.map((d) => ({ ...d, titles: [] })),
  };
}

/** Push the current forecast. Returns the token in use. */
export async function publishCalendar(
  settingsOverride?: CalendarSettings,
): Promise<string> {
  const settings = settingsOverride ?? (await getCalendarSettings());
  let token = await getCalendarToken();
  if (!token) {
    token = newToken();
    await setSetting(TOKEN_KEY, token);
  }

  const res = await fetch("/api/cal/publish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, payload: await buildPayload(settings) }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`publish failed (${res.status}) ${detail.slice(0, 200)}`);
  }

  await setSetting(STATUS_KEY, {
    lastPublishedAt: new Date().toISOString(),
    lastError: null,
  } satisfies CalendarStatus);
  return token;
}

/** Take the feed down and forget the token. Subscribers will see an error. */
export async function disableCalendar(): Promise<void> {
  const token = await getCalendarToken();
  if (token) {
    await fetch(`/api/cal/publish?token=${token}`, { method: "DELETE" }).catch(
      () => {},
    );
  }
  await deleteSetting(TOKEN_KEY);
  await deleteSetting(STATUS_KEY);
}

// --- automatic refresh -----------------------------------------------------
// Reviews land in bursts, so coalesce them into one publish a few seconds later.
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Fire-and-forget refresh after any change that moves the schedule.
 * Silent when the calendar was never enabled, and never blocks the UI.
 */
export function schedulePublish(delayMs = 4000): void {
  if (typeof window === "undefined") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void (async () => {
      if (!(await getCalendarToken())) return; // feature off — nothing to do
      try {
        await publishCalendar();
      } catch (e) {
        await setSetting(STATUS_KEY, {
          lastPublishedAt: (await getCalendarStatus()).lastPublishedAt,
          lastError: e instanceof Error ? e.message : "unknown error",
        } satisfies CalendarStatus);
      }
    })();
  }, delayMs);
}
