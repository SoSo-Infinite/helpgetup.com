"use client";

import type { TalkEvent } from "./events";

export function lengthBucket(seconds: number): string {
  if (seconds < 30) return "lt30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 120) return "1-2m";
  if (seconds < 240) return "2-4m";
  return "4m+";
}

/** First-party, cookieless event beacon to /api/t. Never sends what anyone said. */
export function trackEvent(e: TalkEvent, extra: { b?: string; r?: string } = {}): void {
  if (typeof window === "undefined") return;
  const body = JSON.stringify({ e, p: window.location.pathname, ...extra });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/t", new Blob([body], { type: "application/json" }));
    } else {
      void fetch("/api/t", {
        method: "POST",
        body,
        keepalive: true,
        headers: { "content-type": "application/json" },
      });
    }
  } catch {
    /* analytics must never break the page */
  }
}
