"use client";
// Export the projected workload to Apple/Google/Notion Calendar as an .ics file.
// A snapshot, not a live feed — a live subscription needs a server, which
// arrives with cross-device sync.
import { useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { forecast } from "@/lib/scheduler/forecast";
import { buildIcs, downloadIcs } from "@/lib/calendar/ics";
import { todayISO, formatThai } from "@/lib/scheduler/dates";

const HOURS = [6, 7, 8, 16, 17, 18, 19, 20, 21] as const;
const HORIZONS = [14, 21, 30] as const;
const ALARMS: { value: number | null; label: string }[] = [
  { value: 15, label: "15 นาที" },
  { value: 30, label: "30 นาที" },
  { value: null, label: "ไม่เตือน" },
];

export default function CalendarExport() {
  const [hour, setHour] = useState(19);
  const [horizon, setHorizon] = useState<number>(21);
  const [alarm, setAlarm] = useState<number | null>(15);
  const [done, setDone] = useState<string | null>(null);

  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const days = topics ? forecast(topics, todayISO(), horizon) : [];
  const workDays = days.filter((d) => d.count > 0);
  const preview = workDays.slice(0, 5);

  function onExport() {
    const ics = buildIcs(days, { hour, minute: 0, alarmMinutes: alarm });
    downloadIcs(ics);
    setDone(`สร้างไฟล์แล้ว — ${workDays.length} วันที่มีคิว`);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-stone-500">
        สร้างไฟล์ปฏิทินจากตารางที่คาดการณ์ไว้ แล้วเปิดไฟล์เพื่อเพิ่มลงปฏิทินในเครื่อง
        (iPhone / Google / Notion Calendar อ่านไฟล์ .ics ได้หมด)
      </p>

      <div>
        <label className="block text-xs font-medium mb-1">เวลาที่จะทบทวน</label>
        <div className="flex flex-wrap gap-1.5">
          {HOURS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setHour(h)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                hour === h
                  ? "border-teal-500 bg-teal-50 text-teal-700"
                  : "border-stone-200 bg-white text-stone-500"
              }`}
            >
              {String(h).padStart(2, "0")}:00
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium mb-1">ล่วงหน้ากี่วัน</label>
          <div className="flex gap-1.5">
            {HORIZONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setHorizon(d)}
                className={`flex-1 px-2 py-1.5 rounded-lg text-xs font-medium border ${
                  horizon === d
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">เตือนก่อน</label>
          <div className="flex gap-1.5">
            {ALARMS.map((a) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAlarm(a.value)}
                className={`flex-1 px-1 py-1.5 rounded-lg text-[11px] font-medium border ${
                  alarm === a.value
                    ? "border-teal-500 bg-teal-50 text-teal-700"
                    : "border-stone-200 bg-white text-stone-500"
                }`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {topics && (
        <div className="rounded-xl bg-white border border-stone-200 p-3">
          <p className="text-[11px] text-stone-400 mb-1.5">
            ตัวอย่างที่จะได้ ({workDays.length} วันมีคิว จาก {horizon} วัน)
          </p>
          {preview.length === 0 ? (
            <p className="text-xs text-stone-400">
              ยังไม่มีหัวข้อให้ทบทวนในช่วงนี้
            </p>
          ) : (
            <ul className="text-xs text-stone-600 space-y-0.5">
              {preview.map((d) => (
                <li key={d.date} className="flex justify-between gap-2">
                  <span>{formatThai(d.date)}</span>
                  <span className="text-stone-400">
                    {d.count} หัวข้อ · ~{d.minutes} น.
                    {d.flashMode && " ⚡"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        type="button"
        disabled={!topics || workDays.length === 0}
        onClick={onExport}
        className="w-full rounded-xl bg-stone-800 disabled:bg-stone-300 text-white py-2.5 text-sm font-semibold"
      >
        📅 ดาวน์โหลดไฟล์ปฏิทิน (.ics)
      </button>

      {done && (
        <div className="rounded-xl bg-teal-50 border border-teal-200 px-3 py-2 text-xs text-teal-800">
          {done} — เปิดไฟล์บนเครื่องที่จะใช้ แล้วเลือกปฏิทินที่จะเพิ่มเข้าไป
        </div>
      )}

      <p className="text-[11px] text-stone-400 leading-relaxed">
        เป็นภาพนิ่งของตารางตอนนี้ ไม่ใช่ปฏิทินที่อัปเดตเอง — คำนวณโดยสมมติว่าคุณกด
        &quot;นึกออก&quot; ทุกครั้ง ถ้าจริงๆ ลืมบ่อย คิวจะหนักกว่านี้ ส่งออกใหม่ทุก 1–2
        สัปดาห์ได้ ระบบใช้รหัสเดิมต่อวัน ของเก่าจะถูกทับ ไม่ซ้อนกัน
      </p>
    </div>
  );
}
