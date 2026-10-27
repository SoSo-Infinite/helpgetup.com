import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isListStale, reportChangeHref, STALE_AFTER_DAYS } from "../src/lib/freshness.ts";
import { WALK_TEXT } from "../src/lib/walk-text.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

test("stale banner shows only after 14 days", () => {
  assert.equal(STALE_AFTER_DAYS, 14);
  const now = new Date("2026-10-27T15:00:00Z");
  assert.equal(isListStale("2026-10-27", now), false);
  assert.equal(isListStale("2026-10-13", now), false); // exactly 14 days
  assert.equal(isListStale("2026-10-12", now), true); // 15 days
  assert.equal(isListStale("2026-10-09", now), true);
  assert.equal(isListStale("", now), false);
  assert.equal(isListStale("not-a-date", now), false);
});

test("report-a-change mailto names the stop", () => {
  const h = reportChangeHref("Arbor Hill Pantry");
  assert.ok(h.startsWith("mailto:hello@helpgetup.com?subject="));
  assert.match(decodeURIComponent(h), /subject=Change for Arbor Hill Pantry&body=What changed \(hours, address, rules\):/);
});

test("new strings exist in English and Spanish", () => {
  assert.equal(WALK_TEXT.en.reportChange, "Report a change");
  assert.equal(WALK_TEXT.es.reportChange, "Reportar un cambio");
  assert.match(WALK_TEXT.en.staleList("Oct 9, 2026"), /Hours may have changed since Oct 9, 2026\. Call before you go\./);
  assert.ok(WALK_TEXT.es.staleList("9 oct 2026").length > 10);
});

test("intent title, colon og:title, Organization schema without nonprofit claims", () => {
  const s = read("src/app/layout.tsx");
  assert.match(s, /Food pantries and free meals open this week in Albany County \| HelpGetUp/);
  assert.match(s, /"HelpGetUp: Take the next step\."/);
  assert.match(s, /"@type": "Organization"/);
  assert.doesNotMatch(s, /NGO|NonprofitType|501\(c\)/);
});

test("partners section and report links are wired", () => {
  assert.match(read("src/app/page.tsx"), /Run a pantry or meal program\?/);
  assert.match(read("src/components/FoodWalk.tsx"), /reportChangeHref\(place\.name\)/);
  assert.match(read("src/components/FoodList.tsx"), /reportChangeHref\(p\.name\)/);
});
