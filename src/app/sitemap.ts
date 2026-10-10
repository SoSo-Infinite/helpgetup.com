import type { MetadataRoute } from "next";
import { LIST_CHECKED_ON } from "@/data/albany-food";

// lastModified follows the data check date instead of a hard-coded day.
const modified = new Date(LIST_CHECKED_ON || "2026-10-09");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: "https://helpgetup.com/", lastModified: modified, changeFrequency: "weekly", priority: 1 },
    {
      url: "https://helpgetup.com/albany-food-list",
      lastModified: modified,
      changeFrequency: "weekly",
      priority: 0.8,
      alternates: { languages: { es: "https://helpgetup.com/albany-food-list/es" } },
    },
    {
      url: "https://helpgetup.com/albany-food-list/es",
      lastModified: modified,
      changeFrequency: "weekly",
      priority: 0.6,
      alternates: { languages: { en: "https://helpgetup.com/albany-food-list" } },
    },
  ];
}
