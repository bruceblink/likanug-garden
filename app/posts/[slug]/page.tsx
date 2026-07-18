import { notFound } from 'next/navigation'
import { getPost } from '@/lib/notion'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  return <main className='shell article'>
    <a className='back' href='/'>cd ..</a>
    <div className='meta' style={{ marginTop: 24 }}><time dateTime={post.publishDate}>{post.publishDay}</time>{post.category && <span>{post.category}</span>}</div>
    <h1>{post.title}</h1>
    {post.summary && <p className='intro'>{post.summary}</p>}
    <div className='empty'>当前阶段保留了原 NotionNext 的数据库、视图、字段和配置表解析语义。文章正文渲染将在下一迁移切片中接入原有 record-map block 渲染器，而不改动你的 Notion 内容。</div>
  </main>
}
