/**
 * Weekly source check for the Albany County food list.
 *
 *   npx tsx scripts/verify-food-sources.ts [--file saved-map.html] [--out report.json] [--write]
 *
 * Reads the Food Connect map's own published data (the `resource-data` the map page
 * embeds), then compares every row in src/data that cites the map: hours text, phone
 * digits, address, ZIP. It also lists Albany County pantries, meals and fridges on the
 * map that this list does not carry yet.
 *
 * --write updates src/data/verified.ts: rows that still match get today's date.
 * Rows that drifted keep their old date and are listed, so a person fixes them by hand
 * from the source. Nothing here invents hours or addresses.
 * Exit code 1 when any row drifted or vanished from the map.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { FOOD_PLACES, type FoodPlace } from "../src/data/albany-food";
import { VERIFIED } from "../src/data/verified";

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
  if (!m) throw new Error("resource-data not found on the map page; the map changed shape");
  return JSON.parse(decodeEntities(m[1])) as Layer[];
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

  for (const place of FOOD_PLACES) {
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

  const report = {
    checkedAt: new Date().toISOString(),
    source: MAP_URL,
    rows: FOOD_PLACES.length,
    matched: rows.filter((r) => r.status === "match").length,
    drift,
    otherSource: rows.filter((r) => r.status === "other-source").length,
    details: rows.filter((r) => r.status !== "match"),
    notListed,
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
  process.exit(drift ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
