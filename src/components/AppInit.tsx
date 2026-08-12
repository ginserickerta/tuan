"use client";
import { useEffect, useState } from "react";
import { requestPersistentStorage } from "@/lib/db";

/**
 * One-time client init:
 *  - ask the browser not to evict our IndexedDB data
 *  - register the service worker so the app opens without network
 *  - show a quiet badge while offline (data still saves locally)
 */
export default function AppInit() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    void requestPersistentStorage();

    // dev keeps a stale shell around forever, so only run this in production
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      void navigator.serviceWorker
        .register("/sw.js", { updateViaCache: "none" })
        .catch(() => {}); // offline first-load, private mode, etc.
    }

    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="sticky top-0 z-40 bg-stone-800 text-stone-100 text-[11px] text-center py-1">
      ออฟไลน์ — ทบทวนต่อได้ ข้อมูลบันทึกในเครื่อง
    </div>
  );
}
