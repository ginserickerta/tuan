// Write-side operations: create a topic (with Day-0 grade) and record a review.
// All scheduling math is delegated to the pure engine.
import { db } from "./db";
import { initialSchedule, nextSchedule, estimateMinutes } from "./scheduler/engine";
import { FLASH_MINUTES } from "./scheduler/config";
import { todayISO } from "./scheduler/dates";
import type { ExamTrack, Grade, SubjectType, Topic } from "./scheduler/types";

export interface NewTopicInput {
  title: string;
  subject: string;
  examTrack: ExamTrack;
  subjectType: SubjectType;
  notes: string;
  dayZeroGrade: Grade;
}

/** Create a topic and schedule its first review from the Day-0 grade. */
export async function addTopic(input: NewTopicInput): Promise<number> {
  const today = todayISO();
  const sched = initialSchedule(input.dayZeroGrade, input.examTrack, today);

  const topic: Topic = {
    title: input.title.trim(),
    subject: input.subject.trim(),
    examTrack: input.examTrack,
    subjectType: input.subjectType,
    notes: input.notes.trim(),
    createdAt: today,
    ease: sched.ease,
    intervalDays: sched.intervalDays,
    dueDate: sched.dueDate,
    lastReviewedAt: null,
    reviewCount: 0,
    lapseCount: 0,
    archived: false,
  };

  const id = await db.topics.add(topic);
  await db.reviews.add({
    topicId: id as number,
    date: today,
    grade: input.dayZeroGrade,
    isDayZero: true,
    intervalBefore: 0,
    intervalAfter: sched.intervalDays,
    easeAfter: sched.ease,
    estMinutes: 0, // studying time isn't charged against the review cap
  });
  return id as number;
}

/** Record a review-day grade and reschedule. flash=true charges only 1 minute. */
export async function reviewTopic(
  topic: Topic,
  grade: Grade,
  flash: boolean,
): Promise<void> {
  const today = todayISO();
  const sched = nextSchedule(topic, grade, today);

  await db.transaction("rw", db.topics, db.reviews, async () => {
    await db.topics.update(topic.id!, {
      ease: sched.ease,
      intervalDays: sched.intervalDays,
      dueDate: sched.dueDate,
      lastReviewedAt: today,
      reviewCount: grade >= 3 ? topic.reviewCount + 1 : topic.reviewCount,
      lapseCount: grade === 1 ? topic.lapseCount + 1 : topic.lapseCount,
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
}

export async function deleteTopic(id: number): Promise<void> {
  await db.transaction("rw", db.topics, db.reviews, async () => {
    await db.topics.delete(id);
    await db.reviews.where("topicId").equals(id).delete();
  });
}
