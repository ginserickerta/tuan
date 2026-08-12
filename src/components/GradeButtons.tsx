"use client";
import type { Grade } from "@/lib/scheduler/types";

// Labels differ between Day-0 (just studied) and review days — same 1–4 scale.
const DAY_ZERO_LABELS: Record<Grade, { label: string; sub: string }> = {
  1: { label: "งง", sub: "ตามไม่ทัน" },
  2: { label: "พอเข้าใจ", sub: "ไม่มั่นใจ" },
  3: { label: "เข้าใจดี", sub: "" },
  4: { label: "ง่ายมาก", sub: "รู้อยู่แล้ว" },
};

const REVIEW_LABELS: Record<Grade, { label: string; sub: string }> = {
  1: { label: "ลืมสนิท", sub: "" },
  2: { label: "นึกออกยาก", sub: "" },
  3: { label: "นึกออก", sub: "" },
  4: { label: "ง่ายมาก", sub: "" },
};

const COLORS: Record<Grade, string> = {
  1: "bg-red-50 text-red-700 border-red-200 active:bg-red-100",
  2: "bg-amber-50 text-amber-700 border-amber-200 active:bg-amber-100",
  3: "bg-teal-50 text-teal-700 border-teal-200 active:bg-teal-100",
  4: "bg-sky-50 text-sky-700 border-sky-200 active:bg-sky-100",
};

export default function GradeButtons({
  mode,
  onGrade,
  hints,
}: {
  mode: "dayZero" | "review";
  onGrade: (g: Grade) => void;
  /** optional per-grade hint line, e.g. next interval preview "→ 3 วัน" */
  hints?: Partial<Record<Grade, string>>;
}) {
  const labels = mode === "dayZero" ? DAY_ZERO_LABELS : REVIEW_LABELS;
  return (
    <div className="grid grid-cols-4 gap-2">
      {([1, 2, 3, 4] as Grade[]).map((g) => (
        <button
          key={g}
          type="button"
          onClick={() => onGrade(g)}
          className={`rounded-xl border px-1 py-2.5 text-center transition-colors ${COLORS[g]}`}
        >
          <div className="text-sm font-semibold leading-tight">
            {labels[g].label}
          </div>
          {labels[g].sub && (
            <div className="text-[10px] opacity-70 leading-tight">
              {labels[g].sub}
            </div>
          )}
          {hints?.[g] && (
            <div className="text-[10px] mt-0.5 opacity-60">{hints[g]}</div>
          )}
        </button>
      ))}
    </div>
  );
}
