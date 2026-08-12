// POST /api/ocr — transcribe 1-3 notebook photos into structured markdown notes.
// Runs server-side only (API key stays here).
import type Anthropic from "@anthropic-ai/sdk";
import {
  errorResponse,
  getClient,
  parseStructured,
  QUIZ_MODEL,
} from "@/lib/quiz/anthropic";
import { OCR_SCHEMA, type OcrResult } from "@/lib/quiz/schema";
import { OCR_SYSTEM } from "@/lib/quiz/prompts";

interface OcrRequestBody {
  images: { data: string; mediaType: string }[]; // base64 (no data: prefix)
}

const ALLOWED_MEDIA = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export async function POST(req: Request): Promise<Response> {
  try {
    const body = (await req.json()) as OcrRequestBody;
    if (!body.images?.length || body.images.length > 3) {
      return Response.json({ error: "ส่งรูปได้ 1–3 รูปต่อครั้ง" }, { status: 400 });
    }
    for (const img of body.images) {
      if (!ALLOWED_MEDIA.has(img.mediaType)) {
        return Response.json(
          { error: `ชนิดไฟล์ ${img.mediaType} ไม่รองรับ` },
          { status: 400 },
        );
      }
    }

    const client = getClient();
    const content: Anthropic.ContentBlockParam[] = [
      ...body.images.map(
        (img): Anthropic.ImageBlockParam => ({
          type: "image",
          source: {
            type: "base64",
            media_type: img.mediaType as "image/jpeg",
            data: img.data,
          },
        }),
      ),
      {
        type: "text",
        text: "ถอดความหน้าสมุดเหล่านี้ตามกติกาใน system prompt (ทุกรูปเป็นเรื่องเดียวกัน ให้รวมเป็นโน้ตชุดเดียว)",
      },
    ];

    const response = await client.messages.create({
      model: QUIZ_MODEL,
      max_tokens: 6000,
      system: OCR_SYSTEM,
      messages: [{ role: "user", content }],
      output_config: {
        format: { type: "json_schema", schema: OCR_SCHEMA },
      },
    });

    return Response.json(parseStructured<OcrResult>(response));
  } catch (err) {
    return errorResponse(err);
  }
}
