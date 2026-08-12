"use client";
import { useEffect } from "react";
import { requestPersistentStorage } from "@/lib/db";

/** One-time client init: ask the browser not to evict our IndexedDB data. */
export default function AppInit() {
  useEffect(() => {
    void requestPersistentStorage();
  }, []);
  return null;
}
