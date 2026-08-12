// Server-side Anthropic client helpers. NEVER import this from client code —
// the API key must not leave the server.
import Anthropic from "@anthropic-ai/sdk";

export const QUIZ_MODEL = "claude-sonnet-5";

export function getClient(): Anthropic {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new ApiConfigError(
      "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY — สร้างไฟล์ .env.local ที่รากโปรเจกต์ แล้วใส่ ANTHROPIC_API_KEY=sk-ant-... จากนั้นรีสตาร์ต dev server",
    );
  }
  return new Anthropic({ apiKey: key });
}

export class ApiConfigError extends Error {}

/**
 * Extract the JSON payload from a structured-outputs response.
 * With adaptive thinking on, thinking blocks precede the text block — so find
 * the text block instead of assuming content[0].
 */
export function parseStructured<T>(response: Anthropic.Message): T {
  if (response.stop_reason === "refusal") {
    throw new Error("โมเดลปฏิเสธคำขอนี้ ลองใหม่หรือปรับเนื้อหา");
  }
  if (response.stop_reason === "max_tokens") {
    throw new Error("คำตอบยาวเกินโควตา token — ลองแบ่งรูป/เนื้อหาเป็นส่วนย่อยลง");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || !("text" in text)) {
    throw new Error("ไม่พบเนื้อหาในคำตอบจากโมเดล");
  }
  return JSON.parse(text.text) as T;
}

/** Uniform error → JSON response mapping for the API routes. */
export function errorResponse(err: unknown): Response {
  const msg =
    err instanceof ApiConfigError
      ? err.message
      : err instanceof Anthropic.AuthenticationError
        ? "API key ไม่ถูกต้อง — เช็ก ANTHROPIC_API_KEY ใน .env.local"
        : err instanceof Anthropic.RateLimitError
          ? "เรียกถี่เกินไป รอสักครู่แล้วลองใหม่"
          : err instanceof Anthropic.APIError
            ? `Claude API error: ${err.message}`
            : err instanceof Error
              ? err.message
              : "เกิดข้อผิดพลาดไม่ทราบสาเหตุ";
  const status = err instanceof ApiConfigError ? 503 : 500;
  return Response.json({ error: msg }, { status });
}
