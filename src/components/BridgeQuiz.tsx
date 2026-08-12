"use client";
// Bridge mode UI: copy a self-contained prompt → paste it into claude.ai
// (covered by the user's Max subscription) → paste the JSON answer back here.
// Costs nothing; trades ~1-2 minutes of copy-paste for the API call.
import { useMemo, useState } from "react";
import MathText from "./MathText";
import { buildBridgePrompt, parseBridgeJson } from "@/lib/quiz/bridge";
import type { QuizRequestMeta } from "@/lib/quiz/prompts";
import type { GeneratedQuestion } from "@/lib/quiz/schema";

const BLOOM_TH: Record<string, string> = {
  recall: "จำ",
  apply: "ประยุกต์",
  analyze: "วิเคราะห์",
};
const TYPE_TH: Record<string, string> = {
  mcq: "ปรนัย",
  short: "ตอบสั้น",
  numeric: "คำนวณ",
};
const CHOICE_LETTER = ["ก", "ข", "ค", "ง"];

/** Numbered step header — this flow genuinely is a sequence, so it's numbered. */
function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="tnum grid h-5 w-5 shrink-0 place-items-center rounded-md bg-accent text-[11px] font-bold text-accent-ink">
        {n}
      </span>
      <div>
        <p className="text-[13px] font-semibold">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{desc}</p>
      </div>
    </div>
  );
}

export default function BridgeQuiz({
  meta,
  notes,
  onConfirm,
  onCancel,
  confirmLabel = "ใช้ควิซชุดนี้",
}: {
  meta: QuizRequestMeta;
  notes: string;
  onConfirm: (questions: GeneratedQuestion[]) => void;
  onCancel: () => void;
  confirmLabel?: string;
}) {
  const prompt = useMemo(() => buildBridgePrompt(meta, notes), [meta, notes]);
  const [copied, setCopied] = useState(false);
  const [pasted, setPasted] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[] | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  async function copyPrompt() {
    try {
      // clipboard API needs a secure context — fails over http on a LAN IP
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setShowPrompt(true);
      setError(
        "คัดลอกอัตโนมัติไม่ได้ (เบราว์เซอร์อนุญาตเฉพาะ localhost/https) — กดเลือกข้อความในกล่องด้านล่างแล้วคัดลอกเอง",
      );
    }
  }

  function checkPaste() {
    const outcome = parseBridgeJson(pasted);
    setWarnings(outcome.warnings);
    setError(outcome.error);
    setQuestions(outcome.error ? null : outcome.questions);
  }

  return (
    <div className="space-y-3">
      {/* ---- step 1: copy the prompt ---- */}
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        <Step
          n={1}
          title="คัดลอกคำสั่ง"
          desc="เอาไปวางใน claude.ai (ใช้ Max ที่จ่ายอยู่แล้ว ไม่เสียเงินเพิ่ม)"
        />

        <button
          type="button"
          onClick={() => void copyPrompt()}
          className="press w-full rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-ink"
        >
          {copied ? "คัดลอกแล้ว" : "คัดลอกคำสั่ง"}
        </button>

        <div className="flex gap-2">
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="press flex-1 rounded-lg border border-line py-2 text-center text-[12px] font-medium text-ink-2"
          >
            เปิด claude.ai ↗
          </a>
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            aria-expanded={showPrompt}
            className="press flex-1 rounded-lg border border-line py-2 text-[12px] font-medium text-ink-2"
          >
            {showPrompt ? "ซ่อนคำสั่ง" : "ดู/คัดลอกเอง"}
          </button>
        </div>

        <div className="collapse" data-open={showPrompt}>
          <div>
            <textarea
              readOnly
              value={prompt}
              rows={8}
              onFocus={(e) => e.currentTarget.select()}
              className="w-full rounded-xl border border-line bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed text-ink-2"
            />
          </div>
        </div>
      </div>

      {/* ---- step 2: paste the answer back ---- */}
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        <Step
          n={2}
          title="วางคำตอบกลับมา"
          desc="คัดลอก JSON ที่ Claude ตอบมาทั้งบล็อก แล้ววางตรงนี้ (มีข้อความอื่นปนมาก็ได้)"
        />

        <textarea
          value={pasted}
          onChange={(e) => {
            setPasted(e.target.value);
            setQuestions(null);
            setError(null);
            setWarnings([]);
          }}
          rows={5}
          placeholder='{ "questions": [ ... ] }'
          className="w-full rounded-xl border border-line bg-surface px-3 py-2 font-mono text-[12px] leading-relaxed text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          disabled={!pasted.trim()}
          onClick={checkPaste}
          className="press w-full rounded-xl bg-ink py-2.5 text-[13px] font-semibold text-bg disabled:bg-line-strong disabled:text-ink-3"
        >
          ตรวจและแปลงเป็นควิซ
        </button>

        {error && (
          <div className="rise-in rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
            {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rise-in space-y-1 rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-relaxed text-warn">
            <p className="font-semibold">แก้ให้อัตโนมัติแล้ว:</p>
            {warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* ---- step 3: preview ---- */}
      {questions && questions.length > 0 && (
        <div className="rise-in space-y-2">
          <p className="text-[13px] font-semibold">
            ได้ {questions.length} ข้อ — เช็กความถูกต้อง ลบข้อที่ไม่ดีได้
          </p>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li
                key={i}
                className="space-y-2 rounded-xl border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="tnum rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                    ระดับ {q.difficulty}
                  </span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                    {BLOOM_TH[q.bloom]}
                  </span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                    {TYPE_TH[q.type]}
                    {q.variants.length > 0 && ` +${q.variants.length} ชุดตัวเลข`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    className="press ml-auto px-1 text-danger"
                  >
                    ลบ
                  </button>
                </div>
                <div className="text-[14px] leading-relaxed">
                  <MathText text={q.stem} />
                </div>
                {q.type === "mcq" && (
                  <ol className="space-y-1 text-[12px] text-ink-2">
                    {q.choices.map((c, j) => (
                      <li
                        key={j}
                        className={j === q.correctIndex ? "font-medium text-alevel" : ""}
                      >
                        {CHOICE_LETTER[j]}. <MathText text={c} />
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-[12px] text-ink-2">
                  <b className="text-alevel">เฉลย:</b> <MathText text={q.answer} />
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="press flex-1 rounded-xl border border-line py-3 text-[13px] font-medium text-ink-2"
        >
          ข้ามควิซ
        </button>
        <button
          type="button"
          disabled={!questions || questions.length === 0}
          onClick={() => questions && onConfirm(questions)}
          className="press flex-1 rounded-xl bg-accent py-3 text-[13px] font-semibold text-accent-ink disabled:bg-line-strong disabled:text-ink-3"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
