// Projects the review workload forward N days — pure, no DB.
//
// The future is only knowable under an assumption, so we make one explicitly:
// every review is graded "นึกออก" (3). Real grades move the curve, but the shape
// (which days are heavy, when a backlog builds) holds up well enough to plan by.
//
// Used by the calendar export and, later, the load graph.
import { nextSchedule } from "./engine";
import { buildDayPlan } from "./queue";
import { addDays } from "./dates";
import type { Grade, ISODate, Topic } from "./types";

export interface ForecastDay {
  date: ISODate;
  /** topics the plan would serve that day */
  count: number;
  minutes: number;
  titles: string[];
  /** due but pushed past the cap — they resurface the next day */
  overflowCount: number;
  flashMode: boolean;
  capMinutes: number;
}

export function forecast(
  allTopics: Topic[],
  today: ISODate,
  horizonDays: number,
  assumedGrade: Grade = 3,
): ForecastDay[] {
  // work on copies: the simulation advances schedules it must not persist
  const sim: Topic[] = allTopics.map((t) => ({ ...t }));
  const byId = new Map(sim.map((t) => [t.id!, t]));
  const out: ForecastDay[] = [];

  for (let i = 0; i < horizonDays; i++) {
    const date = addDays(today, i);
    const plan = buildDayPlan(sim, date, 0);

    out.push({
      date,
      count: plan.items.length,
      minutes: plan.items.reduce((s, q) => s + q.estMinutes, 0),
      titles: plan.items.map((q) => q.topic.title),
      overflowCount: plan.overflowCount,
      flashMode: plan.flashMode,
      capMinutes: plan.capMinutes,
    });

    // advance the ones that got reviewed; the rest stay due and roll over
    for (const item of plan.items) {
      const t = byId.get(item.topic.id!);
      if (!t) continue;
      const next = nextSchedule(t, assumedGrade, date);
      t.ease = next.ease;
      t.intervalDays = next.intervalDays;
      t.dueDate = next.dueDate;
      t.lastReviewedAt = date;
      t.reviewCount += 1;
    }
  }

  return out;
}
