"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "วันนี้", icon: "📋" },
  { href: "/add", label: "เพิ่มหัวข้อ", icon: "✏️" },
  { href: "/topics", label: "คลัง", icon: "📚" },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed bottom-0 inset-x-0 bg-white border-t border-stone-200 pb-[env(safe-area-inset-bottom)]">
      <div className="max-w-lg mx-auto flex">
        {TABS.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`flex-1 py-2.5 text-center text-xs font-medium ${
                active ? "text-teal-700" : "text-stone-400"
              }`}
            >
              <div className="text-lg leading-none mb-0.5">{t.icon}</div>
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
