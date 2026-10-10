import type { Metadata } from "next";
import { FoodList, listMetadata } from "@/components/FoodList";

/**
 * Spanish full list (draft Spanish, marked for native review on the page).
 * Place names, addresses, published hours and notes stay in English as the sources publish them.
 */
export const metadata: Metadata = listMetadata("es");

export default function FoodListEsPage() {
  return <FoodList lang="es" />;
}
