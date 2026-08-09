import type {Metadata} from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: '页面不存在',
  robots: {index: false, follow: false}
}

export default function NotFound() {
  return <main id='main-content' className='shell error-shell' aria-labelledby='not-found-title'>
    <div className='empty error-panel'>
      <p className='eyebrow'>404</p>
      <h1 id='not-found-title'>页面不存在</h1>
      <p>这个地址没有对应的公开内容。</p>
      <Link className='back' href='/'>返回首页</Link>
    </div>
  </main>
}
