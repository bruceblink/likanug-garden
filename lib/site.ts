const env = process.env

export const site = {
  url: env.NEXT_PUBLIC_SITE_URL ?? 'https://likanug.top',
  name: env.NEXT_PUBLIC_SITE_NAME ?? 'likanug',
  description:
    env.NEXT_PUBLIC_SITE_DESCRIPTION ??
    'Build quietly. Ship relentlessly. // 把好奇心编译成作品。',
  revalidate: Number(env.NEXT_PUBLIC_REVALIDATE_SECONDS ?? 300),
  pageId: env.NOTION_PAGE_ID ?? '',
  token: env.NOTION_TOKEN_V2 ?? '',
  activeUser: env.NOTION_ACTIVE_USER ?? '',
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
