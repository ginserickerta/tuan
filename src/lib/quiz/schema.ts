// JSON Schemas for Claude structured outputs (output_config.format), plus the
// matching TS types the client consumes. All fields are required with sentinel
// values (empty array / -1) instead of optionals — keeps the schema strict-safe.
//
// Structured-outputs constraints respected here: additionalProperties:false on
// every object, no min/max constraints (counts are enforced in the prompt).

export interface OcrResult {
  /** short topic title suggestion, e.g. "อนุพันธ์ของฟังก์ชันประกอบ" */
  title: string;
  /** best-guess subject from the page content, e.g. "คณิต 1" */
  subjectGuess: string;
  /** 2–5 key bullets summarizing the page */
  summaryBullets: string[];
  /** full transcription as markdown; math as inline $...$ LaTeX; illegible parts marked ⟨อ่านไม่ออก⟩ */
  contentMarkdown: string;
}

export const OCR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    subjectGuess: { type: "string" },
    summaryBullets: { type: "array", items: { type: "string" } },
    contentMarkdown: { type: "string" },
  },
  required: ["title", "subjectGuess", "summaryBullets", "contentMarkdown"],
} as const;

export interface GeneratedQuestion {
  type: "mcq" | "short" | "numeric";
  difficulty: number; // 2..5
  bloom: "recall" | "apply" | "analyze";
  stem: string;
  choices: string[]; // exactly 4 for mcq, [] otherwise
  correctIndex: number; // 0..3 for mcq, -1 otherwise
  answer: string;
  explanation: string;
  variants: { stem: string; answer: string }[]; // numeric re-rolls, [] otherwise
}

export interface QuizResult {
  questions: GeneratedQuestion[];
}

export const QUIZ_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["mcq", "short", "numeric"] },
          difficulty: { type: "integer", enum: [2, 3, 4, 5] },
          bloom: { type: "string", enum: ["recall", "apply", "analyze"] },
          stem: { type: "string" },
          choices: { type: "array", items: { type: "string" } },
          correctIndex: { type: "integer" },
          answer: { type: "string" },
          explanation: { type: "string" },
          variants: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                stem: { type: "string" },
                answer: { type: "string" },
              },
              required: ["stem", "answer"],
            },
          },
        },
        required: [
          "type",
          "difficulty",
          "bloom",
          "stem",
          "choices",
          "correctIndex",
          "answer",
          "explanation",
          "variants",
        ],
      },
    },
  },
  required: ["questions"],
} as const;
