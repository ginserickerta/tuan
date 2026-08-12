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
    <div className="drop-in flex items-center justify-between gap-3 rounded-xl border border-warn-line bg-warn-soft px-3 py-2.5">
      <p className="text-[12px] leading-snug text-warn">
        {daysSince === null
          ? "ยังไม่เคยสำรองข้อมูล"
          : `สำรองข้อมูลล่าสุด ${daysSince} วันก่อน`}{" "}
        — เผื่อเบราว์เซอร์ล้างข้อมูลทิ้ง
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onBackup()}
        className="press shrink-0 rounded-lg border border-warn-line px-2.5 py-1.5 text-[11px] font-semibold text-warn disabled:opacity-50"
      >
        {busy ? "…" : "สำรองตอนนี้"}
      </button>
    </div>
  );
}
