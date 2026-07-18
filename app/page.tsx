import Link from 'next/link'
import { getBlogData } from '@/lib/notion'

export const revalidate = 300

export default async function HomePage() {
  const { posts, categories, tags, error } = await getBlogData()
  return <main className='shell' id='posts'>
    <div className='section-title'>{'// LATEST WRITES'}</div>
    {posts.length === 0 ? <div className='empty'>{error ?? '未读取到已发布文章。请检查数据库字段中的 type=Post 与 status=Published。'}</div> : posts.map(post => <article className='post' key={post.id}>
      <div className='meta'><time dateTime={post.publishDate}>{post.publishDay}</time>{post.category && <span>{post.category}</span>}{post.tags.map(tag => <span className='tag' key={tag}>#{tag}</span>)}</div>
      <h2><Link href={post.href}>{post.title}</Link></h2>
      {post.summary && <p>{post.summary}</p>}
    </article>)}
    {(categories.length > 0 || tags.length > 0) && <section className='post'><div className='section-title'>{'// INDEX'}</div><p className='meta'>{categories.map(category => `${category.name} (${category.count})`).join('  /  ')}{tags.length > 0 && `  //  ${tags.map(tag => `#${tag.name}`).join(' ')}`}</p></section>}
  </main>
}
