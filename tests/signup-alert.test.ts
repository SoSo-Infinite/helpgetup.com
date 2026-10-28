import assert from "node:assert/strict";
import test from "node:test";
import {
  ALERT_PATH,
  ALERT_PER_DAY,
  ALERT_PER_HOUR,
  ALERT_PER_IP_PER_HOUR,
  claimAlert,
  memoryCapStore,
  reserveSignupAlert,
  signupIpKey,
  type AlertBook,
  type CapStore,
} from "../src/lib/signup-alert-cap.ts";

const h1 = new Date("2026-10-28T04:00:00.000Z");
const h2 = new Date("2026-10-28T05:00:00.000Z");
const h3 = new Date("2026-10-28T06:00:00.000Z");
const nextDay = new Date("2026-10-29T06:00:00.000Z");

test("claim resets each hour and stops at the daily cap", () => {
  let book: AlertBook | null = null;
  for (let i = 0; i < ALERT_PER_IP_PER_HOUR; i++) {
    const r = claimAlert(book, "solo", h1);
    assert.equal(r.ok, true);
    book = r.book;
  }
  const denied = claimAlert(book, "solo", h1);
  assert.equal(denied.ok, false);
  assert.equal(denied.book.hourCount, ALERT_PER_IP_PER_HOUR);
  const other = claimAlert(book, "other", h1);
  assert.equal(other.ok, true);
  const later = claimAlert(other.book, "solo", h2);
  assert.equal(later.ok, true);
  assert.equal(later.book.hourCount, 1);
  assert.equal(later.book.dayCount, ALERT_PER_IP_PER_HOUR + 2);
  assert.doesNotMatch(JSON.stringify(later.book), /@|203\.0\.113/);
});

test("reserve stops a per-IP flood, an hourly flood, and a daily flood", async () => {
  const one = memoryCapStore();
  let n = 0;
  for (let i = 0; i < 5; i++) if ((await reserveSignupAlert(one, "solo", h1)) === "ok") n += 1;
  assert.equal(n, ALERT_PER_IP_PER_HOUR);
  assert.equal(await reserveSignupAlert(one, "solo", h1), "capped");
  assert.equal(await reserveSignupAlert(one, "other", h1), "ok");
  const saved = (await one.read<AlertBook>(ALERT_PATH))!.value;
  assert.equal(saved.ips.solo, ALERT_PER_IP_PER_HOUR);
  assert.equal(saved.hourCount, ALERT_PER_IP_PER_HOUR + 1);

  const many = memoryCapStore();
  const burst = await Promise.all(
    Array.from({ length: 30 }, (_, i) => reserveSignupAlert(many, "ip-" + i, h1)),
  );
  const won = burst.filter((r) => r === "ok").length;
  assert.ok(won >= 1 && won <= ALERT_PER_HOUR);
  assert.ok((await many.read<AlertBook>(ALERT_PATH))!.value.hourCount <= ALERT_PER_HOUR);

  const day = memoryCapStore();
  let morning = 0;
  let midday = 0;
  for (let i = 0; i < 25; i++) if ((await reserveSignupAlert(day, "a-" + i, h1)) === "ok") morning += 1;
  for (let i = 0; i < 25; i++) if ((await reserveSignupAlert(day, "b-" + i, h2)) === "ok") midday += 1;
  assert.equal(morning, ALERT_PER_HOUR);
  assert.equal(midday, ALERT_PER_DAY - ALERT_PER_HOUR);
  assert.equal(await reserveSignupAlert(day, "fresh", h3), "capped");
  assert.equal(await reserveSignupAlert(day, "fresh", nextDay), "ok");
});

test("a broken alert counter does not send, and the ip key is not the address", async () => {
  const down: CapStore = {
    async read() {
      throw new Error("blob down");
    },
    async write() {
      throw new Error("blob down");
    },
  };
  assert.equal(await reserveSignupAlert(down, "ip", h1), "failed");
  const key = signupIpKey("203.0.113.10");
  assert.equal(key.includes("203.0.113.10"), false);
  assert.equal(signupIpKey("203.0.113.10"), key);
});
