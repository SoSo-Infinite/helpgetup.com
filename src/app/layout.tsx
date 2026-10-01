import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HelpGetUp — Take the next step.",
  description:
    "Stuck on food in Albany County? Start with one clear next step — a sourced pantry or meal this week, or the official SNAP path. You decide whether to take it.",
  metadataBase: new URL("https://helpgetup.com"),
  openGraph: {
    title: "HelpGetUp — Take the next step.",
    description:
      "Early access waitlist for an assistant that helps you move from stuck to a clear next action.",
    url: "https://helpgetup.com",
    siteName: "HelpGetUp",
    images: [{ url: "/helpgetup-logo.png", width: 1200, height: 1200, alt: "HelpGetUp" }],
    type: "website",
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
