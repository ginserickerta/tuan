// Prompt builders for the two server routes. Kept out of the routes so the
// wording can be tuned in one place.
import { EXAM_STYLE_EXAMPLES, subjectFamily } from "./examples";
import type { ExamTrack, SubjectType } from "../scheduler/types";

export const OCR_SYSTEM = `You are transcribing a Thai high-school student's handwritten study notes for exam preparation.

Rules:
- Transcribe faithfully. Do NOT add, complete, or "fix" content that is not on the page — the student will review against these notes, so invented content is harmful.
- Write mathematics as inline LaTeX between $...$ (display math as $$...$$). Use standard LaTeX (\\frac, \\sqrt, ^, _).
- Keep the original language (Thai notes stay Thai).
- Preserve the note structure with markdown: headings, bullet lists, numbered steps.
- If a word is illegible, write ⟨อ่านไม่ออก⟩ in its place rather than guessing.
- Worked examples/problems in the notes are valuable — transcribe them fully including the solution steps.
- summaryBullets: 2-5 bullets capturing the key formulas/ideas on the page, in Thai.
- title: a short specific topic title in Thai (what this page is about, not the subject name).
- subjectGuess: which school subject this most likely is (e.g. "คณิต 1", "ฟิสิกส์", "เคมี", "ชีววิทยา", "ภาษาอังกฤษ", "ภาษาไทย", "สังคม").`;

export function buildQuizSystem(): string {
  return `You are an exam-question writer for Thai university-entrance exams (TGAT/TPAT and A-Level). You write questions in Thai (English allowed for English-subject content) at REAL exam difficulty — not textbook-recall level.

Difficulty scale used here:
- 2 = แบบฝึกหัดพื้นฐาน (single concept, direct application)
- 3 = ข้อสอบระดับกลาง (one twist, or two concepts combined)
- 4 = ข้อสอบจริงระดับยาก (multi-step, requires choosing the approach)
- 5 = ข้อคัดแยกคนเก่ง (multiple concepts chained, subtle trap, or unusual setup)

Hard requirements:
1. Generate EXACTLY 8 questions: two each at difficulty 2, 3, 4, 5.
2. Bloom mix across the set: 2 recall, 4 apply, 2 analyze.
3. Base every question ONLY on the provided notes content (plus standard prerequisite knowledge of that subject). Never quiz on material absent from the notes.
4. MCQ questions must have exactly 4 choices. Distractors must come from REAL misconceptions or likely calculation slips (e.g. forgetting the chain rule, sign error, using diameter instead of radius) — never obviously-wrong filler. Set correctIndex accordingly (0-based).
5. For "short" and "numeric" questions: choices = [] and correctIndex = -1.
6. For calculation-type content, prefer "numeric" questions and include exactly 2 variants per numeric question — same structure, different numbers, with the answer recomputed correctly. Double-check the arithmetic of every answer and variant.
7. Math in stems/answers as inline LaTeX $...$.
8. explanation: concise solution path in Thai — the steps, not just the final answer.
9. Write stems the way real exams phrase them (see style examples) — situational setups, "ข้อใดถูกต้อง", multi-step numeric setups — not "จงบอกความหมายของ...".`;
}

export interface QuizRequestMeta {
  subject: string;
  examTrack: ExamTrack;
  subjectType: SubjectType;
  title: string;
}

export function buildQuizUser(meta: QuizRequestMeta, notes: string): string {
  const fam = subjectFamily(meta.subject);
  const examples = EXAM_STYLE_EXAMPLES[fam];
  const typeHint =
    meta.subjectType === "calculation"
      ? "เนื้อหาเป็นแนวคำนวณ — เน้น numeric questions (อย่างน้อย 4 ข้อ) พร้อม variants"
      : meta.subjectType === "memorize"
        ? "เนื้อหาเป็นแนวท่องจำ — ใช้ mcq เป็นหลัก แต่ระดับ 4-5 ต้องถามแบบประยุกต์/เปรียบเทียบ ไม่ใช่ถามนิยามตรงๆ"
        : "เนื้อหาเป็นแนวแนวคิด — ผสม mcq กับ short, ระดับสูงถามเชิงวิเคราะห์กลไก/ความเชื่อมโยง";

  return `สร้างควิซจากโน้ตต่อไปนี้

วิชา: ${meta.subject} (สนามสอบ: ${meta.examTrack === "TGAT_TPAT" ? "TGAT/TPAT" : "A-Level"})
หัวข้อ: ${meta.title}
${typeHint}

--- ตัวอย่างสไตล์และระดับความยากของข้อสอบจริงในวิชานี้ ---
${examples}

--- โน้ตของนักเรียน (ขอบเขตเนื้อหาที่ออกได้) ---
${notes}`;
}
