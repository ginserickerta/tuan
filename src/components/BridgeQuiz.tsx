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

export default function BridgeQuiz({
  meta,
  notes,
  onConfirm,
  onCancel,
  confirmLabel = "ใช้ควิซชุดนี้ →",
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
    <div className="space-y-4">
      {/* ---- step 1: copy the prompt ---- */}
      <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="w-6 h-6 shrink-0 rounded-full bg-teal-600 text-white text-xs grid place-items-center font-bold">
            1
          </span>
          <div>
            <p className="font-semibold text-sm">คัดลอกคำสั่ง</p>
            <p className="text-xs text-stone-500">
              เอาไปวางใน claude.ai (ใช้ Max ที่จ่ายอยู่แล้ว ไม่เสียเงินเพิ่ม)
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={copyPrompt}
          className="w-full rounded-xl bg-teal-600 text-white py-2.5 text-sm font-semibold"
        >
          {copied ? "✓ คัดลอกแล้ว" : "📋 คัดลอกคำสั่ง"}
        </button>

        <div className="flex gap-2 text-xs">
          <a
            href="https://claude.ai/new"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 text-center rounded-lg border border-stone-300 py-2 text-stone-600"
          >
            เปิด claude.ai ↗
          </a>
          <button
            type="button"
            onClick={() => setShowPrompt(!showPrompt)}
            className="flex-1 rounded-lg border border-stone-300 py-2 text-stone-600"
          >
            {showPrompt ? "ซ่อนคำสั่ง" : "ดู/คัดลอกเอง"}
          </button>
        </div>

        {showPrompt && (
          <textarea
            readOnly
            value={prompt}
            rows={8}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-3 py-2 text-[11px] font-mono"
          />
        )}
      </div>

      {/* ---- step 2: paste the answer back ---- */}
      <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-3">
        <div className="flex items-baseline gap-2">
          <span className="w-6 h-6 shrink-0 rounded-full bg-teal-600 text-white text-xs grid place-items-center font-bold">
            2
          </span>
          <div>
            <p className="font-semibold text-sm">วางคำตอบกลับมา</p>
            <p className="text-xs text-stone-500">
              คัดลอก JSON ที่ Claude ตอบมาทั้งบล็อก แล้ววางตรงนี้ (มีข้อความอื่นปนมาก็ได้)
            </p>
          </div>
        </div>

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
          className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2 text-xs font-mono"
        />
        <button
          type="button"
          disabled={!pasted.trim()}
          onClick={checkPaste}
          className="w-full rounded-xl bg-stone-800 disabled:bg-stone-300 text-white py-2.5 text-sm font-semibold"
        >
          ตรวจและแปลงเป็นควิซ
        </button>

        {error && (
          <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}
        {warnings.length > 0 && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 space-y-0.5">
            <p className="font-semibold">แก้ให้อัตโนมัติแล้ว:</p>
            {warnings.map((w, i) => (
              <p key={i}>• {w}</p>
            ))}
          </div>
        )}
      </div>

      {/* ---- step 3: preview ---- */}
      {questions && questions.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold">
            ได้ {questions.length} ข้อ — เช็กความถูกต้อง ลบข้อที่ไม่ดีได้
          </p>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li
                key={i}
                className="rounded-xl bg-white border border-stone-200 p-3 space-y-1.5"
              >
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    ระดับ {q.difficulty}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {BLOOM_TH[q.bloom]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {TYPE_TH[q.type]}
                    {q.variants.length > 0 && ` +${q.variants.length} ชุดตัวเลข`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    className="ml-auto text-red-500 px-1"
                  >
                    ลบ
                  </button>
                </div>
                <div className="text-sm">
                  <MathText text={q.stem} />
                </div>
                {q.type === "mcq" && (
                  <ol className="text-xs text-stone-500 space-y-0.5">
                    {q.choices.map((c, j) => (
                      <li
                        key={j}
                        className={j === q.correctIndex ? "text-teal-700 font-medium" : ""}
                      >
                        {["ก", "ข", "ค", "ง"][j]}. <MathText text={c} />
                      </li>
                    ))}
                  </ol>
                )}
                <p className="text-xs text-stone-500">
                  <b className="text-teal-700">เฉลย:</b> <MathText text={q.answer} />
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
          className="flex-1 rounded-xl border border-stone-300 py-3 text-sm text-stone-600"
        >
          ข้ามควิซ
        </button>
        <button
          type="button"
          disabled={!questions || questions.length === 0}
          onClick={() => questions && onConfirm(questions)}
          className="flex-1 rounded-xl bg-teal-600 disabled:bg-stone-300 text-white py-3 text-sm font-semibold"
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  );
}
