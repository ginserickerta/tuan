"use client";
// Export / import the whole local database as one JSON file.
// Also the manual way to move data between devices until sync exists.
import { useRef, useState } from "react";
import {
  BackupError,
  countsOf,
  downloadBackup,
  parseBackup,
  restoreMerge,
  restoreReplace,
  type BackupFile,
} from "@/lib/backup";

export default function BackupPanel() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: BackupFile; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    setError(null);
    try {
      const c = await downloadBackup();
      setStatus(
        `บันทึกไฟล์แล้ว — ${c.topics} หัวข้อ · ${c.reviews} ครั้งที่ทบทวน · ${c.questions} ข้อควิซ`,
      );
    } catch {
      setError("บันทึกไฟล์ไม่สำเร็จ");
    }
  }

  async function onPick(file: File) {
    setError(null);
    setStatus(null);
    try {
      setPending({ file: parseBackup(await file.text()), name: file.name });
    } catch (e) {
      setPending(null);
      setError(e instanceof BackupError ? e.message : "อ่านไฟล์ไม่สำเร็จ");
    }
  }

  async function run(mode: "replace" | "merge") {
    if (!pending || busy) return;
    const c = countsOf(pending.file);
    if (
      mode === "replace" &&
      !confirm(
        `ลบข้อมูลทั้งหมดในเครื่องนี้ แล้วแทนที่ด้วย ${c.topics} หัวข้อจากไฟล์?\nย้อนกลับไม่ได้ — ถ้ายังไม่ได้สำรองของเดิม กดยกเลิกแล้วกด "ดาวน์โหลดไฟล์สำรอง" ก่อน`,
      )
    )
      return;

    setBusy(true);
    try {
      const added =
        mode === "replace"
          ? await restoreReplace(pending.file)
          : await restoreMerge(pending.file);
      setStatus(
        mode === "replace"
          ? `แทนที่เรียบร้อย — ${added.topics} หัวข้อ · ${added.questions} ข้อควิซ`
          : `เพิ่มของใหม่ ${added.topics} หัวข้อ · ${added.questions} ข้อควิซ (ของเดิมไม่ถูกแตะ)`,
      );
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch {
      setError("กู้คืนไม่สำเร็จ — ข้อมูลเดิมยังอยู่");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed text-ink-3">
        ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์เครื่องนี้เครื่องเดียว —
        ล้างข้อมูลเบราว์เซอร์เมื่อไหร่ก็หายหมด ควรดาวน์โหลดเก็บไว้สัปดาห์ละครั้ง
      </p>

      <button
        type="button"
        onClick={() => void onExport()}
        className="press w-full rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-ink"
      >
        ดาวน์โหลดไฟล์สำรอง
      </button>

      <div className="pt-1">
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onPick(f);
          }}
          className="block w-full text-[12px] text-ink-3 file:mr-3 file:rounded-lg file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-[12px] file:font-medium file:text-ink-2"
        />
        <p className="mt-1.5 text-[11px] text-ink-3">
          เลือกไฟล์ tuan-backup-*.json เพื่อกู้คืนหรือย้ายข้อมูลมาจากอีกเครื่อง
        </p>
      </div>

      {pending && (
        <div className="rise-in space-y-2.5 rounded-xl border border-line bg-surface p-3">
          <p className="text-[12px] leading-relaxed text-ink-2">
            <b className="text-ink">{pending.name}</b>
            <br />
            <span className="tnum">{countsOf(pending.file).topics}</span> หัวข้อ ·{" "}
            <span className="tnum">{countsOf(pending.file).questions}</span> ข้อควิซ ·
            สำรองเมื่อ {pending.file.exportedAt.slice(0, 10)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("merge")}
              className="press flex-1 rounded-lg bg-accent py-2 text-[12px] font-semibold text-accent-ink disabled:opacity-50"
            >
              เพิ่มเฉพาะที่ยังไม่มี
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("replace")}
              className="press flex-1 rounded-lg border border-danger-line py-2 text-[12px] font-semibold text-danger disabled:opacity-40"
            >
              แทนที่ทั้งหมด
            </button>
          </div>
          <p className="text-[11px] leading-relaxed text-ink-3">
            ย้ายเครื่อง → &quot;แทนที่ทั้งหมด&quot; · รวมหัวข้อจากอีกเครื่อง →
            &quot;เพิ่มเฉพาะที่ยังไม่มี&quot;
          </p>
        </div>
      )}

      {status && (
        <div className="rise-in rounded-xl border border-accent-line bg-accent-soft px-3 py-2.5 text-[12px] leading-relaxed text-accent">
          {status}
        </div>
      )}
      {error && (
        <div className="rise-in rounded-xl border border-danger-line bg-danger-soft px-3 py-2.5 text-[12px] leading-relaxed text-danger">
          {error}
        </div>
      )}
    </div>
  );
}
