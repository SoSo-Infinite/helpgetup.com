/**
 * Durable copy of a signup. One JSON object per person at an unguessable path.
 * Private first. If this store rejects private access, the same path is written public.
 * A missing token or a failed write is not an error for the visitor.
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
