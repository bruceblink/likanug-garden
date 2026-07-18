import { NotionAPI } from 'notion-client'
import { getDateValue, getTextContent, idToUuid } from 'notion-utils'
import { site } from './site'

type UnknownRecord = Record<string, unknown>

export type Post = {
  id: string
  title: string
  slug: string
  summary: string
  type: string
  status: string
  category: string | null
  tags: string[]
  publishDate: string
  publishDay: string
  href: string
}

export type BlogData = {
  posts: Post[]
  categories: Array<{ name: string; count: number }>
  tags: Array<{ name: string; count: number }>
}

const api = new NotionAPI({
  activeUser: site.activeUser || undefined,
  authToken: site.token || undefined,
  userTimeZone: 'Asia/Shanghai'
})

function readText(value: unknown): string {
  try {
    return getTextContent(value as never) || ''
  } catch {
    return ''
  }
}

function readSelect(value: unknown): string[] {
  const text = readText(value)
  return text ? text.split(',').map(item => item.trim()).filter(Boolean) : []
}

function propertyName(schema: UnknownRecord, key: string): string | null {
  const field = schema[key] as UnknownRecord | undefined
  return typeof field?.name === 'string' ? field.name : null
}

function formatPost(
  id: string,
  value: UnknownRecord,
  schema: UnknownRecord
): Post | null {
  const rawProperties = (value.properties ?? {}) as UnknownRecord
  const byName: Record<string, unknown> = {}
  for (const [key, property] of Object.entries(rawProperties)) {
    const name = propertyName(schema, key)
    if (name) byName[name] = property
  }

  const type = readSelect(byName[site.properties.type])[0] ?? ''
  const status = readSelect(byName[site.properties.status])[0] ?? ''
  const title = readText(byName[site.properties.title])
  const slug = readText(byName[site.properties.slug]) || id
  const date = getDateValue(byName[site.properties.date] as never)
  const created = typeof value.created_time === 'number' ? value.created_time : Date.now()
  const publish = new Date(date?.start_date ?? created)

  if (!title || type !== site.properties.postType || status !== site.properties.publishedStatus) {
    return null
  }

  return {
    id,
    title,
    slug,
    summary: readText(byName[site.properties.summary]),
    type,
    status,
    category: readSelect(byName[site.properties.category])[0] ?? null,
    tags: readSelect(byName[site.properties.tags]),
    publishDate: publish.toISOString(),
    publishDay: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(publish),
    href: `/posts/${encodeURIComponent(slug)}`
  }
}

function aggregate(posts: Post[]): Pick<BlogData, 'categories' | 'tags'> {
  const count = (items: string[]) => Array.from(new Set(items)).map(name => ({ name, count: items.filter(item => item === name).length })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    categories: count(posts.flatMap(post => post.category ? [post.category] : [])),
    tags: count(posts.flatMap(post => post.tags))
  }
}

async function readBlogData(): Promise<BlogData> {
  if (!site.pageId) return { posts: [], categories: [], tags: [] }

  const pageId = idToUuid(site.pageId.split(',')[0])
  const recordMap = await api.getPage(pageId)
  const blocks = recordMap.block as Record<string, { value?: UnknownRecord }>
  const collection = Object.values(recordMap.collection ?? {})[0] as { value?: UnknownRecord } | undefined
  const schema = (collection?.value?.schema ?? {}) as UnknownRecord
  const posts = Object.entries(blocks)
    .map(([id, block]) => block.value ? formatPost(id, block.value, schema) : null)
    .filter((post): post is Post => post !== null)
    .sort((a, b) => b.publishDate.localeCompare(a.publishDate))

  return { posts, ...aggregate(posts) }
}

export const getBlogData = async (): Promise<BlogData> => readBlogData()

export async function getPost(slug: string): Promise<Post | null> {
  const data = await getBlogData()
  return data.posts.find(post => post.slug === slug) ?? null
}
