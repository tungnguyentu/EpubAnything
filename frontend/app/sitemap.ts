import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://epubanything.site",
      lastModified: "2026-05-22",
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: "https://epubanything.site/url-to-epub",
      lastModified: "2026-05-22",
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: "https://epubanything.site/send-to-kindle",
      lastModified: "2026-05-22",
      changeFrequency: "monthly",
      priority: 0.7,
    },
    {
      url: "https://epubanything.site/kobo",
      lastModified: "2026-05-22",
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ]
}
