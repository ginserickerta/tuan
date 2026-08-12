"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "วันนี้" },
  { href: "/add", label: "เพิ่มหัวข้อ" },
  { href: "/topics", label: "คลัง" },
] as const;

/** Line icons drawn at one weight — no emoji, which render differently per OS. */
function TabIcon({ href, active }: { href: string; active: boolean }) {
  const common = {
    width: 21,
    height: 21,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: active ? 1.9 : 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (href === "/")
    return (
      <svg {...common}>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17M8 3v3M16 3v3" />
        <path d="M8.5 14.6l2.2 2.2 4.3-4.6" />
      </svg>
    );
  if (href === "/add")
    return (
      <svg {...common}>
        <path d="M12 5.5v13M5.5 12h13" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M4.5 5.5h5a2.5 2.5 0 0 1 2.5 2.5v11a2 2 0 0 0-2-2H4.5z" />
      <path d="M19.5 5.5h-5A2.5 2.5 0 0 0 12 8v11a2 2 0 0 1 2-2h5.5z" />
    </svg>
  );
}

export default function BottomNav() {
  const pathname = usePathname();
  const activeIndex = Math.max(
    0,
    TABS.findIndex((t) => t.href === pathname),
  );

  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-line bg-surface/85 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      <div className="relative max-w-lg mx-auto flex">
        {/* One indicator that slides between tabs — transform only, so the bar
            never re-lays out while it moves. */}
        <span
          aria-hidden
          className="absolute top-0 h-[2px] rounded-full bg-accent transition-transform duration-[220ms] ease-[cubic-bezier(0.23,1,0.32,1)] motion-reduce:transition-none"
          style={{
            width: `${100 / TABS.length}%`,
            transform: `translateX(${activeIndex * 100}%)`,
          }}
        />
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`press flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                active ? "text-accent" : "text-ink-3"
              }`}
            >
              <TabIcon href={t.href} active={active} />
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
