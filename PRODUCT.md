# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary and sole user: a Thai high-school student preparing for two national
university-entrance exams — TGAT/TPAT (2027-01-30) and A-Level (2027-03-13).
This is a personal tool, not a shared product; there is no second audience.
[Inferred from conversation history.]

## Product Purpose

A spaced-repetition review scheduler ("ทวน" — Thai for "to revise/review") that
takes topics studied in class each day and resurfaces them on a schedule tuned
to retain material through to exam day, with an optional quiz pass per topic
to force active recall. Success is a daily habit sustained for roughly seven
months without burnout, arriving at both exams with durable retention rather
than cram-only memory.

## Positioning

Unlike generic flashcard tools (Anki, Quizlet), scheduling is exam-date-aware:
intervals compress automatically as each exam approaches (capped at 20% of
days remaining), and a reserved quota keeps the later exam's material from
rotting during the earlier exam's final-crunch window. Quiz questions are
generated via a free "bridge" flow through claude.ai rather than a paid API,
so quiz quality is real-exam-calibrated without recurring cost.
[Inferred from conversation history.]

## Operating Context

Opened once daily, ideally at a consistent time; also opened right after a
class to log what was just studied. Primarily a phone, installed to the home
screen as a PWA; also used from a PC during active development. Sessions run
under a real daily time budget (30 min weekdays / 75 min weekends) and can
enter two distinct pressure states: backlog "flash mode" (reviews compressed
to 1 minute each to clear a pile-up) and a "final cram" window in the last 3
days before each exam. The tool must stay legible and low-friction inside
both states, not just in the calm default state.
[Inferred from conversation history.]

## Capabilities and Constraints

- Offline-capable PWA (service worker caches the app shell); data lives only
  in IndexedDB on the device used — no account, no login.
- A one-way "webcal" calendar feed (Apple/Google/Notion Calendar) publishes
  the forecast; a manual JSON export/import is the only cross-device bridge
  today (no two-way sync yet).
- No push notifications yet.
- UI language is Thai throughout (Noto Sans Thai); quiz content mixes Thai
  prose with inline LaTeX math.
- Stack: Next.js 16 (Turbopack) + TypeScript + Tailwind v4 + Dexie
  (IndexedDB); deployed on Vercel Hobby. [Existing codebase — not asked.]

## Brand Commitments

The name "ทวน" is load-bearing (a real Thai word meaning "to revise/review")
and should stay central rather than be genericized. No formal logo exists
beyond a placeholder teal circular repeat-arrow icon; that mark is not a
binding constraint.

## Evidence on Hand

Real topic/subject content used throughout development and safe to reuse in
mockups: subjects like "TGAT2", "A-Level ฟิสิกส์/คณิต 2", example topic
"อนุพันธ์ของฟังก์ชันประกอบ (chain rule)", the two exam countdown dates above.
An earlier hand-built HTML comparison of three visual directions exists from
this session; the user judged its execution poor — treat it as anti-reference
evidence of the old look, not as evidence to extend.

## Product Principles

- Calm over stimulating — this is a daily-habit tool used inside an already
  stressful context, not an engagement/dopamine product.
- Legible under pressure — pressure states (flash mode, backlog, final cram)
  must read at a glance, not require parsing.
- Honest about cost — never hide or soften how many minutes a review queue
  actually costs.
- One-thumb, one-hand — must work well held in one hand, late at night, in
  bed.
[Inferred from conversation history.]

## Accessibility & Inclusion

No accessibility requirement beyond correct Thai-script rendering has been
established.
