"use client";

import { useSyncExternalStore } from "react";
import type { WalkLang } from "@/lib/food-week";

/**
 * The food walk owns the language choice. Pieces outside the walk (skip link, header button,
 * offline banner) read it from here so they switch to Spanish with it. Nothing is stored.
 */
const EVENT = "hgu:lang";
let current: WalkLang = "en";

export function publishWalkLang(lang: WalkLang) {
  if (current === lang) return;
  current = lang;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

export function useWalkLang(): WalkLang {
  return useSyncExternalStore(subscribe, () => current, () => "en");
}

/** Header button: asks the walk to open its first question. */
export const START_EVENT = "hgu:start";
