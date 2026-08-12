// Core domain types for the spaced-repetition scheduler.
// Pure data — no DB or DOM dependencies, so the whole scheduler is portable and testable.

/** Which entrance exam this topic is preparing for. */
export type ExamTrack = "TGAT_TPAT" | "ALEVEL";

/** Determines review style and the interval multiplier (subject_factor). */
export type SubjectType = "memorize" | "concept" | "calculation";

/**
 * Grade buttons (1–4).
 * Day 0 (when studied):   1=งง ตามไม่ทัน · 2=พอเข้าใจแต่ไม่มั่นใจ · 3=เข้าใจดี · 4=ง่ายมาก
 * Review days:            1=ลืมสนิท · 2=นึกออกยาก · 3=นึกออก · 4=ง่ายมาก
 */
export type Grade = 1 | 2 | 3 | 4;

/** ISO local date string "YYYY-MM-DD" (no time component, no timezone surprises). */
export type ISODate = string;

export interface Topic {
  id?: number; // auto-increment (Dexie)
  title: string;
  subject: string; // e.g. "ฟิสิกส์", "TGAT2"
  examTrack: ExamTrack;
  subjectType: SubjectType;
  notes: string;
  createdAt: ISODate;

  // Scheduling state
  ease: number; // clamp [1.3, 2.8]
  intervalDays: number; // current interval
  dueDate: ISODate; // next review date
  lastReviewedAt: ISODate | null;
  reviewCount: number; // successful review passes (not counting Day-0)
  lapseCount: number; // times graded "ลืมสนิท"
  archived: boolean; // manually retired or exam passed

  // Quiz difficulty ratchet (Phase 2). Optional for pre-v2 records.
  /** target quiz difficulty 2–5; questions within ±1 of this are served */
  quizLevel?: number;
  /** consecutive "ง่ายมาก" grades; 2 in a row bumps quizLevel */
  easyStreak?: number;
}

/** Bloom's-taxonomy bucket used to force a difficulty mix in generation. */
export type BloomLevel = "recall" | "apply" | "analyze";

export type QuestionType = "mcq" | "short" | "numeric";

/** A generated quiz question (pool of ~8 per topic, stored separately). */
export interface QuizQuestion {
  id?: number;
  topicId: number;
  type: QuestionType;
  /** 2 (พื้นฐาน) … 5 (ระดับข้อสอบยาก) */
  difficulty: number;
  bloom: BloomLevel;
  /** may contain inline LaTeX between $…$ */
  stem: string;
  /** MCQ only — exactly 4 entries; empty array otherwise */
  choices: string[];
  /** MCQ only — index into choices; -1 otherwise */
  correctIndex: number;
  answer: string;
  explanation: string;
  /** numeric re-rolls: same structure, different numbers (so answers can't be memorized) */
  variants: { stem: string; answer: string }[];
}

export interface ReviewLog {
  id?: number;
  topicId: number;
  date: ISODate;
  grade: Grade;
  isDayZero: boolean; // true for the initial "just studied" grading
  intervalBefore: number;
  intervalAfter: number;
  easeAfter: number;
  estMinutes: number; // minutes this review was estimated/charged at
}

/** One item in today's review queue, with queue-level metadata attached. */
export interface QueueItem {
  topic: Topic;
  estMinutes: number;
  /** true when this item was pulled in by the final-days cram rule rather than its dueDate */
  isCram: boolean;
  /** how overdue relative to its interval (0 = due today, 1 = a full interval late) */
  overdueRatio: number;
}

export interface DayPlan {
  items: QueueItem[];
  capMinutes: number;
  usedMinutes: number; // already spent today (from logs)
  /** total due workload in minutes before capping (for the "backlog" warning) */
  dueBacklogMinutes: number;
  flashMode: boolean; // backlog rescue: every review compressed to 1 minute
  crunchMode: boolean; // TGAT/TPAT final-60-days window: A-Level quota enforced
  /** items due today but pushed past the cap (will surface tomorrow) */
  overflowCount: number;
}
