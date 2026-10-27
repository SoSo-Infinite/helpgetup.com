/**
 * Weekly source check for the Albany County food list.
 *
 *   npx tsx scripts/verify-food-sources.ts [--file saved-map.html] [--out report.json] [--write]
 *                                          [--county-snapshot county-congregate.json] [--offline]
 *
 * Reads the Food Connect map's own published data (the `resource-data` the map page
 * embeds), then compares every row in src/data that cites the map: hours text, phone
 * digits, address, ZIP. It also lists Albany County pantries, meals and fridges on the
 * map that this list does not carry yet.
 *
 * --write updates src/data/verified.ts: rows that still match get today's date.
 * Rows that drifted keep their old date and are listed, so a person fixes them by hand
 * from the source. Nothing here invents hours or addresses.
 * Also checks (added 2026-10-09):
 * - Capital Roots Veggie Mobile rows (src/data/albany-food-veggie.ts): the Veggie Mobile page must
 *   still link the same schedule PDF, and the PDF's bytes must match the copy read by hand. The PDF
 *   is an image, so a changed hash means "re-read it by hand", not an automatic update. The map's
 *   Veggie Mobile layers are compared too and their disagreements listed (informational).
 * - Senior (60+) meal sites (src/data/albany-senior-meals.ts): LifePath's Community Dining page
 *   (day/time text and phone, parsed from its HTML), the Town of Berne seniors page, the Colonie
 *   Senior Service Centers newsletter (hash), and the Albany County congregate dining panels. The
 *   county page is drawn by JavaScript, so pass --county-snapshot (rendered by
 *   render-county-congregate.mjs); without it county-only sites are reported "not checked" and keep
 *   their old verified date. The map's "Older Adult Meal Sites" layer is listed for comparison.
 * Exit code 1 when any row drifted or vanished from its source.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { FOOD_PLACES, type FoodPlace } from "../src/data/albany-food";
import { VEGGIE_PAGE_URL, VEGGIE_SCHEDULE_URL } from "../src/data/albany-food-veggie";
import {
  SENIOR_BERNE_URL,
  SENIOR_CSSC_URL,
  SENIOR_LIFEPATH_URL,
  SENIOR_MEAL_SITES,
  type SeniorMealSite,
} from "../src/data/albany-senior-meals";
import { VERIFIED } from "../src/data/verified";

/** sha256 of the Capital Roots 2026 schedule PDF that was read by hand on 2026-10-09. */
const VEGGIE_PDF_SHA256 = "f3b43f910ce0681577baf56b89d0204179891153e0c18010531877d47a73388f";
/** sha256 of the CSSC October 2026 newsletter read by hand on 2026-10-09 (Beltrone lunch times). */
const CSSC_PDF_SHA256 = "791bf2b62320a4f1e863661436b337a9541812f73de61677a070b9e30049a1d8";
const UA = { headers: { "user-agent": "helpgetup-source-check/1.0" } };

const MAP_URL = "https://map.thefoodpantries.org/";
const args = process.argv.slice(2);
const arg = (k: string) => {
  const i = args.indexOf(k);
  return i >= 0 ? args[i + 1] : undefined;
};

type Props = {
  Name: string;
  Entity_Id: number;
  Address: string;
  City: string;
  Zip: string;
  Phone: string;
  Hours_of_Operation: string;
  Last_Updated: string;
  Counties?: string[];
};
type Layer = { name: string; category: string; features: { properties: Props }[] };

function decodeEntities(s: string): string {
  return s
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

async function loadLayers(): Promise<Layer[]> {
  const file = arg("--file");
  const html = file
    ? readFileSync(file, "utf8")
    : await fetch(MAP_URL, { headers: { "user-agent": "helpgetup-source-check/1.0" } }).then(
        (r) => {
          if (!r.ok) throw new Error(`map returned ${r.status}`);
          return r.text();
        },
      );
  const m = html.match(/resource-data="([\s\S]*?)"\s*\n\s*url=/);
  if (m) return JSON.parse(decodeEntities(m[1])) as Layer[];
  // Since Oct 2026 the map page no longer embeds the data. It loads the layers from
  // data-resource-data-url (/api/map-data, names and addresses only) and each place's
  // hours, phone and Last_Updated from /api/entities/{id} when it is opened.
  const u = html.match(/data-resource-data-url="([^"]+)"/);
  if (!u) throw new Error("resource-data not found on the map page; the map changed shape");
  const dataUrl = decodeEntities(u[1]);
  const r = await fetch(dataUrl, { headers: { ...UA.headers, accept: "application/json" } });
  if (!r.ok) throw new Error(`map data returned ${r.status}`);
  const layers = (await r.json()) as Layer[];
  const base = new URL(dataUrl);
  const ids = [
    ...new Set(
      layers.flatMap((l) =>
        l.features.filter((f) => (f.properties.Counties ?? []).includes("Albany")).map((f) => f.properties.Entity_Id),
      ),
    ),
  ];
  const detail = new Map<number, Partial<Props>>();
  const queue = [...ids];
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let id = queue.shift(); id !== undefined; id = queue.shift()) {
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const d = await fetch(new URL(`/api/entities/${id}`, base), {
              headers: { ...UA.headers, accept: "application/json" },
            });
            if (d.ok) {
              detail.set(id, (await d.json()) as Partial<Props>);
              break;
            }
          } catch {
            /* retry */
          }
        }
      }
    }),
  );
  for (const l of layers)
    for (const f of l.features) {
      const d = detail.get(f.properties.Entity_Id);
      f.properties = {
        Phone: "",
        Hours_of_Operation: "",
        Last_Updated: "",
        ...(f.properties as Partial<Props>),
        ...(d ?? {}),
      } as Props;
    }
  const missing = ids.filter((id) => !detail.has(id));
  if (missing.length) console.error(`map entity details missing for ${missing.length} Albany ids: ${missing.join(",")}`);
  return layers;
}

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .replace(/\bstreet\b/g, "st")
    .replace(/\bavenue\b/g, "ave")
    .replace(/\broad\b/g, "rd")
    .replace(/[^a-z0-9]/g, "");
/** All digits (extension included), minus a leading +1 country code. */
const digits = (s: string) =>
  (s || "").trim().replace(/^\+?1(?=[\s(.-]*\d{3}[\s).-]*\d{3}[\s.-]*\d{4})/, "").replace(/\D/g, "");
const isoFromMap = (d: string) => {
  const [mm, dd, yyyy] = d.split("-");
  return `${yyyy}-${mm}-${dd}`;
};

const KIND_LAYERS: Record<FoodPlace["kind"], string[]> = {
  pantry: ["Food Pantry", "Mobile Food Resources"],
  meal: ["Community Meal/Soup Kitchen"],
  produce: ["Mobile Food Resources", "Food Pantry"],
  fridge: ["Free Food Fridges"],
};
const WATCH_LAYERS = new Set([
  "Food Pantries within the Capital District",
  "Community Meal/Soup Kitchen",
  "Free Food Fridge",
  "Mobile Food Pantry",
]);

function similarity(a: string, b: string) {
  const x = norm(a);
  const y = norm(b);
  let n = 0;
  while (n < x.length && n < y.length && x[n] === y[n]) n++;
  return n;
}

async function main() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });
  const layers = await loadLayers();
  const albany: { layer: Layer; p: Props }[] = [];
  for (const layer of layers) {
    for (const f of layer.features) {
      if ((f.properties.Counties ?? []).includes("Albany")) albany.push({ layer, p: f.properties });
    }
  }
  const used = new Set<number>();
  const rows: Record<string, unknown>[] = [];
  const nextVerified: Record<string, { on: string; entityId?: number }> = { ...VERIFIED };
  let drift = 0;

  const veggie = await checkVeggie(layers);

  for (const place of FOOD_PLACES) {
    if (place.sourceUrl === VEGGIE_SCHEDULE_URL) {
      const v = veggie.rows[place.id];
      if (v.status === "match")
        nextVerified[place.id] = { on: today, ...(typeof v.entityId === "number" ? { entityId: v.entityId } : {}) };
      else if (v.status !== "not-checked") drift++;
      rows.push({ id: place.id, ...v });
      continue;
    }
    if (place.sourceUrl !== MAP_URL) {
      rows.push({ id: place.id, status: "other-source", source: place.sourceUrl });
      continue;
    }
    const known = VERIFIED[place.id]?.entityId;
    let cands = albany.filter((c) =>
      known ? c.p.Entity_Id === known : norm(c.p.Address).startsWith(norm(place.address)),
    );
    const sameKind = cands.filter((c) => KIND_LAYERS[place.kind].includes(c.layer.category));
    if (sameKind.length) cands = sameKind;
    cands.sort((a, b) => similarity(b.p.Name, place.name) - similarity(a.p.Name, place.name));
    const hit = cands[0];
    if (!hit) {
      drift++;
      rows.push({ id: place.id, status: "missing-from-map", name: place.name, address: place.address });
      continue;
    }
    used.add(hit.p.Entity_Id);
    const diffs: Record<string, [string, string]> = {};
    if (hit.p.Hours_of_Operation.trim() !== place.hoursRaw.trim())
      diffs.hours = [place.hoursRaw, hit.p.Hours_of_Operation];
    if (digits(hit.p.Phone) !== digits(place.phone)) diffs.phone = [place.phone, hit.p.Phone];
    if (hit.p.Zip !== place.zip) diffs.zip = [place.zip, hit.p.Zip];
    if (!norm(hit.p.Address).startsWith(norm(place.address))) diffs.address = [place.address, hit.p.Address];
    const mapUpdated = isoFromMap(hit.p.Last_Updated);
    if (mapUpdated !== place.sourceUpdated) diffs.sourceUpdated = [place.sourceUpdated, mapUpdated];
    const status = Object.keys(diffs).length ? "drift" : "match";
    if (status === "drift") drift++;
    else nextVerified[place.id] = { on: today, entityId: hit.p.Entity_Id };
    rows.push({ id: place.id, status, entityId: hit.p.Entity_Id, mapName: hit.p.Name, diffs });
  }

  const notListed = albany
    .filter((c) => WATCH_LAYERS.has(c.layer.name) && !used.has(c.p.Entity_Id))
    .map((c) => ({
      layer: c.layer.name,
      entityId: c.p.Entity_Id,
      name: c.p.Name,
      address: `${c.p.Address}, ${c.p.City} ${c.p.Zip}`,
      hours: c.p.Hours_of_Operation,
      updated: isoFromMap(c.p.Last_Updated),
    }));

  const seniors = await checkSeniors(layers);
  for (const r of seniors.rows) {
    if (r.status === "match") nextVerified[r.id] = { on: today };
    else if (r.status === "drift") drift++;
  }

  const report = {
    checkedAt: new Date().toISOString(),
    source: MAP_URL,
    rows: FOOD_PLACES.length,
    matched: rows.filter((r) => r.status === "match").length,
    drift,
    otherSource: rows.filter((r) => r.status === "other-source").length,
    details: rows.filter((r) => r.status !== "match"),
    notListed,
    veggie: { page: veggie.page, pdf: veggie.pdf, mapConflicts: veggie.mapConflicts },
    seniors: {
      sites: SENIOR_MEAL_SITES.length,
      matched: seniors.rows.filter((r) => r.status === "match").length,
      drift: seniors.rows.filter((r) => r.status === "drift").length,
      notChecked: seniors.rows.filter((r) => r.status === "not-checked").length,
      sources: seniors.sources,
      details: seniors.rows.filter((r) => r.status !== "match"),
      lifePathNotListed: seniors.lifePathNotListed,
      countyNotListed: seniors.countyNotListed,
      mapOlderAdultNotListed: seniors.mapNotListed,
    },
  };
  const out = arg("--out");
  if (out) writeFileSync(out, JSON.stringify(report, null, 2));

  if (args.includes("--write")) {
    const ids = Object.keys(nextVerified).sort();
    const body = ids
      .map((id) => {
        const v = nextVerified[id];
        return `  ${JSON.stringify(id)}: { on: ${JSON.stringify(v.on)}${v.entityId ? `, entityId: ${v.entityId}` : ""} },`;
      })
      .join("\n");
    writeFileSync(
      new URL("../src/data/verified.ts", import.meta.url),
      `/**\n * Written by scripts/verify-food-sources.ts --write. Do not hand-edit dates.\n * \`on\` is the last day HelpGetUp compared the row to its source and found it matching.\n * \`entityId\` is the Food Connect map's own id for the row.\n */\nexport const VERIFIED: Record<string, { on: string; entityId?: number }> = {\n${body}\n};\n`,
    );
  }

  console.log(
    `rows ${report.rows} · match ${report.matched} · drift ${drift} · other source ${report.otherSource} · on map but not listed ${notListed.length}`,
  );
  for (const r of report.details) console.log("  ", JSON.stringify(r));
  console.log(
    `veggie mobile: page ${veggie.page.status} · pdf ${veggie.pdf.status} · map conflicts ${veggie.mapConflicts.length}`,
  );
  console.log(
    `senior meal sites ${report.seniors.sites} · match ${report.seniors.matched} · drift ${report.seniors.drift} · not checked ${report.seniors.notChecked} · sources ${JSON.stringify(seniors.sources)}`,
  );
  for (const r of report.seniors.details) console.log("  ", JSON.stringify(r));
  process.exit(drift ? 1 : 0);
}

// ————————————————————————— Capital Roots Veggie Mobile —————————————————————————

const VEGGIE_LAYERS = ["Veggie Mobile®", "Veggie Mobile Sprout®"];
const DAY_WORDS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

async function fetchBytes(url: string): Promise<{ ok: boolean; status: number; bytes?: Buffer }> {
  try {
    const r = await fetch(url, UA);
    if (!r.ok) return { ok: false, status: r.status };
    return { ok: true, status: r.status, bytes: Buffer.from(await r.arrayBuffer()) };
  } catch {
    return { ok: false, status: 0 };
  }
}
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const textOf = (html: string) =>
  decodeEntities(
    html
      .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h\d)>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/&#8211;/g, "–")
    .replace(/&#8217;/g, "’")
    .replace(/&nbsp;|\u00a0/g, " ")
    .replace(/[ \t]+/g, " ");

async function checkVeggie(layers: Layer[]) {
  const offline = args.includes("--offline");
  const page = { status: "not-checked" as string, links: [] as string[] };
  const pdf = { status: "not-checked" as string, sha256: "" };
  if (!offline) {
    const p = await fetchBytes(VEGGIE_PAGE_URL);
    if (!p.ok) page.status = `http-${p.status}`;
    else {
      page.links = [...new Set(p.bytes!.toString("utf8").match(/https?:\/\/[^"' ]*Veggie-Mobile-Schedule[^"' ]*\.pdf/gi) ?? [])];
      page.status =
        page.links.length === 1 && page.links[0] === VEGGIE_SCHEDULE_URL
          ? "same-schedule-link"
          : page.links.includes(VEGGIE_SCHEDULE_URL)
            ? "extra-schedule-links"
            : "schedule-link-changed";
    }
    const f = await fetchBytes(VEGGIE_SCHEDULE_URL);
    if (!f.ok) pdf.status = `http-${f.status}`;
    else {
      pdf.sha256 = sha256(f.bytes!);
      pdf.status = pdf.sha256 === VEGGIE_PDF_SHA256 ? "unchanged" : "changed-reread-by-hand";
    }
  }
  const sourceOk = page.status === "same-schedule-link" && pdf.status === "unchanged";

  const mapRows = layers
    .filter((l) => VEGGIE_LAYERS.includes(l.name))
    .flatMap((l) => l.features.map((f) => ({ layer: l.name, p: f.properties })))
    .filter((c) => (c.p.Counties ?? []).includes("Albany"));
  const rows: Record<string, Record<string, unknown>> = {};
  const mapConflicts: Record<string, unknown>[] = [];
  for (const place of FOOD_PLACES.filter((p) => p.sourceUrl === VEGGIE_SCHEDULE_URL)) {
    const hit = mapRows.find((c) => norm(c.p.Address).startsWith(norm(place.address)) || norm(place.address).endsWith(norm(c.p.Address)));
    if (hit) {
      const mapHours = hit.p.Hours_of_Operation.toLowerCase();
      const ourDay = DAY_WORDS[place.slots[0].weekdays[0]];
      const mapDays = DAY_WORDS.filter((d) => mapHours.includes(d));
      if (!mapDays.includes(ourDay) || mapDays.length !== 1)
        mapConflicts.push({ id: place.id, schedule: place.hoursRaw, map: hit.p.Hours_of_Operation, layer: hit.layer, entityId: hit.p.Entity_Id });
    }
    rows[place.id] = {
      status: sourceOk ? "match" : offline ? "not-checked" : "source-not-confirmed",
      source: "capital-roots-schedule",
      entityId: hit?.p.Entity_Id,
      ...(sourceOk ? {} : { page: page.status, pdf: pdf.status }),
    };
  }
  return { page, pdf, rows, mapConflicts };
}

// ————————————————————————— Senior (60+) meal sites —————————————————————————

type LifePathBlock = { name: string; schedule: string; address: string; phone: string };

function parseLifePath(html: string): LifePathBlock[] {
  const start = html.indexOf("Locations");
  const end = html.indexOf("How to Enroll", start);
  const blocks = html.slice(start, end > 0 ? end : undefined).split(/<\/p>/i);
  const out: LifePathBlock[] = [];
  for (const b of blocks) {
    const lines = textOf(b)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const i = lines.findIndex((l) => /^(Lunch|Dinner)\s•/.test(l));
    if (i < 1 || lines.length < i + 3) continue;
    out.push({ name: lines[i - 1], schedule: lines[i], address: lines[i + 1], phone: lines[i + 2].split("•")[0].trim() });
  }
  return out;
}

const streetKey = (address: string) => {
  const m = address.match(/^(\d+)\s+([A-Za-z]+)/);
  return m ? `${m[1]} ${m[2].toLowerCase()}` : norm(address);
};

async function checkSeniors(layers: Layer[]) {
  const offline = args.includes("--offline");
  const sources: Record<string, string> = {};

  let lifePath: LifePathBlock[] | null = null;
  if (!offline) {
    const r = await fetchBytes(SENIOR_LIFEPATH_URL);
    if (r.ok) {
      lifePath = parseLifePath(r.bytes!.toString("utf8"));
      sources.lifePath = lifePath.length ? `ok (${lifePath.length} locations)` : "page-changed-shape";
      if (!lifePath.length) lifePath = null;
    } else sources.lifePath = `http-${r.status}`;
  } else sources.lifePath = "not-checked";

  let berneOk: boolean | null = null;
  if (!offline) {
    const r = await fetchBytes(SENIOR_BERNE_URL);
    if (r.ok) {
      const t = textOf(r.bytes!.toString("utf8")).replace(/\s+/g, " ");
      berneOk = /every Tuesday and Friday at 11:30 am/i.test(t) && t.includes("518-465-6465");
      sources.berne = berneOk ? "ok" : "changed";
    } else sources.berne = `http-${r.status}`;
  } else sources.berne = "not-checked";

  let csscOk: boolean | null = null;
  if (!offline) {
    const r = await fetchBytes(SENIOR_CSSC_URL);
    csscOk = r.ok && sha256(r.bytes!) === CSSC_PDF_SHA256;
    sources.cssc = r.ok ? (csscOk ? "unchanged" : "changed-reread-by-hand") : `http-${r.status}`;
  } else sources.cssc = "not-checked";

  const snapPath = arg("--county-snapshot");
  let county: { capturedAt: string; sites: Record<string, { name: string; text: string }> } | null = null;
  if (snapPath && existsSync(snapPath)) {
    county = JSON.parse(readFileSync(snapPath, "utf8"));
    sources.county = `snapshot ${county!.capturedAt} (${Object.keys(county!.sites).length} sites)`;
  } else sources.county = "not-checked (pass --county-snapshot; the county page needs a browser)";

  const rows: { id: string; status: "match" | "drift" | "not-checked"; [k: string]: unknown }[] = [];
  const usedLifePath = new Set<string>();
  for (const site of SENIOR_MEAL_SITES) {
    const diffs: Record<string, [string, string]> = {};
    const unchecked: string[] = [];
    const cites = (url: string) => site.sources.some((s) => s.url === url);

    if (cites(SENIOR_LIFEPATH_URL)) {
      if (!lifePath) unchecked.push("lifepath");
      else {
        const lp = lifePath.find((b) => streetKey(b.address) === streetKey(site.address)) ??
          lifePath.find((b) => site.name.toLowerCase().includes(b.name.toLowerCase().split(" ")[0]));
        if (!lp) diffs.lifePath = [site.hoursRaw, "(site no longer on LifePath page)"];
        else {
          usedLifePath.add(lp.name);
          if (lp.schedule !== site.hoursRaw) diffs.hours = [site.hoursRaw, lp.schedule];
          if (site.phoneFrom === "LifePath" && digits(lp.phone) !== digits(site.phone)) diffs.phone = [site.phone, lp.phone];
        }
      }
    }
    if (cites(SENIOR_BERNE_URL)) {
      if (berneOk === null) unchecked.push("berne");
      else if (!berneOk) diffs.berne = ["Tuesday and Friday at 11:30 am · 518-465-6465", "(text changed on the town page)"];
    }
    if (cites(SENIOR_CSSC_URL)) {
      if (csscOk === null) unchecked.push("cssc");
      else if (!csscOk) diffs.cssc = ["October 2026 newsletter", "(file changed or gone; re-read the current month)"];
    }
    if (site.countyContentId) {
      const c = county?.sites[site.countyContentId];
      if (!county) unchecked.push("county");
      else if (!c) diffs.county = [site.name, "(panel no longer on the county page)"];
      else {
        if (site.phoneFrom.startsWith("county") && !digits(c.text).includes(digits(site.phone).slice(0, 10)))
          diffs.phone = [site.phone, c.text.match(/Phone\s+([^\n]+)/)?.[1] ?? "(no phone)"];
        const countyHours = c.text.match(/Hours\s+([^\n]+)/)?.[1]?.trim() ?? "";
        if (!cites(SENIOR_LIFEPATH_URL) && !cites(SENIOR_CSSC_URL) && countyHours !== site.hoursRaw)
          diffs.hours = [site.hoursRaw, countyHours || "(no hours on county panel)"];
      }
    }
    const status = Object.keys(diffs).length ? "drift" : unchecked.length ? "not-checked" : "match";
    rows.push({ id: site.id, status, ...(Object.keys(diffs).length ? { diffs } : {}), ...(unchecked.length ? { unchecked } : {}) });
  }

  const lifePathNotListed = (lifePath ?? []).filter((b) => !usedLifePath.has(b.name)).map((b) => b);
  const ourIds = new Set(SENIOR_MEAL_SITES.map((s) => s.countyContentId));
  const countyNotListed = county
    ? Object.entries(county.sites).filter(([id]) => !ourIds.has(id)).map(([id, v]) => ({ id, name: v.name }))
    : [];
  // House number + ZIP: the map spells streets differently ("101 South Pearl Street" vs "101 S Pearl St").
  const mapKey = (address: string, zip: string) => `${address.match(/^\d+/)?.[0] ?? norm(address)}|${zip}`;
  const ourStreets = new Set(SENIOR_MEAL_SITES.map((s: SeniorMealSite) => mapKey(s.address, s.zip)));
  const mapNotListed = layers
    .filter((l) => l.name === "Older Adult Meal Sites")
    .flatMap((l) => l.features.map((f) => f.properties))
    .filter((p) => (p.Counties ?? []).includes("Albany") && !ourStreets.has(mapKey(p.Address, p.Zip)))
    .map((p) => ({ entityId: p.Entity_Id, name: p.Name, address: `${p.Address}, ${p.City} ${p.Zip}`, phone: p.Phone }));
  return { rows, sources, lifePathNotListed, countyNotListed, mapNotListed };
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
