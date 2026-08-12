// Sanity checks for the bridge parser against realistic chat output.
// Run: npx tsx scripts/sim-bridge.ts
import { parseBridgeJson, buildBridgePrompt } from "../src/lib/quiz/bridge";

let pass = 0;
let fail = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

// 1) Typical claude.ai reply: prose + fenced json
const typical = `แน่นอนครับ นี่คือควิซ 8 ข้อจากโน้ตของคุณ

\`\`\`json
{
  "questions": [
    {
      "type": "mcq", "difficulty": 4, "bloom": "apply",
      "stem": "จงหา $f'(0)$ เมื่อ $f(x)=xe^{2x}$",
      "choices": ["0", "1", "2", "3"], "correctIndex": 1,
      "answer": "1", "explanation": "$f'(x)=e^{2x}(1+2x)$", "variants": []
    },
    {
      "type": "numeric", "difficulty": 5, "bloom": "apply",
      "stem": "หา $s$ เมื่อ $u=2, a=3, t=4$",
      "choices": [], "correctIndex": -1,
      "answer": "32", "explanation": "$s=ut+\\\\frac12at^2$",
      "variants": [{"stem": "u=1, a=2, t=3", "answer": "12"}]
    }
  ]
}
\`\`\`

หวังว่าจะช่วยได้นะครับ`;
const r1 = parseBridgeJson(typical);
check("prose + fence", r1.error === null && r1.questions.length === 2, JSON.stringify(r1.error));
check("keeps LaTeX", r1.questions[0]?.stem.includes("$f(x)=xe^{2x}$"));
check("keeps variants", r1.questions[1]?.variants.length === 1);

// 2) Bare JSON, no fence
const bare = `{"questions":[{"type":"short","difficulty":3,"bloom":"recall","stem":"นิยามของโมล","choices":[],"correctIndex":-1,"answer":"6.02e23 อนุภาค","explanation":"","variants":[]}]}`;
const r2 = parseBridgeJson(bare);
check("bare json", r2.error === null && r2.questions.length === 1);

// 3) Top-level array instead of {questions:[...]}
const arr = `[{"type":"mcq","difficulty":2,"bloom":"recall","stem":"ข้อใดถูก","choices":["ก","ข","ค","ง"],"correctIndex":0,"answer":"ก","explanation":"","variants":[]}]`;
const r3 = parseBridgeJson(arr);
check("top-level array", r3.error === null && r3.questions.length === 1);

// 4) Salvage: mcq with 3 choices → downgraded to short, not dropped
const bad3 = `{"questions":[{"type":"mcq","difficulty":3,"bloom":"apply","stem":"โจทย์","choices":["ก","ข","ค"],"correctIndex":0,"answer":"ก","explanation":"","variants":[]}]}`;
const r4 = parseBridgeJson(bad3);
check("mcq w/ 3 choices salvaged", r4.questions.length === 1 && r4.questions[0].type === "short");
check("  warned about it", r4.warnings.length === 1, JSON.stringify(r4.warnings));

// 5) Recover a wrong correctIndex from the answer text
const badIdx = `{"questions":[{"type":"mcq","difficulty":3,"bloom":"apply","stem":"โจทย์","choices":["ก","ข","ค","ง"],"correctIndex":9,"answer":"ค","explanation":"","variants":[]}]}`;
const r5 = parseBridgeJson(badIdx);
check("recovers correctIndex", r5.questions[0]?.correctIndex === 2, String(r5.questions[0]?.correctIndex));

// 6) Missing answer → that item dropped, others survive
const partial = `{"questions":[
 {"type":"short","difficulty":3,"bloom":"recall","stem":"มีโจทย์แต่ไม่มีเฉลย","choices":[],"correctIndex":-1,"explanation":"","variants":[]},
 {"type":"short","difficulty":3,"bloom":"recall","stem":"ข้อดี","choices":[],"correctIndex":-1,"answer":"ok","explanation":"","variants":[]}]}`;
const r6 = parseBridgeJson(partial);
check("drops bad, keeps good", r6.error === null && r6.questions.length === 1);

// 7) Out-of-range difficulty clamped; unknown bloom defaulted
const odd = `{"questions":[{"type":"short","difficulty":9,"bloom":"เดา","stem":"x","choices":[],"correctIndex":-1,"answer":"y","explanation":"","variants":[]}]}`;
const r7 = parseBridgeJson(odd);
check("clamps difficulty", r7.questions[0]?.difficulty === 5);
check("defaults bloom", r7.questions[0]?.bloom === "apply");

// 8) Garbage → clear error, no crash
const r8 = parseBridgeJson("ขอโทษครับ ผมสร้างให้ไม่ได้");
check("garbage → error", r8.error !== null && r8.questions.length === 0);
const r9 = parseBridgeJson("");
check("empty → error", r9.error !== null);

// 9) Prompt is self-contained and mentions the required pieces
const p = buildBridgePrompt(
  { subject: "ฟิสิกส์", examTrack: "ALEVEL", subjectType: "calculation", title: "การเคลื่อนที่" },
  "โน้ตทดสอบ",
);
check("prompt has 8-question rule", p.includes("8 ข้อพอดี"));
check("prompt has json shape", p.includes('"correctIndex"'));
check("prompt has subject examples", p.includes("ฟิสิกส์ A-Level"));
check("prompt embeds notes", p.includes("โน้ตทดสอบ"));
check("prompt asks numeric for calculation", p.includes("variants 2 ชุด"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
