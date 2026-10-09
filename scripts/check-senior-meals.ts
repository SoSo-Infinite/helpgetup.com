/**
 * Senior (60+) meal sites: data rules and ranking.  npx tsx scripts/check-senior-meals.ts
 * Network-free; scripts/verify-food-sources.ts compares the rows to their live sources.
 */
import { ALBANY_COUNTY_ZIPS } from "../src/data/albany-food";
import {
  SENIOR_COUNTY_URL,
  SENIOR_MEAL_SITES,
  SENIOR_PROGRAM,
} from "../src/data/albany-senior-meals";
import { formatWhen, phoneHref, zonedDate } from "../src/lib/food-week";
import { matchSeniorMeals, seniorOpenings } from "../src/lib/senior-meals";
import { WALK_TEXT } from "../src/lib/walk-text";

const fail = (msg: string) => {
  throw new Error(msg);
};
const DAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DAY_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// ——— Data rules ———
if (SENIOR_MEAL_SITES.length !== 24) fail(`county lists 24 congregate sites, data has ${SENIOR_MEAL_SITES.length}`);
const ids = new Set<string>();
const contentIds = new Set<string>();
for (const s of SENIOR_MEAL_SITES) {
  if (ids.has(s.id)) fail("duplicate id " + s.id);
  ids.add(s.id);
  if (!s.countyContentId || contentIds.has(s.countyContentId)) fail("missing/duplicate county panel id " + s.id);
  contentIds.add(s.countyContentId as string);
  if (!s.sources.some((x) => x.url === SENIOR_COUNTY_URL)) fail("every site must cite the county page: " + s.id);
  if (!/^tel:\+1\d{10}(,\d+)?$/.test(phoneHref(s.phone))) fail(`bad phone for ${s.id}: ${s.phone}`);
  if (!s.phoneFrom) fail("phoneFrom required: " + s.id);
  if (!ALBANY_COUNTY_ZIPS.has(s.sortZip ?? s.zip)) fail(`site not sortable inside Albany County: ${s.id} ${s.zip}`);
  if (!s.reserve) fail("reservation rule required: " + s.id);
  if (!s.verifiedOn) fail("site never verified against its sources: " + s.id);
  // No invented times: slots only when a source published days/times, and each slot must be readable in hoursRaw.
  if (!s.hoursRaw && s.slots.length) fail("slots without published hours: " + s.id);
  if (s.hoursRaw && !s.slots.length) fail("published hours but no slots: " + s.id);
  for (const slot of s.slots) {
    if (slot.end !== null) fail("no senior source publishes an end time: " + s.id);
    const [h, m] = slot.start.split(":").map(Number);
    const clock = h === 12 && m === 0 ? /(Noon|12:00)/i : new RegExp(`\\b${h % 12 || 12}:${String(m).padStart(2, "0")}`);
    if (!clock.test(s.hoursRaw)) fail(`start ${slot.start} not in published text for ${s.id}: ${s.hoursRaw}`);
    for (const d of slot.weekdays) {
      const range = /Monday\s*[–-]\s*Friday/i.test(s.hoursRaw) && d >= 1 && d <= 5;
      if (!range && !s.hoursRaw.includes(DAY_LONG[d]) && !s.hoursRaw.includes(DAY[d])) {
        fail(`weekday ${DAY_LONG[d]} not in published text for ${s.id}: ${s.hoursRaw}`);
      }
    }
  }
}
const withHours = SENIOR_MEAL_SITES.filter((s) => s.slots.length);
const callFirst = SENIOR_MEAL_SITES.filter((s) => !s.slots.length);
if (withHours.length !== 13 || callFirst.length !== 11) fail(`expected 13 with published times + 11 call-first, got ${withHours.length} + ${callFirst.length}`);
if (SENIOR_PROGRAM.homeDelivered.phone !== "518-447-7177") fail("home-delivered intake is Albany County NY Connects 518-447-7177");
if (!/60/.test(SENIOR_PROGRAM.eligibility) || !/spouse/i.test(SENIOR_PROGRAM.eligibility)) fail("eligibility must say 60+ and spouses");

// ——— Ranking and times ———
// Wed Oct 7 2026, 10:00 ET, ZIP 12206: Westview Homes (12206, lunch Mon–Fri 11:30) is first.
const wed = zonedDate(2026, 10, 7, 10, 0);
const west = matchSeniorMeals(["12206"], wed);
if (west[0].site.id !== "sr-westview") fail("12206 should lead with Westview Homes, got " + west[0].site.id);
if (!west[0].opening || !formatWhen(west[0].opening).startsWith("Wednesday, Oct 7 · starts 11:30am")) {
  fail("Westview next meal should be Wed Oct 7 11:30am: " + (west[0].opening && formatWhen(west[0].opening)));
}
const sameZip = west.filter((m) => m.distance === 0).map((m) => m.site.id);
for (const id of ["sr-frank-chapman", "sr-townsend-park"]) if (!sameZip.includes(id)) fail(`${id} should be in 12206 results`);
const chapman = west.find((m) => m.site.id === "sr-frank-chapman")!;
if (chapman.opening) fail("Frank Chapman has no published meal time; it must stay call-first");
if (west.length < 3 || west.length > 5) fail("expected 3–5 senior sites, got " + west.length);

// Beltrone is closed Mon Oct 12 2026 (CSSC October menu): next meal is Tue Oct 13.
const holiday = zonedDate(2026, 10, 12, 8, 0);
const beltrone = SENIOR_MEAL_SITES.find((s) => s.id === "sr-beltrone")!;
const bNext = seniorOpenings(beltrone, holiday)[0];
if (!bNext || !formatWhen(bNext).startsWith("Tuesday, Oct 13")) fail("Beltrone should skip closed Oct 12: " + (bNext && formatWhen(bNext)));

// The Islamic Center (Colonie, Schenectady mailing ZIP 12304) still sorts with Colonie 12205.
const colonie = matchSeniorMeals(["12205"], wed);
if (!colonie.some((m) => m.site.id === "sr-islamic-center" && m.distance === 0)) fail("Islamic Center should sort with 12205");

// Hilltowns: Berne 12023 is not in the food ZIP list's neighbors, but the 3-site minimum still fills the list.
const far = matchSeniorMeals(["12193"], wed);
if (far[0].site.id !== "sr-westerlo" || far.length < 3) fail("Westerlo (12193) should lead and the list should have 3+: " + far.map((m) => m.site.id).join(","));

// ——— Strings: every senior label exists in English and Spanish ———
for (const key of Object.keys(WALK_TEXT.en).filter((k) => k.startsWith("senior"))) {
  const en = (WALK_TEXT.en as Record<string, unknown>)[key];
  const es = (WALK_TEXT.es as Record<string, unknown>)[key];
  if (typeof en !== typeof es) fail("missing Spanish string " + key);
  if (typeof en === "string" && (!es || es === en)) fail("Spanish string not translated: " + key);
}

console.log(`senior sites ${SENIOR_MEAL_SITES.length} · published times ${withHours.length} · call first ${callFirst.length}`);
for (const m of west) console.log("-", m.site.name, m.opening ? formatWhen(m.opening) : "60+, call first", m.site.phone);
console.log("ok");
