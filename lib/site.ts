const env = process.env
const defaultSiteUrl = 'https://blog.likanug.top'
const mainSiteHosts = new Set(['likanug.top', 'www.likanug.top'])
const defaultRevalidateSeconds = 300
const notionMarkdownApiVersion = '2026-03-11'

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

// Keep cache headers and Notion's cache interval valid even when an environment value is malformed.
function revalidateSeconds(value: string | undefined): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0
    ? Math.floor(parsed)
    : defaultRevalidateSeconds
}

// Markdown v2 需要 2026-03-11 或更新的 Notion API；旧环境变量统一回退到当前支持版本。
function notionApiVersion(value: string | undefined): string {
  const candidate = value?.trim()
  if (candidate && candidate !== notionMarkdownApiVersion) {
    console.warn(`Unsupported NOTION_API_VERSION ${candidate}; using ${notionMarkdownApiVersion}`)
  }
  return notionMarkdownApiVersion
}

// 兼容旧的 Next.js 环境变量，同时支持 Astro 项目使用的 PUBLIC_* 命名。
const canonicalSiteUrl = publicSiteUrl(env.PUBLIC_SITE_URL ?? env.NEXT_PUBLIC_SITE_URL)

export const site = {
  // Published links use the configured blog origin and fall back to the canonical production host.
  url: canonicalSiteUrl,
  mainSiteUrl: 'https://likanug.top',
  name: 'Likanug // lab',
  description:
    env.PUBLIC_SITE_DESCRIPTION ??
    env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Build quietly. Ship relentlessly. // 把好奇心编译成作品。',
  revalidate: revalidateSeconds(env.REVALIDATE_SECONDS ?? env.NEXT_PUBLIC_REVALIDATE_SECONDS),
  // Keep the API version explicit because page Markdown is part of the newer Notion API surface.
  notionVersion: notionApiVersion(env.NOTION_API_VERSION),
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
