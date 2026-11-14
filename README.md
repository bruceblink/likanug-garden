# likanug-garden

基于 Astro SSR、Cloudflare Workers 和 Notion API 的个人博客。文章在 Notion 数据库中编写，站点只展示符合发布条件的页面，并将 Notion-flavored Markdown 渲染为文章页面。

当前仓库已完成 Astro SSR 迁移，包含首页、文章详情页、Notion 数据读取、Mermaid 图表、JSON Feed、Sitemap 和 Robots。

## 技术栈

- Astro `7.4.12`，使用 `@astrojs/cloudflare` 输出 Cloudflare Worker。
- React `19.3.1`，只用于复用 Notion Markdown 服务端渲染组件。
- Mermaid 只在文章页存在图表时通过浏览器脚本动态加载。
- Node.js `24.22.3`，`.nvmrc` 和 CI 使用同一版本。
- pnpm `12.18.0`。

## 运行要求

需要安装 Node.js `24.22.3` 或同一主版本的更新补丁，以及 pnpm `12.18.0`。

安装依赖：

```bash
pnpm install --frozen-lockfile
```

## Notion 配置

### 1. 创建并授权 Integration

1. 在 Notion 的 **Settings → Connections → Develop or manage integrations** 中创建 Internal Integration。
2. 复制 Integration Secret。该值只放在服务端环境变量 `NOTION_API_KEY` 中。
3. 打开文章数据库，选择右上角 **… → Connections**，将 Integration 添加到数据库。

### 2. 获取数据库 ID

`NOTION_PAGE_ID` 是数据库 ID。它保留了历史命名，不是普通文章页面的 ID。带连字符或不带连字符的形式都可以。

### 3. 配置环境变量

复制 `.env.example`，再按环境填写：

```dotenv
NOTION_PAGE_ID=你的数据库ID
NOTION_API_KEY=你的IntegrationSecret
NOTION_API_VERSION=2026-03-11
PUBLIC_SITE_URL=https://你的博客域名
PUBLIC_SITE_DESCRIPTION=你的站点描述
REVALIDATE_SECONDS=300
```

`NOTION_API_KEY` 必须只存在于服务端环境。Astro 版本使用 `PUBLIC_SITE_*` 和 `REVALIDATE_SECONDS`。为了迁移兼容，代码仍可读取旧的 `NEXT_PUBLIC_*` 变量名。

Notion 字段名和发布值可以通过以下变量映射：

```dotenv
NOTION_PROPERTY_TYPE=type
NOTION_PROPERTY_TITLE=title
NOTION_PROPERTY_STATUS=status
NOTION_PROPERTY_SUMMARY=summary
NOTION_PROPERTY_SLUG=slug
NOTION_PROPERTY_CATEGORY=category
NOTION_PROPERTY_DATE=date
NOTION_PROPERTY_TAGS=tags
NOTION_PROPERTY_TYPE_POST=Post
NOTION_PROPERTY_STATUS_PUBLISH=Published
```

## 本地开发

启动 Astro 开发服务器：

```bash
pnpm dev
```

构建并检查 Astro 页面：

```bash
pnpm build
```

使用 Cloudflare Worker 运行时预览构建结果：

```bash
pnpm preview
```

其他检查：

```bash
pnpm test
pnpm typecheck
pnpm cf-typegen
```

`pnpm preview` 比普通静态预览更接近生产环境。它用于检查 Astro Cloudflare adapter、Worker 入口和运行时依赖。

## Cloudflare Workers 部署

本项目使用 Workers + Workers Static Assets，不使用旧的 Workers Sites 配置。`wrangler.jsonc` 中的 Worker 入口由 `@astrojs/cloudflare/entrypoints/server` 提供，静态资源目录为 `dist`。

先检查构建产物，不上传到 Cloudflare：

```bash
pnpm build
pnpm exec wrangler deploy --dry-run
```

确认 Cloudflare 账号和环境变量后，再部署：

```bash
pnpm deploy
```

生产环境至少需要配置：

- `NOTION_API_KEY`：建议使用 Cloudflare Secret。
- `NOTION_PAGE_ID`：可以使用 Worker 变量或 Secret。
- `NOTION_API_VERSION=2026-03-11`。
- `PUBLIC_SITE_URL`。
- `PUBLIC_SITE_DESCRIPTION`。
- `REVALIDATE_SECONDS`。

例如，可以使用 Wrangler 写入 Notion Secret：

```bash
pnpm exec wrangler secret put NOTION_API_KEY
```

不要把 Secret 写入 `wrangler.jsonc`、仓库文件、日志或提交记录。

## 页面和公开端点

| 地址 | 说明 |
| --- | --- |
| `/` | 首页、搜索、分类、标签和分页筛选。 |
| `/posts/<slug>` | 文章详情页，服务端读取 Notion Markdown。 |
| `/feed.json` | JSON Feed 1.1。 |
| `/sitemap.xml` | 只包含已发布文章的 Sitemap。 |
| `/robots.txt` | 公开抓取规则和 Sitemap 地址。 |
| `/404` | Astro 自定义 404 页面。 |

## 缓存和运行时边界

Notion 数据读取使用 Worker 实例内的短期模块缓存，并由响应头提供边缘缓存提示。文章正文缓存最多保留 128 个页面。缓存时间由 `REVALIDATE_SECONDS` 控制。模块缓存不是跨所有 Cloudflare 地区共享的持久缓存；如果后续需要跨实例一致的缓存，应改用 KV 或其他 Cloudflare 存储。

当前 Notion 数据层继续使用 `@notionhq/client`。它已通过本地打包检查；如果目标账号的 Worker 运行时暴露 Node.js 兼容问题，应改为直接使用 `fetch` 调用 Notion REST API。

## Mermaid 处理

文章服务端渲染时，Mermaid 代码块先输出为静态占位块。文章页脚本再动态导入 Mermaid，并在浏览器中生成 SVG。首页和不含 Mermaid 的文章不会加载 Mermaid 模块。

## 项目结构

```text
src/
  layouts/BaseLayout.astro       全局 HTML、导航、元数据和页脚
  pages/index.astro              首页和查询参数筛选
  pages/posts/[slug].astro       动态文章页
  pages/feed.json.ts             JSON Feed endpoint
  pages/sitemap.xml.ts           Sitemap endpoint
  pages/robots.txt.ts            Robots endpoint
  pages/404.astro                自定义 404 页面
  scripts/mermaid.ts             Mermaid 按需加载脚本
  styles/global.css              全局样式
lib/
  notion.ts                      Notion 数据库和页面 Markdown 读取
  notion-markdown.tsx            Markdown 清理、转换和服务端渲染
  notion-markdown-utils.ts       纯函数归一化逻辑
  site.ts                        站点和环境变量配置
test/                             Markdown 归一化测试
astro.config.mjs                 Astro Cloudflare SSR 配置
wrangler.jsonc                   Cloudflare Worker 配置
```

## 完整验收命令

提交前运行：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm build
pnpm exec wrangler deploy --dry-run
```

真实域名、Notion 凭据、Cloudflare 账号权限和线上请求仍需要在部署环境中单独验收。
