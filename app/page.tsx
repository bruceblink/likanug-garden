import Link from 'next/link'
import { getBlogData } from '@/lib/notion'

export const revalidate = 300

export default async function HomePage() {
  const { posts, categories, tags } = await getBlogData()
  return <main className='shell' id='posts'>
    <div className='section-title'>// LATEST WRITES</div>
    {posts.length === 0 ? <div className='empty'>未读取到文章。请在 `.env.local` 设置原项目使用的 `NOTION_PAGE_ID`，并保留原有 `NOTION_TOKEN_V2` / `NOTION_ACTIVE_USER` 配置。新项目兼容原数据库字段和配置表结构。</div> : posts.map(post => <article className='post' key={post.id}>
      <div className='meta'><time dateTime={post.publishDate}>{post.publishDay}</time>{post.category && <span>{post.category}</span>}{post.tags.map(tag => <span className='tag' key={tag}>#{tag}</span>)}</div>
      <h2><Link href={post.href}>{post.title}</Link></h2>
      {post.summary && <p>{post.summary}</p>}
    </article>)}
    {(categories.length > 0 || tags.length > 0) && <section className='post'><div className='section-title'>// INDEX</div><p className='meta'>{categories.map(category => `${category.name} (${category.count})`).join('  /  ')}{tags.length > 0 && `  //  ${tags.map(tag => `#${tag.name}`).join(' ')}`}</p></section>}
  </main>
}
