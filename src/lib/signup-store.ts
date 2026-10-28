/**
 * Durable copy of a signup. One JSON object per person at an unguessable path.
 * Private first. If this store rejects private access, the same path is written public.
 * A missing token or a failed write is not an error for the visitor.
 *
 * Step notes live under events/ and store the event name only. They do not include
 * the name, email, or the signup file's id.
 *
 * Talk-button counts in /api/t are not contact info (no name, email, or transcript),
 * so they stay as log lines and counters. Rosa summaries already go to the talk webhook.
 */
import { put } from "@vercel/blob";
import { randomBytes } from "node:crypto";

type Env = Record<string, string | undefined>;

export type BlobAccess = "private" | "public";

export type SignupPut = (
  pathname: string,
  body: string,
  options: {
    access: BlobAccess;
    contentType: "application/json";
    token: string;
    addRandomSuffix: false;
  },
) => Promise<void>;

export type StoreSignupResult = "skipped" | "private" | "public" | "failed";

/** Step names written under events/. The file body is `{ event }` and nothing else. */
export const SIGNUP_EVENTS = ["signup_submitted", "signup_stored", "signup_alerted"] as const;
export type SignupEventName = (typeof SIGNUP_EVENTS)[number];

const EVENT_NAMES = new Set<string>(SIGNUP_EVENTS);

const TOKEN_OR_TRANSPORT =
  /valid token|token expired|unauthorized|oidc is enabled|aborted|not available|too many requests|fetch failed/;

/**
 * True when the store refused private access (public-only store, or private not allowed).
 * Token and network failures are not this case: retrying them as public would not help.
 */
export function privateAccessRejected(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (TOKEN_OR_TRANSPORT.test(msg)) return false;
  if (
    msg.includes("private") &&
    /not allowed|not supported|only (allows|supports)|public|invalid access|access level|store access|rejected|denied/.test(
      msg,
    )
  ) {
    return true;
  }
  return /only (allows|supports) ["']?public|must be ["']?public|access type ["']?private["']? is not/.test(msg);
}

function signupRandom(): string {
  return randomBytes(8).toString("hex");
}

type BlobDeps = {
  env?: Env;
  putBlob?: SignupPut;
};

/** Private first, then the same path as public if this store rejects private access. */
async function writeBlobJson(pathname: string, body: string, deps: BlobDeps): Promise<StoreSignupResult> {
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return "skipped";

  const putBlob = deps.putBlob ?? defaultPut;
  const base = {
    contentType: "application/json" as const,
    token,
    addRandomSuffix: false as const,
  };

  try {
    await putBlob(pathname, body, { ...base, access: "private" });
    return "private";
  } catch (err) {
    if (!privateAccessRejected(err)) return "failed";
  }

  try {
    await putBlob(pathname, body, { ...base, access: "public" });
    return "public";
  } catch {
    return "failed";
  }
}

async function defaultPut(
  pathname: string,
  body: string,
  options: Parameters<SignupPut>[2],
): Promise<void> {
  await put(pathname, body, {
    access: options.access,
    contentType: options.contentType,
    token: options.token,
    addRandomSuffix: false,
    allowOverwrite: false,
    cacheControlMaxAge: 60,
    abortSignal: AbortSignal.timeout(8000),
  });
}

export async function storeSignup(
  fields: { name: string; email: string },
  deps: {
    env?: Env;
    now?: () => number;
    random?: () => string;
    putBlob?: SignupPut;
  } = {},
): Promise<StoreSignupResult> {
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return "skipped";

  const now = (deps.now ?? Date.now)();
  const random = deps.random?.() || signupRandom();
  if (!/^[a-f0-9]{8,64}$/i.test(random)) return "failed";
  const pathname = `signups/${now}-${random}.json`;
  const body = JSON.stringify({
    name: fields.name,
    email: fields.email,
    at: new Date(now).toISOString(),
  });
  return writeBlobJson(pathname, body, deps);
}

/**
 * One step note. Path is events/YYYY-MM-DD/<id>-<event>.json.
 * The id is its own random value. The body is the event name only.
 */
export async function storeSignupEvent(
  event: SignupEventName,
  deps: {
    env?: Env;
    now?: () => number;
    random?: () => string;
    putBlob?: SignupPut;
  } = {},
): Promise<StoreSignupResult> {
  if (!EVENT_NAMES.has(event)) return "failed";
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return "skipped";

  const now = (deps.now ?? Date.now)();
  const random = deps.random?.() || signupRandom();
  if (!/^[a-f0-9]{8,64}$/i.test(random)) return "failed";
  const day = new Date(now).toISOString().slice(0, 10);
  const pathname = `events/${day}/${random}-${event}.json`;
  return writeBlobJson(pathname, JSON.stringify({ event }), deps);
}
