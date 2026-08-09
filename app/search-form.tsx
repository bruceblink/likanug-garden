'use client'

import {type FormEvent, type KeyboardEvent} from 'react'
import {useRouter} from 'next/navigation'

type SearchFormProps = {
  query: string
  category: string
  tag: string
}

// Builds the same filter URL for both the button and Enter-key submissions.
function searchHref(form: HTMLFormElement) {
  const params = new URLSearchParams()
  new FormData(form).forEach((value, key) => {
    if (typeof value !== 'string') return
    const normalized = value.trim()
    if (normalized) params.set(key, normalized)
  })
  const query = params.toString()
  return query ? `/?${query}#posts` : '/#posts'
}

export default function SearchForm({query, category, tag}: SearchFormProps) {
  const router = useRouter()

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    router.push(searchHref(event.currentTarget))
  }

  // Explicitly submit on Enter while leaving IME composition keystrokes alone.
  function handleSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
    event.preventDefault()
    event.currentTarget.form?.requestSubmit()
  }

  return <form className='search' action='/#posts' method='get' onSubmit={handleSubmit}>
    <label htmlFor='post-search'>搜索文章</label>
    <div className='search-control'>
      <input id='post-search' name='q' type='search' defaultValue={query} placeholder='输入标题、分类或标签' onKeyDown={handleSearchKeyDown} />
      {category && <input name='category' type='hidden' value={category} />}
      {tag && <input name='tag' type='hidden' value={tag} />}
      <button type='submit'>搜索</button>
    </div>
  </form>
}
