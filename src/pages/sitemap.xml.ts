import type {APIRoute} from 'astro'
import {getBlogData} from '../../lib/notion'
import {baseUrl, site} from '../../lib/site'

function escapeXml(value: string): string {
  return value.replace(/[<>&'\"]/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    "'": '&apos;',
    '"': '&quot;'
  })[character] ?? character)
}

// 只将已发布文章写入 Sitemap；Notion 暂时不可用时返回 503，避免发布不完整索引。
export const GET: APIRoute = async () => {
  const {posts, error} = await getBlogData()
  if (error) {
    return new Response('Sitemap temporarily unavailable.\n', {
      status: 503,
      headers: {'Content-Type': 'text/plain; charset=utf-8'}
    })
  }

  const urls = [
    `<url><loc>${escapeXml(baseUrl)}</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`,
    ...posts.map(post => `<url><loc>${escapeXml(new URL(post.href, `${baseUrl}/`).toString())}</loc><lastmod>${escapeXml(post.lastEditedDate)}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`)
  ].join('')
  const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>\n`

  return new Response(body, {
    headers: {
      'Cache-Control': `public, s-maxage=${site.revalidate}, stale-while-revalidate=${site.revalidate * 12}`,
      'Content-Type': 'application/xml; charset=utf-8'
    }
  })
}
