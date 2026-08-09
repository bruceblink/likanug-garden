import {Children, isValidElement, type ComponentProps, type ReactNode} from 'react'
import ReactMarkdown, {type Components} from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {MermaidDiagram} from './mermaid-diagram'

type NotionElementProps = {
  children?: ReactNode
  color?: string
  icon?: string
  url?: string
  src?: unknown
  alt?: string
  inline?: string
  underline?: string
}

type MarkdownCodeProps = ComponentProps<'code'> & {
  inline?: boolean
  node?: unknown
}

type MarkdownPreProps = ComponentProps<'pre'> & {
  node?: unknown
}

type MarkdownAnchorProps = ComponentProps<'a'> & {
  node?: unknown
}

type MarkdownImageProps = ComponentProps<'img'> & {
  node?: unknown
}

type MarkdownHeadingProps = ComponentProps<'h1'> & {
  node?: unknown
}

type MarkdownTableProps = ComponentProps<'table'> & {
  node?: unknown
}

const notionTags = [
  'callout',
  'columns',
  'column',
  'file',
  'page',
  'database',
  'pdf',
  'audio',
  'video',
  'mention-user',
  'mention-page',
  'mention-database',
  'mention-data-source',
  'mention-agent',
  'mention-date',
  'synced_block',
  'synced_block_reference',
  'table_of_contents',
  'empty-block',
  'unknown'
]

// Allow the official Notion-flavored tags through sanitization while keeping arbitrary HTML out.
const notionSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...notionTags],
  attributes: {
    ...defaultSchema.attributes,
    callout: ['icon', 'color'],
    details: ['color'],
    span: ['color', 'underline'],
    file: ['src', 'color'],
    page: ['url', 'color'],
    database: ['url', 'inline', 'icon', 'color'],
    pdf: ['src', 'color'],
    audio: ['src', 'color', 'controls'],
    video: ['src', 'color', 'controls', 'poster', 'width', 'height'],
    'mention-user': ['url'],
    'mention-page': ['url'],
    'mention-database': ['url'],
    'mention-data-source': ['url'],
    'mention-agent': ['url'],
    'mention-date': ['start', 'end', 'starttime', 'timezone'],
    synced_block: ['url'],
    synced_block_reference: ['url'],
    unknown: ['url', 'alt'],
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'decoding']
  }
}

function colorClass(color?: string): string | undefined {
  if (!color) return undefined
  const normalized = color.toLowerCase().replace(/[^a-z_]/g, '')
  return normalized ? `notion-color-${normalized}` : undefined
}

function safeHref(href?: string): string | undefined {
  if (!href) return undefined
  if (href.startsWith('/') || href.startsWith('#')) return href
  try {
    const protocol = new URL(href).protocol
    return ['http:', 'https:', 'mailto:'].includes(protocol) ? href : undefined
  } catch {
    return undefined
  }
}

function externalHref(href?: string): boolean {
  return Boolean(href && /^(https?:)?\/\//i.test(href))
}

function ExternalLink({href, children, node: _node, ...props}: MarkdownAnchorProps) {
  const safeUrl = safeHref(href)
  const external = externalHref(safeUrl)
  return <a href={safeUrl} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined} {...props}>{children}</a>
}

function MarkdownImage({src, alt = '', node: _node, ...props}: MarkdownImageProps) {
  const safeSrc = typeof src === 'string' ? safeHref(src) : undefined
  if (!safeSrc) return null
  // Notion returns temporary signed image URLs, so next/image cannot optimize them without a fixed host allowlist.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={safeSrc} alt={alt} loading='lazy' decoding='async' {...props} />
}

function MarkdownCode({children, className, inline: _inline, node: _node, ...props}: MarkdownCodeProps) {
  const language = className?.match(/language-([\w-]+)/)?.[1]?.toLowerCase()
  return <code className={className} data-language={language} {...props}>{children}</code>
}

function textContent(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textContent).join('')
  if (isValidElement<{children?: ReactNode}>(node)) return textContent(node.props.children)
  return ''
}

/**
 * React Markdown owns the outer pre element for fenced blocks. This component
 * only replaces Mermaid blocks before that pre is emitted, keeping valid HTML.
 */
function MarkdownPre({children, node: _node, ...props}: MarkdownPreProps) {
  const codeChild = Children.toArray(children).find(child =>
    isValidElement<{className?: string; children?: ReactNode}>(child)
  )

  if (
    isValidElement<{className?: string; children?: ReactNode}>(codeChild) &&
    /(?:^|\s)language-mermaid(?:\s|$)/.test(codeChild.props.className ?? '')
  ) {
    return <MermaidDiagram chart={textContent(codeChild.props.children).replace(/\n$/, '')} />
  }

  return <pre {...props}>{children}</pre>
}

function MarkdownTable({node: _node, ...props}: MarkdownTableProps) {
  return <div className='notion-table-scroll'><table {...props} /></div>
}

function NotionCallout({children, color, icon}: NotionElementProps) {
  return <aside className={`notion-callout ${colorClass(color) ?? ''}`.trim()}>
    {icon && <span className='notion-callout-icon' aria-hidden='true'>{icon}</span>}
    <div>{children}</div>
  </aside>
}

function NotionDetails({children, color}: NotionElementProps) {
  return <details className={colorClass(color)}>{children}</details>
}

function NotionColumns({children}: NotionElementProps) {
  return <div className='notion-columns'>{children}</div>
}

function NotionColumn({children}: NotionElementProps) {
  return <div className='notion-column'>{children}</div>
}

function NotionReference({children, url, className}: NotionElementProps & {className?: string}) {
  return <ExternalLink className={`notion-reference ${className ?? ''}`.trim()} href={url}>{children ?? url ?? '打开 Notion'}</ExternalLink>
}

function NotionMedia({children, src, className}: NotionElementProps & {className?: string}) {
  const safeUrl = typeof src === 'string' ? safeHref(src) : undefined
  if (!safeUrl) return null
  return <a className={`notion-media ${className ?? ''}`.trim()} href={safeUrl} target='_blank' rel='noreferrer'>{children ?? '打开媒体文件'}</a>
}

function NotionAudio({src}: NotionElementProps) {
  const safeUrl = typeof src === 'string' ? safeHref(src) : undefined
  return safeUrl ? <audio controls src={safeUrl}>你的浏览器不支持音频播放。</audio> : null
}

function NotionVideo({src}: NotionElementProps) {
  const safeUrl = typeof src === 'string' ? safeHref(src) : undefined
  return safeUrl ? <video controls src={safeUrl}>你的浏览器不支持视频播放。</video> : null
}

function NotionUnknown({url, alt}: NotionElementProps) {
  return <p className='notion-unknown'>未支持的 Notion 内容：{alt ?? 'unknown'} {url && <ExternalLink href={url}>在 Notion 中打开</ExternalLink>}</p>
}

function removeDuplicateTitle(markdown: string, title?: string): string {
  if (!title) return markdown
  const normalizedTitle = title.trim().replace(/\s+/g, ' ')
  const match = markdown.match(/^#\s+(.+?)(?:\s+\{[^\n]*\})?\s*(?:\r?\n|$)/m)
  if (!match || match.index === undefined) return markdown
  const heading = match[1].trim().replace(/\s+/g, ' ')
  if (heading !== normalizedTitle) return markdown
  return `${markdown.slice(0, match.index)}${markdown.slice(match.index + match[0].length)}`.replace(/^\s+/, '')
}

/**
 * Applies a Markdown transform only to prose. Fenced source code must remain
 * untouched because examples may legitimately contain HTML-like table text.
 */
function transformOutsideFencedCode(markdown: string, transform: (prose: string) => string): string {
  const parts: string[] = []
  const lines = markdown.split(/\r?\n/)
  let buffer: string[] = []
  let fence: {character: string; length: number} | null = null

  const flushProse = () => {
    if (buffer.length > 0) {
      parts.push(transform(buffer.join('\n')))
      buffer = []
    }
  }

  for (const line of lines) {
    const marker = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      buffer.push(line)
      const closingFence = new RegExp(`^\\s*${fence.character}{${fence.length},}\\s*$`)
      if (closingFence.test(line)) {
        parts.push(buffer.join('\n'))
        buffer = []
        fence = null
      }
      continue
    }

    if (marker) {
      flushProse()
      buffer = [line]
      fence = {character: marker[1][0], length: marker[1].length}
      continue
    }

    buffer.push(line)
  }

  if (buffer.length > 0) {
    if (fence) parts.push(buffer.join('\n'))
    else flushProse()
  }

  return parts.join('\n')
}

function tableCellToMarkdown(cell: string): string {
  return cell
    .trim()
    .replace(/<br\s*\/?\s*>/gi, '<br />')
    .replace(/\r?\n\s*/g, '<br />')
    .replace(/\|/g, '\\|')
}

/**
 * Converts the tables emitted by Notion's official Markdown API into GFM.
 * This restores Markdown inside cells and gives the first row real table-heading semantics.
 */
function convertNotionTables(markdown: string): string {
  return markdown.replace(/<table\b([^>]*)>([\s\S]*?)<\/table>/gi, (table, attributes: string, body: string) => {
    if (!/\bheader-row\s*=\s*(?:"true"|'true'|true)(?=\s|$)/i.test(attributes)) {
      return `\n\n${table.trim()}\n\n`
    }

    const rows = Array.from(body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi))
      .map(([, row]) => Array.from(row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi))
        .map(([, cell]) => tableCellToMarkdown(cell)))
      .filter(row => row.length > 0)

    if (rows.length === 0) return `\n\n${table.trim()}\n\n`

    const columnCount = Math.max(...rows.map(row => row.length))
    const paddedRows = rows.map(row => Array.from({length: columnCount}, (_, index) => row[index] ?? ''))
    const [header, ...bodyRows] = paddedRows
    const gfmRows = [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...bodyRows.map(row => `| ${row.join(' | ')} |`)
    ]

    return `\n\n${gfmRows.join('\n')}\n\n`
  })
}

function removeEmptyReferenceSection(markdown: string): string {
  // Empty reference blocks are emitted as a heading followed by a lone list marker.
  return markdown.replace(/(?:^|\n)#{1,6}\s*(?:📎\s*)?参考文章\s*\n(?:\s*[-*+]\s*)+\s*$/u, '\n')
}

function normalizeNotionMarkdown(markdown: string): string {
  // Notion adds block attributes and raw tables that standard Markdown parsers cannot safely interpret as-is.
  return transformOutsideFencedCode(markdown, prose =>
    removeEmptyReferenceSection(convertNotionTables(prose)).replace(/\s+\{(?:color="[^"]+"|toggle="true")\}/g, '')
  )
}

const components = {
  h1: ({children, node: _node, ...props}: MarkdownHeadingProps) => <h2 {...props}>{children}</h2>,
  pre: MarkdownPre,
  table: MarkdownTable,
  code: MarkdownCode,
  a: ExternalLink,
  img: MarkdownImage,
  callout: NotionCallout,
  details: NotionDetails,
  columns: NotionColumns,
  column: NotionColumn,
  file: NotionMedia,
  pdf: NotionMedia,
  audio: NotionAudio,
  video: NotionVideo,
  page: NotionReference,
  database: NotionReference,
  'mention-user': NotionReference,
  'mention-page': NotionReference,
  'mention-database': NotionReference,
  'mention-data-source': NotionReference,
  'mention-agent': NotionReference,
  'mention-date': ({children, start, end}: NotionElementProps & {start?: string; end?: string}) => <time className='notion-mention-date'>{children ?? start ?? end}</time>,
  synced_block: ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  synced_block_reference: ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  table_of_contents: () => <nav className='notion-toc' aria-label='文章目录'>文章目录</nav>,
  'empty-block': () => <div className='notion-empty-block' aria-hidden='true' />,
  unknown: NotionUnknown,
  span: ({children, color, underline}: NotionElementProps) => <span className={[colorClass(color), underline === 'true' ? 'notion-underline' : undefined].filter(Boolean).join(' ')}>{children}</span>
}

/**
 * Renders Notion's enhanced Markdown with GFM, math, safe known HTML tags,
 * and a dedicated Mermaid renderer for fenced Mermaid diagrams.
 */
export function NotionMarkdown({markdown, title}: {markdown: string; title?: string}) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[[rehypeRaw], [rehypeSanitize, notionSanitizeSchema], rehypeKatex]}
    components={components as Components}
  >{removeDuplicateTitle(normalizeNotionMarkdown(markdown), title)}</ReactMarkdown>
}
