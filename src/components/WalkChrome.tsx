"use client";

import { START_EVENT, useWalkLang } from "@/lib/walk-lang";

const TEXT = {
  en: { skip: "Skip to the food walk", start: "Start with food" },
  es: { skip: "Ir a la guía de comida", start: "Empezar con comida" },
} as const;

export function SkipLink() {
  const lang = useWalkLang();
  return (
    <a className="skip-link" href="#walk" lang={lang}>
      {TEXT[lang].skip}
    </a>
  );
}

/** Works as a plain #walk link without JavaScript; with it, it also opens the first question. */
export function HeaderStart() {
  const lang = useWalkLang();
  return (
    <a
      className="header-cta"
      href="#walk"
      lang={lang}
      onClick={() => window.dispatchEvent(new Event(START_EVENT))}
    >
      {TEXT[lang].start}
    </a>
  );
}
