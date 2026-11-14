import type {APIRoute} from 'astro'
import {getBlogData} from '../../lib/notion'
import {baseUrl, site} from '../../lib/site'

const cacheControl = `public, s-maxage=${site.revalidate}, stale-while-revalidate=${site.revalidate * 12}`

// 只公开已发布文章的 Feed 字段，不把 Notion 凭据或原始响应返回给读者。
export const GET: APIRoute = async () => {
  const {posts, error} = await getBlogData()
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cacheControl,
    'Content-Type': 'application/feed+json; charset=utf-8'
  }

  if (error) {
    return new Response(JSON.stringify({error: 'The published post feed is temporarily unavailable.'}), {status: 503, headers})
  }

  return new Response(JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: site.name,
    home_page_url: baseUrl,
    feed_url: `${baseUrl}/feed.json`,
    description: site.description,
    items: posts.map(post => ({
      id: post.id,
      url: new URL(post.href, `${baseUrl}/`).toString(),
      title: post.title,
      summary: post.summary || undefined,
      content_text: post.summary || undefined,
      date_published: post.publishDate,
      date_modified: post.lastEditedDate,
      tags: [...(post.category ? [post.category] : []), ...post.tags]
    }))
  }), {headers})
}
