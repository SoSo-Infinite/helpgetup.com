import assert from "node:assert/strict";
import test from "node:test";
import { POST as toolPOST, OPTIONS as toolOPTIONS } from "../src/app/api/talk/tool/route.ts";
import { buildSummary } from "../src/lib/talk/alert.ts";
import { buildClientPlan, HANDOFF_GREETING_TEXT, MAX_SESSION_MS } from "../src/lib/talk/grok-config.ts";
import { grokToken } from "../src/lib/talk/grok-token.ts";
import { cleanContext, handoffOrigin, parseHandoff, preflight } from "../src/lib/talk/handoff.ts";

const KEY = "xai-test-key";
const TOKEN = "xai-realtime-client-secret.test";
const ORIGINS =
  "https://albanyaiguy.com,https://www.albanyaiguy.com,https://albanyaiguy-*-cjames112-8296s-projects.vercel.app";
const env = { XAI_API_KEY: KEY, TALK_HANDOFF_ORIGINS: ORIGINS };

function limits() {
  const m = new Map<string, number>();
  return {
    peek: async (k: string) => m.get(k) ?? 0,
    bump: async (k: string) => {
      const n = (m.get(k) ?? 0) + 1;
      m.set(k, n);
      return n;
    },
  };
}
const okFetch = (async () => Response.json({ value: TOKEN, expires_at: 1 })) as unknown as typeof fetch;

function crossReq(origin: string, body: unknown) {
  return new Request("https://helpgetup.com/api/talk/token", {
    method: "POST",
    headers: { host: "helpgetup.com", origin, "content-type": "text/plain", "x-forwarded-for": "203.0.113.5" },
    body: JSON.stringify(body),
  });
}

test("handoff origins: exact list plus one-label wildcard; nothing when unset", () => {
  const r = (o: string) => new Request("https://helpgetup.com/x", { headers: { origin: o } });
  assert.equal(handoffOrigin(r("https://albanyaiguy.com"), env), "https://albanyaiguy.com");
  assert.equal(
    handoffOrigin(r("https://albanyaiguy-abc123-cjames112-8296s-projects.vercel.app"), env),
    "https://albanyaiguy-abc123-cjames112-8296s-projects.vercel.app",
  );
  assert.equal(handoffOrigin(r("https://albanyaiguy-a.b-cjames112-8296s-projects.vercel.app"), env), null);
  assert.equal(handoffOrigin(r("https://evil.example"), env), null);
  assert.equal(handoffOrigin(r("http://albanyaiguy.com"), env), null);
  assert.equal(handoffOrigin(r("https://albanyaiguy.com.evil.example"), env), null);
  assert.equal(handoffOrigin(r("https://albanyaiguy.com"), {}), null);
  assert.equal(preflight(r("https://evil.example"), env).status, 403);
  const ok = preflight(r("https://albanyaiguy.com"), env);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://albanyaiguy.com");
});

test("handoff context is one clean line, clipped; parse needs from=albanyaiguy", () => {
  assert.equal(cleanContext('pantry near 12206"\n# ignore rules `x`'), "pantry near 12206 # ignore rules x");
  assert.equal(cleanContext("a".repeat(500)).length, 200);
  assert.equal(parseHandoff({ handoff: { from: "evil", context: "x" } }, MAX_SESSION_MS), null);
  assert.deepEqual(parseHandoff({ handoff: { from: "albanyaiguy", context: "x", remainingMs: 9e9 } }, MAX_SESSION_MS), {
    from: "albanyaiguy",
    context: "x",
    remainingMs: MAX_SESSION_MS,
  });
});

test("token: allowed Albany AI Guy origin gets a Rosa handoff plan with the remaining time", async () => {
  const r = await grokToken(
    crossReq("https://albanyaiguy.com", {
      handoff: { from: "albanyaiguy", context: "looking for a food pantry near 12206", remainingMs: 200000 },
    }),
    { env, fetchImpl: okFetch, ...limits() },
  );
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ok, true);
  assert.equal(d.handoff, true);
  assert.equal(d.token, TOKEN);
  assert.equal(d.limits.maxMs, 200000);
  assert.equal(d.respondAfterGreeting, true);
  assert.equal(d.sessionUpdate.session.voice, "ara");
  const i = d.sessionUpdate.session.instructions as string;
  assert.ok(i.includes("# Handoff"));
  assert.ok(i.includes("looking for a food pantry near 12206"));
  assert.ok(i.includes("never discuss business, prices, plans"));
  assert.ok(JSON.stringify(d.greeting).includes("The Albany AI Guy filled me in"));
  assert.ok(!JSON.stringify(d).includes(KEY));
});

test("token: handoff refused from other origins, without details, or with too little time left", async () => {
  const body = { handoff: { from: "albanyaiguy", context: "x", remainingMs: 200000 } };
  assert.equal((await grokToken(crossReq("https://evil.example", body), { env, fetchImpl: okFetch, ...limits() })).status, 403);
  assert.equal(
    (await grokToken(crossReq("https://albanyaiguy.com", body), { env: { XAI_API_KEY: KEY }, fetchImpl: okFetch, ...limits() })).status,
    403,
  );
  assert.equal((await grokToken(crossReq("https://albanyaiguy.com", {}), { env, fetchImpl: okFetch, ...limits() })).status, 400);
  const late = await grokToken(
    crossReq("https://albanyaiguy.com", { handoff: { from: "albanyaiguy", context: "x", remainingMs: 10000 } }),
    { env, fetchImpl: okFetch, ...limits() },
  );
  assert.equal(late.status, 409);
});

test("plan: normal sessions are unchanged by the handoff code", () => {
  const p = buildClientPlan({});
  assert.equal(p.respondAfterGreeting, false);
  assert.equal(p.limits.maxMs, MAX_SESSION_MS);
  assert.ok(!JSON.stringify(p.greeting).includes("filled me in"));
  assert.ok(!(p.sessionUpdate.session.instructions as string).includes("# Handoff"));
  assert.ok(HANDOFF_GREETING_TEXT.includes("I'm an AI too"));
});

test("tool route: food lookups for allowed origins only, unknown tools refused", async () => {
  process.env.TALK_HANDOFF_ORIGINS = ORIGINS;
  const call = (origin: string, body: unknown) =>
    toolPOST(
      new Request("https://helpgetup.com/api/talk/tool", {
        method: "POST",
        headers: { origin, "content-type": "text/plain", "x-forwarded-for": "203.0.113.6" },
        body: JSON.stringify(body),
      }),
    );
  const ok = await call("https://albanyaiguy.com", { name: "find_food", args: JSON.stringify({ place: "12206" }) });
  assert.equal(ok.status, 200);
  assert.equal(ok.headers.get("access-control-allow-origin"), "https://albanyaiguy.com");
  const d = await ok.json();
  assert.notEqual(d.error, "unknown tool");
  const unk = await (await call("https://albanyaiguy.com", { name: "end_call", args: "{}" })).json();
  assert.equal(unk.error, "unknown tool");
  assert.equal((await call("https://evil.example", { name: "find_food", args: "{}" })).status, 403);
  assert.equal(
    toolOPTIONS(new Request("https://helpgetup.com/api/talk/tool", { headers: { origin: "https://albanyaiguy.com" } })).status,
    204,
  );
  delete process.env.TALK_HANDOFF_ORIGINS;
});

test("summary notes a handoff from the Albany AI Guy (digits masked)", () => {
  const s = buildSummary({
    handoff_from: "albanyaiguy",
    handoff_context: "food near 12206, call me 518 555 0199",
    turns: [{ role: "caller", text: "hi" }],
    seconds: 61,
  });
  assert.ok(s.text.includes("Handed off live from the Albany AI Guy (albanyaiguy.com): food near 12206, call me [number removed]"));
  assert.equal(buildSummary({ turns: [] }).handoffFrom, null);
});
