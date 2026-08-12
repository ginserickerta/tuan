// POST /api/quiz — generate an 8-question exam-calibrated pool from edited notes.
import {
  errorResponse,
  getClient,
  parseStructured,
  QUIZ_MODEL,
} from "@/lib/quiz/anthropic";
import { QUIZ_SCHEMA, type QuizResult } from "@/lib/quiz/schema";
import { buildQuizSystem, buildQuizUser, type QuizRequestMeta } from "@/lib/quiz/prompts";

interface QuizRequestBody {
  meta: QuizRequestMeta;
  notes: string;
}

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as QuizRequestBody;
    const notes = body.notes?.trim();
    if (!notes || notes.length < 40) {
      return Response.json(
        { error: "โน้ตสั้นเกินไปที่จะออกข้อสอบได้ดี (ต้องมีเนื้อหาอย่างน้อย ~40 ตัวอักษร)" },
        { status: 400 },
      );
    }
    if (!body.meta?.subject || !body.meta?.title) {
      return Response.json({ error: "ข้อมูล meta ไม่ครบ" }, { status: 400 });
    }

    const client = getClient();
    const response = await client.messages.create({
      model: QUIZ_MODEL,
      max_tokens: 9000, // adaptive thinking shares this budget with the answer
      system: buildQuizSystem(),
      messages: [{ role: "user", content: buildQuizUser(body.meta, notes) }],
      output_config: {
        format: { type: "json_schema", schema: QUIZ_SCHEMA },
      },
    });

    const result = parseStructured<QuizResult>(response);
    if (!result.questions?.length) {
      return Response.json({ error: "โมเดลไม่ได้สร้างคำถามเลย ลองใหม่อีกครั้ง" }, { status: 500 });
    }
    return Response.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
