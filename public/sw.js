/* HelpGetUp offline support.
 * - Page loads: network first, fall back to the last saved copy when offline.
 * - Built assets (/_next/static, icons, logos): cache first; they are content-hashed or static.
 * - Never caches /api/* or anything cross-origin.
 * The food list lives inside the page bundle, so once the page has loaded once,
 * the whole walk (ZIP lookup, this week's times, Maps/calendar links) works offline.
 */
// Bump VERSION when the food list or page shell changes in a way old offline copies must not keep.
// activate deletes every other cache, so a bump drops old pages and assets.
const VERSION = "hgu-offline-v3";
// Content-hashed /_next/static files pile up across deploys under one VERSION; keep the newest N.
const MAX_ENTRIES = 120;
const SHELL = ["/", "/icon.svg", "/helpgetup-logo.png", "/helpgetup-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only the home page is saved as the offline copy. Other paths (future pages, redirects)
          // must not overwrite it.
          if (res.ok && url.pathname === "/" && !res.redirected) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() => caches.match("/").then((hit) => hit || Response.error())),
    );
    return;
  }

  const cacheable =
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|svg|ico|webmanifest|woff2?)$/.test(url.pathname) ||
    url.pathname === "/manifest.webmanifest";
  if (!cacheable) return;

  // Hashed build files never change: cache first. Icons, logos, manifest keep their names
  // across deploys: serve the saved copy but refresh it in the background (stale-while-revalidate),
  // so a changed file is picked up on the next visit instead of being pinned forever.
  const hashed = url.pathname.startsWith("/_next/static/");
  event.respondWith(
    caches.open(VERSION).then((cache) =>
      cache.match(req).then((hit) => {
        const refresh = () =>
          fetch(req).then((res) => {
            if (res.ok) {
              cache.put(req, res.clone()).then(() => trim(cache));
            }
            return res;
          });
        if (hit) {
          if (!hashed) event.waitUntil(refresh().catch(() => {}));
          return hit;
        }
        return refresh();
      }),
    ),
  );
});

function trim(cache) {
  return cache.keys().then((keys) => {
    const extra = keys.length - MAX_ENTRIES;
    if (extra <= 0) return;
    // Oldest entries first; never drop the saved home page.
    return Promise.all(
      keys
        .filter((k) => new URL(k.url).pathname !== "/")
        .slice(0, extra)
        .map((k) => cache.delete(k)),
    );
  });
}
