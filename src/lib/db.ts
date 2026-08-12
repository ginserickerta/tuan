// IndexedDB layer via Dexie. Client-side only.
// LocalStorage is deliberately NOT used — Safari's 7-day ITP eviction and the
// 5MB limit make it unsafe for exam-prep data. IndexedDB + persist() instead.
import Dexie, { type EntityTable } from "dexie";
import type { QuizQuestion, ReviewLog, Topic } from "./scheduler/types";

export const db = new Dexie("tuan") as Dexie & {
  topics: EntityTable<Topic, "id">;
  reviews: EntityTable<ReviewLog, "id">;
  questions: EntityTable<QuizQuestion, "id">;
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
