import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getPost, getPostBlocks } from '@/lib/notion'
import { NotionBlocks } from '@/lib/notion-blocks'

export const dynamic = 'force-dynamic'

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const post = await getPost((await params).slug)
  if (!post) notFound()
  const blocks = await getPostBlocks(post.id)
  return <main className='shell article'>
    <Link className='back' href='/'>cd ..</Link>
    <div className='meta' style={{ marginTop: 24 }}><time dateTime={post.publishDate}>{post.publishDay}</time>{post.category && <span>{post.category}</span>}</div>
    <h1>{post.title}</h1>
    {post.summary && <p className='intro'>{post.summary}</p>}
    <NotionBlocks blocks={blocks} />
  </main>
}
