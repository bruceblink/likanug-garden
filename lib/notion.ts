import { Client, isFullPage, isNotionClientError } from '@notionhq/client'
import { site } from './site'

type NotionProperty = Record<string, unknown>
type NotionPage = {
  id: string
  properties: Record<string, NotionProperty>
  created_time: string
  last_edited_time: string
}

type PageMarkdownResponse = {
  markdown: string
  truncated: boolean
  unknown_block_ids: string[]
}

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
  lastEditedDate: string
  publishDay: string
  href: string
}

export type BlogData = {
  posts: Post[]
  categories: Array<{ name: string; count: number }>
  tags: Array<{ name: string; count: number }>
  error?: string
}

export type PostLookup = {
  post: Post | null
  error?: string
}

const emptyData = (error?: string): BlogData => ({
  posts: [],
  categories: [],
  tags: [],
  error
})

const api = new Client({ auth: site.apiKey, notionVersion: site.notionVersion })

function plainText(items: unknown): string {
  if (!Array.isArray(items)) return ''
  return items
    .map(item => {
      if (item && typeof item === 'object' && 'plain_text' in item) {
        return String(item.plain_text ?? '')
      }
      return ''
    })
    .join('')
}

function property(page: NotionPage, name: string): NotionProperty {
  return page.properties[name] ?? {}
}

// 读取 formula、rollup 等复合属性的公开文本值，保持字段配置变化时的兼容性。
function nestedPropertyText(value: unknown): string {
  if (!value || typeof value !== 'object') return value == null ? '' : String(value)
  const nested = value as NotionProperty
  if (nested.type === 'array' && Array.isArray(nested.array)) {
    return nested.array.map(nestedPropertyText).filter(Boolean).join(',')
  }
  if (nested.type === 'title') return plainText(nested.title)
  if (nested.type === 'rich_text') return plainText(nested.rich_text)
  if (nested.type === 'string') return String(nested.string ?? '')
  if (nested.type === 'number') return String(nested.number ?? '')
  if (nested.type === 'boolean') return nested.boolean ? 'true' : 'false'
  if (nested.type === 'date') return String((nested.date as {start?: string} | null)?.start ?? '')
  return ''
}

function propertyText(property: NotionProperty): string {
  if (property.type === 'title') return plainText(property.title)
  if (property.type === 'rich_text') return plainText(property.rich_text)
  if (property.type === 'url') return String(property.url ?? '')
  if (property.type === 'email') return String(property.email ?? '')
  if (property.type === 'phone_number') return String(property.phone_number ?? '')
  if (property.type === 'number') return String(property.number ?? '')
  if (property.type === 'checkbox') return property.checkbox ? 'true' : 'false'
  if (property.type === 'formula') return nestedPropertyText(property.formula)
  if (property.type === 'rollup') return nestedPropertyText(property.rollup)
  return ''
}

function propertySelect(property: NotionProperty): string[] {
  if (property.type === 'select' || property.type === 'status') {
    const option = property[property.type] as { name?: string } | null
    return option?.name ? [option.name] : []
  }
  if (property.type === 'multi_select') {
    const options = property.multi_select as Array<{ name?: string }> | undefined
    return options?.flatMap(option => (option.name ? [option.name] : [])) ?? []
  }
  return propertyText(property)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
}

function propertyDate(property: NotionProperty): string | null {
  const dateValue = property.type === 'date'
    ? property.date
    : property.type === 'formula' && (property.formula as NotionProperty | null)?.type === 'date'
      ? (property.formula as NotionProperty).date
      : property.type === 'rollup' && (property.rollup as NotionProperty | null)?.type === 'date'
        ? (property.rollup as NotionProperty).date
        : null
  if (!dateValue) return null
  const date = dateValue as { start?: string } | null
  return date?.start ?? null
}

// 先使用发布日期；日期无效时回退到页面创建时间，避免一条坏记录清空整个文章列表。
function validPublishDate(value: string | null, fallback: string): Date | null {
  for (const candidate of [value, fallback]) {
    if (!candidate) continue
    const date = new Date(candidate)
    if (!Number.isNaN(date.getTime())) return date
  }
  return null
}

function formatPost(page: NotionPage): Post | null {
  const type = propertySelect(property(page, site.properties.type))[0] ?? ''
  const status = propertySelect(property(page, site.properties.status))[0] ?? ''
  const title = propertyText(property(page, site.properties.title))
  const slug = propertyText(property(page, site.properties.slug)) || page.id
  const publish = validPublishDate(
    propertyDate(property(page, site.properties.date)),
    page.created_time
  )

  if (
    !title ||
    type !== site.properties.postType ||
    status !== site.properties.publishedStatus
  ) {
    return null
  }

  if (!publish) {
    console.warn('Skipping Notion post with invalid publish date', page.id)
    return null
  }

  const lastEdited = validPublishDate(page.last_edited_time, publish.toISOString()) ?? publish

  return {
    id: page.id,
    title,
    slug,
    summary: propertyText(property(page, site.properties.summary)),
    type,
    status,
    category: propertySelect(property(page, site.properties.category))[0] ?? null,
    tags: propertySelect(property(page, site.properties.tags)),
    publishDate: publish.toISOString(),
    lastEditedDate: lastEdited.toISOString(),
    publishDay: new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(
      publish
    ),
    href: `/posts/${encodeURIComponent(slug)}`
  }
}

function aggregate(posts: Post[]): Pick<BlogData, 'categories' | 'tags'> {
  const count = (items: string[]) =>
    Array.from(new Set(items))
      .map(name => ({ name, count: items.filter(item => item === name).length }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    categories: count(posts.flatMap(post => (post.category ? [post.category] : []))),
    tags: count(posts.flatMap(post => post.tags))
  }
}

// 重复 slug 通过页面 ID 后缀区分，避免两个已发布页面共用同一个公开 URL。
function deduplicateSlugs(posts: Post[]): Post[] {
  const used = new Set<string>()
  return posts.map(post => {
    let slug = post.slug
    if (used.has(slug)) {
      const suffix = post.id.replaceAll('-', '').slice(0, 8)
      slug = `${post.slug}-${suffix}`
      let serial = 2
      while (used.has(slug)) slug = `${post.slug}-${suffix}-${serial++}`
    }
    used.add(slug)
    return slug === post.slug
      ? post
      : {...post, slug, href: `/posts/${encodeURIComponent(slug)}`}
  })
}

async function readAllPages(dataSourceId: string): Promise<NotionPage[]> {
  const pages: NotionPage[] = []
  let start_cursor: string | null | undefined
  do {
    const response = await api.dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor,
      result_type: 'page'
    })
    if (response.request_status?.type === 'incomplete') {
      throw new Error('Notion data source query returned incomplete results.')
    }
    pages.push(
      ...response.results.filter(isFullPage).map(page => ({
        id: page.id,
        properties: page.properties,
        created_time: page.created_time,
        last_edited_time: page.last_edited_time
      }))
    )
    start_cursor = response.has_more ? response.next_cursor : null
  } while (start_cursor)
  return pages
}

function messageFor(error: unknown): string {
  if (error instanceof Error && error.message === 'Notion data source query returned incomplete results.') {
    return 'Notion 数据源结果不完整，文章列表未发布。请缩小数据源范围后重试。'
  }
  if (isNotionClientError(error)) {
    if (error.code === 'object_not_found') {
      return 'Integration 无法访问此数据库。请在 Notion 数据库右上角 ... > Connections 中添加 likanug Integration。'
    }
    if (error.code === 'unauthorized') {
      return 'NOTION_API_KEY 无效。请在 .env.local 中填入 Internal Integration Secret。'
    }
    return `Notion API 请求失败：${error.message}`
  }
  return 'Notion API 请求失败，请检查网络和 Integration 授权。'
}

async function readBlogData(): Promise<BlogData> {
  if (!site.pageId) return emptyData('未配置 NOTION_PAGE_ID。')
  if (!site.apiKey) return emptyData('未配置 NOTION_API_KEY。请创建并授权 Notion Integration。')

  try {
    const database = await api.databases.retrieve({
      database_id: site.pageId
    })
    if (!('data_sources' in database)) {
      return emptyData('Integration 无法读取该 Notion 数据库的数据源。请检查页面访问权限。')
    }
    if (database.data_sources.length === 0) {
      return emptyData('该 Notion 数据库没有可读取的数据源。')
    }

    const rows = (await Promise.all(
      database.data_sources.map(dataSource => readAllPages(dataSource.id))
    )).flat()
    const uniqueRows = Array.from(new Map(rows.map(row => [row.id, row])).values())
    const posts = deduplicateSlugs(uniqueRows
      .map(formatPost)
      .filter((post): post is Post => post !== null)
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate) || a.id.localeCompare(b.id)))

    return { posts, ...aggregate(posts) }
  } catch (error) {
    console.error('Notion API read failed', error)
    return emptyData(messageFor(error))
  }
}

type CacheEntry<T> = {
  value: T
  expiresAt: number
}

let blogDataCache: CacheEntry<BlogData> | undefined
let blogDataRequest: Promise<BlogData> | undefined
const postMarkdownCache = new Map<string, CacheEntry<PostMarkdown>>()
const postMarkdownRequests = new Map<string, Promise<PostMarkdown>>()

// 通过模块级缓存合并同一 Worker 实例中的请求，避免依赖 Next.js 专用缓存。
function cacheIsFresh<T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> {
  return site.revalidate > 0 && Boolean(entry && entry.expiresAt > Date.now())
}

function cacheExpiry(): number {
  return Date.now() + site.revalidate * 1000
}

export async function getBlogData(): Promise<BlogData> {
  if (cacheIsFresh(blogDataCache)) return blogDataCache.value
  if (blogDataRequest) return blogDataRequest

  // 只缓存成功快照；失败结果立即返回，避免暂时故障占满整个刷新周期。
  blogDataRequest = readBlogData()
    .then(data => {
      if (!data.error && site.revalidate > 0) {
        blogDataCache = {value: data, expiresAt: cacheExpiry()}
      }
      return data
    })
    .catch(error => emptyData(error instanceof Error ? error.message : 'Notion API 请求失败，请检查网络和 Integration 授权。'))
    .finally(() => {
      blogDataRequest = undefined
    })

  return blogDataRequest
}

// Keep a temporary source failure distinct from a genuinely missing public article.
export async function getPostLookup(slug: string): Promise<PostLookup> {
  const { posts, error } = await getBlogData()
  return { post: posts.find(post => post.slug === slug) ?? null, error }
}

export async function getPost(slug: string): Promise<Post | null> {
  return (await getPostLookup(slug)).post
}

export type PostMarkdown = {
  markdown: string
  truncated: boolean
  unknownBlockIds: string[]
}

/**
 * Fetches the complete Notion page as Notion-flavored Markdown and fills in
 * blocks that the API reports as unknown.
 */
async function readPostMarkdown(pageId: string): Promise<PostMarkdown> {
  const responses = new Map<string, PageMarkdownResponse>()
  const pending = [pageId]
  let truncated = false

  // 使用 v2，确保块之间有明确空行，并使用稳定的 Notion-flavored Markdown。
  while (pending.length > 0) {
    const currentId = pending.shift() as string
    if (responses.has(currentId)) continue

    try {
      const response = await api.pages.retrieveMarkdown({
        page_id: currentId,
        markdown_version: 'v2'
      })
      const normalizedResponse: PageMarkdownResponse = {
        markdown: response.markdown,
        truncated: response.truncated,
        unknown_block_ids: response.unknown_block_ids.map(String)
      }
      responses.set(currentId, normalizedResponse)
      truncated ||= normalizedResponse.truncated
      pending.push(...normalizedResponse.unknown_block_ids)
    } catch (error) {
      // 权限不足的未知块保留原占位符，不让整篇文章消失。
      console.warn(`Unable to retrieve Notion block ${currentId}`, error)
    }
  }

  const unresolved = new Set<string>()
  const resolveMarkdown = (response: PageMarkdownResponse, ancestors: Set<string>): string => {
    const markerPattern = /<unknown\b[^>]*(?:\/>|>[\s\S]*?<\/unknown>)/gi
    return response.markdown.replace(markerPattern, marker => {
      const url = marker.match(/\burl\s*=\s*["']([^"']+)["']/i)?.[1]
      const markerId = url?.split('#').pop()
      const childId = response.unknown_block_ids.find(id => id === markerId || url?.includes(id))
      if (!childId || ancestors.has(childId)) {
        if (childId) unresolved.add(childId)
        return marker
      }

      const child = responses.get(childId)
      if (!child) {
        unresolved.add(childId)
        return marker
      }

      truncated ||= child.truncated
      const nextAncestors = new Set(ancestors)
      nextAncestors.add(childId)
      return resolveMarkdown(child, nextAncestors)
    })
  }

  const root = responses.get(pageId)
  if (!root) throw new Error('Unable to retrieve Notion page Markdown.')

  return {
    markdown: resolveMarkdown(root, new Set([pageId])),
    truncated,
    unknownBlockIds: [...unresolved]
  }
}

export async function getPostMarkdown(pageId: string): Promise<PostMarkdown> {
  const cached = postMarkdownCache.get(pageId)
  if (cacheIsFresh(cached)) return cached.value

  const existing = postMarkdownRequests.get(pageId)
  if (existing) return existing

  // 文章正文按页面 ID 缓存，并合并并发读取，避免重复请求 Notion Markdown 接口。
  const request = readPostMarkdown(pageId)
    .then(markdown => {
      if (site.revalidate > 0) {
        postMarkdownCache.set(pageId, {value: markdown, expiresAt: cacheExpiry()})
      }
      return markdown
    })
    .finally(() => {
      postMarkdownRequests.delete(pageId)
    })
  postMarkdownRequests.set(pageId, request)
  return request
}
