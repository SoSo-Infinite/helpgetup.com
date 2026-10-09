"use client";

import { useEffect, useState } from "react";
import { LIST_CHECKED_ON } from "@/data/albany-food";
import { formatIsoDate } from "@/lib/food-week";

/**
 * Registers the offline service worker (production builds only) and shows a calm
 * banner when the phone loses its connection. Nothing about the visitor is stored.
 */
export default function OfflineReady() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div className="offline-banner" role="status">
      You’re offline. The food list still works from this phone
      {LIST_CHECKED_ON ? ` (last checked ${formatIsoDate(LIST_CHECKED_ON)})` : ""}. Call
      before you go.
    </div>
  );
}
