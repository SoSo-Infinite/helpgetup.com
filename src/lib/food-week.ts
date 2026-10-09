import {
  ALBANY_COUNTY_ZIPS,
  FOOD_PLACES,
  NEIGHBORHOODS,
  type FoodPlace,
  type SlotRule,
} from "@/data/albany-food";

export type NyParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
};

const WEEKDAY: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

export function nyParts(date: Date): NyParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const bag: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    if (part.type !== "literal") bag[part.type] = part.value;
  }
  return {
    year: Number(bag.year),
    month: Number(bag.month),
    day: Number(bag.day),
    hour: Number(bag.hour),
    minute: Number(bag.minute),
    weekday: WEEKDAY[bag.weekday] ?? 0,
  };
}

export function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function nthOfMonth(day: number): number {
  return Math.floor((day - 1) / 7) + 1;
}

function isLastWeekdayOfMonth(parts: NyParts): boolean {
  const dim = new Date(Date.UTC(parts.year, parts.month, 0)).getUTCDate();
  return parts.day + 7 > dim;
}

export function ruleMatchesDay(rule: SlotRule, parts: NyParts): boolean {
  if (!rule.weekdays.includes(parts.weekday)) return false;
  const nth = nthOfMonth(parts.day);
  if (rule.last && !isLastWeekdayOfMonth(parts)) return false;
  if (rule.nth && !rule.nth.includes(nth)) return false;
  if (rule.exceptNth && rule.exceptNth.includes(nth)) return false;
  return true;
}

export type Opening = {
  date: Date;
  parts: NyParts;
  start: string;
  end: string | null;
  /** true when this slot is after Sunday of the current week */
  nextWeek: boolean;
};

/** Calendar date + clock in America/New_York. */
export function zonedDate(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
): Date {
  const utcGuess = Date.UTC(year, month - 1, day, hour, minute);
  const got = nyParts(new Date(utcGuess));
  const gotUtc = Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute);
  const wantUtc = Date.UTC(year, month - 1, day, hour, minute);
  return new Date(utcGuess - (gotUtc - wantUtc));
}

function shiftDays(parts: NyParts, offset: number): { year: number; month: number; day: number } {
  const utc = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + offset));
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function endOfSunday(now: Date): Date {
  const p = nyParts(now);
  const daysUntilSunday = (7 - p.weekday) % 7;
  const sunday = shiftDays(p, daysUntilSunday);
  return zonedDate(sunday.year, sunday.month, sunday.day, 23, 59);
}

export function openingsFor(
  place: Pick<FoodPlace, "slots">,
  now: Date,
  through: Date,
): Opening[] {
  const found: Opening[] = [];
  const sunday = endOfSunday(now);
  const today = nyParts(now);
  for (let offset = 0; offset < 10; offset++) {
    const cal = shiftDays(today, offset);
    const parts = nyParts(zonedDate(cal.year, cal.month, cal.day, 12, 0));
    const noon = zonedDate(cal.year, cal.month, cal.day, 12, 0);
    if (noon.getTime() > through.getTime() + 24 * 60 * 60 * 1000) break;
    for (const rule of place.slots) {
      if (!ruleMatchesDay(rule, parts)) continue;
      const startDate = zonedDate(
        parts.year,
        parts.month,
        parts.day,
        Number(rule.start.slice(0, 2)),
        Number(rule.start.slice(3)),
      );
      const endClock = rule.end
        ? minutes(rule.end)
        : minutes(rule.start) + 90;
      const endH = Math.min(23, Math.floor(endClock / 60));
      const endM = endClock >= 24 * 60 ? 59 : endClock % 60;
      const endDate = zonedDate(parts.year, parts.month, parts.day, endH, endM);
      if (endDate.getTime() <= now.getTime()) continue;
      if (startDate.getTime() > through.getTime() && endDate.getTime() > through.getTime()) {
        continue;
      }
      found.push({
        date: startDate,
        parts,
        start: rule.start,
        end: rule.end,
        nextWeek: startDate.getTime() > sunday.getTime(),
      });
    }
  }
  found.sort((a, b) => a.date.getTime() - b.date.getTime());
  return found;
}

const NEAR: Record<string, string[]> = {
  "12201": ["12207", "12210", "12202", "12206"],
  "12202": ["12207", "12209", "12210", "12206"],
  "12203": ["12208", "12206", "12209", "12210", "12222"],
  "12204": ["12206", "12205", "12211", "12207"],
  "12205": ["12204", "12211", "12110", "12203"],
  "12206": ["12210", "12207", "12203", "12202", "12204"],
  "12207": ["12210", "12202", "12206", "12201"],
  "12208": ["12203", "12209", "12206"],
  "12209": ["12202", "12208", "12203"],
  "12210": ["12207", "12206", "12203", "12202"],
  "12211": ["12205", "12110", "12204"],
  "12222": ["12203", "12208"],
  "12110": ["12211", "12205", "12047"],
  "12047": ["12183", "12189", "12110"],
  "12189": ["12183", "12047"],
  "12183": ["12189", "12047"],
  "12077": ["12054", "12209", "12158", "12067"],
  "12084": ["12203", "12009", "12222"],
  "12009": ["12084", "12059"],
  "12143": ["12077", "12158", "12046"],
  "12059": ["12193", "12009"],
  "12193": ["12059"],
  "12186": ["12084", "12208", "12158"],
  "12158": ["12077", "12143", "12067", "12046"],
  "12067": ["12158", "12077", "12046"],
  "12046": ["12143", "12158", "12067"],
  "12054": ["12077", "12208", "12209"],
};

export type PlaceMatch = {
  place: FoodPlace;
  opening: Opening | null;
  also: Opening[];
  distance: number;
};

export type MatchResult =
  | { ok: false; reason: "empty" | "ssn" | "outside"; detail?: string }
  | { ok: true; label: string; zips: string[]; places: PlaceMatch[]; weekLabel: string };

export type WalkLang = "en" | "es";
const LOCALE: Record<WalkLang, string> = { en: "en-US", es: "es-US" };

function weekLabel(now: Date, lang: WalkLang = "en"): string {
  const p = nyParts(now);
  const mondayOffset = p.weekday === 0 ? -6 : 1 - p.weekday;
  const monday = shiftDays(p, mondayOffset);
  const sunday = shiftDays(p, mondayOffset + 6);
  const fmt = new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
  });
  return `${fmt.format(zonedDate(monday.year, monday.month, monday.day, 12, 0))} – ${fmt.format(
    zonedDate(sunday.year, sunday.month, sunday.day, 12, 0),
  )}`;
}

export function resolvePlaceQuery(
  raw: string,
):
  | { zips: string[]; label: string }
  | { error: "empty" | "ssn" | "outside"; detail?: string } {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return { error: "empty" };
  if (/social security|\bssn\b/i.test(text)) return { error: "ssn" };
  if (/\b\d{3}-\d{2}-\d{4}\b/.test(text)) return { error: "ssn" };

  const zipMatch = text.match(/\b(\d{5})(?:-\d{4})?\b/);
  if (zipMatch) {
    const zip = zipMatch[1];
    if (!ALBANY_COUNTY_ZIPS.has(zip)) return { error: "outside", detail: zip };
    return { zips: [zip], label: `ZIP ${zip}` };
  }

  const digits = text.replace(/\D/g, "");
  if (digits.length === 9) return { error: "ssn" };

  const lowered = text.toLowerCase();
  const hit = NEIGHBORHOODS.find(
    (n) =>
      n.label.toLowerCase() === lowered ||
      lowered.includes(n.label.toLowerCase()),
  );
  if (hit) return { zips: hit.zips, label: hit.label };

  if (lowered === "albany" || lowered === "albany county") {
    return {
      zips: [
        "12202",
        "12206",
        "12207",
        "12210",
        "12203",
        "12208",
        "12209",
        "12204",
        "12205",
      ],
      label: "Albany",
    };
  }

  return { error: "outside", detail: text };
}

export function distance(placeZip: string, targets: string[]): number {
  if (targets.includes(placeZip)) return 0;
  for (const z of targets) {
    if ((NEAR[z] || []).includes(placeZip)) return 1;
  }
  if (targets.some((z) => z.startsWith("122")) && placeZip.startsWith("122")) return 2;
  return 3;
}

export function matchFood(raw: string, now: Date, lang: WalkLang = "en"): MatchResult {
  const resolved = resolvePlaceQuery(raw);
  if ("error" in resolved) {
    return { ok: false, reason: resolved.error, detail: resolved.detail };
  }
  const throughWeek = endOfSunday(now);
  const throughNext = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const ranked: PlaceMatch[] = [];
  for (const place of FOOD_PLACES) {
    if (place.hoursUnknown) continue;
    let opens = openingsFor(place, now, throughWeek);
    let usingNext = false;
    if (opens.length === 0) {
      opens = openingsFor(place, now, throughNext);
      usingNext = true;
    }
    if (opens.length === 0) continue;
    const dist = distance(place.zip, resolved.zips);
    if (usingNext && dist > 1) continue;
    ranked.push({
      place,
      opening: opens[0],
      also: opens.slice(1, 3),
      distance: dist + (opens[0].nextWeek ? 0.4 : 0),
    });
  }

  ranked.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const at = a.opening?.date.getTime() ?? Infinity;
    const bt = b.opening?.date.getTime() ?? Infinity;
    if (at !== bt) return at - bt;
    return b.place.sourceUpdated.localeCompare(a.place.sourceUpdated);
  });

  const thisWeek = ranked.filter((m) => m.opening && !m.opening.nextWeek);
  const later = ranked.filter((m) => m.opening?.nextWeek);
  const places = thisWeek.slice(0, 5);
  if (places.length < 3) {
    for (const match of later) {
      if (places.length >= 5) break;
      places.push(match);
    }
  }
  if (places.length < 5) {
    const localUnknown = FOOD_PLACES.filter(
      (p) => p.hoursUnknown && distance(p.zip, resolved.zips) === 0,
    );
    for (const place of localUnknown) {
      if (places.length >= 5) break;
      if (places.some((m) => m.place.id === place.id)) continue;
      places.push({ place, opening: null, also: [], distance: 0.2 });
    }
  }
  if (places.length < 3) {
    const fridges = FOOD_PLACES.filter(
      (p) => p.hoursUnknown && distance(p.zip, resolved.zips) <= 1,
    );
    for (const place of fridges) {
      if (places.length >= 5) break;
      if (places.some((m) => m.place.id === place.id)) continue;
      places.push({ place, opening: null, also: [], distance: 2 });
    }
  }

  return {
    ok: true,
    label: resolved.label,
    zips: resolved.zips,
    places,
    weekLabel: weekLabel(now, lang),
  };
}

export function formatWhen(opening: Opening, lang: WalkLang = "en"): string {
  const label = new Intl.DateTimeFormat(LOCALE[lang], {
    timeZone: "America/New_York",
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(opening.date);
  const start = formatClock(opening.start, lang);
  if (!opening.end) {
    return lang === "es"
      ? `${label} · empieza ${start} (no publicaron la hora de cierre)`
      : `${label} · starts ${start} (end time not published)`;
  }
  return `${label} · ${start}–${formatClock(opening.end, lang)}`;
}

export function formatClock(hhmm: string, lang: WalkLang = "en"): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = lang === "es" ? (h >= 12 ? " p. m." : " a. m.") : h >= 12 ? "pm" : "am";
  const hour = h % 12 === 0 ? 12 : h % 12;
  const min = m === 0 ? "" : `:${String(m).padStart(2, "0")}`;
  return `${hour}${min}${suffix}`;
}

/** Main 10-digit number plus any extension or "press N" the source printed after it. */
function splitPhone(raw: string): { main: string; ext: string; press: string } | null {
  const m = raw.match(/^\s*(?:\+?1[\s.-]*)?\(?(\d{3})\)?[\s.-]*(\d{3})[\s.-]*(\d{4})(.*)$/);
  if (!m) return null;
  const rest = m[4];
  return {
    main: `${m[1]}${m[2]}${m[3]}`,
    ext: rest.match(/(?:ext\.?|x)\s*(\d+)/i)?.[1] ?? "",
    press: rest.match(/press\s*(\d)/i)?.[1] ?? "",
  };
}

export function formatPhone(raw: string): string {
  const p = splitPhone(raw);
  if (!p) return raw;
  const d = p.main;
  const main = `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  const ext = raw.match(/(?:ext\.?|x)\s*\d+/i);
  if (ext) return `${main} ${ext[0].replace(/\s+/g, " ")}`;
  if (p.press) return `${main}, press ${p.press}`;
  return main;
}

/**
 * tel: link. An extension or "press N" becomes a pause (",") then the digits, so the phone dials the
 * main number and then the extension. (Before 2026-10-09 the extension digits were glued onto the
 * number, e.g. tel:5184631516110, which would not dial.)
 */
export function phoneHref(raw: string): string {
  const p = splitPhone(raw);
  if (!p) return `tel:${raw.replace(/\D/g, "")}`;
  const tail = p.ext || p.press;
  return `tel:+1${p.main}${tail ? `,${tail}` : ""}`;
}

/**
 * Map search link for a stop. Uses only the published address; nothing about
 * the person is added. Apple devices open Apple Maps, everything else Google Maps
 * (both accept a plain address query).
 */
export function mapsHref(place: Pick<FoodPlace, "name" | "address" | "city" | "zip">): string {
  const q = `${place.name}, ${place.address}, ${place.city}, NY ${place.zip}`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
}

/**
 * One-event calendar file for the picked opening, built in the browser.
 * No personal data: only the stop's published name, address, phone, hours and source.
 * When the source published no end time, the event is 90 minutes and says so.
 */
export function icsFor(place: FoodPlace, opening: Opening, now: Date = new Date()): string {
  const start = opening.date;
  const endMinutes = opening.end ? minutes(opening.end) - minutes(opening.start) : 90;
  const end = new Date(start.getTime() + Math.max(endMinutes, 15) * 60 * 1000);
  const desc = [
    opening.end ? "" : "End time not published by the source; 90 minutes is a placeholder.",
    `Published hours: ${place.hoursRaw || "not listed"}`,
    `Phone: ${formatPhone(place.phone)} (call to confirm before you go)`,
    `Source: ${place.sourceName} ${place.sourceUrl}`,
    "From helpgetup.com. HelpGetUp did not call or reserve anything.",
  ]
    .filter(Boolean)
    .join("\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HelpGetUp//Food walk//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${place.id}-${icsStamp(start)}@helpgetup.com`,
    `DTSTAMP:${icsStamp(now)}`,
    `DTSTART:${icsStamp(start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(`Food: ${place.name}`)}`,
    `LOCATION:${icsEscape(`${place.address}, ${place.city}, NY ${place.zip}`)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Food stop in 1 hour",
    "TRIGGER:-PT1H",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

/** RFC 5545 line folding: max 75 octets per line, continuation lines start with a space. */
function foldIcsLine(line: string): string {
  const enc = new TextEncoder();
  if (enc.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let cur = "";
  for (const ch of line) {
    const limit = parts.length === 0 ? 75 : 74;
    if (enc.encode(cur + ch).length > limit) {
      parts.push(cur);
      cur = ch;
    } else {
      cur += ch;
    }
  }
  parts.push(cur);
  return parts.join("\r\n ");
}

export function icsHref(place: FoodPlace, opening: Opening): string {
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(icsFor(place, opening))}`;
}

export function icsFileName(place: FoodPlace): string {
  return `helpgetup-${place.id}.ics`;
}

/** "2026-10-09" → "Oct 9, 2026" (en) or "9 de oct. de 2026" (es). Date-only, no time zone shift. */
export function formatIsoDate(iso: string | undefined, lang: WalkLang = "en"): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  if (lang === "es") {
    const meses = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."];
    return `${d} de ${meses[m - 1]} de ${y}`;
  }
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** True when the source row itself is older than `months` (default 12) at `now`. */
export function isStaleSource(place: FoodPlace, now: Date = new Date(), months = 12): boolean {
  const [y, m, d] = place.sourceUpdated.split("-").map(Number);
  if (!y || !m) return false;
  const cutoff = new Date(now.getTime());
  cutoff.setMonth(cutoff.getMonth() - months);
  return new Date(Date.UTC(y, m - 1, d || 1, 12)) < cutoff;
}
