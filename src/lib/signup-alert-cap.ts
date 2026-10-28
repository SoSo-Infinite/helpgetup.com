/**
 * Hourly and daily cap in front of the shared signup webhook.
 * The counter is one private Blob object, updated with compare-and-swap.
 * If the counter cannot be written, the alert is skipped.
 * The book stores a hash of the network address, never the address, a name, or an email.
 */
import { createHash, createHmac } from "node:crypto";
import { BlobPreconditionFailedError, get, put } from "@vercel/blob";

type Env = Record<string, string | undefined>;

export const ALERT_PER_IP_PER_HOUR = 3;
export const ALERT_PER_HOUR = 20;
export const ALERT_PER_DAY = 40;
export const ALERT_PATH = "alerts/signup.json";

export type AlertBook = {
  day: string;
  dayCount: number;
  hour: string;
  hourCount: number;
  ips: Record<string, number>;
};

export type Versioned<T> = { value: T; etag: string };

export interface CapStore {
  read<T>(path: string): Promise<Versioned<T> | null>;
  write(path: string, value: unknown, cond: { create: true } | { ifMatch: string }): Promise<void>;
}

export class Precondition extends Error {}

const IP_KEY_ENVS = ["TALK_ALERT_WEBHOOK_KEY", "TALK_REPORT_TOKEN", "BLOB_READ_WRITE_TOKEN"] as const;

/** Keyed hash when a secret is already configured. Otherwise a plain hash. No new env var. */
export function signupIpKey(ip: string, env: Record<string, string | undefined> = process.env): string {
  const material = `hgu-signup-ip:${ip}`;
  const secret = IP_KEY_ENVS.map((name) => env[name]?.trim()).find((value) => value);
  const digest = secret
    ? createHmac("sha256", secret).update(material).digest("hex")
    : createHash("sha256").update(material).digest("hex");
  return digest.slice(0, 24);
}

export function claimAlert(book: AlertBook | null, ipHash: string, at: Date): { ok: boolean; book: AlertBook } {
  const day = at.toISOString().slice(0, 10);
  const hour = at.toISOString().slice(0, 13);
  const sameDay = !!book && book.day === day && Number.isFinite(book.dayCount);
  const sameHour = sameDay && book.hour === hour && Number.isFinite(book.hourCount);
  const dayCount = sameDay ? book.dayCount : 0;
  const hourCount = sameHour ? book.hourCount : 0;
  const ips = sameHour && book.ips && typeof book.ips === "object" ? book.ips : {};
  const ipn = Number(ips[ipHash] || 0) || 0;
  if (dayCount >= ALERT_PER_DAY || hourCount >= ALERT_PER_HOUR || ipn >= ALERT_PER_IP_PER_HOUR) {
    return { ok: false, book: book && sameDay ? book : { day, dayCount, hour, hourCount, ips: {} } };
  }
  return {
    ok: true,
    book: { day, dayCount: dayCount + 1, hour, hourCount: hourCount + 1, ips: { ...ips, [ipHash]: ipn + 1 } },
  };
}

class AlertCapped extends Error {}

async function casUpdate<T>(store: CapStore, path: string, fn: (cur: T | null) => T | Error, tries = 4): Promise<T> {
  for (let i = 0; i < tries; i++) {
    const cur = await store.read<T>(path);
    const next = fn(cur?.value ?? null);
    if (next instanceof Error) throw next;
    try {
      await store.write(path, next, cur ? { ifMatch: cur.etag } : { create: true });
      return next;
    } catch (e) {
      if (!(e instanceof Precondition)) throw e;
    }
  }
  throw new Error("Busy. Try again.");
}

/** "ok" won a slot. "capped" is over the limit. "failed" means the counter write did not stick. */
export async function reserveSignupAlert(
  store: CapStore,
  ipHash: string,
  at: Date,
): Promise<"ok" | "capped" | "failed"> {
  const key = (ipHash || "unknown").slice(0, 64);
  try {
    const seen = await store.read<AlertBook>(ALERT_PATH);
    if (seen && !claimAlert(seen.value, key, at).ok) return "capped";
    await casUpdate<AlertBook>(store, ALERT_PATH, (cur) => {
      const r = claimAlert(cur, key, at);
      if (!r.ok) return new AlertCapped();
      return r.book;
    });
    return "ok";
  } catch (e) {
    if (e instanceof AlertCapped) return "capped";
    return "failed";
  }
}

export function memoryCapStore(): CapStore & { data: Map<string, Versioned<unknown>> } {
  const data = new Map<string, Versioned<unknown>>();
  let n = 0;
  return {
    data,
    async read<T>(path: string) {
      const v = data.get(path);
      return v ? { value: structuredClone(v.value) as T, etag: v.etag } : null;
    },
    async write(path, value, cond) {
      const cur = data.get(path);
      if ("create" in cond ? cur : !cur || cur.etag !== cond.ifMatch) throw new Precondition("precondition");
      data.set(path, { value: structuredClone(value), etag: String(++n) });
    },
  };
}

/** Private Blob counter. Reads that 404 return null; other read failures also return null so the write can fail closed. */
export function blobCapStore(env: Env, timeoutMs = 1000): CapStore {
  const token = env.BLOB_READ_WRITE_TOKEN?.trim() || undefined;
  return {
    async read<T>(path: string) {
      try {
        const r = await get(path, {
          access: "private",
          useCache: false,
          token,
          abortSignal: AbortSignal.timeout(timeoutMs),
        });
        if (!r || r.statusCode !== 200 || !r.stream) return null;
        return { value: JSON.parse(await new Response(r.stream).text()) as T, etag: r.blob.etag };
      } catch {
        return null;
      }
    },
    async write(path, value, cond) {
      try {
        await put(path, JSON.stringify(value), {
          access: "private",
          contentType: "application/json",
          token,
          addRandomSuffix: false,
          abortSignal: AbortSignal.timeout(timeoutMs),
          ...("create" in cond ? { allowOverwrite: false } : { allowOverwrite: true, ifMatch: cond.ifMatch }),
        });
      } catch (e) {
        if (e instanceof BlobPreconditionFailedError || /exist|precondition/i.test((e as Error).message || "")) {
          throw new Precondition((e as Error).message);
        }
        throw e;
      }
    },
  };
}
