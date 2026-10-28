import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";

const LINE = 'if (!process.env.VERCEL_BLOB_RETRIES?.trim()) process.env.VERCEL_BLOB_RETRIES = "1";';

function loadStore(value: string | undefined): string {
  const env = { ...process.env };
  if (value === undefined) delete env.VERCEL_BLOB_RETRIES;
  else env.VERCEL_BLOB_RETRIES = value;
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      "./tests/support/register.mjs",
      "--input-type=module",
      "-e",
      'await import("./src/lib/signup-store.ts"); process.stdout.write(process.env.VERCEL_BLOB_RETRIES ?? "");',
    ],
    { encoding: "utf8", env },
  );
  assert.equal(child.status, 0, child.stderr);
  return child.stdout;
}

test("signup-store caps Blob retries at 1 unless VERCEL_BLOB_RETRIES is already set", () => {
  const src = readFileSync("src/lib/signup-store.ts", "utf8");
  const at = src.indexOf(LINE);
  assert.ok(at > 0);
  assert.ok(at < src.indexOf('from "@vercel/blob"'));
  assert.equal(loadStore(undefined), "1");
  assert.equal(loadStore("   "), "1");
  assert.equal(loadStore("4"), "4");
});
