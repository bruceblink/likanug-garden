import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPostLookup, getPostMarkdown } from '@/lib/notion'
import { NotionMarkdown } from '@/lib/notion-markdown'
import { site } from '@/lib/site'

export const dynamic = 'force-dynamic'

type PostPageProps = {
  params: Promise<{ slug: string }>
}

// Derive per-article metadata from the same published record used by the page.
export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { slug } = await params
  const { post, error } = await getPostLookup(slug)

  if (!post) {
    return {
      title: error ? '文章暂时不可用' : '文章不存在',
      robots: { index: false, follow: false }
    }
  }

  const canonicalPath = `/posts/${encodeURIComponent(post.slug)}`
  const description = post.summary || site.description

  return {
    title: post.title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      type: 'article',
      url: canonicalPath,
      siteName: site.name,
      title: post.title,
      description,
      publishedTime: post.publishDate,
      tags: post.tags
    },
    twitter: {
      card: 'summary',
      title: post.title,
      description
    }
  }
}

// Loads the database metadata first, then renders the complete page Markdown from Notion.
export default async function PostPage({ params }: PostPageProps) {
  const { slug } = await params
  const { post, error } = await getPostLookup(slug)
  if (error) throw new Error('Published posts are temporarily unavailable.')
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
