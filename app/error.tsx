'use client'

import Link from 'next/link'

type ErrorPageProps = {
  reset: () => void
}

// Give transient Notion or network failures a clear recovery path instead of a false 404.
export default function ErrorPage({ reset }: ErrorPageProps) {
  return <main className='shell error-shell'>
    <div className='empty'>
      文章暂时无法加载，请稍后再试。
      <div className='error-actions'>
        <button type='button' onClick={reset}>重新加载</button>
        <Link className='back' href='/#posts'>返回文章列表</Link>
      </div>
    </div>
  </main>
}
