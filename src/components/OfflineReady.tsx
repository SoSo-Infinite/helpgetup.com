"use client";

import { useEffect, useState } from "react";
import { LIST_CHECKED_ON } from "@/data/albany-food";
import { formatIsoDate } from "@/lib/food-week";
import { useWalkLang } from "@/lib/walk-lang";

/**
 * Registers the offline service worker (production builds only) and shows a calm
 * banner when the phone loses its connection. Nothing about the visitor is stored.
 */
export default function OfflineReady() {
  const [offline, setOffline] = useState(false);
  const lang = useWalkLang();

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
  const checked = LIST_CHECKED_ON ? formatIsoDate(LIST_CHECKED_ON, lang) : "";
  return (
    <div className="offline-banner" role="status" lang={lang}>
      {lang === "es"
        ? `Está sin conexión. La lista de comida sigue funcionando en este teléfono${checked ? ` (revisada el ${checked})` : ""}. Llame antes de ir.`
        : `You’re offline. The food list still works from this phone${checked ? ` (last checked ${checked})` : ""}. Call before you go.`}
    </div>
  );
}
