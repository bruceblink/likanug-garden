import assert from 'node:assert/strict'
import {createServer} from 'node:http'
import test from 'node:test'

test('reads and normalizes a published Notion page through the real client', async () => {
  const page = {
    object: 'page',
    id: 'page-1',
    url: 'https://www.notion.so/test-post',
    created_time: '2026-11-01T00:00:00.000Z',
    last_edited_time: '2026-11-02T00:00:00.000Z',
    properties: {
      type: {type: 'select', select: {name: 'Post'}},
      title: {type: 'title', title: [{plain_text: '测试文章'}]},
      status: {type: 'status', status: {name: 'Published'}},
      summary: {type: 'rich_text', rich_text: [{plain_text: '测试摘要'}]},
      slug: {type: 'rich_text', rich_text: [{plain_text: 'test-post'}]},
      category: {type: 'select', select: {name: '工程'}},
      date: {type: 'date', date: {start: '2026-11-01'}},
      tags: {type: 'multi_select', multi_select: [{name: 'Astro'}, {name: 'Cloudflare'}]}
    }
  }

  const server = createServer(async (request, response) => {
    for await (const _chunk of request) {
      // 消耗请求体，保持本地测试服务与真实 HTTP 请求的连接行为一致。
    }
    const path = new URL(request.url ?? '/', 'http://127.0.0.1').pathname
    response.setHeader('Content-Type', 'application/json')

    if (request.method === 'GET' && path === '/v1/databases/database-1') {
      response.end(JSON.stringify({object: 'database', id: 'database-1', data_sources: [{id: 'source-1'}]}))
      return
    }
    if (request.method === 'POST' && path === '/v1/data_sources/source-1/query') {
      response.end(JSON.stringify({object: 'list', results: [page], next_cursor: null, has_more: false}))
      return
    }
    if (request.method === 'GET' && path === '/v1/pages/page-1/markdown') {
      response.end(JSON.stringify({object: 'page_markdown', markdown: '# 测试文章\n\n正文', truncated: false, unknown_block_ids: []}))
      return
    }

    response.statusCode = 404
    response.end(JSON.stringify({object: 'error', code: 'object_not_found', message: 'not found'}))
  })

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  assert.ok(address && typeof address === 'object')

  const originalEnvironment = {
    NOTION_PAGE_ID: process.env.NOTION_PAGE_ID,
    NOTION_API_KEY: process.env.NOTION_API_KEY,
    NOTION_API_BASE_URL: process.env.NOTION_API_BASE_URL,
    REVALIDATE_SECONDS: process.env.REVALIDATE_SECONDS
  }
  process.env.NOTION_PAGE_ID = 'database-1'
  process.env.NOTION_API_KEY = 'test-secret'
  process.env.NOTION_API_BASE_URL = `http://127.0.0.1:${address.port}`
  process.env.REVALIDATE_SECONDS = '0'

  try {
    const {getBlogData, getPostMarkdown} = await import(`../lib/notion.ts?integration=${Date.now()}`)
    const data = await getBlogData()
    assert.equal(data.error, undefined)
    assert.equal(data.posts.length, 1)
    assert.equal(data.posts[0].title, '测试文章')
    assert.equal(data.posts[0].href, '/posts/test-post')
    assert.deepEqual(data.posts[0].tags, ['Astro', 'Cloudflare'])

    const markdown = await getPostMarkdown('page-1')
    assert.equal(markdown.truncated, false)
    assert.match(markdown.markdown, /正文/)
  } finally {
    for (const [name, value] of Object.entries(originalEnvironment)) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
    await new Promise(resolve => server.close(resolve))
  }
})
