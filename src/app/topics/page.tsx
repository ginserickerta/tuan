"use client";
// หน้า "คลัง" — every topic with its scheduling state, for verifying the system
// and light management (archive / delete). Search + full library grow in Phase 5.
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { deleteTopic, saveQuestions, setArchived } from "@/lib/repo";
import { todayISO, diffDays, formatThai } from "@/lib/scheduler/dates";
import { EXAM_LABELS } from "@/lib/scheduler/config";
import BridgeQuiz from "@/components/BridgeQuiz";
import BackupPanel from "@/components/BackupPanel";
import CalendarExport from "@/components/CalendarExport";
import type { Topic } from "@/lib/scheduler/types";

const TRACK_CHIP: Record<string, string> = {
  TGAT_TPAT: "bg-violet-100 text-violet-700",
  ALEVEL: "bg-emerald-100 text-emerald-700",
};

function dueLabel(t: Topic, today: string): { text: string; cls: string } {
  const d = diffDays(today, t.dueDate);
  if (d < 0) return { text: `ค้าง ${-d} วัน`, cls: "text-red-600 font-medium" };
  if (d === 0) return { text: "วันนี้", cls: "text-teal-600 font-medium" };
  return { text: formatThai(t.dueDate), cls: "text-stone-400" };
}

export default function TopicsPage() {
  const today = todayISO();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [quizFor, setQuizFor] = useState<Topic | null>(null);
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  // question count per topic, so the library shows which topics have a quiz
  const quizCounts = useLiveQuery(async () => {
    const all = await db.questions.toArray();
    const m = new Map<number, number>();
    for (const q of all) m.set(q.topicId, (m.get(q.topicId) ?? 0) + 1);
    return m;
  }, []);

  if (!topics)
    return <p className="text-stone-400 text-sm mt-8 text-center">กำลังโหลด…</p>;

  // Full-screen bridge flow for one topic
  if (quizFor) {
    const existing = quizCounts?.get(quizFor.id!) ?? 0;
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">เพิ่มควิซให้หัวข้อนี้</h1>
        <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-1">
          <p className="font-semibold">{quizFor.title}</p>
          <p className="text-xs text-stone-500">
            {quizFor.subject}
            {existing > 0 && ` · มีควิซอยู่แล้ว ${existing} ข้อ (ชุดใหม่จะแทนที่ของเดิม)`}
          </p>
        </div>
        {quizFor.notes.trim().length < 40 ? (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            หัวข้อนี้ยังไม่มีโน้ต (หรือสั้นเกินไป) — ต้องมีเนื้อหาก่อนถึงจะออกข้อสอบได้
            กลับไปเพิ่มโน้ตในหัวข้อนี้ก่อน
          </div>
        ) : (
          <BridgeQuiz
            meta={{
              subject: quizFor.subject,
              examTrack: quizFor.examTrack,
              subjectType: quizFor.subjectType,
              title: quizFor.title,
            }}
            notes={quizFor.notes}
            confirmLabel="บันทึกควิซ"
            onCancel={() => setQuizFor(null)}
            onConfirm={async (qs) => {
              await saveQuestions(quizFor.id!, qs, "replace");
              setQuizFor(null);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setQuizFor(null)}
          className="w-full py-2 text-sm text-stone-400"
        >
          ← กลับไปคลัง
        </button>
      </div>
    );
  }

  const active = topics
    .filter((t) => !t.archived)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const archived = topics.filter((t) => t.archived);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">คลังหัวข้อ</h1>
        <span className="text-sm text-stone-400">{active.length} หัวข้อ</span>
      </header>

      {active.length === 0 && archived.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-10">
          ยังไม่มีหัวข้อ — เริ่มที่แท็บ &quot;เพิ่มหัวข้อ&quot;
        </p>
      )}

      <ul className="space-y-2">
        {active.map((t) => {
          const due = dueLabel(t, today);
          const open = expanded === t.id;
          return (
            <li
              key={t.id}
              className="rounded-xl bg-white border border-stone-200 px-3 py-2.5"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpanded(open ? null : t.id!)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-snug flex-1">
                    {t.title}
                  </span>
                  <span className={`text-xs shrink-0 ${due.cls}`}>{due.text}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] flex-wrap">
                  <span className={`px-1.5 py-0.5 rounded-full ${TRACK_CHIP[t.examTrack]}`}>
                    {EXAM_LABELS[t.examTrack]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {t.subject}
                  </span>
                  {(quizCounts?.get(t.id!) ?? 0) > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-700">
                      ควิซ {quizCounts!.get(t.id!)} ข้อ
                    </span>
                  )}
                  <span className="text-stone-400">
                    ทุก {t.intervalDays} วัน · ease {t.ease.toFixed(2)}
                    {t.lapseCount > 0 && ` · ลืม ${t.lapseCount}`}
                  </span>
                </div>
              </button>

              {open && (
                <div className="mt-2 pt-2 border-t border-stone-100 space-y-2">
                  {t.notes && (
                    <p className="text-xs text-stone-600 whitespace-pre-wrap">{t.notes}</p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setQuizFor(t)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-teal-50 text-teal-700 font-medium"
                    >
                      {(quizCounts?.get(t.id!) ?? 0) > 0 ? "สร้างควิซใหม่" : "+ เพิ่มควิซ"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setArchived(t.id!, true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600"
                    >
                      เก็บเข้ากรุ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ลบ "${t.title}" ถาวร?`)) void deleteTopic(t.id!);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="text-sm text-stone-400 cursor-pointer">
            ในกรุ ({archived.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {archived.map((t) => (
              <li
                key={t.id}
                className="rounded-xl bg-stone-100 px-3 py-2.5 flex items-center justify-between"
              >
                <span className="text-sm text-stone-500">{t.title}</span>
                <button
                  type="button"
                  onClick={() => setArchived(t.id!, false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-stone-600 border border-stone-200"
                >
                  เอากลับมา
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="pt-2">
        <summary className="text-sm text-stone-400 cursor-pointer">
          เพิ่มลงปฏิทิน
        </summary>
        <div className="mt-3">
          <CalendarExport />
        </div>
      </details>

      <details className="pt-2">
        <summary className="text-sm text-stone-400 cursor-pointer">
          สำรอง / ย้ายข้อมูล
        </summary>
        <div className="mt-3">
          <BackupPanel />
        </div>
      </details>
    </div>
  );
}
