"use client";
// Two ways to get the schedule into a calendar app:
//   1. Subscribe (webcal://) — one tap, then it updates on its own. Needs the
//      deployed site, since the calendar app fetches the URL itself.
//   2. Download an .ics snapshot — works anywhere, but frozen in time.
import { useEffect, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { forecast } from "@/lib/scheduler/forecast";
import { buildIcs, downloadIcs } from "@/lib/calendar/ics";
import {
  DEFAULT_SETTINGS,
  disableCalendar,
  feedUrl,
  getCalendarSettings,
  getCalendarStatus,
  getCalendarToken,
  publishCalendar,
  saveCalendarSettings,
  webcalUrl,
  type CalendarSettings,
} from "@/lib/calendar/publish";
import { todayISO, formatThai } from "@/lib/scheduler/dates";

const HOURS = [6, 7, 8, 16, 17, 18, 19, 20, 21] as const;
const HORIZONS = [14, 21, 30] as const;
const ALARMS: { value: number | null; label: string }[] = [
  { value: 15, label: "15 นาที" },
  { value: 30, label: "30 นาที" },
  { value: null, label: "ไม่เตือน" },
];

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`press rounded-lg border px-2.5 py-1.5 text-[12px] font-semibold ${
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-surface text-ink-2"
      }`}
    >
      {children}
    </button>
  );
}

export default function CalendarExport() {
  const [settings, setSettings] = useState<CalendarSettings>(DEFAULT_SETTINGS);
  const [token, setToken] = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    void (async () => {
      const [saved, tok, status] = await Promise.all([
        getCalendarSettings(),
        getCalendarToken(),
        getCalendarStatus(),
      ]);
      setOrigin(window.location.origin);
      setSettings(saved);
      setToken(tok);
      setLastPublished(status.lastPublishedAt);
    })();
  }, []);

  const topics = useLiveQuery(() => db.topics.toArray(), []);
  const days = topics ? forecast(topics, todayISO(), settings.horizonDays) : [];
  const workDays = days.filter((d) => d.count > 0);
  const isLocal =
    origin.startsWith("http://localhost") || origin.startsWith("http://127.");

  /** Persist settings; re-publish immediately when the feed is live. */
  async function update(patch: Partial<CalendarSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    await saveCalendarSettings(next);
    if (token) {
      try {
        await publishCalendar(next);
        setLastPublished(new Date().toISOString());
      } catch {
        /* the scheduled retry will pick it up */
      }
    }
  }

  async function enable() {
    setBusy(true);
    setError(null);
    try {
      const t = await publishCalendar(settings);
      setToken(t);
      setLastPublished(new Date().toISOString());
      setNote("เปิดใช้แล้ว — กดปุ่มด้านล่างเพื่อเพิ่มเข้าปฏิทิน");
    } catch (e) {
      setError(
        e instanceof Error && e.message.includes("503")
          ? "เซิร์ฟเวอร์เก็บข้อมูลไม่พร้อม ลองใหม่อีกครั้ง"
          : "ส่งตารางขึ้นเซิร์ฟเวอร์ไม่สำเร็จ — เช็คอินเทอร์เน็ตแล้วลองใหม่",
      );
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    if (!confirm("ปิดปฏิทินอัตโนมัติ? ปฏิทินที่สมัครไว้จะหยุดอัปเดตและขึ้น error"))
      return;
    setBusy(true);
    await disableCalendar();
    setToken(null);
    setLastPublished(null);
    setNote("ปิดแล้ว — ลบปฏิทินที่สมัครไว้ในเครื่องได้เลย");
    setBusy(false);
  }

  async function copyLink() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(feedUrl(token, origin));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกอัตโนมัติไม่ได้ — กดค้างที่ลิงก์ด้านล่างเพื่อคัดลอกเอง");
    }
  }

  return (
    <div className="space-y-4">
      {/* ---- automatic subscription ---- */}
      <div className="space-y-3 rounded-xl border border-line bg-surface p-3.5">
        <div>
          <p className="text-[13px] font-semibold">ปฏิทินอัตโนมัติ</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">
            สมัครครั้งเดียว แล้วปฏิทินจะดึงตารางใหม่เองทุกครั้งที่คุณกดคะแนน
            ไม่ต้องดาวน์โหลดอะไรอีก
          </p>
        </div>

        {isLocal && (
          <div className="rounded-lg border border-warn-line bg-warn-soft px-3 py-2 text-[12px] leading-relaxed text-warn">
            ตอนนี้เปิดจาก localhost — ปฏิทินบนมือถือเข้าถึงเครื่องนี้ไม่ได้
            ให้เปิดแอปจากเว็บจริงก่อนแล้วค่อยกดเปิดใช้
          </div>
        )}

        {!token ? (
          <button
            type="button"
            disabled={busy || isLocal}
            onClick={() => void enable()}
            className="press w-full rounded-xl bg-accent py-2.5 text-[13px] font-semibold text-accent-ink disabled:bg-line-strong disabled:text-ink-3"
          >
            {busy ? "กำลังเปิด…" : "เปิดใช้ปฏิทินอัตโนมัติ"}
          </button>
        ) : (
          <div className="rise-in space-y-2">
            <a
              href={webcalUrl(token, origin)}
              className="press block w-full rounded-xl bg-accent py-2.5 text-center text-[13px] font-semibold text-accent-ink"
            >
              เพิ่มลงปฏิทิน iPhone / Mac
            </a>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="press w-full rounded-xl border border-line py-2 text-[12px] font-medium text-ink-2"
            >
              {copied ? "คัดลอกลิงก์แล้ว" : "คัดลอกลิงก์ (สำหรับ Google Calendar)"}
            </button>
            <p className="tnum select-all break-all text-[10px] leading-relaxed text-ink-3">
              {feedUrl(token, origin)}
            </p>
            <div className="flex items-center justify-between pt-0.5">
              <span className="text-[11px] text-ink-3">
                {lastPublished
                  ? `อัปเดตล่าสุด ${new Date(lastPublished).toLocaleString("th-TH", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}`
                  : "ยังไม่ได้ส่งขึ้นเซิร์ฟเวอร์"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => void turnOff()}
                className="press text-[11px] text-danger"
              >
                ปิดใช้งาน
              </button>
            </div>
          </div>
        )}

        {note && <p className="text-[12px] text-accent">{note}</p>}
        {error && (
          <div className="rise-in rounded-lg border border-danger-line bg-danger-soft px-3 py-2 text-[12px] leading-relaxed text-danger">
            {error}
          </div>
        )}
      </div>

      {/* ---- shared options ---- */}
      <div className="space-y-3">
        <div>
          <label className="mb-1.5 block text-[12px] font-semibold">
            เวลาที่จะทบทวน
          </label>
          <div className="flex flex-wrap gap-1.5">
            {HOURS.map((h) => (
              <Chip
                key={h}
                active={settings.hour === h}
                onClick={() => void update({ hour: h })}
              >
                <span className="tnum">{String(h).padStart(2, "0")}:00</span>
              </Chip>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold">
              ล่วงหน้ากี่วัน
            </label>
            <div className="flex gap-1.5">
              {HORIZONS.map((d) => (
                <Chip
                  key={d}
                  active={settings.horizonDays === d}
                  onClick={() => void update({ horizonDays: d })}
                >
                  <span className="tnum">{d}</span>
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[12px] font-semibold">เตือนก่อน</label>
            <div className="flex gap-1.5">
              {ALARMS.map((a) => (
                <Chip
                  key={a.label}
                  active={settings.alarmMinutes === a.value}
                  onClick={() => void update({ alarmMinutes: a.value })}
                >
                  {a.label}
                </Chip>
              ))}
            </div>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-[12px] text-ink-2">
          <input
            type="checkbox"
            checked={settings.includeTitles}
            onChange={(e) => void update({ includeTitles: e.target.checked })}
            className="mt-0.5 accent-[var(--accent)]"
          />
          <span>
            ใส่ชื่อหัวข้อในปฏิทินด้วย
            <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-3">
              ปิดไว้ถ้าไม่อยากให้ชื่อเรื่องที่เรียนไปอยู่บนเซิร์ฟเวอร์ — จะเห็นแค่
              &quot;ทวน 5 หัวข้อ&quot;
            </span>
          </span>
        </label>
      </div>

      {/* ---- preview ---- */}
      {topics && (
        <div className="rounded-xl border border-line bg-surface p-3">
          <p className="mb-2 text-[11px] text-ink-3">
            ตัวอย่างที่จะได้ ({workDays.length} วันมีคิว จาก {settings.horizonDays} วัน)
          </p>
          {workDays.length === 0 ? (
            <p className="text-[12px] text-ink-3">ยังไม่มีหัวข้อให้ทบทวนในช่วงนี้</p>
          ) : (
            <ul className="space-y-1 text-[12px]">
              {workDays.slice(0, 5).map((d) => (
                <li key={d.date} className="flex justify-between gap-2">
                  <span className="text-ink-2">{formatThai(d.date)}</span>
                  <span className="tnum text-ink-3">
                    {d.count} หัวข้อ · ~{d.minutes} น.
                    {d.flashMode && " ⚡"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* ---- one-off file ---- */}
      <div className="space-y-2 border-t border-line pt-3">
        <button
          type="button"
          disabled={workDays.length === 0}
          onClick={() =>
            downloadIcs(
              buildIcs(days, {
                hour: settings.hour,
                minute: settings.minute,
                alarmMinutes: settings.alarmMinutes,
              }),
            )
          }
          className="press w-full rounded-xl border border-line py-2.5 text-[13px] font-medium text-ink-2 disabled:opacity-40"
        >
          หรือดาวน์โหลดเป็นไฟล์ .ics (ไม่อัปเดตเอง)
        </button>
      </div>

      <p className="text-[11px] leading-relaxed text-ink-3">
        ตารางคำนวณโดยสมมติว่าคุณกด &quot;นึกออก&quot; ทุกครั้ง
        ถ้าลืมบ่อยกว่านั้นคิวจริงจะหนักกว่า · ปฏิทินอ่านอย่างเดียว
        ติ๊กว่าทบทวนแล้วต้องกลับมากดในแอป · iPhone ดึงข้อมูลใหม่ทุก 15 นาที–1 ชั่วโมง
        ส่วน Google Calendar ช้ากว่านั้นมาก (หลายชั่วโมง)
      </p>
    </div>
  );
}
