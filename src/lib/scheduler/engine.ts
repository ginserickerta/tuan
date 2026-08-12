// The scheduling engine — pure functions only. No DB, no DOM.
// Given a topic's current state and a grade, compute the next state.
import {
  DAY_ZERO_INIT,
  EASE_DELTA,
  EASE_MAX,
  EASE_MIN,
  EASY_BONUS,
  EST_MINUTES,
  EXAM_COMPRESSION_RATIO,
  EXAM_DATES,
  FINAL_CRAM_DAYS,
  HARD_MULTIPLIER,
  MAX_INTERVAL_DAYS,
  SUBJECT_FACTOR,
} from "./config";
import { addDays, diffDays } from "./dates";
import type { ExamTrack, Grade, ISODate, SubjectType, Topic } from "./types";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Days remaining until the topic's exam (negative = exam has passed). */
export function daysToExam(track: ExamTrack, today: ISODate): number {
  return diffDays(today, EXAM_DATES[track]);
}

export function isTrackFinished(track: ExamTrack, today: ISODate): boolean {
  return daysToExam(track, today) < 0;
}

/**
 * Compress an interval as the exam approaches:
 *   interval ≤ 20% of days remaining, never lands after (exam − 1 day),
 *   and inside the final-cram window everything becomes daily.
 */
export function compressForExam(
  intervalDays: number,
  track: ExamTrack,
  today: ISODate,
): number {
  const remaining = daysToExam(track, today);
  if (remaining <= 0) return intervalDays; // exam passed; caller archives the topic
  if (remaining <= FINAL_CRAM_DAYS) return 1;

  let iv = Math.min(
    intervalDays,
    Math.floor(remaining * EXAM_COMPRESSION_RATIO),
    MAX_INTERVAL_DAYS,
    remaining - 1, // last review at latest the day before the exam
  );
  iv = Math.max(1, iv);
  return iv;
}

export interface ScheduleState {
  ease: number;
  intervalDays: number;
  dueDate: ISODate;
}

/** Day-0: topic just studied, graded for initial understanding. */
export function initialSchedule(
  grade: Grade,
  track: ExamTrack,
  today: ISODate,
): ScheduleState {
  const { ease, intervalDays } = DAY_ZERO_INIT[grade];
  const iv = compressForExam(intervalDays, track, today);
  return { ease, intervalDays: iv, dueDate: addDays(today, iv) };
}

/**
 * Review-day transition.
 *   ลืมสนิท(1) → interval reset to 1 day, ease −0.20
 *   นึกออกยาก(2) → interval × 1.2, ease −0.15
 *   นึกออก(3)  → interval × ease × subject_factor
 *   ง่ายมาก(4)  → interval × ease × subject_factor × 1.3, ease +0.15
 * Early steps: the 2nd successful pass goes 1 → 3 days before multiplying kicks in.
 */
export function nextSchedule(
  topic: Pick<Topic, "ease" | "intervalDays" | "examTrack" | "subjectType">,
  grade: Grade,
  today: ISODate,
): ScheduleState {
  const ease = clamp(topic.ease + EASE_DELTA[grade], EASE_MIN, EASE_MAX);
  const factor = SUBJECT_FACTOR[topic.subjectType];
  const prev = Math.max(1, topic.intervalDays);

  let iv: number;
  if (grade === 1) {
    iv = 1;
  } else if (grade === 2) {
    iv = Math.max(prev + 1, Math.round(prev * HARD_MULTIPLIER));
  } else if (prev <= 1) {
    // graduation step: 1 → 3 (or 4 when easy)
    iv = grade === 4 ? 4 : 3;
  } else {
    const bonus = grade === 4 ? EASY_BONUS : 1;
    iv = Math.round(prev * ease * factor * bonus);
    iv = Math.max(prev + 1, iv); // always move forward on success
  }

  iv = compressForExam(iv, topic.examTrack, today);
  return { ease, intervalDays: iv, dueDate: addDays(today, iv) };
}

/** Minutes a review of this topic is expected to take. */
export function estimateMinutes(subjectType: SubjectType): number {
  return EST_MINUTES[subjectType];
}
