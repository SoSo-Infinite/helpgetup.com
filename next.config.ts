import type { NextConfig } from "next";
import path from "path";

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
