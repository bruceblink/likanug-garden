import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'
import 'katex/dist/katex.min.css'
import { site } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang='zh-CN'>
      <body>
        <header className='site-header'>
          <div className='shell site-header-inner'>
            <Link className='brand' href='/' aria-label={`${site.name} 首页`}>
              <Image className='brand-mark' src='/icon.svg' alt='' width={28} height={28} priority />
              <span>{site.name}</span>
            </Link>
            <nav className='site-nav' aria-label='主导航'>
              <Link href='/#posts'>文章</Link>
              <Link href='/#topics'>主题</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer><div className='shell footer-content'>© 2026 {site.name} · 记录、整理、发布。</div></footer>
      </body>
    </html>
  )
}
