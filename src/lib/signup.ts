/**
 * Optional "Get updates and help resources" signup.
 * Each signup is stored in Vercel Blob (private, or public at the same unguessable path
 * if private access is rejected), using BLOB_READ_WRITE_TOKEN. The server log line and
 * the existing talk-alert webhook stay. A missing token or a failed write still succeeds
 * for the visitor. Nothing is sold.
 */
import { alertsConfigured } from "./talk/alert";
import { bump as realBump, clientIp } from "./talk/limits";
import { SIGNUP_COPY } from "./signup-copy";
import { storeSignup, type SignupPut } from "./signup-store";

export { SIGNUP_COPY };

type Env = Record<string, string | undefined>;

export type SignupDeps = {
  env?: Env;
  fetchImpl?: typeof fetch;
  bump?: (key: string, ttlS: number) => Promise<number>;
  log?: (line: string) => void;
  putBlob?: SignupPut;
  now?: () => number;
  random?: () => string;
};

const MAX_BODY = 8 * 1024;
const PER_IP = 8;
const WINDOW_S = 60 * 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SignupFields = { ok: true; name: string; email: string } | { ok: false };

/** Name and email only. Rejects empty, oversized, or address-shaped junk. */
export function parseSignup(input: { name?: unknown; email?: unknown }): SignupFields {
  if (typeof input.name !== "string" || typeof input.email !== "string") return { ok: false };
  const name = input.name.normalize("NFKC").replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const email = input.email.normalize("NFKC").trim().toLowerCase();
  if (name.length < 1 || name.length > 80) return { ok: false };
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false };
  if (/[<>]/.test(name) || /[<>\s]/.test(email)) return { ok: false };
  if (!/\p{L}/u.test(name)) return { ok: false };
  return { ok: true, name, email };
}

/** A present Origin must name this host. Same rule as the talk token route. */
export function sameSite(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  let host: string;
  try {
    host = new URL(origin).host.toLowerCase();
  } catch {
    return false;
  }
  const own = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "")
    .split(",")[0]
    ?.trim()
    .toLowerCase();
  return Boolean(own) && host === own;
}

function wantsJson(req: Request, contentType: string): boolean {
  if (contentType.includes("application/json")) return true;
  return (req.headers.get("accept") || "").includes("application/json");
}

function reply(req: Request, contentType: string, status: number, message: string, ok: boolean): Response {
  if (wantsJson(req, contentType)) {
    return Response.json(
      ok ? { ok: true } : { ok: false, error: message },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
  const title = ok ? "You’re signed up" : "Signup";
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — HelpGetUp</title>
</head>
<body style="font-family:Segoe UI,system-ui,sans-serif;color:#0b1f3a;line-height:1.5;margin:2rem auto;max-width:36rem;padding:0 1.25rem">
<main>
<h1 style="font-size:1.6rem">${title}</h1>
<p>${escapeHtml(message)}</p>
<p><a href="/#updates">Back to HelpGetUp</a></p>
<p>Questions: <a href="mailto:hello@helpgetup.com">hello@helpgetup.com</a>. <a href="/privacy">Privacy</a>.</p>
</main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" },
  });
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;",
  );
}

/**
 * Tell the existing alert webhook, if it is configured. Failure does not undo the log line.
 * Payload is not a talk summary and has no `lead` field.
 */
export async function notifySignup(
  name: string,
  email: string,
  env: Env,
  fetchImpl: typeof fetch,
): Promise<"skipped" | "sent" | "failed"> {
  if (!alertsConfigured(env)) return "skipped";
  try {
    const res = await fetchImpl(String(env.TALK_ALERT_WEBHOOK_URL).trim(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(env.TALK_ALERT_WEBHOOK_KEY).trim()}`,
      },
      body: JSON.stringify({
        source: "helpgetup.com updates",
        summary: `Updates signup\nName: ${name}\nEmail: ${email}`,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

export async function handleSignup(req: Request, deps: SignupDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((line: string) => console.log(line));
  const bump = deps.bump ?? realBump;
  const contentType = (req.headers.get("content-type") || "").toLowerCase();

  if (!sameSite(req)) return reply(req, contentType, 403, SIGNUP_COPY.origin, false);

  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > MAX_BODY) {
    return reply(req, contentType, 413, SIGNUP_COPY.large, false);
  }

  let raw = "";
  try {
    raw = await req.text();
  } catch {
    return reply(req, contentType, 400, SIGNUP_COPY.invalid, false);
  }
  if (raw.length > MAX_BODY) return reply(req, contentType, 413, SIGNUP_COPY.large, false);

  let fields: { name?: unknown; email?: unknown };
  try {
    if (contentType.includes("application/json")) {
      const body = JSON.parse(raw) as { name?: unknown; email?: unknown };
      fields = { name: body.name, email: body.email };
    } else {
      const params = new URLSearchParams(raw);
      fields = { name: params.get("name") ?? "", email: params.get("email") ?? "" };
    }
  } catch {
    return reply(req, contentType, 400, SIGNUP_COPY.invalid, false);
  }

  const parsed = parseSignup(fields);
  if (!parsed.ok) return reply(req, contentType, 400, SIGNUP_COPY.invalid, false);

  const ip = clientIp(req);
  const n = await bump(`upd:${ip}`, WINDOW_S);
  if (n > PER_IP) return reply(req, contentType, 429, SIGNUP_COPY.limited, false);

  log(JSON.stringify({ hgu: "signup", name: parsed.name, email: parsed.email }));
  try {
    await storeSignup(
      { name: parsed.name, email: parsed.email },
      { env, putBlob: deps.putBlob, now: deps.now, random: deps.random },
    );
  } catch {
    /* a failed store must not change the success response */
  }
  await notifySignup(parsed.name, parsed.email, env, deps.fetchImpl ?? fetch);
  return reply(req, contentType, 200, SIGNUP_COPY.ok, true);
}
