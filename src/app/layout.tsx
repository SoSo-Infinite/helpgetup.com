import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HelpGetUp — Take the next step.",
  description:
    "Stuck on food in Albany County? Start with one clear next step — a sourced pantry or meal this week, or the official SNAP path. You decide whether to take it.",
  metadataBase: new URL("https://helpgetup.com"),
  alternates: { canonical: "/" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "HelpGetUp — Take the next step.",
    description:
      "Stuck on food in Albany County? One clear next step: a sourced pantry or meal this week, or the official SNAP path.",
    url: "https://helpgetup.com",
    siteName: "HelpGetUp",
    images: [{ url: "/helpgetup-logo.png", width: 1200, height: 1200, alt: "HelpGetUp" }],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HelpGetUp — Take the next step.",
    description:
      "Stuck on food in Albany County? One clear next step: a sourced pantry or meal this week, or the official SNAP path.",
    images: ["/helpgetup-logo.png"],
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "HelpGetUp",
  url: "https://helpgetup.com/",
  description:
    "A free guide to one clear next step for food in Albany County, NY: sourced pantries and meals this week, or the official SNAP path.",
  inLanguage: "en-US",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
