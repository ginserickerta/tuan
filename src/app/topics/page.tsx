"use client";
// หน้า "คลัง" — every topic with its scheduling state, search, the 30-day load
// forecast, and the calendar / backup panels.
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { deleteTopic, saveQuestions, setArchived } from "@/lib/repo";
import { todayISO, diffDays, formatThai } from "@/lib/scheduler/dates";
import { EXAM_LABELS } from "@/lib/scheduler/config";
import BridgeQuiz from "@/components/BridgeQuiz";
import BackupPanel from "@/components/BackupPanel";
import CalendarExport from "@/components/CalendarExport";
import LoadForecastChart from "@/components/LoadForecastChart";
import type { ExamTrack, Topic } from "@/lib/scheduler/types";

const TRACK: Record<ExamTrack, string> = {
  TGAT_TPAT: "bg-tgat-soft text-tgat",
  ALEVEL: "bg-alevel-soft text-alevel",
};

function dueLabel(t: Topic, today: string): { text: string; cls: string } {
  const d = diffDays(today, t.dueDate);
  if (d < 0) return { text: `ค้าง ${-d} วัน`, cls: "text-danger font-semibold" };
  if (d === 0) return { text: "วันนี้", cls: "text-accent font-semibold" };
  return { text: formatThai(t.dueDate), cls: "text-ink-3" };
}

function matchesSearch(t: Topic, q: string): boolean {
  if (!q) return true;
  return (
    t.title.toLowerCase().includes(q) ||
    t.subject.toLowerCase().includes(q) ||
    t.notes.toLowerCase().includes(q)
  );
}

/** Disclosure whose body animates open via grid-template-rows (no layout thrash). */
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-line pt-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="press flex w-full items-center justify-between text-[13px] font-medium text-ink-2"
      >
        {title}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="text-ink-3 transition-transform duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)" }}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      <div className="disclosure" data-open={open}>
        <div>
          <div className="pt-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

export default function TopicsPage() {
  const today = todayISO();
  const [expanded, setExpanded] = useState<number | null>(null);
  const [quizFor, setQuizFor] = useState<Topic | null>(null);
  const [search, setSearch] = useState("");
  const topics = useLiveQuery(() => db.topics.toArray(), []);
  // question count per topic, so the library shows which topics have a quiz
  const quizCounts = useLiveQuery(async () => {
    const all = await db.questions.toArray();
    const m = new Map<number, number>();
    for (const q of all) m.set(q.topicId, (m.get(q.topicId) ?? 0) + 1);
    return m;
  }, []);

  if (!topics)
    return <p className="mt-10 text-center text-sm text-ink-3">กำลังโหลด…</p>;

  // Full-screen bridge flow for one topic
  if (quizFor) {
    const existing = quizCounts?.get(quizFor.id!) ?? 0;
    return (
      <div className="page-in space-y-4">
        <h1 className="text-[22px] font-bold tracking-tight">เพิ่มควิซให้หัวข้อนี้</h1>
        <div className="rounded-2xl border border-line bg-surface p-4">
          <p className="text-[16px] font-semibold leading-snug">{quizFor.title}</p>
          <p className="mt-1 text-[12px] text-ink-3">
            {quizFor.subject}
            {existing > 0 && ` · มีควิซอยู่แล้ว ${existing} ข้อ (ชุดใหม่จะแทนที่ของเดิม)`}
          </p>
        </div>
        {quizFor.notes.trim().length < 40 ? (
          <div className="rounded-xl border border-warn-line bg-warn-soft px-3 py-2.5 text-[13px] leading-relaxed text-warn">
            หัวข้อนี้ยังไม่มีโน้ต (หรือสั้นเกินไป) — ต้องมีเนื้อหาก่อนถึงจะออกข้อสอบได้
            กลับไปเพิ่มโน้ตในหัวข้อนี้ก่อน
          </div>
        ) : (
          <BridgeQuiz
            meta={{
              subject: quizFor.subject,
              examTrack: quizFor.examTrack,
              subjectType: quizFor.subjectType,
              title: quizFor.title,
            }}
            notes={quizFor.notes}
            confirmLabel="บันทึกควิซ"
            onCancel={() => setQuizFor(null)}
            onConfirm={async (qs) => {
              await saveQuestions(quizFor.id!, qs, "replace");
              setQuizFor(null);
            }}
          />
        )}
        <button
          type="button"
          onClick={() => setQuizFor(null)}
          className="press w-full py-2 text-[13px] text-ink-3"
        >
          ← กลับไปคลัง
        </button>
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const active = topics
    .filter((t) => !t.archived)
    .filter((t) => matchesSearch(t, q))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const archived = topics.filter((t) => t.archived).filter((t) => matchesSearch(t, q));

  return (
    <div className="page-in space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">คลังหัวข้อ</h1>
        <span className="tnum text-[13px] text-ink-3">{active.length} หัวข้อ</span>
      </header>

      {topics.length > 0 && (
        <div className="relative">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อหัวข้อ วิชา หรือเนื้อหาโน้ต"
            className="w-full rounded-xl border border-line bg-surface py-2.5 pl-9 pr-3 text-[14px] text-ink placeholder:text-ink-3 focus:border-accent focus:outline-none"
          />
        </div>
      )}

      {topics.length === 0 && (
        <p className="py-12 text-center text-[13px] text-ink-3">
          ยังไม่มีหัวข้อ — เริ่มที่แท็บ &quot;เพิ่มหัวข้อ&quot;
        </p>
      )}

      {topics.length > 0 && q && active.length === 0 && archived.length === 0 && (
        <p className="py-12 text-center text-[13px] text-ink-3">
          ไม่พบหัวข้อที่ตรงกับ &quot;{search.trim()}&quot;
        </p>
      )}

      <ul className="space-y-1.5">
        {active.map((t) => {
          const due = dueLabel(t, today);
          const open = expanded === t.id;
          const quizCount = quizCounts?.get(t.id!) ?? 0;
          return (
            <li
              key={t.id}
              className="overflow-hidden rounded-xl border border-line bg-surface px-3 py-2.5"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpanded(open ? null : t.id!)}
                aria-expanded={open}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex-1 text-[14px] font-medium leading-snug">
                    {t.title}
                  </span>
                  <span className={`shrink-0 text-[11px] ${due.cls}`}>{due.text}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className={`rounded-md px-1.5 py-0.5 font-semibold ${TRACK[t.examTrack]}`}>
                    {EXAM_LABELS[t.examTrack]}
                  </span>
                  <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                    {t.subject}
                  </span>
                  {quizCount > 0 && (
                    <span className="rounded-md bg-surface-2 px-1.5 py-0.5 text-ink-2">
                      ควิซ {quizCount} ข้อ
                    </span>
                  )}
                  <span className="tnum text-ink-3">
                    ทุก {t.intervalDays} วัน · ease {t.ease.toFixed(2)}
                    {t.lapseCount > 0 && ` · ลืม ${t.lapseCount}`}
                  </span>
                </div>
              </button>

              <div className="disclosure" data-open={open}>
                <div>
                  <div className="mt-2.5 space-y-2.5 border-t border-line pt-2.5">
                    {t.notes && (
                      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-ink-2">
                        {t.notes}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => setQuizFor(t)}
                        className="press rounded-lg bg-accent-soft px-3 py-1.5 text-[11px] font-semibold text-accent"
                      >
                        {quizCount > 0 ? "สร้างควิซใหม่" : "เพิ่มควิซ"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setArchived(t.id!, true)}
                        className="press rounded-lg bg-surface-2 px-3 py-1.5 text-[11px] font-medium text-ink-2"
                      >
                        เก็บเข้ากรุ
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm(`ลบ "${t.title}" ถาวร?`)) void deleteTopic(t.id!);
                        }}
                        className="press rounded-lg bg-danger-soft px-3 py-1.5 text-[11px] font-medium text-danger"
                      >
                        ลบ
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <Section title={`ในกรุ (${archived.length})`}>
          <ul className="space-y-1.5">
            {archived.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2.5"
              >
                <span className="text-[13px] text-ink-2">{t.title}</span>
                <button
                  type="button"
                  onClick={() => setArchived(t.id!, false)}
                  className="press shrink-0 rounded-lg border border-line bg-surface px-3 py-1.5 text-[11px] font-medium text-ink-2"
                >
                  เอากลับมา
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="พยากรณ์โหลด 30 วัน">
        <div className="rounded-xl border border-line bg-surface p-3">
          <LoadForecastChart />
        </div>
      </Section>

      <Section title="เพิ่มลงปฏิทิน">
        <CalendarExport />
      </Section>

      <Section title="สำรอง / ย้ายข้อมูล">
        <BackupPanel />
      </Section>
    </div>
  );
}
