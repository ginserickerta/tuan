"use client";
// หน้า "วันนี้" — the daily review queue.
// Reads all topics + today's logs live from Dexie, builds the plan with the
// pure queue builder, and walks through items one at a time.
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { reviewTopic } from "@/lib/repo";
import { buildDayPlan } from "@/lib/scheduler/queue";
import { daysToExam, nextSchedule } from "@/lib/scheduler/engine";
import { todayISO, formatThai } from "@/lib/scheduler/dates";
import { EXAM_LABELS } from "@/lib/scheduler/config";
import GradeButtons from "@/components/GradeButtons";
import QuizSession from "@/components/QuizSession";
import type { Grade, QuizQuestion } from "@/lib/scheduler/types";

const TRACK_CHIP: Record<string, string> = {
  TGAT_TPAT: "bg-violet-100 text-violet-700",
  ALEVEL: "bg-emerald-100 text-emerald-700",
};

export default function TodayPage() {
  const today = todayISO();
  const [showNotes, setShowNotes] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  // topic id whose quiz pass is finished (grade buttons unlocked)
  const [quizDoneFor, setQuizDoneFor] = useState<number | null>(null);

  const data = useLiveQuery(async () => {
    const [topics, logs] = await Promise.all([
      db.topics.toArray(),
      db.reviews.where("date").equals(today).toArray(),
    ]);
    const usedMinutes = logs.reduce((s, l) => s + l.estMinutes, 0);
    const plan = buildDayPlan(topics, today, usedMinutes);
    // preload quiz pool for the topic at the head of the queue
    const headId = plan.items[0]?.topic.id;
    const pools = new Map<number, QuizQuestion[]>();
    if (headId != null) {
      pools.set(headId, await db.questions.where("topicId").equals(headId).toArray());
    }
    return { plan, topicCount: topics.length, pools };
  }, [today]);

  if (!data) return <p className="text-stone-400 text-sm mt-8 text-center">กำลังโหลด…</p>;

  const { plan, topicCount } = data;
  const current = plan.items[0]; // live query re-runs after each review, so [0] is always next
  const quizPool = data.pools.get(current?.topic.id ?? -1) ?? [];
  // flash/cram passes skip the quiz — they're 1-minute recalls by design
  const quizFinished =
    !current ||
    quizPool.length === 0 ||
    quizDoneFor === current.topic.id ||
    plan.flashMode ||
    current.isCram;
  const dTgat = daysToExam("TGAT_TPAT", today);
  const dAlevel = daysToExam("ALEVEL", today);

  async function grade(g: Grade) {
    if (!current) return;
    setShowNotes(false);
    setQuizDoneFor(null);
    setDoneCount((c) => c + 1);
    await reviewTopic(current.topic, g, plan.flashMode || current.isCram);
  }

  // Preview what each button would do — makes the system legible.
  const hints = current
    ? Object.fromEntries(
        ([1, 2, 3, 4] as Grade[]).map((g) => [
          g,
          `→ ${nextSchedule(current.topic, g, today).intervalDays} วัน`,
        ]),
      )
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header: date + exam countdowns */}
      <header className="space-y-2">
        <h1 className="text-xl font-bold">{formatThai(today)}</h1>
        <div className="flex gap-2 text-xs">
          {dTgat >= 0 && (
            <span className="px-2 py-1 rounded-full bg-violet-100 text-violet-700 font-medium">
              TGAT/TPAT อีก {dTgat} วัน
            </span>
          )}
          {dAlevel >= 0 && (
            <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 font-medium">
              A-Level อีก {dAlevel} วัน
            </span>
          )}
        </div>
      </header>

      {/* Mode banners */}
      {plan.flashMode && (
        <div className="rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 text-sm text-orange-800">
          ⚡ <b>โหมดกู้คิว</b> — งานค้างเยอะ ทุกหัวข้อถูกบีบเหลือทบทวนเร็ว 1 นาที
          เพื่อเคลียร์คิวให้ทัน
        </div>
      )}
      {plan.crunchMode && !plan.flashMode && (
        <div className="rounded-xl bg-violet-50 border border-violet-200 px-3 py-2 text-sm text-violet-800">
          🎯 <b>ช่วงโค้งสุดท้าย TGAT/TPAT</b> — ระบบให้ TGAT มาก่อน
          แต่กัน 20% ของเวลาไว้ให้ A-Level เสมอ
        </div>
      )}

      {/* Time budget bar */}
      <div className="rounded-xl bg-white border border-stone-200 px-3 py-2.5">
        <div className="flex justify-between text-xs text-stone-500 mb-1.5">
          <span>
            ใช้ไป {plan.usedMinutes} / {plan.capMinutes} นาที
          </span>
          <span>
            เหลือในคิว {plan.items.length} หัวข้อ
            {plan.overflowCount > 0 && ` (+${plan.overflowCount} เกินเพดาน → พรุ่งนี้)`}
          </span>
        </div>
        <div className="h-2 rounded-full bg-stone-100 overflow-hidden">
          <div
            className="h-full bg-teal-500 transition-all"
            style={{
              width: `${Math.min(100, (plan.usedMinutes / plan.capMinutes) * 100)}%`,
            }}
          />
        </div>
      </div>

      {/* Current review card */}
      {current ? (
        <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-3 shadow-sm">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${TRACK_CHIP[current.topic.examTrack]}`}
            >
              {EXAM_LABELS[current.topic.examTrack]}
            </span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
              {current.topic.subject}
            </span>
            {current.isCram && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                🔥 โค้งสุดท้าย
              </span>
            )}
          </div>

          <h2 className="text-lg font-semibold leading-snug">
            {current.topic.title}
          </h2>

          {!quizFinished ? (
            <QuizSession
              key={current.topic.id}
              topic={current.topic}
              pool={quizPool}
              onDone={() => setQuizDoneFor(current.topic.id!)}
            />
          ) : (
            <>
              {quizPool.length === 0 && (
                <p className="text-xs text-stone-400">
                  {current.topic.subjectType === "calculation"
                    ? "✍️ ลองทำโจทย์เรื่องนี้ 1–3 ข้อก่อน แล้วค่อยให้คะแนน"
                    : "🧠 พยายามนึกเนื้อหาให้ได้ก่อน แล้วค่อยเปิดโน้ตเช็ก"}
                </p>
              )}

              {current.topic.notes &&
                (showNotes ? (
                  <div className="rounded-xl bg-stone-50 border border-stone-100 p-3 text-sm whitespace-pre-wrap">
                    {current.topic.notes}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowNotes(true)}
                    className="w-full rounded-xl border border-dashed border-stone-300 py-2 text-sm text-stone-500 active:bg-stone-100"
                  >
                    👁 เปิดโน้ตเช็กคำตอบ
                  </button>
                ))}

              <GradeButtons mode="review" onGrade={grade} hints={hints} />
            </>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-stone-200 p-8 text-center space-y-2">
          {doneCount > 0 ? (
            <>
              <div className="text-4xl">🎉</div>
              <p className="font-semibold">เสร็จแล้ว! ทบทวนไป {doneCount} หัวข้อ</p>
              <p className="text-sm text-stone-500">พรุ่งนี้มาต่อ — ความสม่ำเสมอคือทั้งหมดของเกมนี้</p>
            </>
          ) : topicCount === 0 ? (
            <>
              <div className="text-4xl">📖</div>
              <p className="font-semibold">ยังไม่มีหัวข้อเลย</p>
              <p className="text-sm text-stone-500">
                เรียนอะไรมาวันนี้? กด &quot;เพิ่มหัวข้อ&quot; ได้เลย
              </p>
              <Link
                href="/add"
                className="inline-block mt-2 rounded-xl bg-teal-600 text-white px-5 py-2.5 text-sm font-medium"
              >
                + เพิ่มหัวข้อแรก
              </Link>
            </>
          ) : (
            <>
              <div className="text-4xl">✅</div>
              <p className="font-semibold">วันนี้ไม่มีอะไรต้องทบทวน</p>
              <p className="text-sm text-stone-500">
                ทุกหัวข้อยังอยู่ในช่วงจำได้ — ไปเรียนเรื่องใหม่ได้เลย
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
