import Link from 'next/link'
import {type Post, getBlogData} from '@/lib/notion'
import SearchForm from './search-form'

// Render filters and the cached Notion snapshot on demand; the data layer owns the refresh interval.
export const dynamic = 'force-dynamic'
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
    if (value !== undefined && value !== '') search.set(key, String(value))
  }
  const query = search.toString()
  return query ? `/?${query}#posts` : '/#posts'
}

function matches(post: Post, category: string, tag: string, query: string) {
  const haystack = `${post.title} ${post.summary} ${post.category ?? ''} ${post.tags.join(' ')}`.toLocaleLowerCase()
  return (!category || post.category === category) && (!tag || post.tags.includes(tag)) && (!query || haystack.includes(query.toLocaleLowerCase()))
}

function pageNumber(value?: string): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1
}

function PostMeta({post}: {post: Post}) {
  return <div className='post-meta'>
    <time dateTime={post.publishDate}>{post.publishDay}</time>
    {post.category && <span>{post.category}</span>}
  </div>
}

function PostTags({post, category, query}: {post: Post; category: string; query: string}) {
  if (post.tags.length === 0) return null
  return <div className='post-tags'>
    {post.tags.slice(0, 3).map(postTag => <Link href={href({category, q: query, tag: postTag})} key={postTag}>#{postTag}</Link>)}
  </div>
}

export default async function HomePage({searchParams}: {searchParams: SearchParams}) {
  const {page: rawPage, category = '', tag = '', q = ''} = await searchParams
  const {posts, categories, tags, error} = await getBlogData()
  const filtered = posts.filter(post => matches(post, category, tag, q))
  const totalPages = Math.max(1, Math.ceil(filtered.length / POSTS_PER_PAGE))
  const page = Math.min(pageNumber(rawPage), totalPages)
  const visiblePosts = filtered.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE)
  const hasFilters = Boolean(category || tag || q)
  const featuredPost = !hasFilters && page === 1 ? visiblePosts[0] : undefined
  const listedPosts = featuredPost ? visiblePosts.slice(1) : visiblePosts
  const filterParams = {category, tag, q}

  return <main id='main-content'>
    <section className='shell home-intro' aria-labelledby='home-title'>
      <p className='eyebrow'>个人博客</p>
      <h1 id='home-title'>把正在理解的事，写成可以回访的记录。</h1>
      <p className='home-description'>关于软件、系统设计与持续学习。文章由 Notion 写作并在这里发布。</p>
      <p className='home-count'>目前已发布 {posts.length} 篇文章。</p>
    </section>

    {featuredPost && <section className='shell featured-section' aria-labelledby='featured-title'>
      <div className='section-heading'>
        <div>
          <p className='eyebrow'>最新发布</p>
          <h2 id='featured-title'>从这里开始读</h2>
        </div>
      </div>
      <article className='featured-post'>
        <PostMeta post={featuredPost} />
        <div className='featured-copy'>
          <h3><Link href={featuredPost.href}>{featuredPost.title}</Link></h3>
          {featuredPost.summary && <p>{featuredPost.summary}</p>}
          <PostTags post={featuredPost} category={category} query={q} />
          <Link className='read-link' href={featuredPost.href}>阅读全文</Link>
        </div>
      </article>
    </section>}

    <section className='shell post-section' id='posts' aria-labelledby='posts-title'>
      <div className='section-heading post-section-heading'>
        <div>
          <p className='eyebrow'>{hasFilters ? '筛选结果' : '文章列表'}</p>
          <h2 id='posts-title'>{hasFilters ? '找到的文章' : '最近文章'}</h2>
        </div>
        <p className='result-count' aria-live='polite'>共 {filtered.length} 篇</p>
      </div>

      <SearchForm query={q} category={category} tag={tag} />

      {categories.length > 0 && <nav className='category-list' aria-label='按分类筛选'>
        <span>分类</span>
        <Link aria-current={!category ? 'page' : undefined} className={!category ? 'is-active' : undefined} href={href({tag, q})}>全部</Link>
        {categories.map(item => <Link aria-current={category === item.name ? 'page' : undefined} className={category === item.name ? 'is-active' : undefined} href={href({tag, q, category: item.name})} key={item.name}>{item.name} <small>{item.count}</small></Link>)}
      </nav>}

      {hasFilters && <div className='active-filters'>
        <span>当前筛选</span>
        {category && <span>分类：{category}</span>}
        {tag && <span>标签：#{tag}</span>}
        {q && <span>关键词：{q}</span>}
        <Link href='/#posts'>清除筛选</Link>
      </div>}

      {listedPosts.length === 0 ? <div className='empty'>{error ?? '没有匹配的已发布文章。'}</div> : <div className='post-list'>
        {listedPosts.map(post => <article className='post-row' key={post.id}>
          <PostMeta post={post} />
          <div className='post-copy'>
            <h3><Link href={post.href}>{post.title}</Link></h3>
            {post.summary && <p>{post.summary}</p>}
          </div>
          <PostTags post={post} category={category} query={q} />
        </article>)}
      </div>}

      {filtered.length > POSTS_PER_PAGE && <nav className='pager' aria-label='文章分页'>
        {page > 1 && <Link href={href({...filterParams, page: page - 1})}>上一页</Link>}
        <span>第 {page} / {totalPages} 页</span>
        {page < totalPages && <Link href={href({...filterParams, page: page + 1})}>下一页</Link>}
      </nav>}
    </section>

    {(categories.length > 0 || tags.length > 0) && <section className='shell topic-section' id='topics' aria-labelledby='topics-title'>
      <p className='eyebrow'>主题索引</p>
      <h2 id='topics-title'>按主题浏览</h2>
      <details className='topic-details'>
        <summary>展开全部标签</summary>
        <div className='topic-links'>
          {tags.map(item => <Link href={href({category, q, tag: item.name})} key={item.name}>#{item.name} <small>{item.count}</small></Link>)}
        </div>
      </details>
    </section>}
  </main>
}
