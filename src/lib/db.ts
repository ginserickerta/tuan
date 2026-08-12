// IndexedDB layer via Dexie. Client-side only.
// LocalStorage is deliberately NOT used — Safari's 7-day ITP eviction and the
// 5MB limit make it unsafe for exam-prep data. IndexedDB + persist() instead.
import Dexie, { type EntityTable } from "dexie";
import type { QuizQuestion, ReviewLog, Topic } from "./scheduler/types";

/** Small key/value bag for app settings (calendar token and prefs). */
export interface Setting {
  key: string;
  value: unknown;
}

export const db = new Dexie("tuan") as Dexie & {
  topics: EntityTable<Topic, "id">;
  reviews: EntityTable<ReviewLog, "id">;
  questions: EntityTable<QuizQuestion, "id">;
  settings: EntityTable<Setting, "key">;
};

db.version(1).stores({
  // Indexed fields only — full objects are stored regardless.
  topics: "++id, dueDate, examTrack, subject, createdAt, archived",
  reviews: "++id, topicId, date",
});

// v2 (Phase 2): quiz question pool + difficulty-ratchet fields on topics.
db.version(2)
  .stores({
    topics: "++id, dueDate, examTrack, subject, createdAt, archived",
    reviews: "++id, topicId, date",
    questions: "++id, topicId",
  })
  .upgrade((tx) =>
    tx
      .table("topics")
      .toCollection()
      .modify((t) => {
        t.quizLevel ??= 3;
        t.easyStreak ??= 0;
      }),
  );

// v3 (Phase 4): settings bag — holds the calendar feed token and its options.
db.version(3).stores({
  topics: "++id, dueDate, examTrack, subject, createdAt, archived",
  reviews: "++id, topicId, date",
  questions: "++id, topicId",
  settings: "key",
});

export async function getSetting<T>(key: string): Promise<T | undefined> {
  const row = await db.settings.get(key);
  return row?.value as T | undefined;
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value });
}

export async function deleteSetting(key: string): Promise<void> {
  await db.settings.delete(key);
}

/**
 * Ask the browser to protect this origin's storage from eviction.
 * On iOS Safari this (plus Add to Home Screen) is what keeps data alive.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    // non-fatal — data still works, just less protected
  }
  return false;
}
