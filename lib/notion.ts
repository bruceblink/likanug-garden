import { Client, isFullPage, isNotionClientError } from '@notionhq/client'
import { unstable_cache } from 'next/cache'
import { site } from './site'

type NotionProperty = Record<string, unknown>
type NotionPage = {
  id: string
  properties: Record<string, NotionProperty>
  created_time: string
  last_edited_time: string
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

function propertyText(property: NotionProperty): string {
  if (property.type === 'title') return plainText(property.title)
  if (property.type === 'rich_text') return plainText(property.rich_text)
  if (property.type === 'url') return String(property.url ?? '')
  if (property.type === 'email') return String(property.email ?? '')
  if (property.type === 'phone_number') return String(property.phone_number ?? '')
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
  if (property.type !== 'date') return null
  const date = property.date as { start?: string } | null
  return date?.start ?? null
}

function formatPost(page: NotionPage): Post | null {
  const type = propertySelect(property(page, site.properties.type))[0] ?? ''
  const status = propertySelect(property(page, site.properties.status))[0] ?? ''
  const title = propertyText(property(page, site.properties.title))
  const slug = propertyText(property(page, site.properties.slug)) || page.id
  const publishDate = propertyDate(property(page, site.properties.date)) ?? page.created_time

  if (
    !title ||
    type !== site.properties.postType ||
    status !== site.properties.publishedStatus
  ) {
    return null
  }

  const publish = new Date(publishDate)
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
    if (!('data_sources' in database) || database.data_sources.length === 0) {
      return emptyData('该 Notion 数据库没有可读取的数据源。')
    }

    const rows = await readAllPages(database.data_sources[0].id)
    const posts = rows
      .map(formatPost)
      .filter((post): post is Post => post !== null)
      .sort((a, b) => b.publishDate.localeCompare(a.publishDate))

    return { posts, ...aggregate(posts) }
  } catch (error) {
    console.error('Notion API read failed', error)
    return emptyData(messageFor(error))
  }
}

const getCachedBlogData = unstable_cache(
  readBlogData,
  ['notion-blog-data', site.pageId],
  { revalidate: site.revalidate }
)

export const getBlogData = async (): Promise<BlogData> => getCachedBlogData()

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
 * Fetches the complete Notion page as enhanced Markdown and fills in blocks
 * that the API reports as unknown (usually because a page is very large).
 */
async function readPostMarkdown(pageId: string): Promise<PostMarkdown> {
  const response = await api.pages.retrieveMarkdown({ page_id: pageId })
  let markdown = response.markdown

  if (response.unknown_block_ids.length > 0) {
    const nestedMarkdown = await Promise.all(
      response.unknown_block_ids.map(async blockId => {
        try {
          const blockResponse = await api.pages.retrieveMarkdown({ page_id: blockId })
          return blockResponse.markdown
        } catch (error) {
          // A missing permission should not make the rest of the article disappear.
          console.warn(`Unable to retrieve Notion block ${blockId}`, error)
          return ''
        }
      })
    )
    markdown = [markdown, ...nestedMarkdown].filter(Boolean).join('\n\n')
  }

  return {
    markdown,
    truncated: response.truncated,
    unknownBlockIds: response.unknown_block_ids.map(String)
  }
}

export async function getPostMarkdown(pageId: string): Promise<PostMarkdown> {
  return unstable_cache(
    () => readPostMarkdown(pageId),
    ['notion-post-markdown', pageId],
    { revalidate: site.revalidate }
  )()
}
