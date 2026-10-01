import { FOOD_PLACES_A } from "./albany-food-a";
import { FOOD_PLACES_B } from "./albany-food-b";
import { FOOD_PLACES_C } from "./albany-food-c";

/**
 * Albany County food rows for the demo.
 * Every hours string is copied from the cited source. Structured `slots`
 * are a reading of that string so the page can say what falls this week.
 * If a source did not publish an end time, `end` is null.
 * Checked against the Food Connect map (map.thefoodpantries.org) on 2026-09-30
 * and the February 2026 Albany County resource flyer where noted.
 * Rows are copied from those sources. A stop that is not on them is not listed.
 */

export type FoodKind = "pantry" | "meal" | "produce" | "fridge";

export type SlotRule = {
  /** 0 Sunday … 6 Saturday */
  weekdays: number[];
  /** 24-hour HH:MM */
  start: string;
  /** null when the source did not publish an end time */
  end: string | null;
  /** only these nth weekdays of the month (1–5) */
  nth?: number[];
  /** only the last matching weekday of the month */
  last?: boolean;
  /** skip these nth weekdays (closed dates the source named) */
  exceptNth?: number[];
};

export type FoodPlace = {
  id: string;
  name: string;
  kind: FoodKind;
  address: string;
  city: string;
  /** ZIP as published by the source */
  zip: string;
  phone: string;
  /** Hours sentence copied from the source */
  hoursRaw: string;
  /** Extra note copied or tightly paraphrased from the source. Empty if none. */
  note: string;
  sourceName: string;
  sourceUrl: string;
  /** ISO date the source says the row was last updated, or the flyer month */
  sourceUpdated: string;
  slots: SlotRule[];
  /** true when the source published no hours */
  hoursUnknown?: boolean;
};

const FLYER_URL =
  "https://thefoodpantries.org/wp-content/uploads/2026/02/February-2026-Albany-Resource-Flyer-1.pdf";

export const FOOD_PLACES: FoodPlace[] = [
  ...FOOD_PLACES_A,
  ...FOOD_PLACES_B,
  ...FOOD_PLACES_C,
];

export const OFFICIAL = {
  americaGov: {
    name: "America.gov",
    url: "https://america.gov/",
    detail:
      "Official site for finding the program path. You ask there. HelpGetUp does not sign in, and does not take a Social Security number, driver’s license, password, or ID photo.",
  },
  myBenefits: {
    name: "NYS myBenefits",
    url: "https://mybenefits.ny.gov/",
    detail:
      "New York’s site to apply for SNAP or renew. You open it yourself. HelpGetUp does not fill out the form or store a login.",
  },
  hotline: {
    name: "Albany County SNAP hotline",
    phone: "(518) 447-7620",
    phoneHref: "tel:+15184477620",
    hours: "Monday–Friday, 8:00am–5:00pm",
  },
  referral: {
    name: "The Food Pantries for the Capital District",
    phone: "(518) 458-1167",
    phoneHref: "tel:+15184581167",
    hours: "Referral line. The February 2026 Albany flyer lists ext. 1.",
    url: "https://thefoodpantries.org/how-to-find-food-assistance/find-food-now/",
  },
  map: {
    name: "Food Connect map",
    url: "https://map.thefoodpantries.org/",
  },
  flyer: {
    name: "Albany County resource flyer (February 2026)",
    url: FLYER_URL,
  },
} as const;

/** Albany County ZIPs this demo will answer. Others get a county-only message. */
export const ALBANY_COUNTY_ZIPS = new Set([
  "12007",
  "12009",
  "12023",
  "12041",
  "12045",
  "12046",
  "12047",
  "12054",
  "12059",
  "12067",
  "12077",
  "12083",
  "12084",
  "12085",
  "12107",
  "12110",
  "12120",
  "12143",
  "12147",
  "12158",
  "12159",
  "12161",
  "12183",
  "12186",
  "12189",
  "12193",
  "12201",
  "12202",
  "12203",
  "12204",
  "12205",
  "12206",
  "12207",
  "12208",
  "12209",
  "12210",
  "12211",
  "12222",
]);

export const NEIGHBORHOODS: { label: string; zips: string[] }[] = [
  { label: "Arbor Hill", zips: ["12210", "12207"] },
  { label: "West Hill", zips: ["12206", "12210"] },
  { label: "South End", zips: ["12202"] },
  { label: "Downtown", zips: ["12207", "12210", "12201"] },
  { label: "Center Square", zips: ["12210"] },
  { label: "Lark Street", zips: ["12210"] },
  { label: "Pine Hills", zips: ["12203"] },
  { label: "Delaware Avenue", zips: ["12208", "12209"] },
  { label: "New Scotland", zips: ["12208"] },
  { label: "North Albany", zips: ["12204", "12207"] },
  { label: "Menands", zips: ["12204"] },
  { label: "Loudonville", zips: ["12211"] },
  { label: "Colonie", zips: ["12205", "12110"] },
  { label: "Latham", zips: ["12110"] },
  { label: "Cohoes", zips: ["12047"] },
  { label: "Watervliet", zips: ["12189"] },
  { label: "Green Island", zips: ["12183"] },
  { label: "Guilderland", zips: ["12084"] },
  { label: "Altamont", zips: ["12009"] },
  { label: "Bethlehem", zips: ["12054", "12077"] },
  { label: "Delmar", zips: ["12054"] },
  { label: "Glenmont", zips: ["12077"] },
  { label: "Selkirk", zips: ["12158"] },
  { label: "Feura Bush", zips: ["12067"] },
  { label: "Coeymans", zips: ["12046", "12143"] },
  { label: "Coeymans Hollow", zips: ["12046"] },
  { label: "Ravena", zips: ["12143"] },
  { label: "Voorheesville", zips: ["12186"] },
  { label: "Westerlo", zips: ["12193"] },
  { label: "Berne", zips: ["12059"] },
  { label: "East Berne", zips: ["12059"] },
];
