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
  images: {
    // local public assets only
  },
};

export default nextConfig;
