// All tunable numbers live here — one place to adjust, nothing hardcoded in the engine.
import type { ExamTrack, Grade, SubjectType } from "./types";

/** Exam dates (first day of each exam window). */
export const EXAM_DATES: Record<ExamTrack, string> = {
  TGAT_TPAT: "2027-01-30", // 30 ม.ค. – 1 ก.พ. 2570
  ALEVEL: "2027-03-13", // เสาร์ 13 มี.ค. 2570
};

export const EXAM_LABELS: Record<ExamTrack, string> = {
  TGAT_TPAT: "TGAT/TPAT",
  ALEVEL: "A-Level",
};

/** Day-0 grading → starting ease + first interval (days). */
export const DAY_ZERO_INIT: Record<Grade, { ease: number; intervalDays: number }> = {
  1: { ease: 1.9, intervalDays: 1 },
  2: { ease: 2.1, intervalDays: 1 },
  3: { ease: 2.3, intervalDays: 2 },
  4: { ease: 2.5, intervalDays: 3 },
};

/** Ease adjustment per review grade. */
export const EASE_DELTA: Record<Grade, number> = {
  1: -0.2,
  2: -0.15,
  3: 0,
  4: +0.15,
};

export const EASE_MIN = 1.3;
export const EASE_MAX = 2.8;

/** Interval multiplier per subject type (subject_factor). */
export const SUBJECT_FACTOR: Record<SubjectType, number> = {
  memorize: 0.8, // ศัพท์ / นิยาม / สูตร — ทบถี่กว่า
  concept: 1.0, // แนวคิด ทฤษฎี
  calculation: 1.2, // โจทย์คำนวณ — interval ยืดได้ (แต่ทบทวนแพงกว่า/ครั้ง)
};

/** Estimated minutes per review, by subject type. */
export const EST_MINUTES: Record<SubjectType, number> = {
  memorize: 2,
  concept: 3,
  calculation: 5,
};

/** Interval never exceeds this fraction of days-remaining-to-exam (Cepeda-style compression). */
export const EXAM_COMPRESSION_RATIO = 0.2;

/** Hard absolute ceiling on any interval (days). */
export const MAX_INTERVAL_DAYS = 45;

/** Daily review-time caps (minutes). */
export const CAP_WEEKDAY_MIN = 30;
export const CAP_WEEKEND_MIN = 75;

/** New-topic pacing guidance (used for warnings only, never blocks saving). */
export const NEW_TOPICS_PER_DAY_TARGET = 3;

/** TGAT crunch window: within this many days before TGAT, quota rules kick in. */
export const CRUNCH_WINDOW_DAYS = 60;

/** During crunch, at least this fraction of the daily cap goes to A-Level topics. */
export const ALEVEL_QUOTA_DURING_CRUNCH = 0.2;

/** Final-days cram: within this many days before an exam, weak topics get daily flash reviews. */
export const FINAL_CRAM_DAYS = 3;

/** Topics with ease below this are considered "weak" for the final cram sweep. */
export const CRAM_WEAK_EASE_THRESHOLD = 2.3;

/** Backlog rescue: if due workload exceeds cap × this factor, switch to flash mode. */
export const BACKLOG_RESCUE_FACTOR = 2;

/** Flash-mode review length (minutes per topic). */
export const FLASH_MINUTES = 1;

/** "Easy" grade interval bonus on top of ease × subject_factor. */
export const EASY_BONUS = 1.3;

/** "Hard" grade: interval grows slightly instead of multiplying by ease. */
export const HARD_MULTIPLIER = 1.2;
