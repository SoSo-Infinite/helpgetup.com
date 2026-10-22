import { grokToken } from "@/lib/talk/grok-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Mints a short-lived xAI realtime client secret plus the session plan. 503 "off" until XAI_API_KEY is set. */
export async function POST(req: Request) {
  return grokToken(req);
}
