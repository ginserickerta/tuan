"use client";
// Serves quiz questions for one topic during review, before grading.
//
// Selection rules:
//   - band: |difficulty − topic.quizLevel| ≤ 1 (fallback: whole pool)
//   - count by content type: memorize 3, concept 2, calculation 1
//   - numeric questions with variants: pick the base or a variant at random,
//     so calculation answers can't be memorized across passes
import { useMemo, useState } from "react";
import MathText from "./MathText";
import type { QuizQuestion, SubjectType, Topic } from "@/lib/scheduler/types";

const SERVE_COUNT: Record<SubjectType, number> = {
  memorize: 3,
  concept: 2,
  calculation: 1,
};

const BLOOM_LABEL: Record<string, string> = {
  recall: "จำ",
  apply: "ประยุกต์",
  analyze: "วิเคราะห์",
};

const CHOICE_LETTER = ["ก", "ข", "ค", "ง"];

interface Served {
  q: QuizQuestion;
  stem: string;
  answer: string;
  choices: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function selectQuestions(topic: Topic, pool: QuizQuestion[]): Served[] {
  const level = topic.quizLevel ?? 3;
  let band = pool.filter((q) => Math.abs(q.difficulty - level) <= 1);
  if (band.length === 0) band = pool;
  const count = SERVE_COUNT[topic.subjectType];
  return shuffle(band)
    .slice(0, count)
    .map((q) => {
      // numeric re-roll: base form or one of the variants, at random
      if (q.type === "numeric" && q.variants.length > 0) {
        const all = [{ stem: q.stem, answer: q.answer }, ...q.variants];
        const pick = all[Math.floor(Math.random() * all.length)];
        return { q, stem: pick.stem, answer: pick.answer, choices: [] };
      }
      return { q, stem: q.stem, answer: q.answer, choices: q.choices };
    });
}

export default function QuizSession({
  topic,
  pool,
  onDone,
}: {
  topic: Topic;
  pool: QuizQuestion[];
  onDone: () => void;
}) {
  // Re-select only when the topic changes (not on every render)
  const served = useMemo(() => selectQuestions(topic, pool), [topic.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(null);

  if (served.length === 0) return null;
  const cur = served[idx];
  const isMcq = cur.q.type === "mcq" && cur.choices.length === 4;

  function next() {
    if (idx + 1 >= served.length) {
      onDone();
    } else {
      setIdx(idx + 1);
      setRevealed(false);
      setPicked(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-[11px] text-ink-3">
        <span className="flex items-center gap-1.5">
          {/* progress as pips, not a number the eye has to parse */}
          <span className="flex gap-1">
            {served.map((_, i) => (
              <span
                key={i}
                className={`h-1 w-4 rounded-full transition-colors duration-[180ms] ${
                  i < idx ? "bg-accent" : i === idx ? "bg-accent/50" : "bg-line-strong"
                }`}
              />
            ))}
          </span>
          <span className="tnum">ระดับ {cur.q.difficulty}</span>
          <span>· {BLOOM_LABEL[cur.q.bloom]}</span>
        </span>
        <button type="button" onClick={onDone} className="press text-ink-3 underline">
          ข้ามควิซ
        </button>
      </div>

      <div key={idx} className="rise-in space-y-3">
        <div className="text-[15px] font-medium leading-relaxed">
          <MathText text={cur.stem} />
        </div>

        {isMcq && (
          <div className="stagger space-y-1.5">
            {cur.choices.map((c, i) => {
              const isCorrect = revealed && i === cur.q.correctIndex;
              const isWrongPick =
                revealed && picked === i && i !== cur.q.correctIndex;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={revealed}
                  onClick={() => {
                    setPicked(i);
                    setRevealed(true);
                  }}
                  className={`press w-full rounded-xl border px-3 py-2.5 text-left text-[14px] ${
                    isCorrect
                      ? "border-alevel bg-alevel-soft text-alevel"
                      : isWrongPick
                        ? "border-danger-line bg-danger-soft text-danger"
                        : "border-line bg-surface"
                  }`}
                >
                  <span
                    className={`mr-1.5 ${isCorrect || isWrongPick ? "opacity-70" : "text-ink-3"}`}
                  >
                    {CHOICE_LETTER[i]}.
                  </span>
                  <MathText text={c} />
                </button>
              );
            })}
          </div>
        )}

        {!isMcq && !revealed && (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className="press w-full rounded-xl border border-dashed border-line-strong py-2.5 text-[13px] text-ink-2"
          >
            คิดคำตอบในใจก่อน แล้วกดดูเฉลย
          </button>
        )}

        {revealed && (
          <div className="rise-in space-y-2 rounded-xl border border-line bg-surface-2 p-3">
            <p className="text-[14px]">
              <span className="font-semibold text-alevel">เฉลย: </span>
              <MathText text={cur.answer} />
            </p>
            {cur.q.explanation && (
              <p className="text-[12px] leading-relaxed text-ink-2">
                <MathText text={cur.q.explanation} />
              </p>
            )}
            <button
              type="button"
              onClick={next}
              className="press mt-1 w-full rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-ink"
            >
              {idx + 1 >= served.length ? "จบควิซ → ให้คะแนนตัวเอง" : "ข้อถัดไป"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
