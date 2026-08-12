"use client";
// หน้า "คลัง" — every topic with its scheduling state, for verifying the system
// and light management (archive / delete). Search + full library grow in Phase 5.
import { useLiveQuery } from "dexie-react-hooks";
import { useState } from "react";
import { db } from "@/lib/db";
import { deleteTopic, setArchived } from "@/lib/repo";
import { todayISO, diffDays, formatThai } from "@/lib/scheduler/dates";
import { EXAM_LABELS } from "@/lib/scheduler/config";
import type { Topic } from "@/lib/scheduler/types";

const TRACK_CHIP: Record<string, string> = {
  TGAT_TPAT: "bg-violet-100 text-violet-700",
  ALEVEL: "bg-emerald-100 text-emerald-700",
};

function dueLabel(t: Topic, today: string): { text: string; cls: string } {
  const d = diffDays(today, t.dueDate);
  if (d < 0) return { text: `ค้าง ${-d} วัน`, cls: "text-red-600 font-medium" };
  if (d === 0) return { text: "วันนี้", cls: "text-teal-600 font-medium" };
  return { text: formatThai(t.dueDate), cls: "text-stone-400" };
}

export default function TopicsPage() {
  const today = todayISO();
  const [expanded, setExpanded] = useState<number | null>(null);
  const topics = useLiveQuery(() => db.topics.toArray(), []);

  if (!topics)
    return <p className="text-stone-400 text-sm mt-8 text-center">กำลังโหลด…</p>;

  const active = topics
    .filter((t) => !t.archived)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const archived = topics.filter((t) => t.archived);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">คลังหัวข้อ</h1>
        <span className="text-sm text-stone-400">{active.length} หัวข้อ</span>
      </header>

      {active.length === 0 && archived.length === 0 && (
        <p className="text-sm text-stone-400 text-center py-10">
          ยังไม่มีหัวข้อ — เริ่มที่แท็บ &quot;เพิ่มหัวข้อ&quot;
        </p>
      )}

      <ul className="space-y-2">
        {active.map((t) => {
          const due = dueLabel(t, today);
          const open = expanded === t.id;
          return (
            <li
              key={t.id}
              className="rounded-xl bg-white border border-stone-200 px-3 py-2.5"
            >
              <button
                type="button"
                className="w-full text-left"
                onClick={() => setExpanded(open ? null : t.id!)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium leading-snug flex-1">
                    {t.title}
                  </span>
                  <span className={`text-xs shrink-0 ${due.cls}`}>{due.text}</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                  <span className={`px-1.5 py-0.5 rounded-full ${TRACK_CHIP[t.examTrack]}`}>
                    {EXAM_LABELS[t.examTrack]}
                  </span>
                  <span className="px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500">
                    {t.subject}
                  </span>
                  <span className="text-stone-400">
                    ทุก {t.intervalDays} วัน · ease {t.ease.toFixed(2)}
                    {t.lapseCount > 0 && ` · ลืม ${t.lapseCount}`}
                  </span>
                </div>
              </button>

              {open && (
                <div className="mt-2 pt-2 border-t border-stone-100 space-y-2">
                  {t.notes && (
                    <p className="text-xs text-stone-600 whitespace-pre-wrap">{t.notes}</p>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setArchived(t.id!, true)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-stone-100 text-stone-600"
                    >
                      เก็บเข้ากรุ
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm(`ลบ "${t.title}" ถาวร?`)) void deleteTopic(t.id!);
                      }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 text-red-600"
                    >
                      ลบ
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {archived.length > 0 && (
        <details className="pt-2">
          <summary className="text-sm text-stone-400 cursor-pointer">
            ในกรุ ({archived.length})
          </summary>
          <ul className="mt-2 space-y-2">
            {archived.map((t) => (
              <li
                key={t.id}
                className="rounded-xl bg-stone-100 px-3 py-2.5 flex items-center justify-between"
              >
                <span className="text-sm text-stone-500">{t.title}</span>
                <button
                  type="button"
                  onClick={() => setArchived(t.id!, false)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white text-stone-600 border border-stone-200"
                >
                  เอากลับมา
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
