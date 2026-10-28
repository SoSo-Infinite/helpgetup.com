import type { Metadata } from "next";
import TermsPage, { termsMetadata } from "@/components/TermsPage";

/** English terms of use. Markup and copy live in src/components/TermsPage.tsx. */
export const metadata: Metadata = termsMetadata("en");

export default function TermsRoute() {
  return <TermsPage lang="en" />;
}
