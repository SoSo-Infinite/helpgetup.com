import type { Metadata } from "next";
import { FoodList, listMetadata } from "@/components/FoodList";

/** English full list. Markup and copy live in src/components/FoodList.tsx (shared with /albany-food-list/es). */
export const metadata: Metadata = listMetadata("en");

export default function FoodListPage() {
  return <FoodList lang="en" />;
}
