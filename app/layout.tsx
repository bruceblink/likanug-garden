import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
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
        <header className='hero'>
          <div className='shell'>
            <div className='status'>ONLINE / SHANGHAI / UTC+08</div>
            <h1>{site.name}</h1>
            <p className='intro'>{site.description}</p>
            <nav className='nav'><Link href='/'>/home</Link><Link href='/#posts'>/posts</Link><a href={site.url}>/about</a></nav>
          </div>
        </header>
        {children}
        <footer><div className='shell mono'>Copyright {site.name}. Built with Next.js.</div></footer>
      </body>
    </html>
  )
}
