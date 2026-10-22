import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { GET, POST } from "../src/app/api/t/route.ts";
import { postAlert } from "../src/lib/talk/alert.ts";

test("/api/t: counts known talk events, ignores anything else, report is hidden without the token", async () => {
  const ok = await POST(new Request("http://x/api/t", { method: "POST", body: JSON.stringify({ e: "talk_press", p: "/" }) }));
  assert.equal(ok.status, 204);
  const junk = await POST(new Request("http://x/api/t", { method: "POST", body: JSON.stringify({ e: "pricing_view" }) }));
  assert.equal(junk.status, 204);
  delete process.env.TALK_REPORT_TOKEN;
  assert.equal((await GET(new Request("http://x/api/t"))).status, 404);
  process.env.TALK_REPORT_TOKEN = "t0k";
  const r = await GET(new Request("http://x/api/t?days=1", { headers: { "x-report-token": "t0k" } }));
  assert.equal(r.status, 200);
  const d = (await r.json()) as { counts: Record<string, number> };
  assert.equal(d.counts.talk_press, 1);
  assert.equal(d.counts.pricing_view, undefined);
  delete process.env.TALK_REPORT_TOKEN;
});

test("alerts: Authorization Bearer, source helpgetup.com, no lead field", async () => {
  let sent: { headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  const fake = (async (_u: string, init: RequestInit) => {
    sent = { headers: init.headers as Record<string, string>, body: JSON.parse(String(init.body)) };
    return new Response(null, { status: 200 });
  }) as unknown as typeof fetch;
  const r = await postAlert(
    { turns: [{ role: "caller", text: "food near 12206" }], seconds: 40, end: "user" },
    { TALK_ALERT_WEBHOOK_URL: "https://hook.example", TALK_ALERT_WEBHOOK_KEY: "k" },
    fake,
  );
  assert.equal(r, "sent");
  assert.ok(sent);
  const s = sent as { headers: Record<string, string>; body: Record<string, unknown> };
  assert.equal(s.headers.authorization, "Bearer k");
  assert.equal(s.body.source, "helpgetup.com talk button");
  assert.ok(!("lead" in s.body));
});

test("site: contact is hello@helpgetup.com, no demo wording, Vercel Analytics, vercel.app redirect", () => {
  const page = readFileSync("src/app/page.tsx", "utf8");
  assert.ok(page.includes("mailto:hello@helpgetup.com"));
  assert.ok(!/cjames112@gmail\.com/.test(page));
  assert.ok(!/early access|this demo/i.test(page + readFileSync("src/lib/walk-text.ts", "utf8")));
  assert.ok(readFileSync("src/app/layout.tsx", "utf8").includes("<Analytics />"));
  assert.ok(readFileSync("next.config.ts", "utf8").includes('value: "helpgetup-com.vercel.app"'));
});
