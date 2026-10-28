/**
 * Optional "Get updates and help resources" signup.
 * A private Blob file is the record. The visitor hears "you're on the list" only after
 * that private write succeeds, or, when this project has no Blob token, after the
 * alert webhook accepts the signup. Anything else is a 503 that points to hello@.
 * The server log and the step notes never include the name or email.
 * This route does not send email.
 */
import { after as scheduleAfter } from "next/server";
import { alertsConfigured } from "./talk/alert";
import { bump as realBump, clientIp } from "./talk/limits";
import { SIGNUP_COPY } from "./signup-copy";
import {
  blobCapStore,
  reserveSignupAlert,
  signupIpKey,
  type CapStore,
} from "./signup-alert-cap";

/** Test doubles pass putBlob and no counter. That must not open the real Blob counter. */
const ALLOW_CAP: CapStore = {
  async read() {
    return null;
  },
  async write() {},
};
import {
  storeAlertFailure,
  storeSignup,
  storeSignupEvent,
  type SignupEventName,
  type SignupPut,
  type StoredJson,
} from "./signup-store";

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
  /** Runs after the response. Tests pass their own. Production uses Next.js `after`. */
  after?: (fn: () => Promise<void>) => void;
  /** Alert counter. Tests inject one. Production uses the private Blob counter. */
  capStore?: CapStore;
};

const MAX_BODY = 8 * 1024;
const PER_IP = 8;
const WINDOW_S = 60 * 60;
/** One private save, or the no-Blob alert attempts, stays inside this budget. */
const SAVE_TIMEOUT_MS = 8000;
const ALERT_BUDGET_MS = 8000;
const ALERT_ATTEMPT_MS = 4000;
/** A real elapsed time under this is an instant fill and goes to spam/. */
export const MIN_FILL_MS = 1500;
const MAX_FILL_MS = 30 * 60 * 1000;

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

/** A filled honeypot is spam. Missing or blank is a real signup. */
export function isHoneypot(company: unknown): boolean {
  return typeof company === "string" && company.trim().length > 0;
}

/**
 * True only for a short, finite elapsed time from performance.now().
 * Missing, non-numeric, negative, or huge values (including a clock timestamp) are real signups.
 */
export function fastFill(elapsed: unknown, minMs = MIN_FILL_MS): boolean {
  const n =
    typeof elapsed === "number"
      ? elapsed
      : typeof elapsed === "string" && elapsed.trim() !== "" && Number.isFinite(Number(elapsed))
        ? Number(elapsed)
        : null;
  if (n === null || !Number.isFinite(n)) return false;
  if (n < 0 || n > MAX_FILL_MS) return false;
  return n < minMs;
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

function successMain(): string {
  return `<h1 style="font-size:1.6rem">You’re signed up</h1>
<p><strong>${escapeHtml(SIGNUP_COPY.okLead)}</strong></p>
<p>${escapeHtml(SIGNUP_COPY.okNext)}</p>
<p>${escapeHtml(SIGNUP_COPY.okFoodBefore)}<a href="/albany-food-list">${escapeHtml(SIGNUP_COPY.okFoodLabel)}</a>${escapeHtml(SIGNUP_COPY.okFoodAfter)}</p>`;
}

function reply(req: Request, contentType: string, status: number, message: string, ok: boolean): Response {
  if (wantsJson(req, contentType)) {
    return Response.json(
      ok ? { ok: true } : { ok: false, error: message },
      { status, headers: { "cache-control": "no-store" } },
    );
  }
  const title = ok ? "You’re signed up" : "Signup";
  const main = ok
    ? successMain()
    : `<h1 style="font-size:1.6rem">${title}</h1>
<p>${escapeHtml(message)}</p>`;
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} — HelpGetUp</title>
</head>
<body style="font-family:Segoe UI,system-ui,sans-serif;color:#0b1f3a;line-height:1.5;margin:2rem auto;max-width:36rem;padding:0 1.25rem">
<main>
${main}
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
 * Tell the existing alert webhook, if it is configured.
 * The summary names the private file when we have one. It has no `lead` field.
 */
export async function notifySignup(
  name: string,
  email: string,
  env: Env,
  fetchImpl: typeof fetch,
  opts: { path?: string; timeoutMs?: number } = {},
): Promise<"skipped" | "sent" | "failed"> {
  if (!alertsConfigured(env)) return "skipped";
  const lines = ["Updates signup", `Name: ${name}`, `Email: ${email}`];
  if (opts.path) lines.push(`File: ${opts.path}`);
  try {
    const res = await fetchImpl(String(env.TALK_ALERT_WEBHOOK_URL).trim(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(env.TALK_ALERT_WEBHOOK_KEY).trim()}`,
      },
      body: JSON.stringify({
        source: "helpgetup.com updates",
        summary: lines.join("\n"),
      }),
      signal: AbortSignal.timeout(opts.timeoutMs ?? ALERT_ATTEMPT_MS),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}

/** One try, then one retry, inside a single budget. */
export async function notifySignupRetry(
  name: string,
  email: string,
  env: Env,
  fetchImpl: typeof fetch,
  opts: { path?: string; budgetMs?: number } = {},
): Promise<"skipped" | "sent" | "failed"> {
  const budget = opts.budgetMs ?? ALERT_BUDGET_MS;
  const started = Date.now();
  let last: "skipped" | "sent" | "failed" = "failed";
  for (let attempt = 0; attempt < 2; attempt++) {
    const left = budget - (Date.now() - started);
    if (left < 200) break;
    last = await notifySignup(name, email, env, fetchImpl, {
      path: opts.path,
      timeoutMs: Math.min(ALERT_ATTEMPT_MS, left),
    });
    if (last === "sent" || last === "skipped") return last;
  }
  return last;
}

export async function handleSignup(req: Request, deps: SignupDeps = {}): Promise<Response> {
  const env = deps.env ?? process.env;
  const log = deps.log ?? ((line: string) => console.log(line));
  const bump = deps.bump ?? realBump;
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  const fetchImpl = deps.fetchImpl ?? fetch;
  const later =
    deps.after ??
    ((fn: () => Promise<void>) => {
      scheduleAfter(fn);
    });

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

  let fields: { name?: unknown; email?: unknown; company?: unknown; elapsed?: unknown };
  try {
    if (contentType.includes("application/json")) {
      const body = JSON.parse(raw) as { name?: unknown; email?: unknown; company?: unknown; elapsed?: unknown };
      fields = { name: body.name, email: body.email, company: body.company, elapsed: body.elapsed };
    } else {
      const params = new URLSearchParams(raw);
      fields = {
        name: params.get("name") ?? "",
        email: params.get("email") ?? "",
        company: params.get("company") ?? "",
        elapsed: params.get("elapsed") ?? undefined,
      };
    }
  } catch {
    return reply(req, contentType, 400, SIGNUP_COPY.invalid, false);
  }

  const parsed = parseSignup(fields);
  if (!parsed.ok) return reply(req, contentType, 400, SIGNUP_COPY.invalid, false);

  const ip = clientIp(req);
  const ipKey = signupIpKey(ip);
  let n = 0;
  try {
    n = await bump(`upd:${ipKey}`, WINDOW_S);
  } catch {
    n = 0;
  }
  if (n > PER_IP) return reply(req, contentType, 429, SIGNUP_COPY.limited, false);

  const spam = isHoneypot(fields.company) || fastFill(fields.elapsed);
  const blobDeps = {
    env,
    putBlob: deps.putBlob,
    now: deps.now,
    random: deps.random,
    timeoutMs: SAVE_TIMEOUT_MS,
  };
  let saved: StoredJson = { status: "failed", path: "" };
  try {
    saved = await storeSignup(
      { name: parsed.name, email: parsed.email },
      spam ? { ...blobDeps, folder: "spam" } : blobDeps,
    );
  } catch {
    saved = { status: "failed", path: "" };
  }

  if (spam) {
    log(JSON.stringify({ hgu: "signup", stored: saved.status === "private" ? "spam" : "failed" }));
    if (saved.status === "private") return reply(req, contentType, 200, SIGNUP_COPY.ok, true);
    return reply(req, contentType, 503, SIGNUP_COPY.unavailable, false);
  }

  if (saved.status === "private") {
    const path = saved.path;
    log(JSON.stringify({ hgu: "signup", stored: "private" }));
    later(() =>
      deliverAlert({
        env,
        fetchImpl,
        log,
        putBlob: deps.putBlob,
        now: deps.now,
        capStore: deps.capStore,
        ipKey,
        path,
        name: parsed.name,
        email: parsed.email,
      }),
    );
    return reply(req, contentType, 200, SIGNUP_COPY.ok, true);
  }

  if (saved.status === "skipped") {
    const alert = await notifySignupRetry(parsed.name, parsed.email, env, fetchImpl);
    log(JSON.stringify({ hgu: "signup", stored: "skipped", alert }));
    if (alert === "sent") return reply(req, contentType, 200, SIGNUP_COPY.ok, true);
    return reply(req, contentType, 503, SIGNUP_COPY.unavailable, false);
  }

  log(JSON.stringify({ hgu: "signup", stored: "failed" }));
  return reply(req, contentType, 503, SIGNUP_COPY.unavailable, false);
}

/**
 * Cap, then the webhook, after the visitor already has a response.
 * A counter that cannot be written skips the webhook.
 * One retry. If it still fails, log the private path and leave an alerts-failed/ marker.
 */
async function deliverAlert(opts: {
  env: Env;
  fetchImpl: typeof fetch;
  log: (line: string) => void;
  putBlob?: SignupPut;
  now?: () => number;
  capStore?: CapStore;
  ipKey: string;
  path: string;
  name: string;
  email: string;
}): Promise<void> {
  const note = { env: opts.env, putBlob: opts.putBlob, now: opts.now, timeoutMs: 4000 };
  const at = new Date(opts.now ? opts.now() : Date.now());
  try {
    const cap = opts.capStore ?? (opts.putBlob ? ALLOW_CAP : blobCapStore(opts.env));
    const reserved = await reserveSignupAlert(cap, opts.ipKey, at);
    if (reserved !== "ok") {
      opts.log(JSON.stringify({ hgu: "signup", alert: reserved === "capped" ? "capped" : "failed", path: opts.path }));
      if (reserved === "failed") await storeAlertFailure(opts.path, note);
      await safeStep("signup_submitted", note);
      await safeStep("signup_stored", note);
      return;
    }
    const alert = await notifySignupRetry(opts.name, opts.email, opts.env, opts.fetchImpl, { path: opts.path });
    if (alert === "sent") {
      opts.log(JSON.stringify({ hgu: "signup", alert: "sent", path: opts.path }));
      await safeStep("signup_submitted", note);
      await safeStep("signup_stored", note);
      await safeStep("signup_alerted", note);
      return;
    }
    opts.log(JSON.stringify({ hgu: "signup", alert: alert === "skipped" ? "skipped" : "failed", path: opts.path }));
    if (alert === "failed") await storeAlertFailure(opts.path, note);
    await safeStep("signup_submitted", note);
    await safeStep("signup_stored", note);
  } catch {
    opts.log(JSON.stringify({ hgu: "signup", alert: "failed", path: opts.path }));
    await storeAlertFailure(opts.path, note).catch(() => undefined);
  }
}

async function safeStep(
  event: SignupEventName,
  deps: { env?: Env; putBlob?: SignupPut; now?: () => number; timeoutMs?: number },
): Promise<void> {
  await storeSignupEvent(event, deps).catch(() => undefined);
}
