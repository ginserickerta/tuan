// Sanity checks for the workload forecast and the .ics it produces.
// Run: npx tsx scripts/sim-calendar.ts
import { forecast } from "../src/lib/scheduler/forecast";
import { buildIcs } from "../src/lib/calendar/ics";
import { addDays, todayISO } from "../src/lib/scheduler/dates";
import { initialSchedule } from "../src/lib/scheduler/engine";
import type { Grade, Topic } from "../src/lib/scheduler/types";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

const today = todayISO();
let nextId = 1;

function makeTopic(over: Partial<Topic> = {}): Topic {
  const track = over.examTrack ?? "ALEVEL";
  const grade: Grade = 3;
  const init = initialSchedule(grade, track, today);
  return {
    id: nextId++,
    title: `หัวข้อ ${nextId}`,
    subject: "ฟิสิกส์",
    examTrack: track,
    subjectType: "concept",
    notes: "",
    createdAt: today,
    ease: init.ease,
    intervalDays: init.intervalDays,
    dueDate: init.dueDate,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
    archived: false,
    quizLevel: 3,
    easyStreak: 0,
    ...over,
  };
}

// ---- forecast ----------------------------------------------------------
const topics = Array.from({ length: 12 }, (_, i) =>
  makeTopic({ dueDate: addDays(today, i % 5), title: `เรื่องที่ ${i + 1}` }),
);
const days = forecast(topics, today, 21);

check("returns one row per day", days.length === 21);
check("days are consecutive", days[1].date === addDays(today, 1));
check(
  "never exceeds the daily cap",
  days.every((d) => d.minutes <= d.capMinutes),
  JSON.stringify(days.find((d) => d.minutes > d.capMinutes)),
);
check(
  "titles match the count",
  days.every((d) => d.titles.length === d.count),
);
check("some work is scheduled", days.some((d) => d.count > 0));

// The simulation must not mutate the caller's topics.
const before = topics.map((t) => t.dueDate).join();
forecast(topics, today, 21);
check("does not mutate input topics", topics.map((t) => t.dueDate).join() === before);

// A topic due far in the future should not appear on day 0.
const future = [makeTopic({ dueDate: addDays(today, 10), title: "ไกล" })];
const f2 = forecast(future, today, 5);
check("future topic absent from early days", f2.slice(0, 5).every((d) => d.count === 0));

// Archived topics never surface.
const archived = [makeTopic({ archived: true, dueDate: today })];
check("archived excluded", forecast(archived, today, 3).every((d) => d.count === 0));

// Overload → flash mode kicks in and the cap still holds.
const flood = Array.from({ length: 60 }, () => makeTopic({ dueDate: today }));
const heavy = forecast(flood, today, 3);
check("backlog triggers flash mode", heavy[0].flashMode, JSON.stringify(heavy[0]));
check("flash day still respects cap", heavy[0].minutes <= heavy[0].capMinutes);
check("overflow is reported", heavy[0].overflowCount > 0);

// ---- ics ---------------------------------------------------------------
const ics = buildIcs(days, { hour: 19, minute: 0, alarmMinutes: 15 });
const lines = ics.split("\r\n");

check("uses CRLF only", !ics.includes("\n\r") && !/[^\r]\n/.test(ics));
check("starts and ends correctly",
  lines[0] === "BEGIN:VCALENDAR" && lines[lines.length - 2] === "END:VCALENDAR");
check("has VERSION and PRODID",
  ics.includes("VERSION:2.0") && ics.includes("PRODID:-//tuan//"));

const workDays = days.filter((d) => d.count > 0).length;
const eventCount = lines.filter((l) => l === "BEGIN:VEVENT").length;
check("one event per working day", eventCount === workDays, `${eventCount} vs ${workDays}`);
check("events are balanced",
  eventCount === lines.filter((l) => l === "END:VEVENT").length);
check("alarms present", lines.filter((l) => l === "BEGIN:VALARM").length === eventCount);
check("trigger is relative", ics.includes("TRIGGER:-PT15M"));

check("stable per-day UID", ics.includes(`UID:tuan-${days.find((d) => d.count > 0)!.date}@tuan.local`));
check("DTSTART is floating local 19:00",
  /DTSTART:\d{8}T190000\r\n/.test(ics), lines.find((l) => l.startsWith("DTSTART")) ?? "");
check("DTSTAMP is UTC", /DTSTAMP:\d{8}T\d{6}Z/.test(ics));

// Every line must fit in 75 octets once folded.
const enc = new TextEncoder();
const tooLong = lines.filter((l) => enc.encode(l).length > 75);
check("all lines ≤ 75 octets", tooLong.length === 0, tooLong[0] ?? "");

// Continuation lines must start with a space; no bare content lines.
const unfolded = ics.replace(/\r\n[ \t]/g, "");
check("unfolds cleanly", unfolded.includes("SUMMARY:") && !unfolded.includes("\r\n \r\n"));

// Thai text survives folding + escaping.
check("Thai summary intact", unfolded.includes("หัวข้อ"));
check("escapes the middot separator line",
  unfolded.split("\r\n").some((l) => l.startsWith("SUMMARY:") && l.includes("~")));

// A comma in a topic title must be escaped, not treated as a value separator.
const comma = forecast(
  [makeTopic({ title: "กฎข้อ 1, 2 และ 3", dueDate: today })],
  today, 2,
);
const commaIcs = buildIcs(comma, { hour: 19, minute: 0, alarmMinutes: null });
check("escapes commas in titles", commaIcs.includes("\\, 2 "),
  commaIcs.split("\r\n").find((l) => l.startsWith("DESCRIPTION")) ?? "");
check("no alarm when disabled", !commaIcs.includes("BEGIN:VALARM"));

// Empty schedule → a valid, event-free calendar (not a broken file).
const emptyIcs = buildIcs(forecast([], today, 7), { hour: 19, minute: 0, alarmMinutes: null });
check("empty calendar is still valid",
  emptyIcs.startsWith("BEGIN:VCALENDAR") && !emptyIcs.includes("BEGIN:VEVENT"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
