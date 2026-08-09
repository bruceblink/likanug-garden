import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'
import 'katex/dist/katex.min.css'
import { baseUrl, site } from '@/lib/site'

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: site.name, template: `%s | ${site.name}` },
  description: site.description,
  alternates: { canonical: baseUrl }
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Render the current year instead of requiring a yearly footer edit.
  const copyrightYear = new Date().getFullYear()

  return (
    <html lang='zh-CN' data-scroll-behavior='smooth'>
      <body>
        <a className='skip-link' href='#main-content'>跳至主要内容</a>
        <header className='site-header'>
          <div className='shell site-header-inner'>
            <Link className='brand' href='/' aria-label={`${site.name} 首页`}>
              <Image className='brand-mark' src='/icon.svg' alt='' width={28} height={28} priority />
              <span>{site.name}</span>
            </Link>
            <nav className='site-nav' aria-label='主导航'>
              <Link href='/#posts'>文章</Link>
              <Link href='/#topics'>主题</Link>
              <a
                className='site-nav-external'
                href={site.mainSiteUrl}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='前往主站 likanug.top（在新标签页打开）'
              >
                主站
              </a>
            </nav>
          </div>
        </header>
        {children}
        <footer><div className='shell footer-content'>© {copyrightYear} {site.name} · 记录、整理、发布。</div></footer>
      </body>
    </html>
  )
}
