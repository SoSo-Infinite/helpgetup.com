import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { handleSignup, parseSignup } from "../src/lib/signup.ts";
import { SIGNUP_COPY } from "../src/lib/signup-copy.ts";

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

test("signup: logs name and email, no price language, no lead field", async () => {
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
  const logged = JSON.parse(lines[0]) as { hgu: string; name: string; email: string };
  assert.equal(logged.hgu, "signup");
  assert.equal(logged.name, "Ada Lovelace");
  assert.equal(logged.email, "ada@example.com");
  assert.equal("ip" in logged, false);
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
  const bad = await handleSignup(post({ name: "Ada", email: "nope" }), {
    bump: async () => {
      throw new Error("should not count an invalid signup");
    },
    log: (line) => lines.push(line),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(bad.status, 400);
  const err = (await bad.json()) as { error: string };
  assert.equal(err.error, SIGNUP_COPY.invalid);

  const limited = await handleSignup(post({ name: "Ada", email: "ada@example.com" }), {
    env: { TALK_ALERT_WEBHOOK_URL: "https://hook.example", TALK_ALERT_WEBHOOK_KEY: "k" },
    bump: async () => 9,
    log: (line) => lines.push(line),
    fetchImpl: (async () => {
      calls += 1;
      return new Response(null, { status: 200 });
    }) as unknown as typeof fetch,
  });
  assert.equal(limited.status, 429);
  assert.equal(lines.length, 0);
  assert.equal(calls, 0);
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
  assert.match(html, /hello@helpgetup.com/);
  assert.doesNotMatch(html, /ada@example.com/);
  assert.equal(banned.test(html), false);
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
  assert.match(list, /href="\/privacy"/);
  assert.match(sitemap, /helpgetup\.com\/privacy/);
  assert.equal(banned.test(privacy + home + form), false);
  assert.doesNotMatch(home + form + privacy, /early access|this demo|\bdemo\b|coming soon/i);
});
