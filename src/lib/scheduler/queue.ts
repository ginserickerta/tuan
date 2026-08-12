// Builds "today's queue" from all topics — pure function, no DB.
//
// Rules encoded here:
//   1. Daily cap: 30 min weekdays / 75 min weekends.
//   2. Risk ordering: most-overdue-relative-to-interval first, then lowest ease.
//   3. TGAT crunch (≤60 days to TGAT): TGAT topics prioritized, but ≥20% of the
//      cap is reserved for A-Level so it never rots to zero.
//   4. Final cram (≤3 days to an exam): weak topics (ease < 2.3) of that track
//      are swept in daily as 1-minute flash reviews regardless of dueDate.
//   5. Backlog rescue: if due workload > 2× cap, every review becomes a
//      1-minute flash so the queue actually clears.
//   6. Topics whose exam has passed are excluded (to be archived by the caller).
import {
  ALEVEL_QUOTA_DURING_CRUNCH,
  BACKLOG_RESCUE_FACTOR,
  CAP_WEEKDAY_MIN,
  CAP_WEEKEND_MIN,
  CRAM_WEAK_EASE_THRESHOLD,
  CRUNCH_WINDOW_DAYS,
  FINAL_CRAM_DAYS,
  FLASH_MINUTES,
} from "./config";
import { daysToExam, estimateMinutes, isTrackFinished } from "./engine";
import { diffDays, isWeekend } from "./dates";
import type { DayPlan, ISODate, QueueItem, Topic } from "./types";

export function capForDate(today: ISODate): number {
  return isWeekend(today) ? CAP_WEEKEND_MIN : CAP_WEEKDAY_MIN;
}

export function isCrunchMode(today: ISODate): boolean {
  const d = daysToExam("TGAT_TPAT", today);
  return d >= 0 && d <= CRUNCH_WINDOW_DAYS;
}

function riskSort(a: QueueItem, b: QueueItem): number {
  if (b.overdueRatio !== a.overdueRatio) return b.overdueRatio - a.overdueRatio;
  return a.topic.ease - b.topic.ease;
}

export function buildDayPlan(
  allTopics: Topic[],
  today: ISODate,
  usedMinutes: number,
): DayPlan {
  const active = allTopics.filter(
    (t) => !t.archived && !isTrackFinished(t.examTrack, today),
  );

  // --- Collect candidates: due topics + final-cram sweep ---
  const candidates = new Map<number, QueueItem>();

  for (const t of active) {
    const overdueDays = diffDays(t.dueDate, today); // ≥0 when due
    if (overdueDays >= 0) {
      candidates.set(t.id!, {
        topic: t,
        estMinutes: estimateMinutes(t.subjectType),
        isCram: false,
        overdueRatio: overdueDays / Math.max(1, t.intervalDays),
      });
    }
  }

  // Final cram: within FINAL_CRAM_DAYS of an exam, weak topics come in daily.
  for (const t of active) {
    const remaining = daysToExam(t.examTrack, today);
    if (
      remaining >= 0 &&
      remaining <= FINAL_CRAM_DAYS &&
      t.ease < CRAM_WEAK_EASE_THRESHOLD &&
      !candidates.has(t.id!)
    ) {
      candidates.set(t.id!, {
        topic: t,
        estMinutes: FLASH_MINUTES,
        isCram: true,
        overdueRatio: 0,
      });
    }
  }

  const due = [...candidates.values()].sort(riskSort);
  const capMinutes = capForDate(today);
  const dueBacklogMinutes = due.reduce((s, q) => s + q.estMinutes, 0);

  // Backlog rescue: compress everything to flash reviews.
  const flashMode = dueBacklogMinutes > capMinutes * BACKLOG_RESCUE_FACTOR;
  const pool = flashMode
    ? due.map((q) => ({ ...q, estMinutes: FLASH_MINUTES }))
    : due;

  const remainingBudget = Math.max(0, capMinutes - usedMinutes);
  const crunchMode = isCrunchMode(today);

  const picked: QueueItem[] = [];
  let budget = remainingBudget;
  const taken = new Set<number>();

  // --- A-Level quota during TGAT crunch ---
  if (crunchMode) {
    let quota = Math.floor(capMinutes * ALEVEL_QUOTA_DURING_CRUNCH);
    for (const q of pool) {
      if (quota <= 0 || budget <= 0) break;
      if (q.topic.examTrack !== "ALEVEL") continue;
      if (q.estMinutes > budget) continue;
      picked.push(q);
      taken.add(q.topic.id!);
      budget -= q.estMinutes;
      quota -= q.estMinutes;
    }
  }

  // --- Fill the rest by risk (crunch mode: TGAT first, then anything left) ---
  const fillOrder = crunchMode
    ? [...pool].sort((a, b) => {
        const aT = a.topic.examTrack === "TGAT_TPAT" ? 0 : 1;
        const bT = b.topic.examTrack === "TGAT_TPAT" ? 0 : 1;
        return aT !== bT ? aT - bT : riskSort(a, b);
      })
    : pool;

  for (const q of fillOrder) {
    if (budget <= 0) break;
    if (taken.has(q.topic.id!)) continue;
    if (q.estMinutes > budget) continue;
    picked.push(q);
    taken.add(q.topic.id!);
    budget -= q.estMinutes;
  }

  return {
    items: picked,
    capMinutes,
    usedMinutes,
    dueBacklogMinutes,
    flashMode,
    crunchMode,
    overflowCount: pool.length - picked.length,
  };
}
