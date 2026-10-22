/**
 * Live voice handoff from the Albany AI Guy button (albanyaiguy.com) to Rosa. Server-only.
 * The Albany AI Guy page calls this site's token, tool and summary routes cross-origin, so those
 * routes answer CORS only for origins listed in TALK_HANDOFF_ORIGINS (comma separated, exact
 * origins; one "*" may stand for a single host label, for Vercel preview hosts). Nothing is
 * accepted cross-origin when the env var is unset.
 */
type Env = Record<string, string | undefined>;

export const HANDOFF_FROM = "albanyaiguy" as const;
export const MIN_HANDOFF_MS = 30 * 1000;
const MAX_CONTEXT = 200;

function originPatterns(env: Env): string[] {
  return (env.TALK_HANDOFF_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase().replace(/\/+$/, ""))
    .filter((s) => /^https:\/\/[a-z0-9.*-]+$/.test(s));
}

function matches(pattern: string, origin: string): boolean {
  if (!pattern.includes("*")) return pattern === origin;
  if (pattern.split("*").length !== 2) return false;
  const [a, b] = pattern.split("*");
  if (!origin.startsWith(a) || !origin.endsWith(b)) return false;
  const middle = origin.slice(a.length, origin.length - b.length);
  return /^[a-z0-9-]{1,63}$/.test(middle);
}

/** The request's Origin if it is an allowed handoff origin, else null. */
export function handoffOrigin(req: Request, env: Env = process.env): string | null {
  const raw = req.headers.get("origin");
  if (!raw) return null;
  let origin: string;
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    origin = u.origin.toLowerCase();
  } catch {
    return null;
  }
  return originPatterns(env).some((p) => matches(p, origin)) ? origin : null;
}

export function corsHeaders(origin: string): Record<string, string> {
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": "POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "600",
    vary: "Origin",
  };
}

/** Preflight: 204 with CORS for an allowed handoff origin, 403 otherwise. */
export function preflight(req: Request, env: Env = process.env): Response {
  const origin = handoffOrigin(req, env);
  if (!origin) return new Response(null, { status: 403, headers: { vary: "Origin" } });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/** Copy a response, adding CORS headers when the request came from an allowed handoff origin. */
export function withCors(res: Response, origin: string | null): Response {
  if (!origin) return res;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(corsHeaders(origin))) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

/** One plain line, no quotes or control characters, so it can sit inside instructions safely. */
export function cleanContext(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw
    .replace(/[\u0000-\u001f\u007f`"“”<>{}\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.length > MAX_CONTEXT ? `${t.slice(0, MAX_CONTEXT - 1)}…` : t;
}

export type Handoff = { from: typeof HANDOFF_FROM; context: string; remainingMs: number };

/** Parse `{ handoff: { from, context, remainingMs } }`. Null if absent or malformed. */
export function parseHandoff(body: unknown, maxMs: number): Handoff | null {
  const h = (body as { handoff?: unknown } | null)?.handoff as Record<string, unknown> | undefined;
  if (!h || typeof h !== "object" || h.from !== HANDOFF_FROM) return null;
  const rem = Number(h.remainingMs);
  const remainingMs = Number.isFinite(rem) ? Math.round(Math.min(maxMs, Math.max(0, rem))) : 0;
  return { from: HANDOFF_FROM, context: cleanContext(h.context), remainingMs };
}
