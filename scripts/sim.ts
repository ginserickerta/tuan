// One-off sanity simulation for the scheduler (run: npx tsx scripts/sim.ts).
// Not a test suite — a manual verification aid.
import { initialSchedule, nextSchedule, daysToExam } from "../src/lib/scheduler/engine";
import { buildDayPlan } from "../src/lib/scheduler/queue";
import { addDays } from "../src/lib/scheduler/dates";
import type { Topic } from "../src/lib/scheduler/types";

// --- 1. Interval ladder: concept topic, always "นึกออก" (3), far from exam ---
let today = "2026-08-12";
let s = initialSchedule(3, "ALEVEL", today);
const ladder = [s.intervalDays];
for (let i = 0; i < 6; i++) {
  today = s.dueDate;
  s = { ...s, ...nextSchedule({ ...s, examTrack: "ALEVEL", subjectType: "concept" }, 3, today) };
  ladder.push(s.intervalDays);
}
console.log("ladder (grade-3 concept):", ladder.join(" → "));

// --- 2. Compression near exam ---
const nearExam = "2027-03-01"; // 12 days to A-Level
const c = nextSchedule(
  { ease: 2.5, intervalDays: 20, examTrack: "ALEVEL", subjectType: "concept" },
  4,
  nearExam,
);
console.log(`near exam (12d left): interval=${c.intervalDays} (expect ≤2 = floor(12*0.2))`);

// --- 3. Forgot resets ---
const f = nextSchedule(
  { ease: 2.3, intervalDays: 16, examTrack: "ALEVEL", subjectType: "concept" },
  1,
  "2026-09-01",
);
console.log(`forgot: interval=${f.intervalDays} (expect 1), ease=${f.ease} (expect 2.1)`);

// --- 4. Queue: crunch quota ---
function mkTopic(id: number, track: Topic["examTrack"], due: string): Topic {
  return {
    id, title: `t${id}`, subject: "x", examTrack: track, subjectType: "concept",
    notes: "", createdAt: "2026-08-12", ease: 2.3, intervalDays: 5, dueDate: due,
    lastReviewedAt: null, reviewCount: 3, lapseCount: 0, archived: false,
  };
}
const crunchDay = "2026-12-15"; // 46 days to TGAT → crunch
console.log("daysToExam TGAT on 2026-12-15:", daysToExam("TGAT_TPAT", crunchDay));
const topics: Topic[] = [
  ...Array.from({ length: 12 }, (_, i) => mkTopic(i + 1, "TGAT_TPAT", crunchDay)),
  ...Array.from({ length: 12 }, (_, i) => mkTopic(i + 101, "ALEVEL", crunchDay)),
];
const plan = buildDayPlan(topics, crunchDay, 0);
const alevelMin = plan.items
  .filter((q) => q.topic.examTrack === "ALEVEL")
  .reduce((s2, q) => s2 + q.estMinutes, 0);
console.log(
  `crunch day (cap=${plan.capMinutes}): picked=${plan.items.length}, ` +
  `A-Level minutes=${alevelMin} (expect ≥6 = 20% of 30), crunch=${plan.crunchMode}, flash=${plan.flashMode}`,
);

// --- 5. Backlog rescue ---
const many: Topic[] = Array.from({ length: 40 }, (_, i) =>
  mkTopic(i + 1, "ALEVEL", "2026-08-10"),
);
const rescue = buildDayPlan(many, "2026-08-12", 0);
console.log(
  `backlog: 40 topics ×3min=120 > 2×30 → flash=${rescue.flashMode}, picked=${rescue.items.length} (expect 30 @1min)`,
);

// --- 6. Final cram sweep ---
const cramDay = addDays("2027-03-13", -2); // 2 days before A-Level
const weak = { ...mkTopic(1, "ALEVEL", "2027-03-20"), ease: 1.9 }; // not due, but weak
const strong = { ...mkTopic(2, "ALEVEL", "2027-03-20"), ease: 2.6 };
const cram = buildDayPlan([weak, strong], cramDay, 0);
console.log(
  `final cram: picked=${cram.items.map((q) => `t${q.topic.id}(cram=${q.isCram})`).join(", ")} (expect only t1)`,
);
