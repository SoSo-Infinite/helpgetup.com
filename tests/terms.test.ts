import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { dirname, join } from "node:path";
import { after, before, describe, test } from "node:test";
import { fileURLToPath } from "node:url";

/**
 * Fixed eval for /terms (Hamel: pin the observable page, then make it pass).
 * Boots the same Next dev server the repo already uses. No new test packages.
 */
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 3471;
const base = `http://127.0.0.1:${PORT}`;

let child: ChildProcess | undefined;
let log = "";

function remember(chunk: Buffer | string) {
  log += String(chunk);
  if (log.length > 24_000) log = log.slice(-24_000);
}

async function waitForReady() {
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    if (child?.exitCode != null) {
      throw new Error(`next dev exited ${child.exitCode}\n${log}`);
    }
    try {
      const res = await fetch(`${base}/privacy`, { redirect: "manual" });
      if (res.status === 200) {
        await res.text();
        return;
      }
      await res.text();
    } catch {
      // Server is still binding.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`next dev did not serve /privacy\n${log}`);
}

function stopServer() {
  if (!child?.pid || child.exitCode != null) return;
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

before(async () => {
  child = spawn(process.execPath, [join(root, "node_modules/next/dist/bin/next"), "dev", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: root,
    detached: true,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout?.on("data", remember);
  child.stderr?.on("data", remember);
  child.on("error", (error) => remember(String(error)));
  await waitForReady();
}, { timeout: 120_000 });

after(async () => {
  stopServer();
  if (child && child.exitCode == null) {
    await Promise.race([once(child, "exit"), new Promise((resolve) => setTimeout(resolve, 4_000))]);
    if (child.exitCode == null && child.pid) {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    }
  }
});

async function page(path: string) {
  const res = await fetch(`${base}${path}`, { redirect: "manual" });
  const html = await res.text();
  return { status: res.status, html };
}

describe("terms of use", { concurrency: false }, () => {
  test("/terms renders 200 with an h1", async () => {
    const res = await page("/terms");
    assert.equal(res.status, 200, res.html.slice(0, 180));
    assert.match(res.html, /<h1>Terms of use<\/h1>/);
    assert.match(res.html, /<title>Terms of use — HelpGetUp<\/title>/);
    assert.match(res.html, /rel="canonical" href="https:\/\/helpgetup\.com\/terms"/);
  });

  test("EN and ES versions both exist", async () => {
    const en = await page("/terms");
    const es = await page("/terms/es");
    assert.equal(en.status, 200);
    assert.equal(es.status, 200);
    assert.match(en.html, /<h1>Terms of use<\/h1>/);
    assert.match(en.html, /lang="en"/);
    assert.match(en.html, /href="\/terms\/es"/);
    assert.match(es.html, /<h1>Términos de uso<\/h1>/);
    assert.match(es.html, /lang="es"/);
    assert.match(es.html, /href="\/terms"/);
    assert.match(es.html, /<title>Términos de uso — HelpGetUp<\/title>/);
    assert.match(es.html, /rel="canonical" href="https:\/\/helpgetup\.com\/terms\/es"/);
  });

  test("footer on home and privacy links to /terms", async () => {
    for (const path of ["/", "/privacy"]) {
      const res = await page(path);
      assert.equal(res.status, 200, path);
      const footer = res.html.match(/<footer class="site-footer">[\s\S]*?<\/footer>/);
      assert.ok(footer, `${path} has a footer`);
      assert.match(footer[0], /href="\/privacy"/);
      assert.match(footer[0], /href="\/terms"/);
    }
  });

  test("sitemap includes /terms", async () => {
    const res = await page("/sitemap.xml");
    assert.equal(res.status, 200);
    assert.match(res.html, /<loc>https:\/\/helpgetup\.com\/terms<\/loc>/);
    assert.match(res.html, /<loc>https:\/\/helpgetup\.com\/terms\/es<\/loc>/);
  });

  test("page states the ground rules and has no placeholder copy", async () => {
    const en = await page("/terms");
    const es = await page("/terms/es");
    assert.equal(en.status, 200);
    assert.equal(es.status, 200);
    for (const html of [en.html, es.html]) {
      assert.match(html, /911/);
      assert.match(html, /988/);
      assert.match(html, /211/);
      assert.match(html, /Rosa/);
      assert.match(html, /href="\/privacy"/);
      assert.match(html, /hello@helpgetup\.com/);
      assert.doesNotMatch(html, /lorem ipsum|\bTODO\b|placeholder/i);
    }
    assert.match(en.html, /Rosa is an AI/);
    assert.match(en.html, /can make mistakes/);
    assert.match(en.html, /5 minutes/);
    assert.match(es.html, /Rosa es una inteligencia artificial/);
    assert.match(es.html, /puede equivocarse/);
    assert.match(es.html, /5 minutos/);
  });
});
