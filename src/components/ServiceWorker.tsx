"use client";
import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    // in dev only when asked (NEXT_PUBLIC_SW_DEV=1), to test the phone notices
    const on = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW_DEV === "1";
    if ("serviceWorker" in navigator && on) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}
