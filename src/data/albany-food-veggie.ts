import type { FoodPlace, SlotRule } from "./albany-food";

/**
 * Capital Roots Veggie Mobile® and Veggie Mobile® Sprout stops in Albany County.
 *
 * Source: Capital Roots' own "2026 Weekly Schedule — Effective June 15, 2026" PDF, linked as
 * "Download The Schedule" from capitalroots.org/veggie-mobile (PDF uploaded 2026-08-20, read by
 * hand 2026-10-09; the PDF is a Canva image, so scripts/verify-food-sources.ts checks that the
 * page still links this exact file and that its bytes have not changed).
 *
 * Why this file exists: the Food Connect map's two Veggie Mobile layers disagreed with each other
 * and left some days blank (Drake/Idlewild Tue vs the schedule's Wed; Eugene Hanratta Thu vs Fri;
 * Watervliet library and USCRI with no day). Day, time, stop name and street address below are
 * copied from the Capital Roots PDF. The PDF prints no ZIPs, so each ZIP is the one the Food Connect
 * map gives for the same street address (map entity id in src/data/verified.ts).
 * Only stops in Albany County are listed. Troy, Rensselaer, Schenectady and Waterford stops are not.
 *
 * The Veggie Mobile is a low-cost market, not free food.
 */
export const VEGGIE_SCHEDULE_URL =
  "https://www.capitalroots.org/wp-content/uploads/2026/08/Veggie-Mobile-Schedule-2026-3.pdf";
export const VEGGIE_PAGE_URL = "https://www.capitalroots.org/veggie-mobile/";
const SOURCE = "Capital Roots — Veggie Mobile® 2026 weekly schedule (effective June 15, 2026)";
const EFFECTIVE = "2026-06-15";
const PHONE = "518-274-8685";
const PAY =
  "Low-cost produce market, not free. Takes EBT/SNAP, FMNP checks, Double Up Food Bucks, FreshConnect checks, cash, credit and debit. Capital Roots says to call 518-274-8685 or email at least one day ahead to place an order.";
const SPROUT =
  " This is a Sprout stop (the smaller van). Capital Roots says the Sprout serves senior and low-income housing; if you don’t live there, call first and ask if you can shop.";

function stop(
  id: string,
  name: string,
  address: string,
  city: string,
  zip: string,
  hoursRaw: string,
  slot: SlotRule,
  sprout = false,
): FoodPlace {
  return {
    id,
    name: `Veggie Mobile${sprout ? " Sprout" : ""} — ${name}`,
    kind: "produce",
    address,
    city,
    zip,
    phone: PHONE,
    hoursRaw,
    note: PAY + (sprout ? SPROUT : ""),
    sourceName: SOURCE,
    sourceUrl: VEGGIE_SCHEDULE_URL,
    sourceUpdated: EFFECTIVE,
    slots: [slot],
  };
}

export const VEGGIE_MOBILE_STOPS: FoodPlace[] = [
  // Tuesday
  stop("vm-whitney-young", "Whitney Young", "920 Lark Dr", "Albany", "12207", "Tuesday 10:30 AM – 11:30 AM", { weekdays: [2], start: "10:30", end: "11:30" }),
  stop("vm-uscri", "USCRI", "155 Washington Ave", "Albany", "12210", "Tuesday 11:45 AM – 12:30 PM", { weekdays: [2], start: "11:45", end: "12:30" }),
  // Wednesday
  stop("vm-cdpc", "Capital District Psychiatric Center", "75 New Scotland Ave", "Albany", "12208", "Wednesday 10:30 AM – 11:15 AM", { weekdays: [3], start: "10:30", end: "11:15" }),
  stop("vm-st-sophia", "St. Sophia", "440 Whitehall Rd", "Albany", "12208", "Wednesday 11:30 AM – 12:30 PM", { weekdays: [3], start: "11:30", end: "12:30" }),
  stop("vm-westview", "Westview Homes", "680 Central Ave", "Albany", "12206", "Wednesday 11:30 AM – 12:30 PM", { weekdays: [3], start: "11:30", end: "12:30" }, true),
  stop("vm-thurlow", "Thurlow Terrace", "2 Thurlow Terrace", "Albany", "12203", "Wednesday 12:45 PM – 1:45 PM", { weekdays: [3], start: "12:45", end: "13:45" }, true),
  stop("vm-cohoes-senior", "Cohoes Senior Center", "10 Cayuga Plaza", "Cohoes", "12047", "Wednesday 2:00 PM – 3:00 PM", { weekdays: [3], start: "14:00", end: "15:00" }),
  stop("vm-drake-idlewild", "Drake / Idlewild", "112 2nd St", "Albany", "12210", "Wednesday 2:00 PM – 2:30 PM", { weekdays: [3], start: "14:00", end: "14:30" }, true),
  // Thursday
  stop("vm-watervliet-library", "Watervliet Public Library", "1501 Broadway", "Watervliet", "12189", "Thursday 12:30 PM – 1:30 PM", { weekdays: [4], start: "12:30", end: "13:30" }, true),
  stop("vm-capital-green", "Capital Green Apartments", "400 Central Ave", "Albany", "12206", "Thursday 2:00 PM – 2:45 PM", { weekdays: [4], start: "14:00", end: "14:45" }),
  stop("vm-steamboat", "Steamboat Square Apartments", "200 Green St", "Albany", "12202", "Thursday 3:00 PM – 3:45 PM", { weekdays: [4], start: "15:00", end: "15:45" }),
  // Friday
  stop("vm-south-mall", "South Mall Towers", "101 S Pearl St", "Albany", "12207", "Friday 10:30 AM – 11:30 AM", { weekdays: [5], start: "10:30", end: "11:30" }),
  stop("vm-eugene-hanratta", "Eugene Hanratta Senior Housing", "500 16th St", "Watervliet", "12189", "Friday 12:30 PM – 1:15 PM", { weekdays: [5], start: "12:30", end: "13:15" }, true),
  stop("vm-ogden-mills", "Ogden Mills Apartments", "1 Ogden Mills Plaza", "Cohoes", "12047", "Friday 2:30 PM – 3:30 PM", { weekdays: [5], start: "14:30", end: "15:30" }, true),
];
