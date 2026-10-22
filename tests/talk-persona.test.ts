// HelpGetUp-specific: Rosa's identity, hand-off rules, 518, Good day, and the food lookups never
// inventing hours. No network, no paid calls.
import assert from "node:assert/strict";
import test from "node:test";
import { ALBANY_COUNTY_ZIPS, FOOD_PLACES } from "../src/data/albany-food.ts";
import { SENIOR_MEAL_SITES } from "../src/data/albany-senior-meals.ts";
import {
  buildClientPlan,
  buildSessionUpdate,
  GREETING_TEXT,
  IDLE_TEXT,
  WRAP_TEXT,
} from "../src/lib/talk/grok-config.ts";
import { findFood, runFoodTool, seniorMeals } from "../src/lib/talk/food-tool.ts";
import { formatClock, isStaleSource } from "../src/lib/food-week.ts";
import { AGENT_NAME } from "../src/lib/talk/identity.ts";
import { speakPhonesIn, spokenPhone } from "../src/lib/talk/spoken.ts";

// Thursday Oct 22, 2026, 11:41 am in Albany.
const NOW = new Date("2026-10-22T15:41:00Z");
const instructions = () =>
  (buildSessionUpdate().session as { instructions: string }).instructions;
const RAW_518 = /\(?518\)?[\s.-]?\d{3}[\s.-]?\d{4}|\b518\b/;

// ---------- greeting and scripted lines ----------

test("greeting: Good day, says it's an AI helper for Help Get Up, own name, Spanish offer", () => {
  assert.equal(AGENT_NAME, "Rosa");
  assert.equal(
    GREETING_TEXT,
    "Good day. I'm Rosa, an AI helper for Help Get Up. I can help you find food in Albany County, like a pantry, a free meal, SNAP, or meals for people sixty and up. También hablo español. What town or ZIP code are you in?",
  );
  assert.ok(GREETING_TEXT.startsWith("Good day."));
  assert.match(GREETING_TEXT, /an AI helper for Help Get Up/);
  assert.ok(!/Albany AI Guy|concierge/i.test(GREETING_TEXT));
  const g = buildClientPlan({}).greeting as {
    item: { type: string; interruptible: boolean; content: { text: string }[] };
  };
  assert.equal(g.item.type, "force_message");
  assert.equal(g.item.content[0]?.text, GREETING_TEXT);
  for (const t of [GREETING_TEXT, WRAP_TEXT, IDLE_TEXT]) {
    assert.ok(!RAW_518.test(t), t);
    assert.ok(
      !/good (morning|afternoon|evening)|tonight|recorded|email|text me|!/i.test(t),
      t,
    );
  }
});

// ---------- persona ----------

test("persona: Rosa, food help in Albany County, dignity first, not the Albany AI Guy or a concierge", () => {
  const i = instructions();
  assert.ok(i.startsWith("# Role\nYou are Rosa, the voice helper on help get up dot com"));
  assert.match(i, /You are an AI\./);
  assert.match(i, /Dignity first/);
  assert.match(i, /never make anyone feel small, judged or questioned/);
  assert.match(i, /Never ask for a name, a Social Security number/);
  assert.match(i, /You are not a concierge/);
  assert.ok(!/You are the Albany AI Guy|five-star|golden keys|royalty|luxury/i.test(i));
  assert.match(i, /If they speak Spanish, answer in simple Spanish/);
  assert.match(i, /one or two short sentences, under 35 words/);
  assert.ok(!i.includes("`"));
});

test("persona: hand-offs (Albany AI Guy, 211, 911, 988)", () => {
  const i = instructions();
  assert.match(
    i,
    /Restaurants, things to do, local businesses and services, finding a contractor[^\n]*Albany AI Guy[^\n]*albany A I guy dot com/,
  );
  assert.match(
    i,
    /Rent, housing, eviction, shelter tonight, utility shutoffs, heating help, and other benefits: tell them to call or text two-one-one \(211\)/,
  );
  assert.match(i, /call 911 right away/);
  assert.match(i, /call or text 988, the Suicide and Crisis Lifeline/);
  assert.match(i, /only covers Albany County right now, and that two-one-one/);
});

test("persona: no invented hours, call before you go, facts only from the tools and data", () => {
  const i = instructions();
  assert.match(i, /Read hours exactly as the tool gives them\. Never invent, guess, round or fill in hours/);
  assert.match(i, /say "call before you go"/);
  assert.match(i, /call find_food/);
  assert.match(i, /call senior_meals/);
  assert.match(i, /not free food/);
});

test("persona: Good day only, five-one-eight, honest about summaries, never 'recorded'", () => {
  const i = instructions();
  assert.match(i, /Greet only with "Good day", at any hour, never good morning, good afternoon or good evening/);
  assert.match(i, /always said "five-one-eight", never five eighteen/);
  // The rule itself names 518; every other 518 (phone numbers) is pre-spoken.
  const rest = i.replace('The area code 518 is always said "five-one-eight"', "");
  assert.ok(!RAW_518.test(rest), "every 518 in the instructions is pre-spoken");
  // NY Connects home-delivered meals intake, from the data, spoken.
  assert.match(i, /New York Connects at five-one-eight, four four seven, seven one seven seven/);
  // SNAP hotline from the data.
  assert.match(i, /five-one-eight, four four seven, seven six two zero, Monday to Friday/);
  assert.match(i, /the audio isn't recorded, but a short written summary is kept/);
  assert.match(i, /Never say the call is recorded/);
  assert.ok(!/\b(is|being) recorded\b/i.test(i.replace("Never say the call is recorded", "")));
  assert.match(i, /Voice only\. Never offer or promise texts/);
});

test("session: replace map keeps 518 as five-one-eight in audio", () => {
  const s = buildSessionUpdate().session as { replace: Record<string, string> };
  assert.equal(s.replace["518"], "five-one-eight");
  assert.equal(s.replace["NY Connects"], "New York Connects");
});

// ---------- spoken phone numbers ----------

test("spokenPhone: 518 is five-one-eight, digits one by one, extensions and press", () => {
  assert.equal(
    spokenPhone("518-447-7177"),
    "five-one-eight, four four seven, seven one seven seven",
  );
  assert.equal(
    spokenPhone("(518) 463-1516 ext 110"),
    "five-one-eight, four six three, one five one six, extension one one zero",
  );
  assert.equal(
    spokenPhone("518-465-3322 x 111"),
    "five-one-eight, four six five, three three two two, extension one one one",
  );
  assert.equal(
    spokenPhone("(518) 458-1167, press 1"),
    "five-one-eight, four five eight, one one six seven, then press one",
  );
  assert.equal(spokenPhone("800-555-0100"), "eight zero zero, five five five, zero one zero zero");
  assert.equal(spokenPhone("call us"), "call us");
  assert.equal(
    speakPhonesIn("RSVP 518-505-5944 or (518) 447-7198."),
    "RSVP five-one-eight, five zero five, five nine four four or five-one-eight, four four seven, seven one nine eight.",
  );
});

// ---------- food lookups: only the data, never invented ----------

const HOURS = new Set(FOOD_PLACES.map((p) => p.hoursRaw).filter(Boolean));
const BY_NAME = new Map(FOOD_PLACES.map((p) => [p.name, p]));
const FIXED = new Set([
  "No hours published.",
  "The source lists it as open 24 hours, 7 days.",
]);

function checkRow(r: Record<string, unknown>) {
  const place = BY_NAME.get(String(r.name));
  assert.ok(place, `unknown place ${r.name}`);
  const hours = String(r.published_hours);
  if (place.hoursRaw) {
    assert.ok(hours.length > 0);
    assert.ok(
      HOURS.has(place.hoursRaw),
      "published_hours comes from the row",
    );
    // Same words as the source (only phone numbers inside it are pre-spoken).
    assert.equal(hours, speakPhonesIn(place.hoursRaw));
  } else {
    assert.ok(FIXED.has(hours), hours);
  }
  if (r.next_published_time) {
    const starts = place.slots.map((s) => formatClock(s.start));
    assert.ok(
      starts.some((c) => String(r.next_published_time).includes(c)),
      `${r.name}: ${r.next_published_time} not a published start (${starts})`,
    );
    const ends = place.slots.map((s) => (s.end ? formatClock(s.end) : "end time not published"));
    assert.ok(ends.some((c) => String(r.next_published_time).includes(c)));
  } else {
    assert.ok(place.hoursUnknown || place.slots.length === 0 || !r.next_published_time);
  }
  assert.ok(!RAW_518.test(String(r.phone)), String(r.phone));
  assert.ok(!RAW_518.test(String(r.note ?? "")), String(r.note));
  if (r.call_before_you_go) assert.ok(String(r.why_call_first).length > 0);
}

test("find_food: every ZIP and kind returns only real places with their published hours", () => {
  let rows = 0;
  for (const zip of ALBANY_COUNTY_ZIPS) {
    for (const kind of ["any", "pantry", "meal", "produce", "fridge"]) {
      const r = findFood({ place: zip, kind }, NOW);
      assert.equal(r.ok, true, zip);
      const results = r.results as Record<string, unknown>[];
      assert.ok(results.length <= 4);
      for (const row of results) {
        checkRow(row);
        rows++;
      }
      assert.equal(r.today, "Thursday, October 22");
      assert.match(String(r.rules), /never add, round or guess times/);
    }
  }
  assert.ok(rows > 100, `checked ${rows} rows`);
});

test("find_food: a published time is the source's own time (Arbor Hill pantry)", () => {
  const r = findFood({ place: "Arbor Hill", kind: "pantry" }, NOW);
  const row = (r.results as Record<string, unknown>[]).find((x) =>
    String(x.name).startsWith("Arbor Hill Pantry"),
  );
  assert.ok(row, "Arbor Hill Pantry is near Arbor Hill");
  assert.equal(
    row.published_hours,
    "Monday, Tuesday, Thursday, and Friday 9:30am-12:00pm, 1-4:30pm Wednesday 10:00am-12:00pm, 1:00pm-6:00pm",
  );
  // 11:41 am: the 9:30 to 12 window is still open.
  assert.equal(row.next_published_time, "Thursday, Oct 22 · 9:30am–12pm");
  assert.equal(
    row.phone,
    "five-one-eight, four six three, one five one six, extension one one zero",
  );
  // Source row last updated Aug 2025: over a year old, so call first.
  assert.equal(row.call_before_you_go, true);
});

test("find_food: stale and unconfirmed rows say call before you go", () => {
  const stale = FOOD_PLACES.filter((p) => isStaleSource(p, NOW));
  const unconfirmed = FOOD_PLACES.filter((p) => p.unconfirmed);
  assert.ok(stale.length > 0);
  for (const p of [...stale, ...unconfirmed]) {
    const r = findFood({ place: p.zip, kind: p.kind }, NOW);
    const row = (r.results as Record<string, unknown>[]).find((x) => x.name === p.name);
    if (!row) continue; // not in the closest four for its own ZIP this week
    assert.equal(row.call_before_you_go, true, p.name);
    assert.match(String(row.why_call_first), /call/i);
  }
});

test("find_food: Veggie Mobile is said to be not free", () => {
  const r = findFood({ place: "Cohoes", kind: "produce" }, NOW);
  const rows = r.results as Record<string, unknown>[];
  assert.ok(rows.length > 0);
  for (const row of rows.filter((x) => String(x.name).startsWith("Veggie Mobile"))) {
    assert.equal(row.not_free, true);
    assert.match(String(row.note), /not free/);
  }
});

test("find_food: outside Albany County hands off to 211; SSN refused; empty asks for a place", () => {
  for (const place of ["Troy", "12180", "Schenectady"]) {
    const r = findFood({ place }, NOW);
    assert.equal(r.ok, false);
    assert.equal(r.reason, "outside_albany_county");
    assert.match(String(r.say), /two-one-one \(call or text 211\)/);
  }
  const ssn = findFood({ place: "my ssn is 123-45-6789" }, NOW);
  assert.equal(ssn.reason, "private");
  assert.match(String(ssn.say), /Never ask for, repeat or keep a Social Security number/);
  assert.equal(findFood({}, NOW).reason, "need_place");
});

test("senior_meals: real 60+ sites, call first where no time is published, NY Connects for home delivery", () => {
  const names = new Set(SENIOR_MEAL_SITES.map((s) => s.name));
  for (const zip of ALBANY_COUNTY_ZIPS) {
    const r = seniorMeals({ place: zip }, NOW);
    assert.equal(r.ok, true);
    const sites = r.sites as Record<string, unknown>[];
    assert.ok(sites.length >= 1 && sites.length <= 3);
    for (const s of sites) {
      assert.ok(names.has(String(s.name)));
      const site = SENIOR_MEAL_SITES.find((x) => x.name === s.name);
      if (!site?.hoursRaw) {
        assert.equal(s.published_hours, "No meal time published.");
        assert.equal(s.call_before_you_go, true);
        assert.equal(s.next_published_time, undefined);
      } else {
        assert.equal(s.published_hours, site.hoursRaw);
      }
      for (const v of Object.values(s)) assert.ok(!RAW_518.test(String(v)), String(v));
    }
    const program = r.program as Record<string, string>;
    assert.match(
      program.home_delivered_meals,
      /Albany County NY Connects at five-one-eight, four four seven, seven one seven seven/,
    );
  }
});

test("runFoodTool: bad JSON and unknown tools never throw", () => {
  assert.equal(runFoodTool("find_food", "{not json", NOW).reason, "need_place");
  assert.equal(runFoodTool("save_followup", "{}", NOW).error, "unknown tool");
  assert.equal(runFoodTool("find_food", JSON.stringify({ place: "Cohoes" }), NOW).ok, true);
});

test("persona: nothing to sell, never mentions prices or plans", async () => {
  const { personaInstructions } = await import("../src/lib/talk/grok-persona.ts");
  const i = personaInstructions();
  assert.ok(i.includes("HelpGetUp has nothing to sell. Never mention prices, plans, fees, products or selling"));
  assert.ok(!/per month|setup fee|\btiers?\b|subscription/i.test(i));
  for (const m of i.matchAll(/.{0,60}\$\d.{0,60}/g)) assert.ok(/contribution/i.test(m[0]), m[0]);
});
