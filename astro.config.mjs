import {defineConfig} from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'

// 使用 Cloudflare SSR，并保留 React Markdown 组件的服务端渲染能力。
export default defineConfig({
  output: 'server',
  session: false,
  adapter: cloudflare({imageService: 'passthrough'}),
  integrations: [react()]
})
