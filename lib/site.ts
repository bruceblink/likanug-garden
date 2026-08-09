const env = process.env
const defaultSiteUrl = 'https://blog.likanug.top'
const mainSiteHosts = new Set(['likanug.top', 'www.likanug.top'])

// Normalize the public origin used by canonical and feed links, falling back when a preview value is invalid.
function publicSiteUrl(value: string | undefined): string {
  const candidate = value?.trim() || defaultSiteUrl

  try {
    const url = new URL(candidate)
    if (!['http:', 'https:'].includes(url.protocol)) return defaultSiteUrl
    // The blog is a separate deployment; a parent-site value would generate wrong feed and canonical URLs.
    if (mainSiteHosts.has(url.hostname.toLowerCase())) return defaultSiteUrl
    return url.origin
  } catch {
    return defaultSiteUrl
  }
}

const canonicalSiteUrl = publicSiteUrl(env.NEXT_PUBLIC_SITE_URL)

export const site = {
  // Published links use the configured blog origin and fall back to the canonical production host.
  url: canonicalSiteUrl,
  mainSiteUrl: 'https://likanug.top',
  name: 'Likanug // lab',
  description:
    env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Build quietly. Ship relentlessly. // 把好奇心编译成作品。',
  revalidate: Number(env.NEXT_PUBLIC_REVALIDATE_SECONDS ?? 300),
  // Keep the API version explicit because page Markdown is part of the newer Notion API surface.
  notionVersion: env.NOTION_API_VERSION ?? '2026-03-11',
  pageId: env.NOTION_PAGE_ID ?? '',
  apiKey: env.NOTION_API_KEY ?? '',
  properties: {
    type: env.NOTION_PROPERTY_TYPE ?? 'type',
    title: env.NOTION_PROPERTY_TITLE ?? 'title',
    status: env.NOTION_PROPERTY_STATUS ?? 'status',
    summary: env.NOTION_PROPERTY_SUMMARY ?? 'summary',
    slug: env.NOTION_PROPERTY_SLUG ?? 'slug',
    category: env.NOTION_PROPERTY_CATEGORY ?? 'category',
    date: env.NOTION_PROPERTY_DATE ?? 'date',
    tags: env.NOTION_PROPERTY_TAGS ?? 'tags',
    postType: env.NOTION_PROPERTY_TYPE_POST ?? 'Post',
    publishedStatus: env.NOTION_PROPERTY_STATUS_PUBLISH ?? 'Published'
  }
} as const

export const baseUrl = site.url.replace(/\/$/, '')
