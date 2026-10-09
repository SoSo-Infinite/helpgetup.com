import type { SlotRule } from "./albany-food";
import { VERIFIED } from "./verified";

/**
 * Albany County senior (60+) meal sites — congregate dining run under the Albany County
 * Department for Aging, plus how to ask for home-delivered meals.
 *
 * Sources, read 2026-10-09 (see scripts/verify-food-sources.ts for the re-check):
 * - Albany County Department for Aging, Congregate Dining page and each site's detail panel
 *   (https://www.albanycountyny.gov/congregate-dining). The site list, eligibility (60+ and spouses),
 *   "24-hour notice" reservations and the per-site RSVP phone come from here. The page is drawn by
 *   JavaScript, so the verifier compares against a rendered snapshot.
 * - Sponsor pages for days and times, because the county page publishes times for only 3 sites:
 *   LifePath Community Dining (lifepathny.org/communitydining, page updated 2026-09-25),
 *   Colonie Senior Service Centers' October 2026 "Senior Connections" newsletter (Beltrone),
 *   and the Town of Berne seniors page (Hilltown site).
 * - The Food Connect map's "Older Adult Meal Sites" layer (all rows say "Please call") is only a
 *   cross-check; it is never the source of a time.
 *
 * Rules: a site with no published day/time has `hoursRaw: ""`, no slots, and shows as
 * "60+, call first" with the official phone. Where sources disagree, the card says so in `note`.
 * Nothing here is guessed. A meal time with no published end has `end: null`.
 */

export type SeniorSource = { name: string; url: string; updated?: string };

export type SeniorMealSite = {
  id: string;
  name: string;
  address: string;
  city: string;
  zip: string;
  /** ZIP used only to sort by distance when the mailing ZIP is outside the county list (Islamic Center: Colonie, Schenectady mail). */
  sortZip?: string;
  /** The number to call to reserve, as published by the source named in `phoneFrom`. */
  phone: string;
  phoneFrom: string;
  /** Days/times copied from the source. Empty when no source publishes them. */
  hoursRaw: string;
  slots: SlotRule[];
  /** ISO dates the source lists as closed (e.g. a holiday on the sponsor's monthly menu). */
  closedDates?: string[];
  /** Reservation rule copied from the source. */
  reserve: string;
  /** Conflicts between sources and other cautions. Empty if none. */
  note: string;
  /** Albany County Department for Aging detail-panel id on the congregate dining page. */
  countyContentId?: string;
  sources: SeniorSource[];
  verifiedOn?: string;
};

export const SENIOR_COUNTY_URL = "https://www.albanycountyny.gov/congregate-dining";
export const SENIOR_HDM_URL = "https://www.albanycountyny.gov/home-delivered-meals";
export const SENIOR_LIFEPATH_URL = "https://lifepathny.org/communitydining/";
export const SENIOR_LIFEPATH_MOW_URL = "https://lifepathny.org/mealsonwheels/";
export const SENIOR_CSSC_URL =
  "https://colonieseniors.org/wp-content/uploads/2026/09/SeniorConnections_October_2026__4pg_r13.pdf";
export const SENIOR_BERNE_URL = "https://berneny.gov/social-services-for-seniors/";

const COUNTY: SeniorSource = {
  name: "Albany County Department for Aging — Congregate Dining",
  url: SENIOR_COUNTY_URL,
};
const LIFEPATH: SeniorSource = {
  name: "LifePath — Community Dining",
  url: SENIOR_LIFEPATH_URL,
  updated: "2026-09-25",
};
const CSSC: SeniorSource = {
  name: "Colonie Senior Service Centers — Senior Connections, October 2026",
  url: SENIOR_CSSC_URL,
};
const LIFEPATH_RESERVE =
  "LifePath: reserve by 1 p.m. the business day before. Walk-ins welcome, but a meal isn’t guaranteed without a reservation.";
const COUNTY_RESERVE = "County: reservations need 24 hours’ notice. Call the site to reserve and ask the meal time.";

/** Program-wide facts from the county and LifePath pages. Shown once above the site list. */
export const SENIOR_PROGRAM = {
  checkedOn: "2026-10-09",
  eligibility:
    "Age 60 or older, plus the spouse of an eligible person at any age (Albany County Department for Aging). LifePath: adults under 60 or living outside Albany County may join as paying guests.",
  contribution:
    "Suggested contribution $3 a meal. Not required; no one is turned away for not paying (county Nutrition Services page).",
  countyPhone: "518-447-7198",
  countyName: "Albany County Department for Aging",
  homeDelivered: {
    name: "Home-delivered meals (Meals on Wheels)",
    phone: "518-447-7177",
    phoneName: "Albany County NY Connects",
    eligibility:
      "For people 60+ who are homebound. The county lists three conditions, all required: incapacitated by accident, illness or frailty; no support from family, friends or neighbors; and unable to prepare meals. Family, friends or agencies can refer. Call NY Connects for an intake.",
    lifePathPhone: "518-465-3322 x 111",
    lifePathNote: "LifePath (the county’s Meals on Wheels provider) also takes calls about enrollment and self-pay meals.",
    url: SENIOR_HDM_URL,
    lifePathUrl: SENIOR_LIFEPATH_MOW_URL,
  },
} as const;

const SITES: SeniorMealSite[] = [
  // ——— Albany ———
  {
    id: "sr-frank-chapman",
    name: "Frank Chapman Memorial Institute",
    address: "340 First Street",
    city: "Albany",
    zip: "12206",
    phone: "518-729-3472",
    phoneFrom: "county page",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "The county page prints the address as 40 1st St, 12210. The institute’s own site and the Food Connect map both say 340 First Street, 12206, so that is used here.",
    countyContentId: "eb96ca5d-2d0a-4e9a-8c37-ccfd7b70513e",
    sources: [COUNTY, { name: "Frank Chapman Memorial Institute — Contact", url: "https://fcmialbany.org/contact-us" }],
  },
  {
    id: "sr-livingston",
    name: "LifePath Living Center — Livingston School Apartments",
    address: "315 Northern Blvd",
    city: "Albany",
    zip: "12210",
    phone: "518-465-3322 x 500",
    phoneFrom: "LifePath",
    hoursRaw: "Dinner • Tuesday, Wednesday and Thursday • 4:30 p.m.",
    slots: [{ weekdays: [2, 3, 4], start: "16:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "The county page lists 518-505-5944 to RSVP and ZIP 12206; LifePath and the Food Connect map say 12210.",
    countyContentId: "0d123f9c-c481-43eb-addc-1c6bda817896",
    sources: [LIFEPATH, COUNTY],
  },
  {
    id: "sr-ohav-shalom",
    name: "Ohav Shalom (Ohav Sholom Apartments)",
    address: "115 Krumkill Rd",
    city: "Albany",
    zip: "12208",
    phone: "518-465-3322 x 500",
    phoneFrom: "LifePath",
    hoursRaw: "Dinner • Monday & Wednesday • 4:30 p.m.",
    slots: [{ weekdays: [1, 3], start: "16:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "The county page lists 518-465-6465 for this site.",
    countyContentId: "20e6ec4f-e449-4647-a880-c22320810ea0",
    sources: [LIFEPATH, COUNTY],
  },
  {
    id: "sr-parkview",
    name: "Parkview Apartments",
    address: "400 Hudson Ave",
    city: "Albany",
    zip: "12203",
    phone: "518-756-8593",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "f27f1e93-98dc-46cb-925c-271ddfa72ca9",
    sources: [COUNTY],
  },
  {
    id: "sr-albany-jcc",
    name: "Sidney Albert Albany Jewish Community Center",
    address: "340 Whitehall Rd",
    city: "Albany",
    zip: "12208",
    phone: "518-438-6651",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "06324ae3-8143-446e-adc7-73bae5ae39b9",
    sources: [COUNTY],
  },
  {
    id: "sr-south-mall",
    name: "South Mall Senior Center (South Mall Towers)",
    address: "101 S Pearl St",
    city: "Albany",
    zip: "12207",
    phone: "518-465-3322 x 500",
    phoneFrom: "LifePath",
    hoursRaw: "Dinner • Tuesday & Wednesday • 4:30 p.m. • • Lunch • Friday • 11:30 a.m.",
    slots: [
      { weekdays: [2, 3], start: "16:30", end: null },
      { weekdays: [5], start: "11:30", end: null },
    ],
    reserve: LIFEPATH_RESERVE,
    note: "The county page says “Lunch: Friday at Noon” and lists 518-463-0294 to RSVP and for the menu. LifePath, which serves the meal, says Friday lunch is 11:30 a.m. Call to confirm the time.",
    countyContentId: "a09bbad1-78f0-4686-abea-546594e4999b",
    sources: [LIFEPATH, COUNTY],
  },
  {
    id: "sr-townsend-park",
    name: "Townsend Park Apartments",
    address: "45 Central Ave",
    city: "Albany",
    zip: "12206",
    phone: "518-756-8593",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "07244ce9-d234-48a9-a281-9d334b9869b6",
    sources: [COUNTY],
  },
  {
    id: "sr-westview",
    name: "Westview Homes",
    address: "680 Central Ave",
    city: "Albany",
    zip: "12206",
    phone: "518-465-3322 x 500",
    phoneFrom: "LifePath",
    hoursRaw: "Lunch • Monday – Friday • 11:30 a.m.",
    slots: [{ weekdays: [1, 2, 3, 4, 5], start: "11:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "The county page lists 518-482-2120 for this site.",
    countyContentId: "3b04b69c-c559-465e-bfd5-73d269b53793",
    sources: [LIFEPATH, COUNTY],
  },
  // ——— Berne ———
  {
    id: "sr-berne",
    name: "Hilltown Community Center (Town of Berne Community & Senior Center)",
    address: "1360 Helderberg Trail (Route 443)",
    city: "Berne",
    zip: "12023",
    phone: "518-465-3322 x 500",
    phoneFrom: "LifePath",
    hoursRaw: "Lunch • Tuesday & Friday • 11:30 a.m.",
    slots: [{ weekdays: [2, 5], start: "11:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "Three numbers are published: LifePath 518-465-3322 x 500, the Town of Berne page 518-465-6465 (reserve by 1 p.m. the day before), and the county page 518-937-5963. The town page also says Tuesday and Friday at 11:30 a.m.",
    countyContentId: "77298b6e-6160-41eb-8ecf-69d1a94ca3c6",
    sources: [LIFEPATH, { name: "Town of Berne — Social Services for Seniors", url: SENIOR_BERNE_URL }, COUNTY],
  },
  // ——— Cohoes ———
  {
    id: "sr-cohoes",
    name: "Cohoes Multi-Service Senior Citizen Center",
    address: "10 Cayuga Plaza",
    city: "Cohoes",
    zip: "12047",
    phone: "518-465-3322 x 200",
    phoneFrom: "LifePath",
    hoursRaw: "Lunch • Monday – Friday • 12:00 p.m.",
    slots: [{ weekdays: [1, 2, 3, 4, 5], start: "12:00", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "Address: the county page and the Food Connect map say 10 Cayuga Plaza; LifePath lists the Cohoes Senior Center at 18 Mohawk St. Ask which door when you call. The county page lists 518-235-2420 to RSVP.",
    countyContentId: "6fe2dd95-15bc-4326-b93e-1d75da2dbeb3",
    sources: [LIFEPATH, COUNTY],
  },
  // ——— Colonie ———
  {
    id: "sr-beltrone",
    name: "Beltrone Living Center",
    address: "6 Winners Circle",
    city: "Albany",
    zip: "12205",
    phone: "518-459-2857 ext. 303",
    phoneFrom: "county page and CSSC newsletter",
    hoursRaw: "Monday-Friday at Noon (Senior Dining Program, October 2026)",
    slots: [{ weekdays: [1, 2, 3, 4, 5], start: "12:00", end: null }],
    closedDates: ["2026-10-12"],
    reserve:
      "Colonie Senior Service Centers: registration and reservations are required; call by 12 p.m. the business day before.",
    note: "The October 2026 menu lists Oct 12 as CLOSED.",
    countyContentId: "ec7580dc-0c71-4607-9b43-9fc55b4c658e",
    sources: [CSSC, COUNTY],
  },
  {
    id: "sr-bishop-broderick",
    name: "Bishop Broderick Apartments",
    address: "50 Prescott St",
    city: "Albany",
    zip: "12205",
    phone: "518-459-2857 ext. 303",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "Colonie Senior Service Centers’ October 2026 newsletter lists its Senior Dining lunch at the Beltrone Living Center; ask whether meals are served here now.",
    countyContentId: "a46e315c-5559-4825-98fd-02f4dc130735",
    sources: [COUNTY, CSSC],
  },
  {
    id: "sr-islamic-center",
    name: "The Islamic Center of the Capital District",
    address: "21 Lansing Rd N",
    city: "Schenectady",
    zip: "12304",
    sortZip: "12205",
    phone: "518-370-2664",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "In the Town of Colonie (the county lists it under Colonie) with a Schenectady mailing address. The Food Connect map lists 518-256-8350.",
    countyContentId: "29147c45-6639-4e9f-ba9a-79116bbdc591",
    sources: [COUNTY],
  },
  // ——— Glenmont ———
  {
    id: "sr-van-allen",
    name: "Van Allen Senior Apartments",
    address: "790 US-9W",
    city: "Glenmont",
    zip: "12077",
    phone: "518-756-8593",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "263ccf94-8961-4a36-b9a8-2361909d7f80",
    sources: [COUNTY],
  },
  // ——— Green Island ———
  {
    id: "sr-green-island",
    name: "Green Island Community Center",
    address: "5 George St",
    city: "Green Island",
    zip: "12183",
    phone: "518-272-7262",
    phoneFrom: "county page (Call to RSVP & for Menu)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "a3013de1-a9d7-4e25-ad65-d87d981c0ff4",
    sources: [COUNTY],
  },
  // ——— Guilderland ———
  {
    id: "sr-guilderland",
    name: "Guilderland Senior Center",
    address: "141 Bavarian Way",
    city: "Altamont",
    zip: "12009",
    phone: "518-280-7607",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "Lunch: Tuesday at Noon",
    slots: [{ weekdays: [2], start: "12:00", end: null }],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "a624a77e-23f7-43ae-84e8-94c6e5035b10",
    sources: [COUNTY],
  },
  // ——— Latham ———
  {
    id: "sr-king-thiel",
    name: "King Thiel Senior Community",
    address: "17 Elks Ln",
    city: "Latham",
    zip: "12110",
    phone: "518-429-6292, press 2",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "49476413-b758-492c-94af-8a77ad6fafb5",
    sources: [COUNTY],
  },
  // ——— New Scotland / Voorheesville ———
  {
    id: "sr-st-matthews",
    name: "St. Matthew’s Church",
    address: "25 Mountainview St",
    city: "Voorheesville",
    zip: "12186",
    phone: "518-439-9038",
    phoneFrom: "county page and LifePath",
    hoursRaw: "Lunch • Thursday • 11:30 a.m.",
    slots: [{ weekdays: [4], start: "11:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "",
    countyContentId: "b300a8d9-fa6d-40c8-bccf-62f9b9ee7b81",
    sources: [LIFEPATH, COUNTY],
  },
  {
    id: "sr-wyman-osterhout",
    name: "Wyman Osterhout Community Center",
    address: "7 The Old Rd",
    city: "Voorheesville",
    zip: "12186",
    phone: "518-439-9038",
    phoneFrom: "county page and LifePath",
    hoursRaw: "Lunch • Wednesday • 11:30 a.m.",
    slots: [{ weekdays: [3], start: "11:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "",
    countyContentId: "9423bf34-5df6-45bf-b1bc-68c9e77e6b03",
    sources: [LIFEPATH, COUNTY],
  },
  // ——— Ravena ———
  {
    id: "sr-civil",
    name: "Civil Senior Apartments",
    address: "8 Civil Ave",
    city: "Ravena",
    zip: "12143",
    phone: "518-447-7198",
    phoneFrom: "Albany County Department for Aging main line (the site’s county panel lists no phone)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "The county panel gives no phone, so this is the Department for Aging’s number. The Food Connect map lists (518) 756-8593 and spells the street “Civill”.",
    countyContentId: "879d0df9-6391-4d0b-b4a6-7b69322dce21",
    sources: [COUNTY],
  },
  {
    id: "sr-ravena",
    name: "Senior Projects of Ravena",
    address: "9 Bruno Blvd",
    city: "Ravena",
    zip: "12143",
    phone: "518-756-8593",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "",
    slots: [],
    reserve: COUNTY_RESERVE,
    note: "",
    countyContentId: "09ad495d-7775-48d0-8426-4107011a7a52",
    sources: [COUNTY],
  },
  // ——— Watervliet ———
  {
    id: "sr-sheehy",
    name: "Sheehy Manor",
    address: "8 Carondelet Dr",
    city: "Watervliet",
    zip: "12189",
    phone: "518-459-2857 ext. 303",
    phoneFrom: "county page (Call to RSVP)",
    hoursRaw: "Lunch: Thursday at Noon",
    slots: [{ weekdays: [4], start: "12:00", end: null }],
    reserve: COUNTY_RESERVE,
    note: "Colonie Senior Service Centers’ October 2026 newsletter lists its Senior Dining lunch at the Beltrone Living Center; call to confirm Thursday lunch is still served here.",
    countyContentId: "46f02f8c-fd67-44c8-b91f-2ae25eb39350",
    sources: [COUNTY, CSSC],
  },
  {
    id: "sr-watervliet",
    name: "Watervliet Senior Citizen Center",
    address: "1501 Broadway",
    city: "Watervliet",
    zip: "12189",
    phone: "518-465-3322 x 400",
    phoneFrom: "LifePath",
    hoursRaw: "Lunch • Monday – Friday • 12:00 p.m.",
    slots: [{ weekdays: [1, 2, 3, 4, 5], start: "12:00", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "The county page lists 518-273-4422 to RSVP.",
    countyContentId: "0e72235c-102e-4d4c-84e3-75b148f1463b",
    sources: [LIFEPATH, COUNTY],
  },
  // ——— Westerlo ———
  {
    id: "sr-westerlo",
    name: "Westerlo Town Hall",
    address: "933 County Route 401",
    city: "Westerlo",
    zip: "12193",
    phone: "518-797-3111 x 1014",
    phoneFrom: "LifePath",
    hoursRaw: "Lunch • Thursday • 11:30 a.m.",
    slots: [{ weekdays: [4], start: "11:30", end: null }],
    reserve: LIFEPATH_RESERVE,
    note: "The county page lists 518-439-9038 to RSVP.",
    countyContentId: "1be2c6e4-6b04-4a18-8869-e0ef4f7014a8",
    sources: [LIFEPATH, COUNTY],
  },
];

export const SENIOR_MEAL_SITES: SeniorMealSite[] = SITES.map((s) => ({ ...s, verifiedOn: VERIFIED[s.id]?.on }));
