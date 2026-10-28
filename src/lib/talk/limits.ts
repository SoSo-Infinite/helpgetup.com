import { getCache } from "@vercel/functions";

/**
 * Best-effort counters for the talk button (per-IP rate limit, daily cap).
 * Vercel Runtime Cache is regional and not atomic, so these are guardrails, not billing-grade.
 * The hard ceiling is the xAI team's prepaid credits; the 5-minute cap and idle hang-up live in the browser.
 */
const mem = new Map<string, { n: number; exp: number }>();

type Store = {
  get(key: string): Promise<number>;
  set(key: string, n: number, ttl: number): Promise<void>;
};

function memoryStore(): Store {
  return {
    async get(key) {
      const v = mem.get(key);
      if (!v || v.exp < Date.now()) return 0;
      return v.n;
    },
    async set(key, n, ttl) {
      mem.set(key, { n, exp: Date.now() + ttl * 1000 });
    },
  };
}

function store(): Store {
  if (!process.env.VERCEL) return memoryStore();
  try {
    const cache = getCache({ namespace: "hgu-talk" });
    return {
      async get(key) {
        const v = (await cache.get(key)) as number | undefined;
        return typeof v === "number" ? v : 0;
      },
      async set(key, n, ttl) {
        await cache.set(key, n, { ttl, name: "talk-limit" });
      },
    };
  } catch {
    return memoryStore();
  }
}

/** A hung counter must not hold a signup or a talk token open. */
export const BUMP_TIMEOUT_MS = 2_000;

export function withTimeout<T>(p: Promise<T>, ms = BUMP_TIMEOUT_MS): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("limit timeout")), ms);
    p.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

export async function bump(key: string, ttlSeconds: number): Promise<number> {
  const s = store();
  const n = (await withTimeout(s.get(key))) + 1;
  await withTimeout(s.set(key, n, ttlSeconds));
  return n;
}

export async function peek(key: string): Promise<number> {
  return store().get(key);
}

export function dayKey(d = new Date()): string {
  // Day boundary in Albany time.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(d);
}

export function clientIp(req: Request): string {
  const xf = req.headers.get("x-forwarded-for") ?? "";
  return xf.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}
