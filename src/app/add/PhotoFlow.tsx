"use client";
// Photo → OCR → edit → quiz → Day-0 grade → save.
// The edit step is mandatory by design: OCR of Thai handwriting will make
// mistakes, and everything downstream (quiz, future reviews) reads this text.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { prepareImage, type PreparedImage } from "@/lib/image";
import { addTopicWithQuiz } from "@/lib/repo";
import { initialSchedule } from "@/lib/scheduler/engine";
import { todayISO } from "@/lib/scheduler/dates";
import GradeButtons from "@/components/GradeButtons";
import MathText from "@/components/MathText";
import type { ExamTrack, Grade, SubjectType } from "@/lib/scheduler/types";
import type { GeneratedQuestion, OcrResult, QuizResult } from "@/lib/quiz/schema";

type Step = "photos" | "extracting" | "edit" | "generating" | "preview" | "grade";

const TYPE_OPTIONS: { value: SubjectType; label: string }[] = [
  { value: "memorize", label: "ท่องจำ" },
  { value: "concept", label: "แนวคิด" },
  { value: "calculation", label: "คำนวณ" },
];

const CHOICE_LETTER = ["ก", "ข", "ค", "ง"];
const FIELD =
  "w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none";
const PILL_ON = "border-accent bg-accent-soft text-accent";
const PILL_OFF = "border-line bg-surface text-ink-2";

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? `เรียก ${url} ไม่สำเร็จ (${res.status})`);
  return json as T;
}

export default function PhotoFlow() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("photos");
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<PreparedImage[]>([]);

  // topic fields (prefilled by OCR, editable)
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [examTrack, setExamTrack] = useState<ExamTrack>("ALEVEL");
  const [subjectType, setSubjectType] = useState<SubjectType>("concept");
  const [notes, setNotes] = useState("");

  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [saving, setSaving] = useState(false);

  async function onPickFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    try {
      const prepared = await Promise.all(
        [...files].slice(0, 3 - images.length).map(prepareImage),
      );
      setImages((prev) => [...prev, ...prepared].slice(0, 3));
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านรูปไม่สำเร็จ");
    }
  }

  async function extract() {
    setStep("extracting");
    setError(null);
    try {
      const r = await postJson<OcrResult>("/api/ocr", {
        images: images.map(({ data, mediaType }) => ({ data, mediaType })),
      });
      setTitle(r.title);
      setSubject(r.subjectGuess);
      setNotes(
        (r.summaryBullets.length
          ? "สรุป:\n" + r.summaryBullets.map((b) => `- ${b}`).join("\n") + "\n\n"
          : "") + r.contentMarkdown,
      );
      setStep("edit");
    } catch (e) {
      setError(e instanceof Error ? e.message : "OCR ไม่สำเร็จ");
      setStep("photos");
    }
  }

  async function generateQuiz() {
    setStep("generating");
    setError(null);
    try {
      const r = await postJson<QuizResult>("/api/quiz", {
        meta: { subject, examTrack, subjectType, title },
        notes,
      });
      setQuestions(r.questions);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : "สร้างควิซไม่สำเร็จ");
      setStep("edit");
    }
  }

  async function saveWithGrade(g: Grade) {
    if (saving) return;
    setSaving(true);
    try {
      await addTopicWithQuiz(
        { title, subject, examTrack, subjectType, notes, dayZeroGrade: g },
        questions,
      );
      router.push("/");
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
    }
  }

  const gradeHints = Object.fromEntries(
    ([1, 2, 3, 4] as Grade[]).map((g) => [
      g,
      `${initialSchedule(g, examTrack, todayISO()).intervalDays} วัน`,
    ]),
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rise-in rounded-xl border border-danger-line bg-danger-soft px-3 py-2.5 text-[13px] leading-relaxed text-danger">
          {error}
        </div>
      )}

      {/* ---------- STEP: photos ---------- */}
      {step === "photos" && (
        <div className="rise-in space-y-4">
          <p className="text-[13px] leading-relaxed text-ink-2">
            ถ่ายหน้าสมุดที่เรียนวันนี้ (ได้สูงสุด 3 รูปต่อหัวข้อ) —
            ระบบจะถอดความ + สร้างควิซระดับข้อสอบจริงให้
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => onPickFiles(e.target.files)}
          />
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={i} className="relative aspect-[3/4]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.previewUrl}
                  alt={`รูปที่ ${i + 1}`}
                  className="h-full w-full rounded-xl border border-line object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  className="press absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] text-bg"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="press grid aspect-[3/4] place-items-center rounded-xl border-2 border-dashed border-line-strong text-2xl text-ink-3"
              >
                +
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={images.length === 0}
            onClick={extract}
            className="press w-full rounded-xl bg-accent py-3 text-[14px] font-semibold text-accent-ink disabled:bg-line-strong disabled:text-ink-3"
          >
            ถอดความจากรูป
          </button>
        </div>
      )}

      {/* ---------- STEP: extracting / generating ---------- */}
      {(step === "extracting" || step === "generating") && (
        <div className="rise-in rounded-2xl border border-line bg-surface px-6 py-10 text-center">
          {/* three dots that breathe — a progress hint, not a spinner claiming
              to know a percentage it can't know */}
          <div className="mb-3 flex justify-center gap-1.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full bg-accent motion-safe:animate-pulse"
                style={{ animationDelay: `${i * 180}ms` }}
              />
            ))}
          </div>
          <p className="text-[13px] leading-relaxed text-ink-2">
            {step === "extracting"
              ? "กำลังอ่านลายมือ + ถอดความ… (~20-40 วินาที)"
              : "กำลังออกข้อสอบ 8 ข้อจากโน้ตของคุณ… (~30-60 วินาที)"}
          </p>
        </div>
      )}

      {/* ---------- STEP: edit ---------- */}
      {step === "edit" && (
        <div className="rise-in space-y-4">
          <div className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2.5 text-[12px] leading-relaxed text-warn">
            <b className="font-semibold">เช็กก่อนไปต่อ</b> — OCR ลายมืออาจอ่านพลาดบางจุด
            แก้ตรงนี้ครั้งเดียว ควิซและการทบทวนทุกครั้งหลังจากนี้จะอิงข้อความนี้
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">หัวข้อ</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={FIELD}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold">วิชา</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={FIELD}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[13px] font-semibold">สนามสอบ</label>
              <div className="grid grid-cols-2 gap-1.5">
                {(["TGAT_TPAT", "ALEVEL"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setExamTrack(v)}
                    aria-pressed={examTrack === v}
                    className={`press rounded-xl border px-1 py-2.5 text-[12px] font-semibold ${
                      examTrack === v ? PILL_ON : PILL_OFF
                    }`}
                  >
                    {v === "TGAT_TPAT" ? "TGAT/TPAT" : "A-Level"}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">ประเภทเนื้อหา</label>
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setSubjectType(o.value)}
                  aria-pressed={subjectType === o.value}
                  className={`press rounded-xl border px-2 py-2.5 text-[13px] font-semibold ${
                    subjectType === o.value ? PILL_ON : PILL_OFF
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold">
              เนื้อหาที่ถอดความได้{" "}
              <span className="font-normal text-ink-3">(แก้ได้)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              className={`${FIELD} font-mono text-[13px] leading-relaxed`}
            />
          </div>
          <button
            type="button"
            onClick={generateQuiz}
            className="press w-full rounded-xl bg-accent py-3 text-[14px] font-semibold text-accent-ink"
          >
            สร้างควิซ 8 ข้อ
          </button>
        </div>
      )}

      {/* ---------- STEP: preview ---------- */}
      {step === "preview" && (
        <div className="rise-in space-y-3">
          <p className="text-[13px] text-ink-2">
            ได้ {questions.length} ข้อ — ไล่เช็กความถูกต้อง ข้อไหนแย่กดลบทิ้งได้
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
                    {{ recall: "จำ", apply: "ประยุกต์", analyze: "วิเคราะห์" }[q.bloom]}
                  </span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                    {{ mcq: "ปรนัย", short: "ตอบสั้น", numeric: "คำนวณ" }[q.type]}
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="press flex-1 rounded-xl border border-line py-3 text-[13px] font-medium text-ink-2"
            >
              ← แก้โน้ต
            </button>
            <button
              type="button"
              onClick={() => setStep("grade")}
              className="press flex-1 rounded-xl bg-accent py-3 text-[13px] font-semibold text-accent-ink"
            >
              ถัดไป: ประเมิน Day-0
            </button>
          </div>
        </div>
      )}

      {/* ---------- STEP: grade ---------- */}
      {step === "grade" && (
        <div className="rise-in space-y-4">
          <h2 className="text-[18px] font-bold tracking-tight">
            วันนี้เข้าใจเรื่องนี้แค่ไหน?
          </h2>
          <div className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-[16px] font-semibold leading-snug">{title}</p>
            <p className="mt-1 text-[12px] text-ink-3">
              {subject} · ควิซ {questions.length} ข้อพร้อมใช้
            </p>
          </div>
          <GradeButtons
            mode="dayZero"
            onGrade={saveWithGrade}
            hints={gradeHints}
            disabled={saving}
          />
          <button
            type="button"
            onClick={() => setStep("preview")}
            className="press w-full py-2 text-[13px] text-ink-3"
          >
            ← กลับ
          </button>
        </div>
      )}
    </div>
  );
}
