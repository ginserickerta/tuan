"use client";
// Quiet nag to export a backup file. Not automatic — no cloud sync exists yet,
// so this is the only thing standing between a cleared browser and lost data.
// Shows only when it's actually been a while, so it doesn't become wallpaper.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { downloadBackup } from "@/lib/backup";
import { diffDays, todayISO } from "@/lib/scheduler/dates";

const REMIND_AFTER_DAYS = 7;
const MIN_TOPICS_TO_NAG = 3; // not worth nagging over a handful of test topics

export default function BackupReminder({ topicCount }: { topicCount: number }) {
  const [busy, setBusy] = useState(false);
  const setting = useLiveQuery(() => db.settings.get("lastBackupAt"), []);

  if (topicCount < MIN_TOPICS_TO_NAG || setting === undefined) return null;

  const lastBackupAt = setting?.value as string | undefined;
  const daysSince = lastBackupAt ? diffDays(lastBackupAt, todayISO()) : null;
  const overdue = daysSince === null || daysSince >= REMIND_AFTER_DAYS;
  if (!overdue) return null;

  async function onBackup() {
    setBusy(true);
    try {
      await downloadBackup();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-2">
      <span>
        {daysSince === null
          ? "ยังไม่เคยสำรองข้อมูลเลย"
          : `สำรองข้อมูลล่าสุดเมื่อ ${daysSince} วันก่อน`}{" "}
        — เผื่อเบราว์เซอร์ล้างข้อมูลทิ้ง
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onBackup()}
        className="shrink-0 rounded-lg bg-amber-600 disabled:bg-amber-300 text-white px-2.5 py-1.5 text-[11px] font-semibold"
      >
        {busy ? "…" : "สำรองตอนนี้"}
      </button>
    </div>
  );
}
