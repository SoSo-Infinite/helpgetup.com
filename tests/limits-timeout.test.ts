import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { bump, withTimeout } from "../src/lib/talk/limits.ts";

test("one timeout wraps the whole bump and a hang fails open", async () => {
  const src = readFileSync("src/lib/talk/limits.ts", "utf8");
  const body = src.slice(src.indexOf("export async function bump"), src.indexOf("export async function peek"));
  assert.equal(body.split("withTimeout").length - 1, 1);
  assert.match(body, /BUMP_TIMEOUT_MS/);
  assert.match(body, /return 1/);
  await assert.rejects(withTimeout(new Promise(() => {}), 30), /limit timeout/);
  assert.equal(await withTimeout(Promise.resolve(2), 30), 2);
  assert.equal(await bump("limits-timeout-open", 60), 1);
  assert.equal(await bump("limits-timeout-open", 60), 2);
});
