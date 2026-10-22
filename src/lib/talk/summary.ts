/** POST /api/talk/summary handler. No-op (204) unless the alerts webhook is configured. Server-only. */
import { alertsConfigured, postAlert, verifySession } from "./alert";
import { bump as realBump, peek as realPeek } from "./limits";

type Env = Record<string, string | undefined>;
const MAX_BODY = 24 * 1024;

export type SummaryDeps = {
  env?: Env;
  fetchImpl?: typeof fetch;
  peek?: (key: string) => Promise<number>;
  bump?: (key: string, ttlS: number) => Promise<number>;
  now?: () => number;
};

export async function handleSummary(
  req: Request,
  deps: SummaryDeps = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  if (!alertsConfigured(env)) return new Response(null, { status: 204 });
  const peek = deps.peek ?? realPeek;
  const bump = deps.bump ?? realBump;

  const raw = await req.text();
  if (raw.length > MAX_BODY) return new Response(null, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new Response(null, { status: 400 });
  }
  const id = verifySession(
    String(env.TALK_ALERT_WEBHOOK_KEY).trim(),
    body.sid,
    (deps.now ?? Date.now)(),
  );
  if (!id) return new Response(null, { status: 403 });
  // One summary per session.
  if ((await peek(`sum:${id}`)) > 0) return new Response(null, { status: 409 });
  await bump(`sum:${id}`, 30 * 60);
  const r = await postAlert(body, env, deps.fetchImpl ?? fetch);
  return new Response(null, { status: r === "sent" ? 202 : 502 });
}
