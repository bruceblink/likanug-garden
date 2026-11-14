# likanug-garden

基于 Next.js 和 Notion API 的个人博客。文章在 Notion 数据库中编写，站点只展示符合发布条件的页面，并将 Notion-flavored Markdown 渲染为文章页面。

## 功能

- 从 Notion 数据库读取已发布文章，并按发布日期排序。
- 首页支持关键词、分类、标签和分页筛选。
- 文章页面提供规范链接、Open Graph 元数据和文章标签。
- 提供 JSON Feed、`sitemap.xml` 和 `robots.txt`。
- 支持 Notion Markdown v2 的标题、列表、代码块、表格、引用、待办、Callout、折叠块、图片、音频、视频、附件、日期、提及、同步块和目录。
- 支持 GFM、数学公式和 Mermaid 图表。
- 对未知 Notion 区块显示可识别的回退提示；对 API 截断内容显示文章提示，不会静默伪造完整内容。
- 使用服务端缓存降低 Notion API 请求次数。缓存时间由 `NEXT_PUBLIC_REVALIDATE_SECONDS` 控制。

## 运行要求

- Node.js `>=22.13.0`。仓库的 `.nvmrc` 使用 `22.13.0`。
- pnpm `12.18.0`。版本由 `package.json` 的 `packageManager` 字段固定。
- 一个可访问目标数据库的 Notion Internal Integration。

可以使用 Corepack 准备 pnpm：

```bash
corepack enable
corepack pnpm --version
```

输出应为 `12.18.0`。如果系统已经安装 pnpm，也请确认它满足该版本要求。

## Notion 配置

### 1. 创建并授权 Integration

1. 在 Notion 的 **Settings → Connections → Develop or manage integrations** 中创建 Internal Integration。
2. 复制 Integration Secret。该值只放在服务端环境变量 `NOTION_API_KEY` 中。
3. 打开文章数据库，选择右上角 **… → Connections**，将该 Integration 添加到数据库。

仅创建 Integration 而没有分享数据库时，站点无法读取文章。

### 2. 获取数据库 ID

`NOTION_PAGE_ID` 是数据库 ID。它保留了历史命名，不是普通文章页面的 ID。

可以从数据库 URL 中取得 ID。复制 URL 中的 32 位 ID；带连字符或不带连字符的形式都可以交给 Notion SDK。

### 3. 准备文章属性

默认字段名和发布值如下。字段名可以通过环境变量映射，但字段含义不能省略。

| 字段 | 默认环境变量值 | 推荐 Notion 类型 | 作用 |
| --- | --- | --- | --- |
| 类型 | `type` | Select / Status | 必须等于 `Post`，否则页面不会进入文章列表。 |
| 标题 | `title` | Title | 文章标题。 |
| 状态 | `status` | Select / Status | 必须等于 `Published`，否则页面不会公开。 |
| 摘要 | `summary` | Rich text / Formula / Rollup | 首页摘要和文章描述。 |
| Slug | `slug` | Rich text / URL | 文章公开路径，例如 `hibernate-panache`。 |
| 分类 | `category` | Select / Status | 首页分类筛选。 |
| 日期 | `date` | Date / Formula / Rollup | 文章发布日期。缺失时回退到页面创建时间。 |
| 标签 | `tags` | Multi-select | 首页标签筛选和文章标签。 |

建议每篇已发布文章使用唯一的 `slug`。如果多个已发布页面使用相同值，应用会为后续页面追加页面 ID 后缀，以避免公开 URL 冲突。

### 4. 创建本地环境文件

```bash
cp .env.example .env.local
```

至少填写以下变量：

```dotenv
NOTION_PAGE_ID=你的数据库ID
NOTION_API_KEY=你的IntegrationSecret
NOTION_API_VERSION=2026-03-11
```

`NOTION_API_VERSION` 应保持为 `2026-03-11`。当前页面 Markdown 接口使用 Notion API v2；应用会将旧值统一回退到该版本，并在服务端日志中给出提示。

如果你的数据库字段不是默认名称，只修改对应的 `NOTION_PROPERTY_*` 变量。例如：

```dotenv
NOTION_PROPERTY_TITLE=名称
NOTION_PROPERTY_STATUS=发布状态
NOTION_PROPERTY_STATUS_PUBLISH=已发布
```

完整变量说明见 [`.env.example`](./.env.example)。不要把 `.env.local` 提交到 Git；它已被 `.gitignore` 忽略。

## 本地开发

安装依赖：

```bash
pnpm install --frozen-lockfile
```

启动开发服务器：

```bash
pnpm dev
```

默认访问地址为 <http://localhost:3000>。如果端口已被占用，可以指定端口：

```bash
pnpm dev -- --port 3100
```

开发服务器会读取 `.env.local`。修改 Notion 配置后重启开发服务器，以避免旧进程继续使用旧环境变量。

## 常用命令

| 命令 | 用途 |
| --- | --- |
| `pnpm dev` | 启动 Next.js 开发服务器。 |
| `pnpm lint` | 执行 ESLint 检查。 |
| `pnpm typecheck` | 执行 TypeScript 类型检查。 |
| `pnpm test` | 执行 Notion Markdown 归一化测试。 |
| `pnpm build` | 生成生产构建。 |
| `pnpm start` | 启动生产服务器，需先执行 `pnpm build`。 |
| `pnpm clean` | 删除 `.next` 构建目录。 |

提交代码前建议运行完整检查：

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm lint
pnpm typecheck
pnpm build
```

## 生产部署

项目没有内置 Docker 或特定云平台配置。任何能够运行 Node.js 22 的部署平台都可以使用以下流程：

1. 注入 `.env.local` 中的服务端和公开环境变量。
2. 安装锁定版本依赖：`pnpm install --frozen-lockfile`。
3. 构建：`pnpm build`。
4. 启动：`pnpm start`。
5. 将外部访问端口转发到 Next.js 进程使用的端口。默认端口为 `3000`，也可以通过平台提供的 `PORT` 环境变量修改。

生产环境至少需要配置：

```dotenv
NOTION_PAGE_ID=你的数据库ID
NOTION_API_KEY=你的IntegrationSecret
NOTION_API_VERSION=2026-03-11
NEXT_PUBLIC_SITE_URL=https://你的博客域名
NEXT_PUBLIC_SITE_DESCRIPTION=你的站点描述
NEXT_PUBLIC_REVALIDATE_SECONDS=300
```

`NEXT_PUBLIC_SITE_URL` 会用于规范链接、Feed 和 Sitemap。它应填写博客实际域名，不要填写主站域名或带路径的临时预览地址。

## 页面和公开端点

| 地址 | 说明 |
| --- | --- |
| `/` | 首页、文章列表、搜索、分类、标签和分页。 |
| `/posts/<slug>` | 文章详情页。`<slug>` 来自 Notion 的 Slug 字段。 |
| `/feed.json` | 已发布文章的 JSON Feed。 |
| `/sitemap.xml` | 首页和已发布文章的 Sitemap。 |
| `/robots.txt` | 搜索引擎抓取规则。 |

## Markdown 渲染说明

文章详情页先通过 Notion API 的 Markdown v2 接口读取页面，再执行以下处理：

1. 补读 API 标记为未知的子区块。
2. 归一化 Notion 自定义标签和 v1/v2 标签差异。
3. 清理危险 HTML 和不安全链接。
4. 渲染 GFM、数学公式、Mermaid 和 Notion 专用区块。
5. 为标题生成稳定锚点；标题较多时自动生成目录。

Notion 图片使用临时签名 URL。图片链接过期后，刷新文章即可重新取得 URL。未知区块会保留提示，不会执行任意 HTML。页面内容超过 Notion API 单页读取限制时，文章顶部会显示“部分内容超过 Notion API 单页读取上限”的提示。

## 故障排查

### 首页显示“未配置 NOTION_PAGE_ID”

确认 `.env.local` 存在，并填写的是数据库 ID，而不是单篇文章页面 ID。修改后重启开发服务器。

### 首页显示 Integration 无法访问数据库

在 Notion 数据库右上角 **… → Connections** 中确认 Integration 已被添加。数据库所在页面也必须对该 Integration 可见。

### 首页没有文章

逐项检查：

- 标题字段有值。
- 类型字段值为 `Post`，或已修改 `NOTION_PROPERTY_TYPE_POST`。
- 状态字段值为 `Published`，或已修改 `NOTION_PROPERTY_STATUS_PUBLISH`。
- 日期字段是有效日期；没有日期时会使用页面创建时间。
- 字段名称与 `NOTION_PROPERTY_*` 配置一致。

### 文章标题或正文重复

页面标题由数据库标题字段提供。正文中与页面标题完全相同的首个非空标题会被移除，以避免重复显示；其他同名标题和代码块中的示例不会被删除。

### 页面出现未知内容提示

这表示 Notion API 返回了当前渲染器没有实现的区块，或该区块没有访问权限。提示中的链接可以用于回到 Notion 查看原内容。不要把未知内容当作已成功渲染。

## 项目结构

```text
app/
  page.tsx                  首页和筛选
  posts/[slug]/page.tsx     文章详情
  feed.json/route.ts        JSON Feed
  sitemap.ts                Sitemap
  robots.ts                 Robots 规则
lib/
  notion.ts                 Notion 数据库和页面 Markdown 读取
  notion-markdown.tsx       Markdown 归一化、清理和渲染
  notion-markdown-utils.ts  纯函数归一化逻辑
  site.ts                   站点和环境变量配置
test/                       Markdown 归一化测试
```

## 相关文档

- [Notion API：Working with Markdown content](https://developers.notion.com/guides/data-apis/working-with-markdown-content)
- [Notion-flavored Markdown](https://developers.notion.com/guides/data-apis/notion-flavored-markdown)
- [Next.js 文档](https://nextjs.org/docs)
