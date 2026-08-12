"use client";
// 30-day workload bar chart — same forecast engine the calendar feed uses,
// so "what the calendar will say" and "what this graph shows" never disagree.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { forecast } from "@/lib/scheduler/forecast";
import { todayISO, parseISO, formatThai } from "@/lib/scheduler/dates";
import { CAP_WEEKEND_MIN } from "@/lib/scheduler/config";

const HORIZON_DAYS = 30;
const CHART_HEIGHT = 92; // px
const Y_MAX = CAP_WEEKEND_MIN + 10; // headroom above the highest possible cap
const LABEL_EVERY = 5;

export default function LoadForecastChart() {
  const topics = useLiveQuery(() => db.topics.toArray(), []);

  if (!topics) return <p className="text-[12px] text-ink-3">กำลังคำนวณ…</p>;

  const days = forecast(topics, todayISO(), HORIZON_DAYS);
  if (days.every((d) => d.count === 0)) {
    return (
      <p className="text-[12px] text-ink-3">
        ยังไม่มีคิวให้พยากรณ์ในช่วง {HORIZON_DAYS} วันข้างหน้า
      </p>
    );
  }

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const flashDays = days.filter((d) => d.flashMode).length;
  const busiest = days.reduce((a, b) => (b.minutes > a.minutes ? b : a));

  return (
    <div className="space-y-2.5">
      <div className="flex items-baseline justify-between gap-3 text-[11px]">
        <span className="text-ink-2">
          รวม{" "}
          <span className="tnum font-semibold text-ink">~{totalMinutes}</span> นาที
          <span className="text-ink-3">
            {" "}
            · เฉลี่ย {(totalMinutes / HORIZON_DAYS).toFixed(0)} นาที/วัน
          </span>
        </span>
        {flashDays > 0 && (
          <span className="tnum shrink-0 text-danger">วันเร่ง {flashDays} วัน</span>
        )}
      </div>

      <div className="flex items-end gap-px" style={{ height: CHART_HEIGHT }}>
        {days.map((d) => {
          const barH = Math.max(2, (d.minutes / Y_MAX) * CHART_HEIGHT);
          const capH = (d.capMinutes / Y_MAX) * CHART_HEIGHT;
          return (
            <div
              key={d.date}
              className="relative flex-1"
              style={{ height: CHART_HEIGHT }}
              title={`${formatThai(d.date)} · ${d.count} หัวข้อ · ${d.minutes} นาที${
                d.flashMode ? " · โหมดเร่ง" : ""
              }`}
            >
              {/* that day's cap — 30 นาทีวันธรรมดา / 75 นาทีวันหยุด */}
              <div
                className="absolute inset-x-0 border-t border-dashed border-line-strong"
                style={{ bottom: capH }}
              />
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-[2px] ${
                  d.flashMode
                    ? "bg-danger"
                    : d.count > 0
                      ? "bg-accent"
                      : "bg-surface-2"
                }`}
                style={{ height: barH }}
              />
            </div>
          );
        })}
      </div>

      <div className="tnum flex text-[9px] text-ink-3">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % LABEL_EVERY === 0 ? parseISO(d.date).getDate() : ""}
          </div>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-ink-3">
        วันที่หนักสุด: {formatThai(busiest.date)} ({busiest.count} หัวข้อ ·{" "}
        {busiest.minutes} นาที) · เส้นประคือเพดานของวันนั้น · คำนวณโดยสมมติว่ากด
        &quot;นึกออก&quot; ทุกครั้งเหมือนที่ใช้สร้างปฏิทิน
      </p>
    </div>
  );
}
