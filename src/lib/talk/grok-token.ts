/**
 * POST /api/talk/token, Grok provider: mint a short-lived xAI realtime client secret.
 * XAI_API_KEY stays on the server; the browser only gets the ephemeral token plus the session plan.
 * Server-only. Dependencies are injectable so tests run without network or Vercel.
 */
import { alertsConfigured, signSession } from "./alert";
import {
  buildClientPlan,
  MAX_SESSION_MS,
  TOKEN_TTL_S,
  XAI_CLIENT_SECRETS_URL,
} from "./grok-config";
import { type Handoff, handoffOrigin, MIN_HANDOFF_MS, parseHandoff } from "./handoff";
import { clientIp, dayKey, bump as realBump, peek as realPeek } from "./limits";

type Env = Record<string, string | undefined>;

export type TokenDeps = {
  env?: Env;
  fetchImpl?: typeof fetch;
  peek?: (key: string) => Promise<number>;
  bump?: (key: string, ttlS: number) => Promise<number>;
  now?: () => number;
  log?: (msg: string) => void;
};

function deny(status: number, reason: string, message: string) {
  return Response.json(
    { ok: false, reason, message },
    { status, headers: { "cache-control": "no-store" } },
  );
}

/** A present Origin must name this host. Browsers always send Origin on a POST fetch. */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const own = (
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    ""
  )
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return Boolean(own) && host === own;
}

export async function grokToken(
  req: Request,
  deps: TokenDeps = {},
): Promise<Response> {
  const env = deps.env ?? process.env;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const peek = deps.peek ?? realPeek;
  const bump = deps.bump ?? realBump;
  const now = deps.now ?? Date.now;
  const log = deps.log ?? ((m: string) => console.warn(m));

  const key = env.XAI_API_KEY?.trim();
  if (!key || env.TALK_ENABLED === "0") {
    return deny(
      503,
      "off",
      "Live voice is off right now. Use the food list instead.",
    );
  }
  // Same-site button, or a live handoff from an allowed Albany AI Guy origin (TALK_HANDOFF_ORIGINS).
  const crossOrigin = sameOrigin(req) ? null : handoffOrigin(req, env);
  if (!sameOrigin(req) && !crossOrigin) {
    return deny(403, "origin", "Live voice only works from helpgetup.com.");
  }
  let handoff: Handoff | null = null;
  if (crossOrigin) {
    let body: unknown = null;
    try {
      body = await req.json();
    } catch {
      /* handled below */
    }
    handoff = parseHandoff(body, MAX_SESSION_MS);
    if (!handoff) return deny(400, "handoff", "Missing handoff details.");
    if (handoff.remainingMs < MIN_HANDOFF_MS) {
      return deny(409, "no_time", "There isn't enough time left for a handoff.");
    }
  }

  const perIp = Number(env.TALK_PER_IP_LIMIT || 4);
  const perIpWindow = Number(env.TALK_PER_IP_WINDOW_S || 600);
  const dailyCap = Number(env.TALK_DAILY_CAP || 60);
  const perMin = Number(env.TALK_GLOBAL_PER_MIN || 8);

  const ip = clientIp(req);
  const day = dayKey(new Date(now()));
  const minute = Math.floor(now() / 60000);
  if ((await peek(`day:${day}`)) >= dailyCap) {
    return deny(
      429,
      "daily_cap",
      "That's all the live conversations for today. Use the food list, or come back tomorrow.",
    );
  }
  if ((await peek(`ip:${ip}`)) >= perIp) {
    return deny(
      429,
      "rate_limited",
      "You've started a few conversations in a row. Give it a few minutes.",
    );
  }
  if ((await peek(`min:${minute}`)) >= perMin) {
    return deny(
      429,
      "busy",
      "All lines are busy. Try again in a minute, or use the food list.",
    );
  }

  let value: string | undefined;
  let expiresAt: number | undefined;
  try {
    const res = await fetchImpl(XAI_CLIENT_SECRETS_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ expires_after: { seconds: TOKEN_TTL_S } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Never log the key or the upstream body verbatim (it can echo team ids); status is enough.
      log(`talk token: xAI client_secrets HTTP ${res.status}`);
      return deny(
        503,
        res.status === 403 || res.status === 402
          ? "upstream_credits"
          : "upstream",
        "Live voice isn't available right now. Use the food list.",
      );
    }
    const data = (await res.json()) as {
      value?: unknown;
      expires_at?: unknown;
    };
    if (typeof data.value === "string" && data.value) value = data.value;
    if (typeof data.expires_at === "number") expiresAt = data.expires_at;
  } catch {
    log("talk token: xAI client_secrets request failed");
    return deny(
      503,
      "upstream",
      "Live voice isn't available right now. Use the food list.",
    );
  }
  if (!value || value === key) {
    return deny(
      503,
      "upstream",
      "Live voice isn't available right now. Use the food list.",
    );
  }

  await bump(`ip:${ip}`, perIpWindow);
  await bump(`day:${day}`, 26 * 3600);
  await bump(`min:${minute}`, 120);

  const alerts = alertsConfigured(env);
  const plan = buildClientPlan(env, handoff);
  return Response.json(
    {
      ok: true,
      provider: "grok",
      token: value,
      expiresAt: expiresAt ?? null,
      ...plan,
      alerts,
      sid: alerts
        ? signSession(String(env.TALK_ALERT_WEBHOOK_KEY).trim(), now())
        : null,
      maxMinutes: plan.limits.maxMs / 60000,
      handoff: Boolean(handoff),
    },
    { headers: { "cache-control": "no-store" } },
  );
}
