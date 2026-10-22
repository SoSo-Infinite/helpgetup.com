/**
 * The HelpGetUp voice helper's two lookup tools, run in the browser against the same data the page
 * already ships (src/data/*): no network, no server, no paid calls. The voice model may only speak the
 * facts these return. Hours are the source's own words; nothing is guessed or filled in.
 *
 *   find_food({ place, kind })  -> up to 4 pantries / community meals / produce stops / fridges, closest first
 *   senior_meals({ place })     -> up to 3 Albany County 60+ meal sites, plus home-delivered meals intake
 *
 * Browser-safe (no regex lookbehind, no Node APIs).
 */
import { FOOD_PLACES, type FoodKind, type FoodPlace } from "@/data/albany-food";
import { SENIOR_PROGRAM } from "@/data/albany-senior-meals";
import {
  distance,
  formatWhen,
  isStaleSource,
  matchFood,
  nyParts,
  openingsFor,
  type Opening,
  resolvePlaceQuery,
} from "@/lib/food-week";
import { matchSeniorMeals } from "@/lib/senior-meals";
import { SITE_SPOKEN } from "./identity";
import { speakPhonesIn, spokenPhone } from "./spoken";

export const FOOD_TOOL_NAMES = ["find_food", "senior_meals"] as const;
const KINDS: FoodKind[] = ["pantry", "meal", "produce", "fridge"];
const KIND_SAID: Record<FoodKind, string> = {
  pantry: "food pantry (groceries to take home)",
  meal: "community meal",
  produce: "produce stop",
  fridge: "community fridge",
};
const MAX_FOOD = 4;
const MAX_SENIOR = 3;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** "Thursday, October 22" in Albany, so the helper can say "today" or "tomorrow" correctly. */
export function todayInAlbany(now: Date): string {
  const p = nyParts(now);
  return `${DAYS[p.weekday]}, ${MONTHS[p.month - 1]} ${p.day}`;
}

type Spoken = Record<string, string | boolean | undefined>;

function callFirstReason(place: FoodPlace, now: Date): string | undefined {
  if (place.unconfirmed)
    return "No current public source confirms this stop. Call before you go.";
  if (place.hoursUnknown && !place.alwaysOpen)
    return "The source does not publish hours. Call before you go.";
  if (isStaleSource(place, now))
    return "The source has not updated this listing in over a year. Call before you go.";
  if (/call (ahead|first|before)/i.test(place.note))
    return "The source says to call ahead.";
  return undefined;
}

function foodRow(place: FoodPlace, opening: Opening | null, now: Date): Spoken {
  const why = callFirstReason(place, now);
  return {
    name: place.name,
    type: KIND_SAID[place.kind],
    address: `${place.address}, ${place.city}`,
    next_published_time: opening ? formatWhen(opening) : undefined,
    published_hours: place.hoursRaw
      ? speakPhonesIn(place.hoursRaw)
      : place.alwaysOpen
        ? "The source lists it as open 24 hours, 7 days."
        : "No hours published.",
    phone: place.phone ? spokenPhone(place.phone) : "No phone published.",
    note: place.note ? speakPhonesIn(place.note) : undefined,
    call_before_you_go: Boolean(why),
    why_call_first: why,
    not_free:
      place.kind === "produce" && /not free/i.test(place.note)
        ? true
        : undefined,
  };
}

/** Same week logic as the site's walk; a kind filter re-ranks only that kind. */
function rankByKind(zips: string[], now: Date, kind: FoodKind) {
  const through = new Date(now.getTime() + WEEK_MS);
  return FOOD_PLACES.filter((p) => p.kind === kind)
    .map((place) => {
      const opens = place.hoursUnknown ? [] : openingsFor(place, now, through);
      return {
        place,
        opening: opens[0] ?? null,
        distance: distance(place.zip, zips),
      };
    })
    .filter((m) => m.opening || m.place.hoursUnknown)
    .sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      const at = a.opening?.date.getTime() ?? Number.POSITIVE_INFINITY;
      const bt = b.opening?.date.getTime() ?? Number.POSITIVE_INFINITY;
      return at - bt;
    })
    .slice(0, MAX_FOOD);
}

function refused(reason: string): Spoken {
  if (reason === "ssn")
    return {
      ok: false,
      reason: "private",
      say: "Never ask for, repeat or keep a Social Security number. Ask only for a town, neighborhood or ZIP code.",
    };
  if (reason === "empty")
    return {
      ok: false,
      reason: "need_place",
      say: "Ask which town, neighborhood or ZIP code in Albany County they are in.",
    };
  return {
    ok: false,
    reason: "outside_albany_county",
    say: "Help Get Up only lists places in Albany County. If they are somewhere else, two-one-one (call or text 211) can find food near them. If you misheard the town, ask them to say it again or give a ZIP code.",
  };
}

const RULES =
  "Speak only what is here. Read hours as published; never add, round or guess times. If call_before_you_go is true, say call before you go. If next_published_time is missing, say the hours are not published and to call. Offer one or two places, not all of them.";

export function findFood(
  args: { place?: unknown; kind?: unknown },
  now: Date = new Date(),
): Record<string, unknown> {
  const place = typeof args.place === "string" ? args.place.slice(0, 80) : "";
  const kind = KINDS.includes(args.kind as FoodKind)
    ? (args.kind as FoodKind)
    : null;
  const where = resolvePlaceQuery(place);
  if ("error" in where) return refused(where.error);
  let rows: Spoken[];
  if (kind) {
    rows = rankByKind(where.zips, now, kind).map((m) =>
      foodRow(m.place, m.opening, now),
    );
  } else {
    const r = matchFood(place, now);
    if (!r.ok) return refused(r.reason);
    rows = r.places
      .slice(0, MAX_FOOD)
      .map((m) => foodRow(m.place, m.opening, now));
  }
  return {
    ok: true,
    area: where.label,
    today: todayInAlbany(now),
    results: rows,
    rules: RULES,
    more: `The full list with every place is on ${SITE_SPOKEN}.`,
  };
}

export function seniorMeals(
  args: { place?: unknown },
  now: Date = new Date(),
): Record<string, unknown> {
  const place = typeof args.place === "string" ? args.place.slice(0, 80) : "";
  const where = resolvePlaceQuery(place);
  const hdm = SENIOR_PROGRAM.homeDelivered;
  const program = {
    who_can_go: speakPhonesIn(SENIOR_PROGRAM.eligibility),
    cost: speakPhonesIn(SENIOR_PROGRAM.contribution),
    county_office: `${SENIOR_PROGRAM.countyName}, ${spokenPhone(SENIOR_PROGRAM.countyPhone)}`,
    home_delivered_meals: `${speakPhonesIn(hdm.eligibility)} Call ${hdm.phoneName} at ${spokenPhone(hdm.phone)}.`,
    meals_on_wheels_provider: `${hdm.lifePathNote} ${spokenPhone(hdm.lifePathPhone)}.`,
  };
  if ("error" in where) return { ...refused(where.error), program };
  const sites = matchSeniorMeals(where.zips, now, MAX_SENIOR, 2)
    .slice(0, MAX_SENIOR)
    .map(({ site, opening }) => ({
      name: site.name,
      address: `${site.address}, ${site.city}`,
      next_published_time: opening ? formatWhen(opening) : undefined,
      published_hours: site.hoursRaw || "No meal time published.",
      phone: spokenPhone(site.phone),
      reserve: speakPhonesIn(site.reserve),
      note: site.note ? speakPhonesIn(site.note) : undefined,
      call_before_you_go: !site.hoursRaw,
      why_call_first: site.hoursRaw
        ? undefined
        : "No meal time is published. Call first to reserve and ask the time.",
    }));
  return {
    ok: true,
    area: where.label,
    today: todayInAlbany(now),
    sites,
    program,
    rules: RULES,
  };
}

/** Dispatch for GrokTalk's onTool. Unknown names return an error object (never throws). */
export function runFoodTool(
  name: string,
  rawArgs: string,
  now: Date = new Date(),
): Record<string, unknown> {
  let args: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(rawArgs || "{}");
    if (parsed && typeof parsed === "object") args = parsed;
  } catch {
    /* fall through with empty args */
  }
  if (name === "find_food") return findFood(args, now);
  if (name === "senior_meals") return seniorMeals(args, now);
  return { ok: false, error: "unknown tool" };
}
