import type {APIRoute} from 'astro'
import {baseUrl} from '../../lib/site'

// robots.txt 不读取 Notion，只发布公开抓取规则和 Sitemap 地址。
export const GET: APIRoute = () => new Response(
  `User-agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`,
  {headers: {'Content-Type': 'text/plain; charset=utf-8'}}
)
