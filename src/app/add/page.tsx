"use client";
// หน้า "เพิ่มหัวข้อ" — two steps:
//   1. fill the form (title / subject / track / type / notes)
//   2. Day-0 grade → creates the topic with its first schedule
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useLiveQuery } from "dexie-react-hooks";
import { addTopic } from "@/lib/repo";
import { db } from "@/lib/db";
import { initialSchedule } from "@/lib/scheduler/engine";
import { todayISO } from "@/lib/scheduler/dates";
import { NEW_TOPICS_PER_DAY_TARGET } from "@/lib/scheduler/config";
import GradeButtons from "@/components/GradeButtons";
import PhotoFlow from "./PhotoFlow";
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

export default function AddPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"photo" | "manual">("photo");
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [examTrack, setExamTrack] = useState<ExamTrack>("ALEVEL");
  const [subjectType, setSubjectType] = useState<SubjectType>("concept");
  const [notes, setNotes] = useState("");
  const [step, setStep] = useState<"form" | "grade">("form");
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
      `ทบทวนอีก ${initialSchedule(g, examTrack, todayISO()).intervalDays} วัน`,
    ]),
  );

  async function saveWithGrade(g: Grade) {
    if (saving) return;
    setSaving(true);
    await addTopic({ title, subject, examTrack, subjectType, notes, dayZeroGrade: g });
    router.push("/");
  }

  if (step === "grade") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold">วันนี้เข้าใจเรื่องนี้แค่ไหน?</h1>
        <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-1">
          <p className="font-semibold">{title}</p>
          <p className="text-xs text-stone-500">{subject}</p>
        </div>
        <p className="text-sm text-stone-500">
          ตอบตามจริง — คะแนนนี้กำหนดว่าระบบจะพาเรื่องนี้กลับมาเร็วแค่ไหน
        </p>
        <GradeButtons mode="dayZero" onGrade={saveWithGrade} hints={hints} />
        <button
          type="button"
          onClick={() => setStep("form")}
          className="w-full py-2 text-sm text-stone-400"
        >
          ← กลับไปแก้
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">เพิ่มหัวข้อที่เรียนวันนี้</h1>

      {/* mode switcher */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-stone-200/60 p-1">
        {(
          [
            ["photo", "📷 จากรูปสมุด"],
            ["manual", "✍️ พิมพ์เอง"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setMode(v)}
            className={`rounded-lg py-2 text-sm font-medium ${
              mode === v ? "bg-white shadow-sm text-stone-800" : "text-stone-500"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {typeof addedToday === "number" && addedToday >= NEW_TOPICS_PER_DAY_TARGET && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
          ⚠️ วันนี้เพิ่มไปแล้ว {addedToday} หัวข้อ — เกิน {NEW_TOPICS_PER_DAY_TARGET}{" "}
          หัวข้อ/วัน โหลดทบทวนใน 2–3 สัปดาห์ข้างหน้าจะเริ่มหนัก
          เพิ่มได้แต่ควรรู้ไว้
        </div>
      )}

      {mode === "photo" && <PhotoFlow />}

      {mode === "manual" && (
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">หัวข้อ</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="เช่น อนุพันธ์ของฟังก์ชันประกอบ (chain rule)"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <p className="text-[11px] text-stone-400 mt-1">
            แตกให้เล็กพอที่จะตอบได้ว่า &quot;จำได้ / จำไม่ได้&quot; — อย่าใส่ทั้งบท
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">วิชา</label>
          <input
            list="subjects"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="เลือกหรือพิมพ์เอง"
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <datalist id="subjects">
            {SUBJECTS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">สอบสนามไหน</label>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["TGAT_TPAT", "TGAT/TPAT", "30 ม.ค. 70"],
                ["ALEVEL", "A-Level", "13 มี.ค. 70"],
              ] as const
            ).map(([value, label, date]) => (
              <button
                key={value}
                type="button"
                onClick={() => setExamTrack(value)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium ${
                  examTrack === value
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                {label}
                <div className="text-[10px] font-normal opacity-60">{date}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">ประเภทเนื้อหา</label>
          <div className="grid grid-cols-3 gap-2">
            {TYPE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setSubjectType(o.value)}
                className={`rounded-xl border px-2 py-2.5 text-sm font-medium ${
                  subjectType === o.value
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                {o.label}
                <div className="text-[10px] font-normal opacity-60">{o.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            สรุปสั้นๆ <span className="text-stone-400 font-normal">(2–5 ประเด็น)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={5}
            placeholder={"- สูตร/ประเด็นหลักที่ต้องจำ\n- จุดที่มักพลาด\n- โจทย์ตัวอย่างที่ทำในคาบ"}
            className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        <button
          type="button"
          disabled={!canProceed}
          onClick={() => setStep("grade")}
          className="w-full rounded-xl bg-teal-600 disabled:bg-stone-300 text-white py-3 text-sm font-semibold"
        >
          ถัดไป: ประเมินความเข้าใจ →
        </button>
      </div>
      )}
    </div>
  );
}
