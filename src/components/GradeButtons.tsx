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

// A semantic ramp that lands on the two brand hues at the good end, so the
// palette stays at four colors total instead of inventing a fifth.
const COLORS: Record<Grade, string> = {
  1: "bg-danger-soft text-danger border-danger-line",
  2: "bg-warn-soft text-warn border-warn-line",
  3: "bg-alevel-soft text-alevel border-transparent",
  4: "bg-accent-soft text-accent border-accent-line",
};

export default function GradeButtons({
  mode,
  onGrade,
  hints,
  disabled = false,
}: {
  mode: "dayZero" | "review";
  onGrade: (g: Grade) => void;
  /** optional per-grade hint line, e.g. next interval preview "→ 3 วัน" */
  hints?: Partial<Record<Grade, string>>;
  disabled?: boolean;
}) {
  const labels = mode === "dayZero" ? DAY_ZERO_LABELS : REVIEW_LABELS;
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {([1, 2, 3, 4] as Grade[]).map((g) => (
        <button
          key={g}
          type="button"
          disabled={disabled}
          onClick={() => onGrade(g)}
          className={`press rounded-xl border px-1 py-2.5 text-center disabled:opacity-40 ${COLORS[g]}`}
        >
          <div className="text-[13px] font-semibold leading-tight">
            {labels[g].label}
          </div>
          {labels[g].sub && (
            <div className="text-[10px] leading-tight opacity-70">
              {labels[g].sub}
            </div>
          )}
          {hints?.[g] && (
            <div className="tnum mt-1 text-[10px] opacity-65">{hints[g]}</div>
          )}
        </button>
      ))}
    </div>
  );
}
