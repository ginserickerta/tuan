// Local-date helpers. All scheduler dates are "YYYY-MM-DD" strings in the user's
// local timezone — never Date.toISOString() (which shifts across midnight in UTC+7).
import type { ISODate } from "./types";

export function toISODate(d: Date): ISODate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

export function parseISO(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d); // local midnight
}

export function addDays(iso: ISODate, days: number): ISODate {
  const d = parseISO(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Whole-day difference b − a (positive when b is after a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / MS);
}

export function isWeekend(iso: ISODate): boolean {
  const dow = parseISO(iso).getDay();
  return dow === 0 || dow === 6;
}

/** Thai-friendly display, e.g. "อ. 12 ส.ค." */
const THAI_DOW = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const THAI_MONTH = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];
export function formatThai(iso: ISODate): string {
  const d = parseISO(iso);
  return `${THAI_DOW[d.getDay()]} ${d.getDate()} ${THAI_MONTH[d.getMonth()]}`;
}
