import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSignup, parseSignup } from "../src/lib/signup.ts";
import { SIGNUP_COPY } from "../src/lib/signup-copy.ts";
import { privateAccessRejected, type SignupPut } from "../src/lib/signup-store.ts";

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
  assert.equal(form.status, 200);
  assert.match(form.headers.get("content-type") || "", /text\/html/);
  const html = await form.text();
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

test("privateAccessRejected: store access only, not token or network failures", () => {
  assert.equal(
    privateAccessRejected(
      new Error("Vercel Blob: Invalid access level. This store only allows public blobs. Requested private."),
    ),
    true,
  );
  assert.equal(
    privateAccessRejected(new Error("Vercel Blob: This store only allows public blobs.")),
    true,
  );
  assert.equal(
    privateAccessRejected(new Error("Vercel Blob: Access denied, please provide a valid token for this resource.")),
    false,
  );
  assert.equal(
    privateAccessRejected(new Error("Vercel Blob: The blob service is currently not available. Please try again.")),
    false,
  );
  assert.equal(privateAccessRejected(new TypeError("fetch failed")), false);
});

test("signup blob: private JSON at signups/<timestamp>-<random>.json, log and webhook stay", async () => {
  const lines: string[] = [];
  let webhook = 0;
  const { calls, putBlob } = recordingPut();
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
    fetchImpl: (async () => {
      webhook += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(res.status, 200);
  assert.equal((await res.json() as { ok: boolean }).ok, true);
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
  assert.deepEqual(JSON.parse(lines[0]), { hgu: "signup", stored: "private", alert: "sent" });
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

test("signup blob: private rejection falls back to public at the same path", async () => {
  const { calls, putBlob } = recordingPut((access) => {
    if (access === "private") {
      throw new Error("Vercel Blob: The store access is public, but the request specified private.");
    }
  });
  const res = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { BLOB_READ_WRITE_TOKEN: "blob-token" },
    bump: async () => 1,
    log: () => {},
    putBlob,
    now: () => NOW,
    random: () => RAND,
  });
  assert.equal(res.status, 200);
  const signup = calls.filter((c) => c.pathname === PATH);
  assert.deepEqual(
    signup.map((c) => c.access),
    ["private", "public"],
  );
  assert.equal(signup[0].pathname, signup[1].pathname);
  assert.equal(JSON.parse(signup[1].body).email, "ada@example.com");
  assert.ok(eventCalls(calls).some((c) => c.pathname.endsWith("-signup_stored.json")));
  assert.equal(
    eventCalls(calls).some((c) => c.pathname.endsWith("-signup_alerted.json")),
    false,
  );
  assertEventNotes(calls);
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
  assert.equal(failed.status, 200);
  const signupTries = down.calls.filter((c) => c.pathname === PATH);
  assert.equal(signupTries.length, 1);
  assert.equal(signupTries[0].access, "private");
  assert.equal(
    eventCalls(down.calls).some((c) => c.pathname.endsWith("-signup_stored.json")),
    false,
  );
  assert.ok(eventCalls(down.calls).some((c) => c.pathname.endsWith("-signup_submitted.json")));
  assert.ok(eventCalls(down.calls).some((c) => c.pathname.endsWith("-signup_alerted.json")));
  assertEventNotes(down.calls);
  assert.equal(webhook, 2);

  const both = recordingPut(() => {
    throw new Error("Vercel Blob: This store only allows public blobs.");
  });
  const fallbackFailed = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { BLOB_READ_WRITE_TOKEN: "  blob-token  " },
    bump: async () => 1,
    log: () => {},
    putBlob: both.putBlob,
    now: () => NOW,
    random: () => RAND,
  });
  assert.equal(fallbackFailed.status, 200);
  const publicTries = both.calls.filter((c) => c.pathname === PATH);
  assert.deepEqual(
    publicTries.map((c) => c.access),
    ["private", "public"],
  );
  assert.equal(publicTries[1].token, "blob-token");
  assert.equal(
    eventCalls(both.calls).some((c) => c.pathname.endsWith("-signup_stored.json")),
    false,
  );
  assertEventNotes(both.calls);
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
  assert.match(form, /Get updates and help resources/);
  assert.match(form, /SIGNUP_COPY\.okLead/);
  assert.match(form, /href="\/albany-food-list"/);
  assert.match(privacy, /does not include your name or email/);
  assert.match(privacy, /that note has no name and no email/);
  assert.doesNotMatch(privacy, /keep a line in the site log/);
  assert.match(list, /href="\/privacy"/);
  assert.match(sitemap, /helpgetup\.com\/privacy/);
  assert.equal(banned.test(privacy + home + form), false);
  assert.doesNotMatch(home + form + privacy, /early access|this demo|\bdemo\b|coming soon/i);
});
