import { NextResponse } from 'next/server'
import { getBlogData } from '@/lib/notion'
import { baseUrl, site } from '@/lib/site'

export const dynamic = 'force-dynamic'

const cacheControl = `public, s-maxage=${site.revalidate}, stale-while-revalidate=${site.revalidate * 12}`

// Publish only the already-filtered public fields so other surfaces can list posts without Notion credentials.
export async function GET() {
  const { posts, error } = await getBlogData()
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': cacheControl,
    'Content-Type': 'application/feed+json; charset=utf-8'
  }

  if (error) {
    return NextResponse.json({ error: 'The published post feed is temporarily unavailable.' }, { status: 503, headers })
  }

  return NextResponse.json({
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
      content_text: post.summary || post.title,
      date_published: post.publishDate,
      tags: [...(post.category ? [post.category] : []), ...post.tags]
    }))
  }, { headers })
}
