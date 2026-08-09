'use client'

import Link from 'next/link'

type ErrorPageProps = {
  reset: () => void
}

// Give transient Notion or network failures a clear recovery path instead of a false 404.
export default function ErrorPage({ reset }: ErrorPageProps) {
  return <main id='main-content' className='shell error-shell' role='alert' aria-labelledby='error-title'>
    <div className='empty error-panel'>
      <p className='eyebrow'>暂时不可用</p>
      <h1 id='error-title'>文章暂时无法加载</h1>
      <p>请稍后再试，或者返回文章列表继续浏览。</p>
      <div className='error-actions'>
        <button type='button' onClick={reset}>重新加载</button>
        <Link className='back' href='/#posts'>返回文章列表</Link>
      </div>
    </div>
  </main>
}
