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
      const added = mode === "replace"
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
      <p className="text-xs text-stone-500">
        ข้อมูลทั้งหมดเก็บอยู่ในเบราว์เซอร์เครื่องนี้เครื่องเดียว —
        ล้างข้อมูลเบราว์เซอร์เมื่อไหร่ก็หายหมด ควรดาวน์โหลดเก็บไว้สัปดาห์ละครั้ง
      </p>

      <button
        type="button"
        onClick={onExport}
        className="w-full rounded-xl bg-stone-800 text-white py-2.5 text-sm font-semibold"
      >
        ⬇️ ดาวน์โหลดไฟล์สำรอง
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
          className="block w-full text-xs text-stone-500 file:mr-3 file:rounded-lg file:border-0 file:bg-stone-200 file:px-3 file:py-2 file:text-xs file:font-medium file:text-stone-700"
        />
        <p className="text-[11px] text-stone-400 mt-1">
          เลือกไฟล์ tuan-backup-*.json เพื่อกู้คืนหรือย้ายข้อมูลมาจากอีกเครื่อง
        </p>
      </div>

      {pending && (
        <div className="rounded-xl bg-white border border-stone-200 p-3 space-y-2">
          <p className="text-xs text-stone-600">
            <b>{pending.name}</b>
            <br />
            {countsOf(pending.file).topics} หัวข้อ ·{" "}
            {countsOf(pending.file).questions} ข้อควิซ · สำรองเมื่อ{" "}
            {pending.file.exportedAt.slice(0, 10)}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("merge")}
              className="flex-1 rounded-lg bg-teal-600 disabled:bg-stone-300 text-white py-2 text-xs font-semibold"
            >
              เพิ่มเฉพาะที่ยังไม่มี
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void run("replace")}
              className="flex-1 rounded-lg border border-red-300 disabled:opacity-40 text-red-600 py-2 text-xs font-semibold"
            >
              แทนที่ทั้งหมด
            </button>
          </div>
          <p className="text-[11px] text-stone-400">
            ย้ายเครื่อง → &quot;แทนที่ทั้งหมด&quot; · รวมหัวข้อจากอีกเครื่อง →
            &quot;เพิ่มเฉพาะที่ยังไม่มี&quot;
          </p>
        </div>
      )}

      {status && (
        <div className="rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800">
          {status}
        </div>
      )}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
