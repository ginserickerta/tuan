// Write-side operations: create a topic (with Day-0 grade) and record a review.
// All scheduling math is delegated to the pure engine.
import { db } from "./db";
import { schedulePublish } from "./calendar/publish";
import { initialSchedule, nextSchedule, estimateMinutes } from "./scheduler/engine";
import { FLASH_MINUTES } from "./scheduler/config";
import { todayISO } from "./scheduler/dates";
import type {
  ExamTrack,
  Grade,
  ISODate,
  QuizQuestion,
  SubjectType,
  Topic,
} from "./scheduler/types";

export interface NewTopicInput {
  title: string;
  subject: string;
  examTrack: ExamTrack;
  subjectType: SubjectType;
  notes: string;
  dayZeroGrade: Grade;
  /** the day the material was actually studied; defaults to today */
  studiedOn?: ISODate;
}

/**
 * Create a topic and schedule its first review from the Day-0 grade.
 * Backdating is supported: the schedule is measured from the day it was
 * studied, so a topic logged late can already be due (or overdue) today.
 */
export async function addTopic(input: NewTopicInput): Promise<number> {
  const studied = input.studiedOn ?? todayISO();
  const sched = initialSchedule(input.dayZeroGrade, input.examTrack, studied);

  const topic: Topic = {
    title: input.title.trim(),
    subject: input.subject.trim(),
    examTrack: input.examTrack,
    subjectType: input.subjectType,
    notes: input.notes.trim(),
    createdAt: studied,
    ease: sched.ease,
    intervalDays: sched.intervalDays,
    dueDate: sched.dueDate,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
    archived: false,
    quizLevel: 3,
    easyStreak: 0,
  };

  const id = await db.topics.add(topic);
  await db.reviews.add({
    topicId: id as number,
    date: studied,
    grade: input.dayZeroGrade,
    isDayZero: true,
    intervalBefore: 0,
    intervalAfter: sched.intervalDays,
    easeAfter: sched.ease,
    estMinutes: 0, // studying time isn't charged against the review cap
  });
  schedulePublish(); // keep the subscribed calendar in step
  return id as number;
}

/**
 * Quiz-difficulty ratchet: two consecutive "ง่ายมาก" bump the served level,
 * any struggle (grade ≤2) drops it back down.
 */
function nextQuizRatchet(
  topic: Topic,
  grade: Grade,
): { quizLevel: number; easyStreak: number } {
  let quizLevel = topic.quizLevel ?? 3;
  let easyStreak = topic.easyStreak ?? 0;
  if (grade === 4) {
    easyStreak += 1;
    if (easyStreak >= 2) {
      quizLevel = Math.min(5, quizLevel + 1);
      easyStreak = 0;
    }
  } else if (grade <= 2) {
    quizLevel = Math.max(2, quizLevel - 1);
    easyStreak = 0;
  } else {
    easyStreak = 0;
  }
  return { quizLevel, easyStreak };
}

/** Record a review-day grade and reschedule. flash=true charges only 1 minute. */
export async function reviewTopic(
  topic: Topic,
  grade: Grade,
  flash: boolean,
): Promise<void> {
  const today = todayISO();
  const sched = nextSchedule(topic, grade, today);
  const ratchet = nextQuizRatchet(topic, grade);

  await db.transaction("rw", db.topics, db.reviews, async () => {
    await db.topics.update(topic.id!, {
      ease: sched.ease,
      intervalDays: sched.intervalDays,
      dueDate: sched.dueDate,
      lastReviewedAt: today,
      reviewCount: grade >= 3 ? topic.reviewCount + 1 : topic.reviewCount,
      lapseCount: grade === 1 ? topic.lapseCount + 1 : topic.lapseCount,
      quizLevel: ratchet.quizLevel,
      easyStreak: ratchet.easyStreak,
    });
    await db.reviews.add({
      topicId: topic.id!,
      date: today,
      grade,
      isDayZero: false,
      intervalBefore: topic.intervalDays,
      intervalAfter: sched.intervalDays,
      easeAfter: sched.ease,
      estMinutes: flash ? FLASH_MINUTES : estimateMinutes(topic.subjectType),
    });
  });
  schedulePublish();
}

/** Minutes already charged against today's cap. */
export async function minutesUsedToday(): Promise<number> {
  const logs = await db.reviews.where("date").equals(todayISO()).toArray();
  return logs.reduce((s, l) => s + l.estMinutes, 0);
}

/** Count of topics created today (for the 3-per-day pacing warning). */
export async function newTopicsToday(): Promise<number> {
  return db.topics.where("createdAt").equals(todayISO()).count();
}

export async function setArchived(id: number, archived: boolean): Promise<void> {
  await db.topics.update(id, { archived });
  schedulePublish();
}

export async function deleteTopic(id: number): Promise<void> {
  await db.transaction("rw", db.topics, db.reviews, db.questions, async () => {
    await db.topics.delete(id);
    await db.reviews.where("topicId").equals(id).delete();
    await db.questions.where("topicId").equals(id).delete();
  });
  schedulePublish();
}

/** Create a topic (Day-0 graded) together with its generated quiz pool. */
export async function addTopicWithQuiz(
  input: NewTopicInput,
  questions: Omit<QuizQuestion, "id" | "topicId">[],
): Promise<number> {
  const topicId = await addTopic(input);
  if (questions.length > 0) {
    await db.questions.bulkAdd(
      questions.map((q) => ({ ...q, topicId })),
    );
  }
  return topicId;
}

/** Attach questions to an existing topic. mode "replace" clears the old pool first. */
export async function saveQuestions(
  topicId: number,
  questions: Omit<QuizQuestion, "id" | "topicId">[],
  mode: "append" | "replace",
): Promise<void> {
  await db.transaction("rw", db.questions, async () => {
    if (mode === "replace") {
      await db.questions.where("topicId").equals(topicId).delete();
    }
    if (questions.length > 0) {
      await db.questions.bulkAdd(questions.map((q) => ({ ...q, topicId })));
    }
  });
}

export async function countQuestions(topicId: number): Promise<number> {
  return db.questions.where("topicId").equals(topicId).count();
}
