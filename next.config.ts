import type { NextConfig } from "next";
import path from "path";

// Enforcing CSP for a statically prerendered site. Next's bootstrap and the RSC
// payload are inline scripts, and next/image sets style attributes, so those two
// directives allow 'unsafe-inline'. A nonce policy would force dynamic rendering
// and drop the offline HTML cache. Origins in use (checked against the app and
// the live helpgetup.com document, Oct 25 2026):
// - pages, CSS, images, /_next/image, /api/*, service worker, AudioWorklet,
//   and production Vercel Web Analytics (/_vercel/insights script + beacons): 'self'
// - Rosa's browser voice socket: wss://api.x.ai (the xAI token call is server-side)
// - fonts: the system stack in globals.css; no remote font host
// - next dev only: React eval, and the analytics debug script on va.vercel-scripts.com
// upgrade-insecure-requests is omitted so `next start` on http://localhost still loads.
const isDev = process.env.NODE_ENV === "development";

const contentSecurityPolicy = [
  "default-src 'self'",
  [
    "script-src 'self' 'unsafe-inline'",
    isDev ? "'unsafe-eval' https://va.vercel-scripts.com" : "",
  ]
    .filter(Boolean)
    .join(" "),
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self' wss://api.x.ai",
  "worker-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
];

const nextConfig: NextConfig = {
  // Preview and QA open the dev server as 127.0.0.1 while it listens on 0.0.0.0.
  // Next 16 blocks those dev assets unless the hostname is allowed.
  allowedDevOrigins: [
    "127.0.0.1",
    "grok.com",
    "*.grok.com",
    "**.grok.com",
    "grok-sandbox.com",
    "*.grok-sandbox.com",
    "**.grok-sandbox.com",
  ],
  // The preview sandbox has another package-lock above this repo.
  turbopack: {
    root: path.join(__dirname),
  },
  async redirects() {
    return [
      {
        // Same as albanyaiguy.com: send the default Vercel host (not previews) to the real domain.
        source: "/:path*",
        has: [{ type: "host", value: "helpgetup-com.vercel.app" }],
        destination: "https://helpgetup.com/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // Later rule wins for the same header key. The worker only talks to this
        // origin, so keep its script policy tighter than the document CSP.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
  images: {
    // local public assets only
  },
};

export default nextConfig;
