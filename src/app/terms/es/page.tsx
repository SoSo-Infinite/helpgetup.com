import type { Metadata } from "next";
import TermsPage, { termsMetadata } from "@/components/TermsPage";

/**
 * Spanish terms of use. Draft Spanish, marked for native review on the page.
 * Same rule as /albany-food-list/es.
 */
export const metadata: Metadata = termsMetadata("es");

export default function TermsEsRoute() {
  return <TermsPage lang="es" />;
}
