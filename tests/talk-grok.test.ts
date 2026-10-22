/* eslint-disable @typescript-eslint/no-explicit-any -- reads loose JSON payloads */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  alertsConfigured,
  buildSummary,
  postAlert,
  signSession,
  verifySession,
} from "../src/lib/talk/alert.ts";
import { base64ToFloat32, pcm16ToBase64 } from "../src/lib/talk/grok-client.ts";
import {
  buildClientPlan,
  buildSessionUpdate,
  DEFAULT_MODEL,
  IDLE_HANGUP_MS,
  KEYTERMS,
  MAX_SESSION_MS,
  resolveVoice,
  TOKEN_TTL_S,
  XAI_CLIENT_SECRETS_URL,
} from "../src/lib/talk/grok-config.ts";
import { grokToken, sameOrigin } from "../src/lib/talk/grok-token.ts";
import { say518 } from "../src/lib/talk/say518.ts";
import { handleSummary } from "../src/lib/talk/summary.ts";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const KEY = "xai-TESTKEY-do-not-leak-0123456789";
const TOKEN = "xai-realtime-client-secret-abc";

// ---------- 518 normalizer (port of royalty/tests/test_say518.py) ----------

test("say518: area forms", () => {
  assert.equal(say518("Albany and the 518."), "Albany and the five-one-eight.");
  assert.equal(
    say518("help in the 518-area"),
    "help in the five-one-eight-area",
  );
  assert.equal(say518("518"), "five-one-eight");
  assert.equal(say518("5 1 8"), "five-one-eight");
  assert.ok(!say518("the 518").includes("eighteen"));
});

test("say518: 518 phone numbers digit by digit", () => {
  const want = "five-one-eight, five five five, zero one four two";
  for (const p of [
    "(518) 555-0142",
    "518-555-0142",
    "518.555.0142",
    "518 555 0142",
    "+1 518 555 0142",
    "5185550142",
  ]) {
    assert.equal(say518(`Call ${p} now`), `Call ${want} now`, p);
  }
});

test("say518: leaves other numbers alone", () => {
  for (const s of [
    "5,518 dollars",
    "1518",
    "518,000 people",
    "212-555-0518x",
  ]) {
    assert.ok(!say518(s).includes("five-one-eight"), s);
  }
});

// ---------- session config ----------

test("voice: default ara (not the Albany AI Guy's leo), alternates via env, junk falls back", () => {
  assert.equal(resolveVoice(undefined), "ara");
  assert.equal(resolveVoice("celeste"), "celeste");
  assert.equal(resolveVoice("  "), "ara");
  assert.equal(resolveVoice('ara"; drop'), "ara");
  assert.equal(resolveVoice("leo"), "ara", "leo is the Albany AI Guy's voice");
  assert.equal(resolveVoice("LEO"), "ara");
  const s = buildSessionUpdate({ voice: "ursa" }).session;
  assert.equal(s.voice, "ursa");
});

test("session.update: format, VAD idle check-in, 518 replace, keyterms", () => {
  const u = buildSessionUpdate();
  assert.equal(u.type, "session.update");
  const s = u.session as Record<string, any>;
  assert.equal(s.voice, "ara");
  assert.deepEqual(s.turn_detection, {
    type: "server_vad",
    idle_timeout_ms: 15000,
  });
  assert.deepEqual(s.audio.input.format, { type: "audio/pcm", rate: 24000 });
  assert.deepEqual(s.audio.output.format, { type: "audio/pcm", rate: 24000 });
  assert.equal(s.replace["518"], "five-one-eight");
  assert.equal(s.replace.HelpGetUp, "Help Get Up");
  for (const k of [
    "Albany",
    "SNAP",
    "EBT",
    "Veggie Mobile",
    "Cohoes",
    "Arbor Hill",
    "Help Get Up",
  ]) {
    assert.ok(s.audio.input.transcription.keyterms.includes(k), k);
  }
  assert.ok(KEYTERMS.length <= 100 && KEYTERMS.every((k) => k.length <= 50));
  assert.equal(s.reasoning, undefined);
  assert.equal(s.audio.output.speed, undefined);
});

test("session.update: optional reasoning and clamped speed", () => {
  const s = buildSessionUpdate({ reasoning: "none", speed: "9" })
    .session as Record<string, any>;
  assert.deepEqual(s.reasoning, { effort: "none" });
  assert.equal(s.audio.output.speed, 1.5);
  const t = buildSessionUpdate({ reasoning: "max" })
    .session as Record<string, any>;
  assert.equal(t.reasoning, undefined);
});

test("tools: end_call plus the two local food lookups; no lead capture", () => {
  const s = buildSessionUpdate().session as Record<string, any>;
  assert.deepEqual(
    s.tools.map((t: { name: string }) => t.name),
    ["end_call", "find_food", "senior_meals"],
  );
  assert.ok(!JSON.stringify(s).includes("save_followup"));
  const find = s.tools.find((t: { name: string }) => t.name === "find_food");
  assert.deepEqual(find.parameters.required, ["place"]);
  assert.deepEqual(find.parameters.properties.kind.enum, [
    "any",
    "pantry",
    "meal",
    "produce",
    "fridge",
  ]);
});

test("client plan: pinned model, caps, no secrets", () => {
  const plan = buildClientPlan({ XAI_API_KEY: KEY });
  assert.equal(plan.model, DEFAULT_MODEL);
  assert.equal(plan.wsUrl, "wss://api.x.ai/v1/realtime?model=grok-voice-3.0");
  assert.equal(plan.limits.maxMs, MAX_SESSION_MS);
  assert.equal(MAX_SESSION_MS, 5 * 60 * 1000);
  assert.equal(plan.limits.idleMs, IDLE_HANGUP_MS);
  assert.equal(IDLE_HANGUP_MS, 30 * 1000);
  assert.ok(!JSON.stringify(plan).includes(KEY));
  const bad = buildClientPlan({ TALK_GROK_MODEL: "gpt-4o; evil" });
  assert.equal(bad.model, DEFAULT_MODEL);
});

// ---------- token route ----------

function memLimits() {
  const m = new Map<string, number>();
  return {
    m,
    peek: async (k: string) => m.get(k) ?? 0,
    bump: async (k: string) => {
      const n = (m.get(k) ?? 0) + 1;
      m.set(k, n);
      return n;
    },
  };
}

function req(headers: Record<string, string> = {}) {
  return new Request("https://helpgetup.com/api/talk/token", {
    method: "POST",
    headers: {
      host: "helpgetup.com",
      origin: "https://helpgetup.com",
      "x-forwarded-for": "203.0.113.9",
      ...headers,
    },
  });
}

function okFetch(calls: { url: string; init: RequestInit }[]) {
  return (async (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return Response.json({ value: TOKEN, expires_at: 1774274445 });
  }) as unknown as typeof fetch;
}

test("token: off without XAI_API_KEY or with TALK_ENABLED=0 (no upstream call)", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const l = memLimits();
  for (const env of [{}, { XAI_API_KEY: KEY, TALK_ENABLED: "0" }]) {
    const r = await grokToken(req(), { env, fetchImpl: okFetch(calls), ...l });
    assert.equal(r.status, 503);
    assert.equal((await r.json()).reason, "off");
  }
  assert.equal(calls.length, 0);
});

test("token: cross-origin and missing Origin are refused", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const l = memLimits();
  const env = { XAI_API_KEY: KEY };
  const evil = await grokToken(req({ origin: "https://evil.example" }), {
    env,
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal(evil.status, 403);
  const noOrigin = new Request("https://helpgetup.com/api/talk/token", {
    method: "POST",
    headers: { host: "helpgetup.com" },
  });
  assert.equal(sameOrigin(noOrigin), false);
  assert.equal(
    (await grokToken(noOrigin, { env, fetchImpl: okFetch(calls), ...l }))
      .status,
    403,
  );
  assert.equal(calls.length, 0);
});

test("token: success mints a short-lived secret and never leaks the key", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const l = memLimits();
  const r = await grokToken(req(), {
    env: { XAI_API_KEY: KEY },
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  const raw = await r.text();
  assert.ok(!raw.includes(KEY), "API key must never reach the browser");
  const body = JSON.parse(raw);
  assert.equal(body.ok, true);
  assert.equal(body.provider, "grok");
  assert.equal(body.token, TOKEN);
  assert.equal(body.maxMinutes, 5);
  assert.equal(body.alerts, false);
  assert.equal(body.sid, null);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url, XAI_CLIENT_SECRETS_URL);
  const h = calls[0]?.init.headers as Record<string, string>;
  assert.equal(h.authorization, `Bearer ${KEY}`);
  assert.deepEqual(JSON.parse(String(calls[0]?.init.body)), {
    expires_after: { seconds: TOKEN_TTL_S },
  });
  assert.ok(TOKEN_TTL_S <= 600);
});

test("token: per-IP rate limit, per-minute and daily caps", async () => {
  const calls: { url: string; init: RequestInit }[] = [];
  const l = memLimits();
  const env = {
    XAI_API_KEY: KEY,
    TALK_PER_IP_LIMIT: "2",
    TALK_GLOBAL_PER_MIN: "100",
  };
  for (let i = 0; i < 2; i++) {
    assert.equal(
      (await grokToken(req(), { env, fetchImpl: okFetch(calls), ...l })).status,
      200,
    );
  }
  const third = await grokToken(req(), {
    env,
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal(third.status, 429);
  assert.equal((await third.json()).reason, "rate_limited");
  assert.equal(calls.length, 2, "a refused request makes no upstream call");
  // Another IP still gets through until the per-minute cap.
  const env2 = { XAI_API_KEY: KEY, TALK_GLOBAL_PER_MIN: "3" };
  const other = await grokToken(req({ "x-forwarded-for": "198.51.100.7" }), {
    env: env2,
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal(other.status, 200);
  const busy = await grokToken(req({ "x-forwarded-for": "198.51.100.8" }), {
    env: env2,
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal((await busy.json()).reason, "busy");
  const env3 = { XAI_API_KEY: KEY, TALK_DAILY_CAP: "3" };
  const daily = await grokToken(req({ "x-forwarded-for": "198.51.100.9" }), {
    env: env3,
    fetchImpl: okFetch(calls),
    ...l,
  });
  assert.equal((await daily.json()).reason, "daily_cap");
});

test("token: upstream 403 (no credits) is a friendly 503, logs no key", async () => {
  const logs: string[] = [];
  const l = memLimits();
  const fetch403 = (async () =>
    Response.json(
      { error: `team out of credits ${KEY}` },
      { status: 403 },
    )) as unknown as typeof fetch;
  const r = await grokToken(req(), {
    env: { XAI_API_KEY: KEY },
    fetchImpl: fetch403,
    log: (m) => logs.push(m),
    ...l,
  });
  assert.equal(r.status, 503);
  const raw = await r.text();
  assert.ok(!raw.includes(KEY));
  assert.equal(JSON.parse(raw).reason, "upstream_credits");
  assert.ok(logs.length === 1 && !logs[0]?.includes(KEY));
  assert.equal(l.m.size, 0, "failed mints do not count against the visitor");
});

test("token: network failure is a friendly 503", async () => {
  const boom = (async () => {
    throw new Error(KEY);
  }) as unknown as typeof fetch;
  const r = await grokToken(req(), {
    env: { XAI_API_KEY: KEY },
    fetchImpl: boom,
    log: () => {},
    ...memLimits(),
  });
  assert.equal(r.status, 503);
  assert.ok(!(await r.text()).includes(KEY));
});

test("token: with alerts wired, returns a signed session id", async () => {
  const env = {
    XAI_API_KEY: KEY,
    TALK_ALERT_WEBHOOK_URL: "https://hook.example/x",
    TALK_ALERT_WEBHOOK_KEY: "hk",
  };
  const r = await grokToken(req(), {
    env,
    fetchImpl: okFetch([]),
    ...memLimits(),
  });
  const body = await r.json();
  assert.equal(body.alerts, true);
  assert.ok(verifySession("hk", body.sid));
  assert.ok(!JSON.stringify(body).includes('hk"'));
});

// ---------- alerts webhook ----------

test("alerts: no-op without both env vars (no network call)", async () => {
  let called = 0;
  const f = (async () => {
    called++;
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  assert.equal(alertsConfigured({}), false);
  assert.equal(
    alertsConfigured({ TALK_ALERT_WEBHOOK_URL: "https://x" }),
    false,
  );
  assert.equal(await postAlert({ turns: [] }, {}, f), "skipped");
  assert.equal(
    await postAlert({ turns: [] }, { TALK_ALERT_WEBHOOK_KEY: "k" }, f),
    "skipped",
  );
  const r = await handleSummary(
    new Request("https://helpgetup.com/api/talk/summary", {
      method: "POST",
      body: "{}",
    }),
    { env: {}, fetchImpl: f },
  );
  assert.equal(r.status, 204);
  assert.equal(called, 0);
});

test("alerts: summary text says what was asked and answered", () => {
  const s = buildSummary({
    turns: [
      { role: "agent", text: "Good day. I'm Rosa." },
      { role: "caller", text: "Where can I get groceries in Cohoes? My SSN is 123-45-6789" },
      {
        role: "agent",
        text: "There's a pantry close by. Call before you go.",
      },
      { role: "hacker", text: "x" },
    ],
    seconds: 95,
    end: "goodbye",
  });
  assert.match(s.text, /1m 35s \(goodbye\)/);
  assert.match(s.text, /^HelpGetUp talk button conversation/);
  assert.match(s.text, /Caller asked: Where can I get groceries in Cohoes/);
  assert.match(s.text, /Rosa said: There's a pantry close by/);
  assert.ok(!s.text.includes("6789"), "long digit runs are masked");
  assert.match(s.text, /\[number removed\]/);
  assert.equal(s.turns.length, 3);
  assert.ok(!("lead" in s));
});

test("alerts: signed, one-shot summary posts to the webhook with the key", async () => {
  const env = {
    TALK_ALERT_WEBHOOK_URL: "https://hook.example/routine",
    TALK_ALERT_WEBHOOK_KEY: "secret-k",
  };
  const sent: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    sent.push({ url: String(url), init });
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const l = memLimits();
  const sid = signSession("secret-k");
  const mk = (b: unknown) =>
    new Request("https://helpgetup.com/api/talk/summary", {
      method: "POST",
      body: JSON.stringify(b),
    });
  const body = {
    sid,
    turns: [{ role: "caller", text: "Pantry in Cohoes?" }],
    seconds: 40,
    end: "user",
  };
  assert.equal(
    (await handleSummary(mk(body), { env, fetchImpl: f, ...l })).status,
    202,
  );
  assert.equal(
    (await handleSummary(mk(body), { env, fetchImpl: f, ...l })).status,
    409,
  );
  assert.equal(
    (
      await handleSummary(mk({ ...body, sid: `${sid}x` }), {
        env,
        fetchImpl: f,
        ...l,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await handleSummary(mk({ ...body, sid: signSession("other") }), {
        env,
        fetchImpl: f,
        ...l,
      })
    ).status,
    403,
  );
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.url, "https://hook.example/routine");
  assert.equal(
    (sent[0]?.init.headers as Record<string, string>).authorization,
    "Bearer secret-k",
  );
  assert.match(
    JSON.parse(String(sent[0]?.init.body)).summary,
    /Caller asked: Pantry in Cohoes\?/,
  );
  assert.equal(
    JSON.parse(String(sent[0]?.init.body)).source,
    "helpgetup.com talk button",
  );
});

test("alerts: expired session ids are refused", () => {
  const sid = signSession("k", Date.now() - 60 * 60 * 1000, 60);
  assert.equal(verifySession("k", sid), null);
});

// ---------- browser audio helpers + wiring ----------

test("pcm16 base64 round trip", () => {
  const pcm = new Int16Array([0, 16384, -16384, 32767, -32768]);
  const f = base64ToFloat32(pcm16ToBase64(pcm.buffer));
  assert.equal(f.length, 5);
  assert.ok(Math.abs((f[1] ?? 0) - 0.5) < 1e-4);
  assert.ok(Math.abs((f[2] ?? 0) + 0.5) < 1e-4);
  assert.equal(f[4], -1);
});

test("wiring: token route is Grok only; button keeps the Albany AI Guy button's parts", () => {
  const route = readFileSync(
    join(root, "src/app/api/talk/token/route.ts"),
    "utf8",
  );
  assert.match(route, /return grokToken\(req\)/);
  assert.ok(!/livekit/i.test(route));
  const btn = readFileSync(join(root, "src/components/TalkButton.tsx"), "utf8");
  for (const cls of [
    "talk-bounce",
    "talk-btn",
    "talk-glow",
    "talk-ring",
    "talk-vortex",
    "talk-mascot",
    "talk-hint",
    "talk-end",
    "talk-again",
    "talk-fallback",
    "talk-fine",
  ]) {
    assert.ok(btn.includes(`"${cls}"`), cls);
  }
  assert.ok(btn.includes("/talk/helpgetup-logo-240.png"), "HGU logo");
  assert.ok(btn.includes('import("@/lib/talk/food-tool")'));
  assert.ok(btn.includes('"pagehide"'), "closing the tab hangs up");
  assert.ok(!btn.includes("livekit"));
  // Honest fine print (Chad, Oct 22): never just "Not recorded".
  assert.ok(
    btn.includes("Audio isn’t recorded, but a short written summary is kept."),
  );
  assert.ok(!/Not recorded\./.test(btn));
  assert.ok(btn.includes("El audio no se graba, pero se guarda un breve resumen escrito."));
  const css = readFileSync(join(root, "src/app/globals.css"), "utf8");
  for (const k of ["@keyframes talk-bounce", "@keyframes talk-pulse", "prefers-reduced-motion"]) {
    assert.ok(css.includes(k), k);
  }
  const page = readFileSync(join(root, "src/app/page.tsx"), "utf8");
  assert.ok(page.includes("<TalkButton"));
  const client = readFileSync(
    join(root, "src/lib/talk/grok-client.ts"),
    "utf8",
  );
  assert.ok(client.includes("xai-client-secret."));
  assert.ok(!client.includes("XAI_API_KEY"));
  assert.ok(
    client.includes("conversation.item.truncate"),
    "barge-in truncation",
  );
});

test("offline service worker still never caches /api/* (token, summary)", () => {
  const sw = readFileSync(join(root, "public/sw.js"), "utf8");
  assert.ok(sw.includes('if (url.pathname.startsWith("/api/")) return;'));
  assert.ok(sw.includes('if (req.method !== "GET") return;'));
});

test("smoke script refuses without --yes-paid", () => {
  const smoke = readFileSync(join(root, "scripts/grok-voice-smoke.ts"), "utf8");
  assert.ok(smoke.includes('if (!process.argv.includes("--yes-paid"))'));
  assert.ok(smoke.indexOf("--yes-paid") < smoke.indexOf("await fetch("));
});
