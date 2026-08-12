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
      <div className="flex items-center justify-between text-[11px] text-stone-400">
        <span>
          ข้อ {idx + 1}/{served.length} · ระดับ {cur.q.difficulty} ·{" "}
          {BLOOM_LABEL[cur.q.bloom]}
        </span>
        <button type="button" onClick={onDone} className="underline">
          ข้ามควิซ
        </button>
      </div>

      <div className="text-sm font-medium leading-relaxed">
        <MathText text={cur.stem} />
      </div>

      {isMcq && (
        <div className="space-y-1.5">
          {cur.choices.map((c, i) => {
            const isCorrect = revealed && i === cur.q.correctIndex;
            const isWrongPick = revealed && picked === i && i !== cur.q.correctIndex;
            return (
              <button
                key={i}
                type="button"
                disabled={revealed}
                onClick={() => {
                  setPicked(i);
                  setRevealed(true);
                }}
                className={`w-full text-left rounded-xl border px-3 py-2 text-sm ${
                  isCorrect
                    ? "border-teal-500 bg-teal-50"
                    : isWrongPick
                      ? "border-red-400 bg-red-50"
                      : "border-stone-200 bg-white active:bg-stone-50"
                }`}
              >
                <span className="text-stone-400 mr-1.5">
                  {["ก", "ข", "ค", "ง"][i]}.
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
          className="w-full rounded-xl border border-dashed border-stone-300 py-2.5 text-sm text-stone-500 active:bg-stone-100"
        >
          ✍️ คิดคำตอบก่อน แล้วกดดูเฉลย
        </button>
      )}

      {revealed && (
        <div className="rounded-xl bg-stone-50 border border-stone-200 p-3 space-y-1.5">
          <p className="text-sm">
            <span className="font-semibold text-teal-700">เฉลย: </span>
            <MathText text={cur.answer} />
          </p>
          {cur.q.explanation && (
            <p className="text-xs text-stone-600">
              <MathText text={cur.q.explanation} />
            </p>
          )}
          <button
            type="button"
            onClick={next}
            className="w-full mt-1 rounded-xl bg-teal-600 text-white py-2 text-sm font-medium"
          >
            {idx + 1 >= served.length ? "จบควิซ → ให้คะแนนตัวเอง" : "ข้อถัดไป →"}
          </button>
        </div>
      )}
    </div>
  );
}
