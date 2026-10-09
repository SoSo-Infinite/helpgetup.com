import { SENIOR_MEAL_SITES, type SeniorMealSite } from "@/data/albany-senior-meals";
import { distance, openingsFor, type Opening } from "@/lib/food-week";

export type SeniorMatch = {
  site: SeniorMealSite;
  /** Next published meal time within 7 days, skipping dates the source lists as closed. Null when none is published. */
  opening: Opening | null;
  distance: number;
};

function isoOf(o: Opening): string {
  const p = o.parts;
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

export function seniorOpenings(site: SeniorMealSite, now: Date, days = 7): Opening[] {
  if (!site.slots.length) return [];
  const through = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const closed = new Set(site.closedDates ?? []);
  return openingsFor(site, now, through).filter((o) => !closed.has(isoOf(o)));
}

/**
 * Senior (60+) meal sites for the ZIPs the person typed, closest first.
 * Within the same distance, a site with a published meal time comes first (soonest first),
 * then "call first" sites. Only sites within the same or a neighboring ZIP area are returned,
 * unless fewer than `min` are found, in which case the next closest are added.
 */
export function matchSeniorMeals(zips: string[], now: Date, limit = 5, min = 3): SeniorMatch[] {

  const ranked = SENIOR_MEAL_SITES.map((site) => {
    const opens = seniorOpenings(site, now);
    return { site, opening: opens[0] ?? null, distance: distance(site.sortZip ?? site.zip, zips) };
  }).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    const at = a.opening?.date.getTime() ?? Infinity;
    const bt = b.opening?.date.getTime() ?? Infinity;
    if (at !== bt) return at - bt;
    return a.site.name.localeCompare(b.site.name);
  });
  const near = ranked.filter((m) => m.distance <= 1);
  const out = near.slice(0, limit);
  for (const m of ranked) {
    if (out.length >= Math.max(min, Math.min(limit, near.length))) break;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}
