import Link from 'next/link'

export default function NotFound() { return <main className='shell'><div className='empty'>404 / 页面不存在。<br /><Link className='back' href='/'>返回首页</Link></div></main> }
