import Link from 'next/link'
import { type Post, getBlogData } from '@/lib/notion'

export const revalidate = 300
const POSTS_PER_PAGE = 8

type SearchParams = Promise<{
  page?: string
  category?: string
  tag?: string
  q?: string
}>

function href(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `/?${query}#posts` : '/#posts'
}

function matches(post: Post, category: string, tag: string, query: string) {
  const haystack = `${post.title} ${post.summary} ${post.category ?? ''} ${post.tags.join(' ')}`.toLocaleLowerCase()
  return (!category || post.category === category) && (!tag || post.tags.includes(tag)) && (!query || haystack.includes(query.toLocaleLowerCase()))
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const { page: rawPage, category = '', tag = '', q = '' } = await searchParams
  const { posts, categories, tags, error } = await getBlogData()
  const filtered = posts.filter(post => matches(post, category, tag, q))
  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE))
  const page = Math.min(Math.max(Number(rawPage) || 1, 1), totalPages)
  const visiblePosts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)
  const filterParams = { category, tag, q }
  return <main className='shell' id='posts'>
    <div className='section-title'>{'// LATEST WRITES'}</div>
    <form className='search' action='/' method='get'>
      <input aria-label='搜索文章' name='q' defaultValue={q} placeholder='search posts' />
      {category && <input name='category' type='hidden' value={category} />}
      {tag && <input name='tag' type='hidden' value={tag} />}
      <button type='submit'>search</button>
    </form>
    {(category || tag || q) && <div className='filters'><span>{'// FILTER'}</span>{category && <span>category:{category}</span>}{tag && <span>tag:#{tag}</span>}{q && <span>query:{q}</span>}<Link href='/#posts'>clear</Link></div>}
    {visiblePosts.length === 0 ? <div className='empty'>{error ?? '没有匹配的已发布文章。'}</div> : visiblePosts.map(post => <article className='post' key={post.id}>
      <div className='meta'><time dateTime={post.publishDate}>{post.publishDay}</time>{post.category && <Link href={href({ tag, q, category: post.category })}>{post.category}</Link>}{post.tags.map(postTag => <Link className='tag' href={href({ category, q, tag: postTag })} key={postTag}>#{postTag}</Link>)}</div>
      <h2><Link href={post.href}>{post.title}</Link></h2>
      {post.summary && <p>{post.summary}</p>}
    </article>)}
    {filtered.length > POSTS_PER_PAGE && <nav className='pager' aria-label='文章分页'>{page > 1 && <Link href={href({ ...filterParams, page: page - 1 })}>prev</Link>}<span>{page} / {totalPages}</span>{page < totalPages && <Link href={href({ ...filterParams, page: page + 1 })}>next</Link>}</nav>}
    {(categories.length > 0 || tags.length > 0) && <section className='post'><div className='section-title'>{'// INDEX'}</div><div className='index-links'>{categories.map(item => <Link href={href({ tag, q, category: item.name })} key={item.name}>{item.name} ({item.count})</Link>)}{tags.map(item => <Link className='tag' href={href({ category, q, tag: item.name })} key={item.name}>#{item.name}</Link>)}</div></section>}
  </main>
}
