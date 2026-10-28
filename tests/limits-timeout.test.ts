import assert from "node:assert/strict";
import test from "node:test";
import { withTimeout } from "../src/lib/talk/limits.ts";

test("bump's timeout rejects a counter that never answers", async () => {
  await assert.rejects(withTimeout(new Promise(() => {}), 30), /limit timeout/);
  assert.equal(await withTimeout(Promise.resolve(2), 30), 2);
});
