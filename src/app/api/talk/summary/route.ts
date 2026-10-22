import { handoffOrigin, preflight, withCors } from "@/lib/talk/handoff";
import { handleSummary } from "@/lib/talk/summary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Browser posts one summary when a Grok talk session ends; forwarded to the alerts webhook if configured. */
export async function POST(req: Request) {
  return withCors(await handleSummary(req), handoffOrigin(req));
}

export function OPTIONS(req: Request) {
  return preflight(req);
}
