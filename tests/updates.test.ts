import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { fastFill, handleSignup, isHoneypot, MIN_FILL_MS, parseSignup } from "../src/lib/signup.ts";
import {
  clientSignupError,
  SIGNUP_CLIENT_TIMEOUT_MS,
  SIGNUP_COPY,
  SIGNUP_COPY_EN,
  SIGNUP_COPY_ES,
} from "../src/lib/signup-copy.ts";
import { type SignupPut } from "../src/lib/signup-store.ts";
import { memoryCapStore, type AlertBook, ALERT_PATH } from "../src/lib/signup-alert-cap.ts";

const NOW = 1700000000000;
const RAND = "ab12cd34ef567890";
const PATH = `signups/${NOW}-${RAND}.json`;
const DAY = new Date(NOW).toISOString().slice(0, 10);
const EVENT_PATH = new RegExp(`^events/${DAY}/(?!${RAND}-)[a-f0-9]{16}-signup_(submitted|stored|alerted)\\.json$`);

type PutCall = {
  pathname: string;
  body: string;
  access: string;
  token: string;
  contentType: string;
  addRandomSuffix: boolean;
};

function eventCalls(calls: PutCall[]): PutCall[] {
  return calls.filter((c) => c.pathname.startsWith("events/"));
}

function assertEventNotes(calls: PutCall[]) {
  for (const c of eventCalls(calls)) {
    const body = JSON.parse(c.body) as Record<string, unknown>;
    assert.deepEqual(Object.keys(body), ["event"]);
    assert.match(String(body.event), /^signup_(submitted|stored|alerted)$/);
    assert.match(c.pathname, EVENT_PATH);
    assert.equal(/ada|@|lovelace/i.test(JSON.stringify(body)), false);
    assert.equal(c.pathname.includes("ada"), false);
  }
}

function collectAfter() {
  const jobs: Promise<unknown>[] = [];
  return {
    after(fn: () => Promise<void>) {
      jobs.push(fn());
    },
    flush: () => Promise.all(jobs),
  };
}

function recordingPut(onCall?: (access: string) => void): { calls: PutCall[]; putBlob: SignupPut } {
  const calls: PutCall[] = [];
  const putBlob: SignupPut = async (pathname, body, options) => {
    calls.push({
      pathname,
      body,
      access: options.access,
      token: options.token,
      contentType: options.contentType,
      addRandomSuffix: options.addRandomSuffix,
    });
    onCall?.(options.access);
  };
  return { calls, putBlob };
}

const banned = /waitlist|lista de espera|cjames112|gmail|pricing|buy now|checkout|\$\d/i;

function post(body: unknown, headers: Record<string, string> = {}) {
  const json = typeof body === "string" ? body : JSON.stringify(body);
  return new Request("https://helpgetup.com/api/updates", {
    method: "POST",
    headers: {
      origin: "https://helpgetup.com",
      host: "helpgetup.com",
      "content-type": "application/json",
      accept: "application/json",
      ...headers,
    },
    body: json,
  });
}

test("parseSignup: keeps a real name and email, rejects junk", () => {
  assert.deepEqual(parseSignup({ name: "  Rosa  Méndez ", email: "Rosa@Example.com " }), {
    ok: true,
    name: "Rosa Méndez",
    email: "rosa@example.com",
  });
  assert.equal(parseSignup({ name: "", email: "a@b.co" }).ok, false);
  assert.equal(parseSignup({ name: "Al", email: "not-an-email" }).ok, false);
  assert.equal(parseSignup({ name: "<script>", email: "a@b.co" }).ok, false);
  assert.equal(parseSignup({ name: "Al", email: "a@b.co" }).ok, true);
});

test("signup: log has no name or email, webhook still does, no price language", async () => {
  const lines: string[] = [];
  let sent: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  const res = await handleSignup(post({ name: "Ada Lovelace", email: "ada@example.com" }), {
    env: { TALK_ALERT_WEBHOOK_URL: "https://hook.example/updates", TALK_ALERT_WEBHOOK_KEY: "k" },
    bump: async () => 1,
    log: (line) => lines.push(line),
    fetchImpl: (async (_u: string, init: RequestInit) => {
      sent = {
        headers: init.headers as Record<string, string>,
        body: JSON.parse(String(init.body)),
      };
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(res.status, 200);
  const data = (await res.json()) as { ok: boolean };
  assert.equal(data.ok, true);
  const logged = JSON.parse(lines[0]) as { hgu: string; stored: string; alert: string };
  assert.deepEqual(logged, { hgu: "signup", stored: "skipped", alert: "sent" });
  assert.equal("name" in logged, false);
  assert.equal("email" in logged, false);
  assert.equal("ip" in logged, false);
  assert.doesNotMatch(lines.join("\n"), /Ada|ada@example\.com/i);
  assert.match(SIGNUP_COPY.ok, /You’re on the list/);
  assert.match(SIGNUP_COPY.ok, /doesn’t send an email on its own/);
  assert.match(SIGNUP_COPY.ok, /hello@helpgetup\.com/);
  assert.match(SIGNUP_COPY.ok, /isn’t a set schedule/);
  assert.match(SIGNUP_COPY.ok, /Albany County food list/);
  assert.doesNotMatch(SIGNUP_COPY.ok, /within \d|business day|check your inbox/i);
  assert.doesNotMatch(Object.values(SIGNUP_COPY).join("\n"), /\p{Extended_Pictographic}/u);
  assert.ok(sent);
  const hook = sent as { headers: Record<string, string>; body: Record<string, unknown> };
  assert.equal(hook.headers.authorization, "Bearer k");
  assert.equal(hook.body.source, "helpgetup.com updates");
  assert.match(String(hook.body.summary), /Ada Lovelace/);
  assert.match(String(hook.body.summary), /ada@example.com/);
  assert.equal("lead" in hook.body, false);
  assert.equal(banned.test(JSON.stringify(hook.body) + lines[0] + SIGNUP_COPY.ok), false);
});

test("signup: invalid email is not logged, rate limit does not call the webhook", async () => {
  const lines: string[] = [];
  let calls = 0;
  let puts = 0;
  const bad = await handleSignup(post({ name: "Ada", email: "nope" }), {
    env: { BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => {
      throw new Error("should not count an invalid signup");
    },
    log: (line) => lines.push(line),
    putBlob: async () => {
      puts += 1;
    },
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(bad.status, 400);
  const err = (await bad.json()) as { error: string };
  assert.equal(err.error, SIGNUP_COPY.invalid);

  const limited = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 9,
    log: (line) => lines.push(line),
    putBlob: async () => {
      puts += 1;
    },
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(limited.status, 429);
  assert.equal(lines.length, 0);
  assert.equal(calls, 0);
  assert.equal(puts, 0);
});

test("signup: other origins are refused, and a plain form post returns HTML", async () => {
  const lines: string[] = [];
  const foreign = await handleSignup(
    post({ name: "Ada", email: "ada@example.com" }, { origin: "https://evil.example" }),
    { log: (line) => lines.push(line), bump: async () => 1 },
  );
  assert.equal(foreign.status, 403);
  assert.equal(lines.length, 0);

  const form = await handleSignup(
    new Request("https://helpgetup.com/api/updates", {
      method: "POST",
      headers: {
        origin: "https://helpgetup.com",
        host: "helpgetup.com",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=Ada+Lovelace&email=ada%40example.com",
    }),
    {
      bump: async () => 1,
      log: (line) => lines.push(line),
      env: {},
    },
  );
  assert.equal(form.status, 503);
  const missed = await form.text();
  assert.match(missed, /We couldn’t save that signup/);
  assert.match(missed, /hello@helpgetup.com/);
  assert.doesNotMatch(missed, /You’re on the list/);
  assert.doesNotMatch(missed, /ada@example.com/);

  const savedHtml = await handleSignup(
    new Request("https://helpgetup.com/api/updates", {
      method: "POST",
      headers: {
        origin: "https://helpgetup.com",
        host: "helpgetup.com",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "name=Ada+Lovelace&email=ada%40example.com",
    }),
    {
      bump: async () => 1,
      log: (line) => lines.push(line),
      env: { TALK_ALERT_WEBHOOK_URL: "https://hook.example", TALK_ALERT_WEBHOOK_KEY: "k" },
      fetchImpl: (async () => new Response(null, { status: 200 })) as unknown as typeof fetch,
    },
  );
  assert.equal(savedHtml.status, 200);
  assert.match(savedHtml.headers.get("content-type") || "", /text\/html/);
  const html = await savedHtml.text();
  assert.match(html, /You’re signed up/);
  assert.match(html, /You’re on the list/);
  assert.match(html, /doesn’t send an email on its own/);
  assert.match(html, /isn’t a set schedule/);
  assert.match(html, /href="\/albany-food-list"/);
  assert.match(html, /Albany County food list/);
  assert.match(html, /hello@helpgetup.com/);
  assert.doesNotMatch(html, /ada@example.com/);
  assert.doesNotMatch(html, /\p{Extended_Pictographic}/u);
  assert.equal(banned.test(html), false);
  assert.doesNotMatch(lines.join("\n"), /Ada|ada@example\.com/i);
});

test("signup blob: private JSON at signups/<timestamp>-<random>.json, log and webhook stay", async () => {
  const lines: string[] = [];
  let webhook = 0;
  const { calls, putBlob } = recordingPut();
  const trail = collectAfter();
  const res = await handleSignup(post({ name: "Ada Lovelace", email: "Ada@Example.com" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example/updates",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 1,
    log: (line) => lines.push(line),
    putBlob,
    now: () => NOW,
    random: () => RAND,
    after: trail.after,
    fetchImpl: (async () => {
      webhook += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json() as { ok: boolean }).ok, true);
  await trail.flush();
  const signup = calls.filter((c) => c.pathname === PATH);
  assert.equal(signup.length, 1);
  assert.equal(signup[0].access, "private");
  assert.equal(signup[0].contentType, "application/json");
  assert.equal(signup[0].addRandomSuffix, false);
  assert.equal(signup[0].token, "blob-token");
  assert.deepEqual(JSON.parse(signup[0].body), {
    name: "Ada Lovelace",
    email: "ada@example.com",
    at: new Date(NOW).toISOString(),
  });
  assert.equal("ip" in JSON.parse(signup[0].body), false);
  assert.equal(JSON.parse(lines[0]).stored, "private");
  assert.match(lines.join("\n"), /"alert":"sent"/);
  assert.match(lines.join("\n"), new RegExp(PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(lines.join("\n"), /Ada|ada@example\.com/i);
  assert.deepEqual(
    eventCalls(calls)
      .map((c) => (JSON.parse(c.body) as { event: string }).event)
      .sort(),
    ["signup_alerted", "signup_stored", "signup_submitted"],
  );
  assertEventNotes(calls);
  assert.equal(webhook, 1);
});

test("signup blob: a private rejection is a failure, never a public file", async () => {
  const { calls, putBlob } = recordingPut(() => {
    throw new Error("Vercel Blob: This store only allows public blobs.");
  });
  const res = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => 1,
    log: () => {},
    putBlob,
    now: () => NOW,
    random: () => RAND,
  });
  assert.equal(res.status, 503);
  assert.equal((await res.json() as { error: string }).error, SIGNUP_COPY.unavailable);
  assert.deepEqual(
    calls.map((c) => c.access),
    ["private"],
  );
  assert.equal(calls[0].pathname, PATH);
  assert.equal(calls.some((c) => c.access === "public"), false);
});

test("signup blob: missing token or a failed write still succeeds, and still logs and webhooks", async () => {
  const lines: string[] = [];
  let webhook = 0;
  const fetchImpl = (async () => {
    webhook += 1;
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const hookEnv = { TALK_ALERT_WEBHOOK_URL: "https://hook.example", TALK_ALERT_WEBHOOK_KEY: "k" };

  let puts = 0;
  const skipped = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: hookEnv,
    bump: async () => 1,
    log: (line) => lines.push(line),
    putBlob: async () => {
      puts += 1;
    },
    fetchImpl,
  });
  assert.equal(skipped.status, 200);
  assert.equal(puts, 0);
  assert.equal(lines.length, 1);
  assert.equal(webhook, 1);

  const down = recordingPut(() => {
    throw new Error("Vercel Blob: The blob service is currently not available. Please try again.");
  });
  const failed = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { ...hookEnv, BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => 1,
    log: (line) => lines.push(line),
    putBlob: down.putBlob,
    now: () => NOW,
    random: () => RAND,
    fetchImpl,
  });
  assert.equal(failed.status, 503);
  const signupTries = down.calls.filter((c) => c.pathname === PATH);
  assert.equal(signupTries.length, 1);
  assert.equal(signupTries[0].access, "private");
  assert.equal(webhook, 1);
  assert.equal((await failed.json() as { error: string }).error, SIGNUP_COPY.unavailable);

  const trimmed = recordingPut();
  const kept = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { BLOB_READ_WRITE_TOKEN: "  blob-token  " },
    bump: async () => 1,
    log: () => {},
    putBlob: trimmed.putBlob,
    now: () => NOW,
    random: () => RAND,
    after: () => {},
  });
  assert.equal(kept.status, 200);
  assert.equal(trimmed.calls[0].access, "private");
  assert.equal(trimmed.calls[0].token, "blob-token");
  assert.equal(trimmed.calls.some((c) => c.access === "public"), false);
});

test("pages: privacy covers the required topics and the footers link to it", () => {
  const privacy = readFileSync("src/app/privacy/page.tsx", "utf8");
  const home = readFileSync("src/app/page.tsx", "utf8");
  const list = readFileSync("src/components/FoodList.tsx", "utf8");
  const form = readFileSync("src/components/UpdatesForm.tsx", "utf8");
  const sitemap = readFileSync("src/app/sitemap.ts", "utf8");
  assert.match(privacy, /Rosa, the talk button/);
  assert.match(privacy, /Vercel Analytics/);
  assert.match(privacy, /hello@helpgetup\.com/);
  assert.match(privacy, /How hello@helpgetup\.com is used/);
  assert.match(privacy, /sells nothing/);
  assert.match(privacy, /mailto:hello@helpgetup\.com/);
  assert.match(home, /href="\/privacy"/);
  assert.match(home, /Get updates and help resources/);
  assert.match(form, /name="name"/);
  assert.match(form, /name="email"/);
  assert.match(form, /copy\.button/);
  assert.match(form, /performance\.now\(\)/);
  assert.match(form, /AbortSignal\.timeout\(SIGNUP_CLIENT_TIMEOUT_MS\)/);
  assert.match(form, /name="company"/);
  assert.doesNotMatch(form, /Date\.now|startedAt/);
  assert.equal(SIGNUP_CLIENT_TIMEOUT_MS, 15_000);
  assert.match(form, /href="\/albany-food-list"/);
  assert.match(privacy, /does not include your name or email/);
  assert.match(privacy, /that note has no name and no email/);
  assert.match(privacy, /until you ask us to delete it/);
  assert.match(privacy, /up to 8 signups from one connection in an hour/);
  assert.match(privacy, /short hash of the network address/);
  assert.doesNotMatch(privacy, /keep a line in the site log/);
  assert.deepEqual(Object.keys(SIGNUP_COPY_EN).sort(), Object.keys(SIGNUP_COPY_ES).sort());
  assert.doesNotMatch(Object.values(SIGNUP_COPY_ES).join("\n"), /\p{Extended_Pictographic}/u);
  assert.equal(clientSignupError(400, undefined, SIGNUP_COPY), SIGNUP_COPY.invalid);
  assert.equal(clientSignupError(503, undefined, SIGNUP_COPY), SIGNUP_COPY.unavailable);
  assert.equal(clientSignupError(500, SIGNUP_COPY.invalid, SIGNUP_COPY), SIGNUP_COPY.unavailable);
  assert.equal(clientSignupError(503, undefined, SIGNUP_COPY_ES), SIGNUP_COPY_ES.unavailable);
  assert.equal(clientSignupError(429, undefined, SIGNUP_COPY_ES), SIGNUP_COPY_ES.limited);
  assert.match(list, /href="\/privacy"/);
  assert.match(sitemap, /helpgetup\.com\/privacy/);
  assert.equal(banned.test(privacy + home + form), false);
  assert.doesNotMatch(home + form + privacy, /early access|this demo|\bdemo\b|coming soon/i);
  assert.doesNotMatch(readFileSync("src/lib/talk/alert.ts", "utf8"), /No leads are collected on HelpGetUp/);
});

test("fill time: only a short real elapsed value is spam", () => {
  assert.equal(isHoneypot(" Acme "), true);
  assert.equal(isHoneypot(""), false);
  assert.equal(isHoneypot(undefined), false);
  assert.equal(fastFill(0), true);
  assert.equal(fastFill(MIN_FILL_MS - 1), true);
  assert.equal(fastFill(MIN_FILL_MS), false);
  assert.equal(fastFill(undefined), false);
  assert.equal(fastFill("nope"), false);
  assert.equal(fastFill(-5), false);
  assert.equal(fastFill(Date.now()), false);
});

test("honeypot and an instant fill go to private spam/ and do not alert", async () => {
  const trail = collectAfter();
  let webhook = 0;
  const { calls, putBlob } = recordingPut();
  const honeypot = await handleSignup(post({ name: "Ada", email: "ada@example.com", company: "Acme" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 1,
    log: () => {},
    putBlob,
    now: () => NOW,
    random: () => RAND,
    after: trail.after,
    fetchImpl: (async () => {
      webhook += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  await trail.flush();
  assert.equal(honeypot.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].pathname, `spam/${NOW}-${RAND}.json`);
  assert.equal(calls[0].access, "private");
  assert.equal(webhook, 0);

  const fast = recordingPut();
  const instant = await handleSignup(post({ name: "Ada", email: "ada@example.com", elapsed: 10 }), {
    env: { BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => 1,
    log: () => {},
    putBlob: fast.putBlob,
    now: () => NOW,
    random: () => RAND,
  });
  assert.equal(instant.status, 200);
  assert.equal(fast.calls[0].pathname.startsWith("spam/"), true);

  const real = recordingPut();
  const slow = await handleSignup(post({ name: "Ada", email: "ada@example.com", elapsed: Date.now() }), {
    env: { BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => 1,
    log: () => {},
    putBlob: real.putBlob,
    now: () => NOW,
    random: () => RAND,
    after: () => {},
  });
  assert.equal(slow.status, 200);
  assert.equal(real.calls[0].pathname, PATH);
});

test("a saved signup answers before the alert, retries once, and records a failure without the email", async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let webhook = 0;
  const trail = collectAfter();
  const blocked = handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 1,
    putBlob: async () => {},
    now: () => NOW,
    random: () => RAND,
    after: trail.after,
    fetchImpl: (async () => {
      webhook += 1;
      await gate;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  const raced = await Promise.race([
    blocked.then(() => "response"),
    new Promise((resolve) => setTimeout(() => resolve("timeout"), 50)),
  ]);
  assert.equal(raced, "response");
  const res = await blocked;
  assert.equal(res.status, 200);
  assert.equal(webhook, 0);
  release();
  await trail.flush();
  assert.equal(webhook, 1);

  const lines: string[] = [];
  let tries = 0;
  const { putBlob } = recordingPut();
  const retry = collectAfter();
  const saved = await handleSignup(post({ name: "Ada Lovelace", email: "ada@example.com" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => {
      throw new Error("cache down");
    },
    log: (line) => lines.push(line),
    putBlob,
    now: () => NOW,
    random: () => RAND,
    after: retry.after,
    fetchImpl: (async (_u: string, init: RequestInit) => {
      tries += 1;
      const body = JSON.parse(String(init.body)) as { summary: string };
      assert.match(body.summary, new RegExp(PATH.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
      assert.equal("lead" in JSON.parse(String(init.body)), false);
      return new Response(null, { status: tries === 1 ? 500 : 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(saved.status, 200);
  await retry.flush();
  assert.equal(tries, 2);
  assert.doesNotMatch(lines.join("\n"), /Ada|ada@example\.com/);

  const failedLines: string[] = [];
  const failedPut = recordingPut();
  const failedTrail = collectAfter();
  const stillSaved = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 1,
    log: (line) => failedLines.push(line),
    putBlob: failedPut.putBlob,
    now: () => NOW,
    random: () => RAND,
    after: failedTrail.after,
    fetchImpl: (async () => new Response(null, { status: 500 })) as unknown as typeof fetch,
  });
  assert.equal(stillSaved.status, 200);
  await failedTrail.flush();
  const marker = failedPut.calls.find((c) => c.pathname.startsWith("alerts-failed/"));
  assert.ok(marker);
  assert.deepEqual(JSON.parse(marker.body), { path: PATH });
  assert.equal(marker.access, "private");
  assert.match(failedLines.join("\n"), /"path":"signups\//);
  assert.doesNotMatch(failedLines.join("\n") + marker.body, /ada@example\.com/);
});

test("the alert cap skips the webhook when the counter write fails, and stores a hash", async () => {
  const lines: string[] = [];
  let webhook = 0;
  const { calls, putBlob } = recordingPut();
  const trail = collectAfter();
  const down = await handleSignup(
    post({ name: "Ada", email: "ada@example.com" }, { "x-forwarded-for": "203.0.113.10" }),
    {
      env: {
        BLOB_READ_WRITE_TOKEN: "blob-token",
        TALK_ALERT_WEBHOOK_URL: "https://hook.example",
        TALK_ALERT_WEBHOOK_KEY: "k",
      },
      bump: async () => 1,
      log: (line) => lines.push(line),
      putBlob,
      now: () => NOW,
      random: () => RAND,
      after: trail.after,
      capStore: {
        async read() {
          throw new Error("blob down");
        },
        async write() {
          throw new Error("blob down");
        },
      },
      fetchImpl: (async () => {
        webhook += 1;
        return new Response(null, { status: 200 });
      }) as unknown as typeof fetch,
    },
  );
  assert.equal(down.status, 200);
  await trail.flush();
  assert.equal(webhook, 0);
  assert.ok(calls.some((c) => c.pathname.startsWith("alerts-failed/")));
  assert.doesNotMatch(lines.join("\n"), /203\.0\.113\.10|ada@example/);

  const book = memoryCapStore();
  const capped = collectAfter();
  let sent = 0;
  await handleSignup(post({ name: "Ada", email: "ada@example.com" }, { "x-forwarded-for": "203.0.113.10" }), {
    env: {
      BLOB_READ_WRITE_TOKEN: "blob-token",
      TALK_ALERT_WEBHOOK_URL: "https://hook.example",
      TALK_ALERT_WEBHOOK_KEY: "k",
    },
    bump: async () => 1,
    putBlob: async () => {},
    now: () => NOW,
    random: () => RAND,
    after: capped.after,
    capStore: book,
    fetchImpl: (async () => {
      sent += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  await capped.flush();
  assert.equal(sent, 1);
  const saved = (await book.read<AlertBook>(ALERT_PATH))?.value;
  assert.ok(saved);
  assert.equal(JSON.stringify(saved).includes("203.0.113.10"), false);
  assert.equal(JSON.stringify(saved).includes("ada@example.com"), false);
  assert.equal(Object.keys(saved.ips).length, 1);
});
