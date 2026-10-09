/**
 * Link check for every URL the food walk shows (official SNAP links + each stop's source).
 *   npx tsx scripts/check-links.ts
 * Prints status per unique URL. Exit 1 if any URL returns 4xx/5xx.
 * Some New York State sites drop TLS from cloud runners; those print as "unreachable here"
 * and do not fail the run (check them in a normal browser instead).
 */
import { FOOD_PLACES, OFFICIAL } from "../src/data/albany-food";

const urls = new Set<string>();
for (const v of Object.values(OFFICIAL)) if ("url" in v && v.url) urls.add(v.url);
for (const p of FOOD_PLACES) urls.add(p.sourceUrl);

async function main() {
  let bad = 0;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: AbortSignal.timeout(20000),
        headers: { "user-agent": "Mozilla/5.0 (helpgetup link check)" },
      });
      const ok = res.status < 400;
      if (!ok) bad++;
      console.log(`${ok ? "ok " : "BAD"} ${res.status} ${url}${res.url !== url ? ` -> ${res.url}` : ""}`);
    } catch (e) {
      console.log(`?   unreachable here (${(e as Error).cause ?? (e as Error).message}) ${url}`);
    }
  }
  process.exit(bad ? 1 : 0);
}

void main();
