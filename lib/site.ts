const env = process.env
const canonicalSiteUrl = 'https://blog.likanug.top'

export const site = {
  // Published links must stay on the blog host, even if a deployment inherits a parent-site URL.
  url: canonicalSiteUrl,
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
