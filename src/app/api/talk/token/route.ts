import { handoffOrigin, preflight, withCors } from "@/lib/talk/handoff";
import { grokToken } from "@/lib/talk/grok-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mints a short-lived xAI realtime client secret plus the session plan. 503 "off" until XAI_API_KEY is set. */
export async function POST(req: Request) {
  return withCors(await grokToken(req), handoffOrigin(req));
}

/** CORS preflight for a live handoff from the Albany AI Guy button (TALK_HANDOFF_ORIGINS only). */
export function OPTIONS(req: Request) {
  return preflight(req);
}
