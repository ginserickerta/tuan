// "Bridge mode": generate a self-contained prompt the user pastes into claude.ai
// (covered by their Claude Max subscription), then paste the JSON answer back.
//
// Unlike the API route, there are no structured outputs here — chat output is
// free-form, so the parser must be lenient: strip code fences, tolerate
// surrounding prose, salvage partially-malformed questions instead of failing
// the whole paste.
import { EXAM_STYLE_EXAMPLES, subjectFamily } from "./examples";
import type { QuizRequestMeta } from "./prompts";
import type { GeneratedQuestion } from "./schema";

/** The exact JSON shape we ask claude.ai to produce (shown inline in the prompt). */
const SHAPE_EXAMPLE = `{
  "questions": [
    {
      "type": "mcq",
      "difficulty": 4,
      "bloom": "apply",
      "stem": "โจทย์ (คณิตใช้ LaTeX ระหว่าง $...$)",
      "choices": ["ตัวเลือก ก", "ตัวเลือก ข", "ตัวเลือก ค", "ตัวเลือก ง"],
      "correctIndex": 2,
      "answer": "คำตอบที่ถูก",
      "explanation": "วิธีคิดโดยย่อ",
      "variants": []
    },
    {
      "type": "numeric",
      "difficulty": 5,
      "bloom": "apply",
      "stem": "โจทย์คำนวณ",
      "choices": [],
      "correctIndex": -1,
      "answer": "42",
      "explanation": "วิธีคิด",
      "variants": [
        { "stem": "โจทย์เดิม เปลี่ยนตัวเลข", "answer": "17" },
        { "stem": "โจทย์เดิม เปลี่ยนตัวเลขอีกชุด", "answer": "8" }
      ]
    }
  ]
}`;

export function buildBridgePrompt(meta: QuizRequestMeta, notes: string): string {
  const examples = EXAM_STYLE_EXAMPLES[subjectFamily(meta.subject)];
  const typeHint =
    meta.subjectType === "calculation"
      ? 'เนื้อหาแนวคำนวณ — ให้ใช้ type "numeric" อย่างน้อย 4 ข้อ และแต่ละข้อต้องมี variants 2 ชุด (โครงเดิม เปลี่ยนตัวเลข คำนวณเฉลยใหม่ให้ถูก)'
      : meta.subjectType === "memorize"
        ? 'เนื้อหาแนวท่องจำ — ใช้ "mcq" เป็นหลัก แต่ระดับ 4–5 ต้องถามแบบประยุกต์หรือเปรียบเทียบ ห้ามถามนิยามตรงๆ'
        : 'เนื้อหาแนวแนวคิด — ผสม "mcq" กับ "short"; ระดับสูงถามเชิงวิเคราะห์กลไกหรือความเชื่อมโยง';

  return `คุณคือผู้ออกข้อสอบเข้ามหาวิทยาลัยของไทย (TGAT/TPAT และ A-Level) เขียนคำถามเป็นภาษาไทย (วิชาภาษาอังกฤษใช้อังกฤษได้) ที่ระดับความยากของข้อสอบจริง ไม่ใช่ระดับถามนิยามในตำรา

## ระดับความยาก
- 2 = แบบฝึกหัดพื้นฐาน (แนวคิดเดียว แทนสูตรตรงๆ)
- 3 = ข้อสอบระดับกลาง (มีจุดพลิกหนึ่งจุด หรือรวมสองแนวคิด)
- 4 = ข้อสอบจริงระดับยาก (หลายขั้นตอน ต้องเลือกวิธีเอง)
- 5 = ข้อคัดแยกคนเก่ง (หลายแนวคิดต่อกัน มีกับดักแนบเนียน หรือโจทย์ตั้งแปลก)

## กติกาที่ต้องทำตามเคร่งครัด
1. สร้าง **8 ข้อพอดี** — ระดับ 2, 3, 4, 5 ระดับละ 2 ข้อ
2. สัดส่วน bloom ทั้งชุด: recall 2 ข้อ, apply 4 ข้อ, analyze 2 ข้อ
3. ออกข้อสอบจาก **เนื้อหาในโน้ตด้านล่างเท่านั้น** (บวกความรู้พื้นฐานที่จำเป็นของวิชานั้น) ห้ามออกเรื่องที่ไม่มีในโน้ต
4. ข้อ mcq ต้องมี 4 ตัวเลือกพอดี **ตัวเลือกลวงต้องมาจากความเข้าใจผิดจริงหรือความพลาดที่เกิดบ่อย** (ลืม chain rule, ผิดเครื่องหมาย, ใช้เส้นผ่านศูนย์กลางแทนรัศมี ฯลฯ) ห้ามใส่ตัวเลือกที่ผิดชัดจนตัดทิ้งได้ทันที · correctIndex นับจาก 0
5. ข้อ short และ numeric: \`"choices": []\` และ \`"correctIndex": -1\`
6. ${typeHint}
7. คณิตศาสตร์ในโจทย์และเฉลยเขียนเป็น LaTeX ระหว่าง $...$
8. explanation = วิธีคิดโดยย่อเป็นภาษาไทย (บอกขั้นตอน ไม่ใช่บอกแค่คำตอบ)
9. สำนวนโจทย์ให้เหมือนข้อสอบจริง (ตั้งสถานการณ์, "ข้อใดถูกต้อง", โจทย์คำนวณหลายขั้น) ไม่ใช่ "จงบอกความหมายของ..."
10. **ตรวจเลขทุกข้อและทุก variant ให้ถูกก่อนตอบ**

## ตัวอย่างสไตล์และระดับความยากของข้อสอบจริงในวิชานี้
${examples}

## ข้อมูลหัวข้อ
วิชา: ${meta.subject}
สนามสอบ: ${meta.examTrack === "TGAT_TPAT" ? "TGAT/TPAT" : "A-Level"}
หัวข้อ: ${meta.title}

## โน้ตของนักเรียน (ขอบเขตเนื้อหาที่ออกได้)
${notes}

## รูปแบบคำตอบ
ตอบเป็น **JSON ล้วนในบล็อกโค้ดเดียว** ห้ามมีข้อความอื่นนอกบล็อก ใช้โครงนี้เป๊ะๆ:

\`\`\`json
${SHAPE_EXAMPLE}
\`\`\``;
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

export interface ParseOutcome {
  questions: GeneratedQuestion[];
  /** non-fatal per-question fixes applied */
  warnings: string[];
  /** fatal — nothing usable was parsed */
  error: string | null;
}

/** Pull a JSON object out of chat output that may have fences and/or prose. */
function extractJsonText(raw: string): string {
  let s = raw.trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  if (!s.startsWith("{") && !s.startsWith("[")) {
    const objStart = s.indexOf("{");
    const arrStart = s.indexOf("[");
    const start =
      objStart === -1 ? arrStart : arrStart === -1 ? objStart : Math.min(objStart, arrStart);
    const end = Math.max(s.lastIndexOf("}"), s.lastIndexOf("]"));
    if (start >= 0 && end > start) s = s.slice(start, end + 1);
  }
  return s;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
};

function normalizeQuestion(
  raw: Record<string, unknown>,
  i: number,
  warnings: string[],
): GeneratedQuestion | null {
  const label = `ข้อ ${i + 1}`;

  const stem = str(raw.stem) || str(raw.question);
  if (!stem) {
    warnings.push(`${label}: ไม่มีโจทย์ — ข้ามข้อนี้`);
    return null;
  }
  const answer = str(raw.answer) || str(raw.correctAnswer);
  if (!answer) {
    warnings.push(`${label}: ไม่มีเฉลย — ข้ามข้อนี้`);
    return null;
  }

  let choices = Array.isArray(raw.choices) ? raw.choices.map(str).filter(Boolean) : [];
  let correctIndex = num(raw.correctIndex) ?? -1;

  let type: GeneratedQuestion["type"] =
    raw.type === "mcq" || raw.type === "short" || raw.type === "numeric"
      ? raw.type
      : choices.length === 4
        ? "mcq"
        : "short";

  if (type === "mcq") {
    if (choices.length !== 4) {
      warnings.push(`${label}: ปรนัยแต่มี ${choices.length} ตัวเลือก — เปลี่ยนเป็นข้อเขียนตอบสั้น`);
      type = "short";
      choices = [];
      correctIndex = -1;
    } else if (correctIndex < 0 || correctIndex > 3) {
      // try to recover the index by matching the answer text
      const found = choices.findIndex((c) => c === answer);
      if (found >= 0) {
        correctIndex = found;
        warnings.push(`${label}: correctIndex ผิด — กู้คืนจากข้อความเฉลยแล้ว`);
      } else {
        warnings.push(`${label}: หาตัวเลือกที่ถูกไม่เจอ — เปลี่ยนเป็นข้อเขียนตอบสั้น`);
        type = "short";
        choices = [];
        correctIndex = -1;
      }
    }
  } else {
    choices = [];
    correctIndex = -1;
  }

  let difficulty = Math.round(num(raw.difficulty) ?? 3);
  if (difficulty < 2 || difficulty > 5) {
    warnings.push(`${label}: ระดับความยาก ${difficulty} ไม่อยู่ในช่วง 2–5 — ปรับให้อยู่ในช่วง`);
    difficulty = Math.min(5, Math.max(2, difficulty));
  }

  const bloom: GeneratedQuestion["bloom"] =
    raw.bloom === "recall" || raw.bloom === "apply" || raw.bloom === "analyze"
      ? raw.bloom
      : "apply";

  const variants = Array.isArray(raw.variants)
    ? raw.variants
        .map((v) => {
          const o = (v ?? {}) as Record<string, unknown>;
          return { stem: str(o.stem), answer: str(o.answer) };
        })
        .filter((v) => v.stem && v.answer)
    : [];

  return {
    type,
    difficulty,
    bloom,
    stem,
    choices,
    correctIndex,
    answer,
    explanation: str(raw.explanation),
    variants,
  };
}

export function parseBridgeJson(raw: string): ParseOutcome {
  const warnings: string[] = [];
  if (!raw.trim()) {
    return { questions: [], warnings, error: "ยังไม่ได้วางอะไรมา" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonText(raw));
  } catch {
    return {
      questions: [],
      warnings,
      error:
        "อ่าน JSON ไม่ออก — ตรวจว่าคัดลอกมาครบทั้งบล็อก (ตั้งแต่ { ถึง } ตัวสุดท้าย) และไม่มีข้อความอื่นปน",
    };
  }

  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { questions?: unknown }).questions)
      ? (parsed as { questions: unknown[] }).questions
      : null;

  if (!list) {
    return {
      questions: [],
      warnings,
      error: 'ไม่พบรายการคำถาม — JSON ต้องมีคีย์ "questions" ที่เป็น array',
    };
  }

  const questions = list
    .map((q, i) => normalizeQuestion((q ?? {}) as Record<string, unknown>, i, warnings))
    .filter((q): q is GeneratedQuestion => q !== null);

  if (questions.length === 0) {
    return {
      questions: [],
      warnings,
      error: "ไม่มีข้อไหนใช้ได้เลย — ลองให้ claude.ai สร้างใหม่",
    };
  }
  return { questions, warnings, error: null };
}
