/**
 * Durable copy of a signup. One JSON object per person at an unguessable private path.
 * A private write that fails stays failed. Nothing is retried as a public file.
 *
 * Step notes live under events/ and store the event name only. They do not include
 * the name, email, or the signup file's id.
 *
 * Talk-button counts in /api/t are not contact info (no name, email, or transcript),
 * so they stay as log lines and counters. Rosa summaries already go to the talk webhook.
 */
if (!process.env.VERCEL_BLOB_RETRIES?.trim()) process.env.VERCEL_BLOB_RETRIES = "1";
import { put } from "@vercel/blob";
import { randomBytes } from "node:crypto";

type Env = Record<string, string | undefined>;

export type SignupPut = (
  pathname: string,
  body: string,
  options: {
    access: "private";
    contentType: "application/json";
    token: string;
    addRandomSuffix: false;
  },
) => Promise<void>;

export type StoreSignupResult = "skipped" | "private" | "failed";

export type StoredJson = { status: StoreSignupResult; path: string };

/** Step names written under events/. The file body is `{ event }` and nothing else. */
export const SIGNUP_EVENTS = ["signup_submitted", "signup_stored", "signup_alerted"] as const;
export type SignupEventName = (typeof SIGNUP_EVENTS)[number];

const EVENT_NAMES = new Set<string>(SIGNUP_EVENTS);

function signupRandom(): string {
  return randomBytes(8).toString("hex");
}

type BlobDeps = {
  env?: Env;
  putBlob?: SignupPut;
  timeoutMs?: number;
};

const failed: StoredJson = { status: "failed", path: "" };
const skipped: StoredJson = { status: "skipped", path: "" };

/** Private write only. A rejection, a timeout, or a missing file is a failure. */
async function writeBlobJson(pathname: string, body: string, deps: BlobDeps): Promise<StoredJson> {
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return skipped;

  const timeoutMs = deps.timeoutMs ?? 8000;
  const putBlob =
    deps.putBlob ??
    (async (path, payload, options) => {
      await put(path, payload, {
        access: "private",
        contentType: options.contentType,
        token: options.token,
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: 60,
        abortSignal: AbortSignal.timeout(timeoutMs),
      });
    });

  try {
    await putBlob(pathname, body, {
      access: "private",
      contentType: "application/json",
      token,
      addRandomSuffix: false,
    });
    return { status: "private", path: pathname };
  } catch {
    return failed;
  }
}

export async function storeSignup(
  fields: { name: string; email: string },
  deps: {
    env?: Env;
    now?: () => number;
    random?: () => string;
    putBlob?: SignupPut;
    timeoutMs?: number;
    /** Real signups go under signups/. A honeypot or an instant fill goes under spam/. */
    folder?: "signups" | "spam";
  } = {},
): Promise<StoredJson> {
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return skipped;

  const now = (deps.now ?? Date.now)();
  const random = deps.random?.() || signupRandom();
  if (!/^[a-f0-9]{8,64}$/i.test(random)) return failed;
  const folder = deps.folder === "spam" ? "spam" : "signups";
  const pathname = `${folder}/${now}-${random}.json`;
  const body = JSON.stringify({
    name: fields.name,
    email: fields.email,
    at: new Date(now).toISOString(),
  });
  return writeBlobJson(pathname, body, deps);
}

/** Durable pointer for a saved signup whose alert did not go out. The body is the file path only. */
export async function storeAlertFailure(
  signupPath: string,
  deps: {
    env?: Env;
    now?: () => number;
    random?: () => string;
    putBlob?: SignupPut;
    timeoutMs?: number;
  } = {},
): Promise<StoredJson> {
  if (!signupPath.startsWith("signups/")) return failed;
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return skipped;
  const random = deps.random?.() || signupRandom();
  if (!/^[a-f0-9]{8,64}$/i.test(random)) return failed;
  const pathname = `alerts-failed/${random}.json`;
  return writeBlobJson(pathname, JSON.stringify({ path: signupPath }), deps);
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
    timeoutMs?: number;
  } = {},
): Promise<StoredJson> {
  if (!EVENT_NAMES.has(event)) return failed;
  const token = (deps.env ?? process.env).BLOB_READ_WRITE_TOKEN?.trim();
  if (!token) return skipped;

  const now = (deps.now ?? Date.now)();
  const random = deps.random?.() || signupRandom();
  if (!/^[a-f0-9]{8,64}$/i.test(random)) return failed;
  const day = new Date(now).toISOString().slice(0, 10);
  const pathname = `events/${day}/${random}-${event}.json`;
  return writeBlobJson(pathname, JSON.stringify({ event }), deps);
}
