import type { MetadataRoute } from 'next'
import { getBlogData } from '@/lib/notion'
import { baseUrl } from '@/lib/site'

export const dynamic = 'force-dynamic'

// Reuse the published-post query so drafts and Notion-only entries never enter the sitemap.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { posts } = await getBlogData()

  return [
    { url: baseUrl, changeFrequency: 'weekly', priority: 1 },
    ...posts.map(post => ({
      url: new URL(post.href, `${baseUrl}/`).toString(),
      changeFrequency: 'monthly' as const,
      priority: 0.7
    }))
  ]
}
