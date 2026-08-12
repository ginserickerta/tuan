// Backup / restore for the whole local database.
//
// Until cross-device sync exists, this file is the only thing standing between
// a cleared browser profile and losing every topic. It doubles as the manual
// way to move data between the PC and an iPhone: export here, import there.
import { db } from "./db";
import { schedulePublish } from "./calendar/publish";
import type { QuizQuestion, ReviewLog, Topic } from "./scheduler/types";
import { todayISO } from "./scheduler/dates";

const FORMAT = "tuan-backup";
const FORMAT_VERSION = 1;

export interface BackupFile {
  format: typeof FORMAT;
  version: number;
  exportedAt: string; // ISO timestamp, informational only
  topics: Topic[];
  reviews: ReviewLog[];
  questions: QuizQuestion[];
}

export interface BackupCounts {
  topics: number;
  reviews: number;
  questions: number;
}

export async function buildBackup(): Promise<BackupFile> {
  const [topics, reviews, questions] = await Promise.all([
    db.topics.toArray(),
    db.reviews.toArray(),
    db.questions.toArray(),
  ]);
  return {
    format: FORMAT,
    version: FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    topics,
    reviews,
    questions,
  };
}

/** Trigger a file download of the full database. */
export async function downloadBackup(): Promise<BackupCounts> {
  const backup = await buildBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tuan-backup-${todayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // revoke late so Safari has time to start the download
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return {
    topics: backup.topics.length,
    reviews: backup.reviews.length,
    questions: backup.questions.length,
  };
}

export class BackupError extends Error {}

/** Parse + validate a backup file without touching the database. */
export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupError("ไฟล์นี้ไม่ใช่ JSON ที่อ่านได้ — เลือกไฟล์ tuan-backup-*.json");
  }
  if (typeof parsed !== "object" || parsed === null)
    throw new BackupError("ไฟล์ว่างหรือรูปแบบผิด");

  const b = parsed as Partial<BackupFile>;
  if (b.format !== FORMAT)
    throw new BackupError("ไฟล์นี้ไม่ใช่ไฟล์สำรองของแอปทวน");
  if (typeof b.version !== "number" || b.version > FORMAT_VERSION)
    throw new BackupError(
      `ไฟล์สำรองเวอร์ชัน ${b.version} ใหม่กว่าแอปนี้ — อัปเดตแอปก่อน`,
    );
  if (!Array.isArray(b.topics) || !Array.isArray(b.reviews) || !Array.isArray(b.questions))
    throw new BackupError("ไฟล์สำรองไม่ครบ (ต้องมี topics / reviews / questions)");
  for (const t of b.topics) {
    if (typeof t?.title !== "string" || typeof t?.dueDate !== "string")
      throw new BackupError("ข้อมูลหัวข้อในไฟล์เสียหาย");
  }
  return b as BackupFile;
}

export function countsOf(b: BackupFile): BackupCounts {
  return {
    topics: b.topics.length,
    reviews: b.reviews.length,
    questions: b.questions.length,
  };
}

/**
 * Wipe everything and restore the file exactly, ids included.
 * Use when this device should become a copy of the exporting device.
 */
export async function restoreReplace(b: BackupFile): Promise<BackupCounts> {
  await db.transaction("rw", db.topics, db.reviews, db.questions, async () => {
    await Promise.all([db.topics.clear(), db.reviews.clear(), db.questions.clear()]);
    await db.topics.bulkAdd(b.topics);
    await db.reviews.bulkAdd(b.reviews);
    await db.questions.bulkAdd(b.questions);
  });
  schedulePublish();
  return countsOf(b);
}

/** Drop the source id so Dexie assigns a fresh one on insert. */
function withoutId<T extends { id?: number }>(row: T): Omit<T, "id"> {
  const copy = { ...row };
  delete copy.id;
  return copy;
}

/** Same topic entered on two devices — treated as one. */
function topicKey(t: Topic): string {
  return `${t.title.trim()}||${t.subject.trim()}||${t.createdAt}`;
}

/**
 * Add only what this device doesn't have, keeping local records untouched.
 * Ids are reassigned on insert, so child rows are remapped to the new ids.
 */
export async function restoreMerge(b: BackupFile): Promise<BackupCounts> {
  let addedTopics = 0;
  let addedReviews = 0;
  let addedQuestions = 0;

  await db.transaction("rw", db.topics, db.reviews, db.questions, async () => {
    const existing = new Set((await db.topics.toArray()).map(topicKey));
    const idMap = new Map<number, number>(); // old topic id -> new topic id

    for (const t of b.topics) {
      if (t.id === undefined || existing.has(topicKey(t))) continue;
      const newId = await db.topics.add(withoutId(t) as Topic);
      idMap.set(t.id, newId as number);
      addedTopics++;
    }

    const reviews = b.reviews
      .filter((r) => idMap.has(r.topicId))
      .map((r) => ({ ...withoutId(r), topicId: idMap.get(r.topicId)! }));
    if (reviews.length) {
      await db.reviews.bulkAdd(reviews as ReviewLog[]);
      addedReviews = reviews.length;
    }

    const questions = b.questions
      .filter((q) => idMap.has(q.topicId))
      .map((q) => ({ ...withoutId(q), topicId: idMap.get(q.topicId)! }));
    if (questions.length) {
      await db.questions.bulkAdd(questions as QuizQuestion[]);
      addedQuestions = questions.length;
    }
  });

  schedulePublish();
  return { topics: addedTopics, reviews: addedReviews, questions: addedQuestions };
}
