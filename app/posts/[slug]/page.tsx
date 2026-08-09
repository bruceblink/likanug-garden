import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPost, getPostMarkdown } from '@/lib/notion'
import { NotionMarkdown } from '@/lib/notion-markdown'

export const dynamic = 'force-dynamic'

// Loads the database metadata first, then renders the complete page Markdown from Notion.
export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  const content = await getPostMarkdown(post.id)
  return <main className='shell article-shell'>
    <Link className='back' href='/#posts'>返回文章列表</Link>
    <article>
      <header className='article-header'>
        <p className='eyebrow'>文章</p>
        <div className='article-meta'>
          <time dateTime={post.publishDate}>{post.publishDay}</time>
          {post.category && <span>{post.category}</span>}
        </div>
        <h1>{post.title}</h1>
        {post.summary && <p className='article-summary'>{post.summary}</p>}
        {post.tags.length > 0 && <div className='article-tags'>{post.tags.map(tag => <Link href={`/?tag=${encodeURIComponent(tag)}#posts`} key={tag}>#{tag}</Link>)}</div>}
      </header>
      {content.truncated && <p className='notion-warning'>部分内容超过 Notion API 单页读取上限，已尽力加载可访问内容。</p>}
      <div className='notion-content'>
        <NotionMarkdown markdown={content.markdown} title={post.title} />
      </div>
    </article>
  </main>
}
