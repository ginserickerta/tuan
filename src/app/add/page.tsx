"use client";
// หน้า "เพิ่มหัวข้อ" — manual flow:
//   1. fill the form (title / subject / track / type / notes)
//   2. optional: bridge quiz via claude.ai (free — uses the Max subscription)
//   3. Day-0 grade → creates the topic with its first schedule (+ quiz pool)
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { addTopicWithQuiz } from "@/lib/repo";
import { db } from "@/lib/db";
import { initialSchedule } from "@/lib/scheduler/engine";
import { todayISO } from "@/lib/scheduler/dates";
import { NEW_TOPICS_PER_DAY_TARGET } from "@/lib/scheduler/config";
import GradeButtons from "@/components/GradeButtons";
import BridgeQuiz from "@/components/BridgeQuiz";
import PhotoFlow from "./PhotoFlow";
import type { GeneratedQuestion } from "@/lib/quiz/schema";
import type { ExamTrack, Grade, SubjectType } from "@/lib/scheduler/types";

const SUBJECTS = [
  "TGAT1 อังกฤษ", "TGAT2 เหตุผล", "TGAT3 สมรรถนะ",
  "TPAT1", "TPAT2", "TPAT3", "TPAT4", "TPAT5",
  "คณิต 1", "คณิต 2", "ฟิสิกส์", "เคมี", "ชีววิทยา",
  "ภาษาไทย", "สังคม", "ภาษาอังกฤษ",
];

const TYPE_OPTIONS: { value: SubjectType; label: string; desc: string }[] = [
  { value: "memorize", label: "ท่องจำ", desc: "ศัพท์ / นิยาม / สูตร" },
  { value: "concept", label: "แนวคิด", desc: "ทฤษฎี / กระบวนการ" },
  { value: "calculation", label: "คำนวณ", desc: "ต้องทำโจทย์" },
];

const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";

/** Segmented option button used for exam track + content type. */
function Segment({
  active,
  onClick,
  label,
  desc,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  desc: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press rounded-xl border px-2 py-2.5 text-[13px] font-semibold ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-2"
      }`}
    >
      {label}
      <span className="mt-0.5 block text-[10px] font-normal opacity-70">{desc}</span>
    </button>
  );
}

export default function AddPage() {
  const router = useRouter();
  // manual is the default — photo mode needs API credits
  const [mode, setMode] = useState<"manual" | "photo">("manual");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [examTrack, setExamTrack] = useState<ExamTrack>("ALEVEL");
  const [subjectType, setSubjectType] = useState<SubjectType>("concept");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "bridge" | "grade">("form");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  const addedToday = useLiveQuery(
    () => db.topics.where("createdAt").equals(todayISO()).count(),
    [],
  );

  const canProceed = title.trim().length > 0 && subject.trim().length > 0;

  // Preview the first review date per grade, so the buttons explain themselves.
  const hints = Object.fromEntries(
    ([1, 2, 3, 4] as Grade[]).map((g) => [
      g,
      `${initialSchedule(g, examTrack, todayISO()).intervalDays} วัน`,
    ]),
  );

  async function saveWithGrade(g: Grade) {
    if (saving) return;
    setSaving(true);
    await addTopicWithQuiz(
      { title, subject, examTrack, subjectType, notes, dayZeroGrade: g },
      questions,
    );
    router.push("/");
  }

  if (step === "bridge") {
    return (
      <div className="page-in space-y-4">
        <header>
          <h1 className="text-[22px] font-bold tracking-tight">
            สร้างควิซผ่าน claude.ai
          </h1>
          <p className="mt-1 text-[13px] text-ink-3">
            ฟรี — ใช้ Claude Max ที่คุณจ่ายอยู่แล้ว แลกกับการคัดลอก-วาง 2 ครั้ง
          </p>
        </header>
        <BridgeQuiz
          meta={{ subject, examTrack, subjectType, title }}
          notes={notes}
          onConfirm={(qs) => {
            setQuestions(qs);
            setStep("grade");
          }}
          onCancel={() => {
            setQuestions([]);
            setStep("grade");
          }}
          confirmLabel="ใช้ควิซ → ประเมิน Day-0"
        />
        <button
          type="button"
          onClick={() => setStep("form")}
          className="press w-full py-2 text-[13px] text-ink-3"
        >
          ← กลับไปแก้โน้ต
        </button>
      </div>
    );
  }

  if (step === "grade") {
    return (
      <div className="page-in space-y-4">
        <h1 className="text-[22px] font-bold tracking-tight">
          วันนี้เข้าใจเรื่องนี้แค่ไหน?
        </h1>
        <div className="card-in rounded-2xl border border-line bg-surface p-4">
          <p className="text-[17px] font-semibold leading-snug text-balance">{title}</p>
          <p className="mt-1 text-[12px] text-ink-3">
            {subject}
            {questions.length > 0 && ` · ควิซ ${questions.length} ข้อพร้อมใช้`}
          </p>
        </div>
        <p className="text-[13px] text-ink-2">
          ตอบตามจริง — คะแนนนี้กำหนดว่าระบบจะพาเรื่องนี้กลับมาเร็วแค่ไหน
        </p>
        <GradeButtons
          mode="dayZero"
          onGrade={saveWithGrade}
          hints={hints}
          disabled={saving}
        />
        <button
          type="button"
          onClick={() => setStep("form")}
          className="press w-full py-2 text-[13px] text-ink-3"
        >
          ← กลับไปแก้
        </button>
      </div>
    );
  }

  const notesLongEnough = notes.trim().length >= 40;

  return (
    <div className="page-in space-y-4">
      <h1 className="text-[22px] font-bold tracking-tight">เพิ่มหัวข้อที่เรียนวันนี้</h1>

      {/* mode switcher — the pill slides, it doesn't blink between states */}
      <div className="relative grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-surface shadow-[var(--shadow-card)] transition-transform duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ transform: `translateX(${mode === "manual" ? 0 : 100}%)` }}
        />
        {(
          [
            ["manual", "พิมพ์เอง"],
            ["photo", "จากรูปสมุด"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMode(v)}
            className={`relative z-10 rounded-lg py-2 text-[13px] font-semibold transition-colors duration-[180ms] ${
              mode === v ? "text-ink" : "text-ink-3"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {typeof addedToday === "number" && addedToday >= NEW_TOPICS_PER_DAY_TARGET && (
        <div className="drop-in rounded-xl border border-warn-line bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
          วันนี้เพิ่มไปแล้ว {addedToday} หัวข้อ — เกิน {NEW_TOPICS_PER_DAY_TARGET}{" "}
          หัวข้อ/วัน โหลดทบทวนใน 2–3 สัปดาห์ข้างหน้าจะเริ่มหนัก เพิ่มได้แต่ควรรู้ไว้
        </div>
      )}

      {mode === "photo" && (
        <div className="rise-in space-y-4">
          <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-[12px] leading-relaxed text-ink-2">
            โหมดนี้ใช้เครดิต Claude API (~1 บาท/หัวข้อ) — ถ้ายังไม่ได้เติม
            ให้ใช้ &quot;พิมพ์เอง&quot; แล้วสร้างควิซผ่าน claude.ai ฟรีแทน
          </div>
          <PhotoFlow />
        </div>
      )}

      {mode === "manual" && (
        <div className="rise-in space-y-4">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">หัวข้อ</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น อนุพันธ์ของฟังก์ชันประกอบ (chain rule)"
              className={FIELD}
            />
            <p className="mt-1.5 text-[11px] text-ink-3">
              แตกให้เล็กพอที่จะตอบได้ว่า &quot;จำได้ / จำไม่ได้&quot; — อย่าใส่ทั้งบท
            </p>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">วิชา</label>
            <input
              list="subjects"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="เลือกหรือพิมพ์เอง"
              className={FIELD}
            />
            <datalist id="subjects">
              {SUBJECTS.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">สอบสนามไหน</label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ["TGAT_TPAT", "TGAT/TPAT", "30 ม.ค. 70"],
                  ["ALEVEL", "A-Level", "13 มี.ค. 70"],
                ] as const
              ).map(([value, label, date]) => (
                <Segment
                  key={value}
                  active={examTrack === value}
                  onClick={() => setExamTrack(value)}
                  label={label}
                  desc={date}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">ประเภทเนื้อหา</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((o) => (
                <Segment
                  key={o.value}
                  active={subjectType === o.value}
                  onClick={() => setSubjectType(o.value)}
                  label={o.label}
                  desc={o.desc}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">
              สรุปสั้นๆ <span className="font-normal text-ink-3">(2–5 ประเด็น)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              placeholder={"- สูตร/ประเด็นหลักที่ต้องจำ\n- จุดที่มักพลาด\n- โจทย์ตัวอย่างที่ทำในคาบ"}
              className={`${FIELD} leading-relaxed`}
            />
          </div>

          <div className="space-y-2 pt-1">
            <button
              type="button"
              disabled={!canProceed || !notesLongEnough}
              onClick={() => setStep("bridge")}
              className="press w-full rounded-xl bg-accent py-3 text-[14px] font-semibold text-accent-ink disabled:bg-line-strong disabled:text-ink-3"
            >
              สร้างควิซผ่าน claude.ai (ฟรี)
            </button>
            {canProceed && !notesLongEnough && (
              <p className="text-center text-[11px] text-ink-3">
                เขียนสรุปให้ยาวขึ้นอีกนิด (อย่างน้อย ~40 ตัวอักษร) ถึงจะออกข้อสอบได้ดี
              </p>
            )}
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => {
                setQuestions([]);
                setStep("grade");
              }}
              className="press w-full rounded-xl border border-line py-3 text-[14px] font-medium text-ink-2 disabled:opacity-40"
            >
              ข้ามควิซ → ประเมินเลย
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
