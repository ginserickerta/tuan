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
        (r.summaryBullets.length ? "สรุป:\n" + r.summaryBullets.map((b) => `- ${b}`).join("\n") + "\n\n" : "") +
          r.contentMarkdown,
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
      `ทบทวนอีก ${initialSchedule(g, examTrack, todayISO()).intervalDays} วัน`,
    ]),
  );

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ---------- STEP: photos ---------- */}
      {step === "photos" && (
        <>
          <p className="text-sm text-stone-500">
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
                  className="w-full h-full object-cover rounded-xl border border-stone-200"
                />
                <button
                  type="button"
                  onClick={() => setImages(images.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-stone-800 text-white text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
            {images.length < 3 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="aspect-[3/4] rounded-xl border-2 border-dashed border-stone-300 text-stone-400 text-3xl active:bg-stone-100"
              >
                +
              </button>
            )}
          </div>
          <button
            type="button"
            disabled={images.length === 0}
            onClick={extract}
            className="w-full rounded-xl bg-teal-600 disabled:bg-stone-300 text-white py-3 text-sm font-semibold"
          >
            📖 ถอดความจากรูป →
          </button>
        </>
      )}

      {/* ---------- STEP: extracting / generating ---------- */}
      {(step === "extracting" || step === "generating") && (
        <div className="rounded-2xl bg-white border border-stone-200 p-8 text-center space-y-3">
          <div className="text-3xl animate-pulse">
            {step === "extracting" ? "🔍" : "📝"}
          </div>
          <p className="text-sm text-stone-500">
            {step === "extracting"
              ? "กำลังอ่านลายมือ + ถอดความ… (~20-40 วินาที)"
              : "กำลังออกข้อสอบ 8 ข้อจากโน้ตของคุณ… (~30-60 วินาที)"}
          </p>
        </div>
      )}

      {/* ---------- STEP: edit ---------- */}
      {step === "edit" && (
        <>
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
            ✏️ <b>เช็กก่อนไปต่อ</b> — OCR ลายมืออาจอ่านพลาดบางจุด
            แก้ตรงนี้ครั้งเดียว ควิซและการทบทวนทุกครั้งหลังจากนี้จะอิงข้อความนี้
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">หัวข้อ</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-sm font-medium mb-1">วิชา</label>
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">สนามสอบ</label>
              <div className="grid grid-cols-2 gap-1">
                {(["TGAT_TPAT", "ALEVEL"] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setExamTrack(v)}
                    className={`rounded-xl border px-1 py-2.5 text-xs font-medium ${
                      examTrack === v
                        ? "border-teal-500 bg-teal-50 text-teal-700"
                        : "border-stone-200 bg-white text-stone-500"
                    }`}
                  >
                    {v === "TGAT_TPAT" ? "TGAT/TPAT" : "A-Level"}
                  </button>
                ))}
              </div>
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
                  className={`rounded-xl border px-2 py-2 text-sm font-medium ${
                    subjectType === o.value
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-stone-200 bg-white text-stone-500"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">
              เนื้อหาที่ถอดความได้ <span className="text-stone-400 font-normal">(แก้ได้)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono"
            />
          </div>
          <button
            type="button"
            onClick={generateQuiz}
            className="w-full rounded-xl bg-teal-600 text-white py-3 text-sm font-semibold"
          >
            📝 สร้างควิซ 8 ข้อ →
          </button>
        </>
      )}

      {/* ---------- STEP: preview ---------- */}
      {step === "preview" && (
        <>
          <p className="text-sm text-stone-500">
            ได้ {questions.length} ข้อ — ไล่เช็กความถูกต้อง ข้อไหนแย่กดลบทิ้งได้
          </p>
          <ul className="space-y-2">
            {questions.map((q, i) => (
              <li key={i} className="rounded-xl bg-white border border-stone-200 p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    ระดับ {q.difficulty}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {{ recall: "จำ", apply: "ประยุกต์", analyze: "วิเคราะห์" }[q.bloom]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {{ mcq: "ปรนัย", short: "ตอบสั้น", numeric: "คำนวณ" }[q.type]}
                    {q.variants.length > 0 && ` +${q.variants.length} ชุดตัวเลข`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuestions(questions.filter((_, j) => j !== i))}
                    className="ml-auto text-red-500 text-xs px-1"
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
                      <li key={j} className={j === q.correctIndex ? "text-teal-700 font-medium" : ""}>
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
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep("edit")}
              className="flex-1 rounded-xl border border-stone-300 py-3 text-sm text-stone-600"
            >
              ← แก้โน้ต
            </button>
            <button
              type="button"
              onClick={() => setStep("grade")}
              className="flex-1 rounded-xl bg-teal-600 text-white py-3 text-sm font-semibold"
            >
              ถัดไป: ประเมิน Day-0 →
            </button>
          </div>
        </>
      )}

      {/* ---------- STEP: grade ---------- */}
      {step === "grade" && (
        <>
          <h2 className="text-lg font-bold">วันนี้เข้าใจเรื่องนี้แค่ไหน?</h2>
          <div className="rounded-2xl bg-white border border-stone-200 p-4 space-y-1">
            <p className="font-semibold">{title}</p>
            <p className="text-xs text-stone-500">
              {subject} · ควิซ {questions.length} ข้อพร้อมใช้
            </p>
          </div>
          <GradeButtons mode="dayZero" onGrade={saveWithGrade} hints={gradeHints} />
          <button
            type="button"
            onClick={() => setStep("preview")}
            className="w-full py-2 text-sm text-stone-400"
          >
            ← กลับ
          </button>
        </>
      )}
    </div>
  );
}
