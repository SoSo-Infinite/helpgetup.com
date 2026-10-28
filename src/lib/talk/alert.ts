/**
 * HelpGetUp talk button alerts: after a session ends, POST a short summary (what the caller asked, what
 * the helper said) to Chad's webhook routine. A no-op unless TALK_ALERT_WEBHOOK_URL and
 * TALK_ALERT_WEBHOOK_KEY are both set (this project's own env vars, separate from albanyaiguy.com).
 * The talk button does not collect a name or email. Updates signups are a separate path. Long digit runs (SSN, card or phone numbers a caller might say)
 * are masked before anything leaves the server. Server-only.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { AGENT_NAME } from "./identity";

type Env = Record<string, string | undefined>;

export function alertsConfigured(env: Env = process.env): boolean {
  return Boolean(
    env.TALK_ALERT_WEBHOOK_URL?.trim() && env.TALK_ALERT_WEBHOOK_KEY?.trim(),
  );
}

/** A session id the summary route can trust: `<uuid>.<expiry-unix>.<hmac>`, signed with the webhook key. */
export function signSession(
  key: string,
  nowMs = Date.now(),
  ttlS = 15 * 60,
): string {
  const body = `${randomUUID()}.${Math.floor(nowMs / 1000) + ttlS}`;
  return `${body}.${mac(key, body)}`;
}

export function verifySession(
  key: string,
  sid: unknown,
  nowMs = Date.now(),
): string | null {
  if (typeof sid !== "string" || sid.length > 200) return null;
  const i = sid.lastIndexOf(".");
  if (i < 0) return null;
  const body = sid.slice(0, i);
  const got = Buffer.from(sid.slice(i + 1));
  const want = Buffer.from(mac(key, body));
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const exp = Number(body.split(".")[1]);
  if (!Number.isFinite(exp) || exp * 1000 < nowMs) return null;
  return body.split(".")[0] ?? null;
}

function mac(key: string, body: string): string {
  return createHmac("sha256", key).update(body).digest("base64url");
}

export type Turn = { role: "caller" | "agent"; text: string };
export type SummaryInput = {
  /** "albanyaiguy" when the caller was handed off live from the Albany AI Guy button. */
  handoff_from?: unknown;
  handoff_context?: unknown;
  turns?: unknown;
  seconds?: unknown;
  end?: unknown;
};

const MAX_TURNS = 16;
const MAX_TEXT = 300;

function clip(s: unknown, n = MAX_TEXT): string {
  if (typeof s !== "string") return "";
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/** Mask anything that looks like an SSN, card or personal number: 7+ digits, spaces or dashes allowed. */
export function maskDigits(s: string): string {
  return s.replace(/\d(?:[\s-]?\d){6,}/g, "[number removed]");
}

export function cleanTurns(raw: unknown): Turn[] {
  if (!Array.isArray(raw)) return [];
  const out: Turn[] = [];
  for (const t of raw.slice(0, MAX_TURNS * 2)) {
    const role = (t as { role?: unknown })?.role;
    const text = maskDigits(clip((t as { text?: unknown })?.text));
    if ((role === "caller" || role === "agent") && text)
      out.push({ role, text });
  }
  return out.slice(0, MAX_TURNS);
}

/** Plain-text summary for the chat alert. */
export function buildSummary(input: SummaryInput): {
  text: string;
  turns: Turn[];
  seconds: number;
  end: string;
  handoffFrom: string | null;
} {
  const handoffFrom = input.handoff_from === "albanyaiguy" ? "albanyaiguy" : null;
  const turns = cleanTurns(input.turns);
  const seconds = Math.max(
    0,
    Math.min(3600, Math.round(Number(input.seconds) || 0)),
  );
  const end = clip(input.end, 20) || "ended";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const lines = [
    `HelpGetUp talk button conversation, ${m}m ${s}s (${end}).`,
    ...(handoffFrom
      ? [
          `Handed off live from the Albany AI Guy (albanyaiguy.com)${
            clip(input.handoff_context, 200) ? `: ${maskDigits(clip(input.handoff_context, 200))}` : "."
          }`,
        ]
      : []),
    ...turns.map(
      (t) =>
        `${t.role === "caller" ? "Caller asked" : `${AGENT_NAME} said`}: ${t.text}`,
    ),
  ];
  if (!turns.length) lines.push("No speech was transcribed.");
  return { text: lines.join("\n"), turns, seconds, end, handoffFrom };
}

/**
 * POST the summary to the webhook. Returns "skipped" when not configured (no network call at all).
 * `fetchImpl` is injectable for tests.
 */
export async function postAlert(
  input: SummaryInput,
  env: Env = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<"skipped" | "sent" | "failed"> {
  if (!alertsConfigured(env)) return "skipped";
  const summary = buildSummary(input);
  try {
    const res = await fetchImpl(String(env.TALK_ALERT_WEBHOOK_URL).trim(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(env.TALK_ALERT_WEBHOOK_KEY).trim()}`,
      },
      body: JSON.stringify({
        source: "helpgetup.com talk button",
        ...(summary.handoffFrom ? { handoff_from: "albanyaiguy.com talk button" } : {}),
        summary: summary.text,
        seconds: summary.seconds,
        end: summary.end,
        turns: summary.turns,
      }),
      signal: AbortSignal.timeout(8000),
    });
    return res.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
