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
import BackupReminder from "@/components/BackupReminder";
import type { ExamTrack, Grade, QuizQuestion } from "@/lib/scheduler/types";

/** Color is data here: violet = TGAT/TPAT, teal = A-Level. */
const TRACK: Record<ExamTrack, { chip: string; dot: string }> = {
  TGAT_TPAT: { chip: "bg-tgat-soft text-tgat", dot: "bg-tgat" },
  ALEVEL: { chip: "bg-alevel-soft text-alevel", dot: "bg-alevel" },
};

/** How long the outgoing card gets before the next one takes its place. */
const HANDOFF_MS = 140;

function Countdown({ track, days }: { track: ExamTrack; days: number }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TRACK[track].dot}`} />
      <span className="tnum text-[15px] font-semibold leading-none">{days}</span>
      <span className="text-[11px] text-ink-3">วัน · {EXAM_LABELS[track]}</span>
    </div>
  );
}

export default function TodayPage() {
  const today = todayISO();
  const [showNotes, setShowNotes] = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  // topic id whose quiz pass is finished (grade buttons unlocked)
  const [quizDoneFor, setQuizDoneFor] = useState<number | null>(null);
  // set while the graded card animates out, before the DB write lands
  const [leaving, setLeaving] = useState(false);

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

  if (!data)
    return <p className="mt-10 text-center text-sm text-ink-3">กำลังโหลด…</p>;

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
  const usedPct = Math.min(1, plan.usedMinutes / plan.capMinutes);

  async function grade(g: Grade) {
    if (!current || leaving) return;
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    setShowNotes(false);
    setQuizDoneFor(null);
    setDoneCount((c) => c + 1);

    // Let the card leave before the queue re-orders underneath it, otherwise
    // the next topic's text pops into the old card mid-transition.
    if (!reduce) {
      setLeaving(true);
      await new Promise((r) => setTimeout(r, HANDOFF_MS));
    }
    await reviewTopic(current.topic, g, plan.flashMode || current.isCram);
    setLeaving(false);
  }

  // Preview what each button would do — makes the system legible.
  const hints = current
    ? Object.fromEntries(
        ([1, 2, 3, 4] as Grade[]).map((g) => [
          g,
          `${nextSchedule(current.topic, g, today).intervalDays} วัน`,
        ]),
      )
    : undefined;

  return (
    <div className="page-in space-y-4">
      {/* Header: date + exam countdowns */}
      <header className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="text-[22px] font-bold tracking-tight">{formatThai(today)}</h1>
          {doneCount > 0 && (
            <span className="tnum text-[11px] text-ink-3">
              ทบทวนแล้ว {doneCount}
            </span>
          )}
        </div>
        <div className="flex gap-5">
          {dTgat >= 0 && <Countdown track="TGAT_TPAT" days={dTgat} />}
          {dAlevel >= 0 && <Countdown track="ALEVEL" days={dAlevel} />}
        </div>
      </header>

      <BackupReminder topicCount={topicCount} />

      {/* Mode banners */}
      {plan.flashMode && (
        <div className="drop-in rounded-xl border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] text-danger">
          <b className="font-semibold">โหมดกู้คิว</b> — งานค้างเยอะ
          ทุกหัวข้อถูกบีบเหลือทบทวนเร็ว 1 นาที เพื่อเคลียร์คิวให้ทัน
        </div>
      )}
      {plan.crunchMode && !plan.flashMode && (
        <div className="drop-in rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5 text-[13px] text-accent">
          <b className="font-semibold">ช่วงโค้งสุดท้าย TGAT/TPAT</b> — ระบบให้ TGAT
          มาก่อน แต่กัน 20% ของเวลาไว้ให้ A-Level เสมอ
        </div>
      )}

      {/* Time budget */}
      <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
        <div className="mb-2 flex items-baseline justify-between text-[11px]">
          <span className="text-ink-2">
            <span className="tnum text-[13px] font-semibold text-ink">
              {plan.usedMinutes}
            </span>
            <span className="tnum text-ink-3"> / {plan.capMinutes}</span> นาที
          </span>
          <span className="text-ink-3">
            เหลือในคิว {plan.items.length} หัวข้อ
            {plan.overflowCount > 0 && ` · +${plan.overflowCount} ไว้พรุ่งนี้`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className={`fill h-full rounded-full ${plan.flashMode ? "bg-danger" : "bg-accent"}`}
            style={{ width: "100%", transform: `scaleX(${usedPct})` }}
          />
        </div>
      </div>

      {/* Current review card */}
      {current ? (
        <div
          key={current.topic.id}
          className={`card-in rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-card)] ${
            leaving ? "card-leaving" : ""
          }`}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${TRACK[current.topic.examTrack].chip}`}
            >
              {EXAM_LABELS[current.topic.examTrack]}
            </span>
            <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[10px] text-ink-2">
              {current.topic.subject}
            </span>
            {current.isCram && (
              <span className="rounded-md bg-danger-soft px-1.5 py-0.5 text-[10px] font-semibold text-danger">
                โค้งสุดท้าย
              </span>
            )}
          </div>

          <h2 className="mt-2.5 text-[19px] font-semibold leading-snug tracking-tight text-balance">
            {current.topic.title}
          </h2>

          <div className="mt-3.5">
            {!quizFinished ? (
              <QuizSession
                key={current.topic.id}
                topic={current.topic}
                pool={quizPool}
                onDone={() => setQuizDoneFor(current.topic.id!)}
              />
            ) : (
              <div className="space-y-3">
                {quizPool.length === 0 && (
                  <p className="text-xs text-ink-3">
                    {current.topic.subjectType === "calculation"
                      ? "ลองทำโจทย์เรื่องนี้ 1–3 ข้อก่อน แล้วค่อยให้คะแนน"
                      : "พยายามนึกเนื้อหาให้ได้ก่อน แล้วค่อยเปิดโน้ตเช็ก"}
                  </p>
                )}

                {current.topic.notes &&
                  (showNotes ? (
                    <div className="rise-in whitespace-pre-wrap rounded-xl bg-surface-2 p-3 text-[13px] leading-relaxed text-ink-2">
                      {current.topic.notes}
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowNotes(true)}
                      className="press w-full rounded-xl border border-dashed border-line-strong py-2.5 text-[13px] text-ink-2"
                    >
                      เปิดโน้ตเช็กคำตอบ
                    </button>
                  ))}

                <GradeButtons
                  mode="review"
                  onGrade={grade}
                  hints={hints}
                  disabled={leaving}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="card-in rounded-2xl border border-line bg-surface px-6 py-12 text-center">
          {doneCount > 0 ? (
            <>
              <p className="text-[17px] font-semibold">
                เสร็จแล้ว — ทบทวนไป {doneCount} หัวข้อ
              </p>
              <p className="mt-1.5 text-[13px] text-ink-3">
                พรุ่งนี้มาต่อ ความสม่ำเสมอคือทั้งหมดของเกมนี้
              </p>
            </>
          ) : topicCount === 0 ? (
            <>
              <p className="text-[17px] font-semibold">ยังไม่มีหัวข้อเลย</p>
              <p className="mt-1.5 text-[13px] text-ink-3">
                เรียนอะไรมาวันนี้? เริ่มจากหัวข้อแรกได้เลย
              </p>
              <Link
                href="/add"
                className="press mt-4 inline-block rounded-xl bg-accent px-5 py-2.5 text-[13px] font-semibold text-accent-ink"
              >
                เพิ่มหัวข้อแรก
              </Link>
            </>
          ) : (
            <>
              <p className="text-[17px] font-semibold">วันนี้ไม่มีอะไรต้องทบทวน</p>
              <p className="mt-1.5 text-[13px] text-ink-3">
                ทุกหัวข้อยังอยู่ในช่วงจำได้ — ไปเรียนเรื่องใหม่ได้เลย
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
