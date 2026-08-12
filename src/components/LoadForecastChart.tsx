"use client";
// 30-day workload bar chart — same forecast engine the calendar feed uses,
// so "what the calendar will say" and "what this graph shows" never disagree.
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { forecast } from "@/lib/scheduler/forecast";
import { todayISO, parseISO, formatThai } from "@/lib/scheduler/dates";
import { CAP_WEEKEND_MIN } from "@/lib/scheduler/config";

const HORIZON_DAYS = 30;
const CHART_HEIGHT = 96; // px
const Y_MAX = CAP_WEEKEND_MIN + 10; // headroom above the highest possible cap
const LABEL_EVERY = 5;

export default function LoadForecastChart() {
  const topics = useLiveQuery(() => db.topics.toArray(), []);

  if (!topics) return <p className="text-xs text-stone-400">กำลังคำนวณ…</p>;

  const days = forecast(topics, todayISO(), HORIZON_DAYS);
  if (days.every((d) => d.count === 0)) {
    return (
      <p className="text-xs text-stone-400">
        ยังไม่มีคิวให้พยากรณ์ในช่วง {HORIZON_DAYS} วันข้างหน้า
      </p>
    );
  }

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const flashDays = days.filter((d) => d.flashMode).length;
  const busiest = days.reduce((a, b) => (b.minutes > a.minutes ? b : a));

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-[11px] text-stone-500">
        <span>
          รวม ~{totalMinutes} นาที ใน {HORIZON_DAYS} วัน (เฉลี่ย{" "}
          {(totalMinutes / HORIZON_DAYS).toFixed(0)} นาที/วัน)
        </span>
        {flashDays > 0 && <span className="text-orange-600">⚡ วันเร่ง {flashDays} วัน</span>}
      </div>

      <div className="flex items-end gap-px" style={{ height: CHART_HEIGHT }}>
        {days.map((d) => {
          const barH = Math.max(2, (d.minutes / Y_MAX) * CHART_HEIGHT);
          const capH = (d.capMinutes / Y_MAX) * CHART_HEIGHT;
          return (
            <div
              key={d.date}
              className="flex-1 relative"
              style={{ height: CHART_HEIGHT }}
              title={`${formatThai(d.date)} · ${d.count} หัวข้อ · ${d.minutes} นาที${
                d.flashMode ? " · โหมดเร่ง" : ""
              }`}
            >
              {/* that day's cap (30 หรือ 75 นาทีตามวันธรรมดา/วันหยุด) */}
              <div
                className="absolute inset-x-0 border-t border-dashed border-stone-300"
                style={{ bottom: capH }}
              />
              <div
                className={`absolute inset-x-0 bottom-0 rounded-t-sm ${
                  d.flashMode
                    ? "bg-orange-400"
                    : d.count > 0
                      ? "bg-teal-500"
                      : "bg-stone-100"
                }`}
                style={{ height: barH }}
              />
            </div>
          );
        })}
      </div>

      <div className="flex text-[9px] text-stone-400">
        {days.map((d, i) => (
          <div key={d.date} className="flex-1 text-center">
            {i % LABEL_EVERY === 0 ? parseISO(d.date).getDate() : ""}
          </div>
        ))}
      </div>

      <p className="text-[11px] text-stone-400 leading-relaxed">
        วันที่หนักสุด: {formatThai(busiest.date)} ({busiest.count} หัวข้อ · {busiest.minutes}{" "}
        นาที) · เส้นประคือเพดานของวันนั้น (30 นาทีวันธรรมดา / 75 นาทีวันหยุด) ·
        คำนวณโดยสมมติว่ากด &quot;นึกออก&quot; ทุกครั้งเหมือนที่ใช้สร้างปฏิทิน
      </p>
    </div>
  );
}
