import { EVENTS, LENGTH_BUCKETS } from "@/lib/talk/events";
import { bump, dayKey, peek } from "@/lib/talk/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Minimal first-party talk button counts (same as albanyaiguy.com). No cookies, no IP or user agent
 * stored: each event is one JSON log line plus a per-day counter.
 */
const ALLOWED = new Set<string>(EVENTS);
const BUCKETS = new Set<string>(LENGTH_BUCKETS);

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 204 });
  }
  const ev = String(body.e ?? "");
  if (!ALLOWED.has(ev)) return new Response(null, { status: 204 });
  const b = BUCKETS.has(String(body.b)) ? String(body.b) : "";
  const path = String(body.p ?? "").slice(0, 64);
  const reason = String(body.r ?? "").slice(0, 32);
  console.log(JSON.stringify({ hgu: "evt", e: ev, b, p: path, r: reason }));
  await bump(`evt:${dayKey()}:${ev}${b ? `:${b}` : ""}`, 40 * 86400);
  return new Response(null, { status: 204 });
}

/** GET /api/t?days=7 with header x-report-token: counts (best-effort, regional). 404 without the token. */
export async function GET(req: Request) {
  const tok = process.env.TALK_REPORT_TOKEN;
  if (!tok || req.headers.get("x-report-token") !== tok) {
    return new Response("Not found", { status: 404 });
  }
  const days = Math.max(1, Math.min(31, Number(new URL(req.url).searchParams.get("days") || 7) || 7));
  const counts: Record<string, number> = {};
  for (let i = 0; i < days; i++) {
    const day = dayKey(new Date(Date.now() - i * 86400000));
    for (const e of EVENTS) {
      const keys = e === "session_length" ? LENGTH_BUCKETS.map((b) => `${e}:${b}`) : [e];
      for (const k of keys) {
        const n = await peek(`evt:${day}:${k}`);
        if (n) counts[k] = (counts[k] ?? 0) + n;
      }
    }
  }
  return Response.json({ days, counts }, { headers: { "cache-control": "no-store" } });
}
