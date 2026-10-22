import { FOOD_TOOL_NAMES, runFoodTool } from "@/lib/talk/food-tool";
import { handoffOrigin, preflight, withCors } from "@/lib/talk/handoff";
import { bump, clientIp, peek } from "@/lib/talk/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NAMES = new Set<string>(FOOD_TOOL_NAMES);
const MAX_BODY = 4 * 1024;
const PER_IP = 60;
const WINDOW_S = 600;

/**
 * Rosa's food lookups (find_food, senior_meals) for a live handoff on the Albany AI Guy button,
 * which can't bundle HelpGetUp's food data. Same pure functions the HelpGetUp button runs in the
 * browser; no model calls, nothing stored. Only allowed handoff origins (TALK_HANDOFF_ORIGINS).
 */
export async function POST(req: Request) {
  const origin = handoffOrigin(req);
  if (!origin) return Response.json({ ok: false, error: "origin" }, { status: 403 });
  const ip = clientIp(req);
  if ((await peek(`tool:${ip}`)) >= PER_IP) {
    return withCors(Response.json({ ok: false, error: "rate_limited" }, { status: 429 }), origin);
  }
  await bump(`tool:${ip}`, WINDOW_S);
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return withCors(Response.json({ ok: false, error: "too_large" }, { status: 413 }), origin);
  }
  let body: { name?: unknown; args?: unknown } = {};
  try {
    body = JSON.parse(raw) as typeof body;
  } catch {
    /* falls through to unknown tool */
  }
  const name = typeof body.name === "string" ? body.name : "";
  const args = typeof body.args === "string" ? body.args : "{}";
  const out = NAMES.has(name) ? runFoodTool(name, args) : { ok: false, error: "unknown tool" };
  return withCors(Response.json(out, { headers: { "cache-control": "no-store" } }), origin);
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
