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
  className?: string
  color?: string
  icon?: string
  url?: string
  src?: unknown
  alt?: string
  inline?: string
  underline?: string
  open?: boolean
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

type HastNode = {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  value?: string
}

type MarkdownHeading = {
  id: string
  level: number
  text: string
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
  'notion-table-of-contents',
  'empty-block',
  'unknown'
]

const sanitizedHeadingIdPrefix = defaultSchema.clobberPrefix ?? ''

// Allow the official Notion-flavored tags through sanitization while keeping arbitrary HTML out.
const notionSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...notionTags, 'nav'],
  attributes: {
    ...defaultSchema.attributes,
    callout: ['icon', 'color'],
    details: ['color', 'open', ['className', 'notion-toc']],
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
    nav: ['ariaLabel', ['className', 'notion-toc']],
    p: [...(defaultSchema.attributes?.p ?? []), ['className', 'notion-toc-label']],
    ol: ['ariaDescribedBy', 'ariaLabel', 'ariaLabelledBy', ['className', 'contains-task-list', 'notion-toc-list']],
    li: [['className', 'task-list-item', /^notion-toc-level-[1-6]$/]],
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

function hastTextContent(node: HastNode): string {
  if (node.type === 'text' || node.type === 'raw') return node.value ?? ''
  if (node.tagName === 'br') return ' '
  return node.children?.map(hastTextContent).join('') ?? ''
}

function headingLevel(node: HastNode): number | undefined {
  const match = node.tagName?.match(/^h([1-6])$/)
  return match ? Number(match[1]) : undefined
}

// Builds a readable, predictable fragment while retaining non-Latin letters and numbers.
function headingSlug(text: string): string {
  const slug = text
    .normalize('NFKC')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}_-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'section'
}

/**
 * Finds rendered heading nodes once, assigns collision-safe IDs, and returns
 * the exact text and hierarchy used by the Notion table of contents.
 */
function collectMarkdownHeadings(root: HastNode): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const usedIds = new Map<string, number>()

  const visit = (node: HastNode) => {
    const level = headingLevel(node)
    if (level) {
      const text = hastTextContent(node).replace(/\s+/g, ' ').trim()
      const baseId = `section-${headingSlug(text)}`
      const duplicateIndex = usedIds.get(baseId) ?? 0
      usedIds.set(baseId, duplicateIndex + 1)
      const id = duplicateIndex === 0 ? baseId : `${baseId}-${duplicateIndex + 1}`

      node.properties = {...node.properties, id}
      if (text) headings.push({id, level, text})
    }

    node.children?.forEach(visit)
  }

  root.children?.forEach(visit)
  return headings
}

// Creates the sanitized navigation subtree from the headings found in the rendered document.
function createTableOfContents(headings: MarkdownHeading[]): HastNode {
  return {
    type: 'element',
    tagName: 'details',
    properties: {className: ['notion-toc']},
    children: [
      {
        type: 'element',
        tagName: 'summary',
        properties: {},
        children: [{type: 'text', value: '目录'}]
      },
      {
        type: 'element',
        tagName: 'ol',
        properties: {className: ['notion-toc-list']},
        children: headings.map(heading => ({
          type: 'element',
          tagName: 'li',
          properties: {className: [`notion-toc-level-${heading.level}`]},
          children: [{
            type: 'element',
            tagName: 'a',
            properties: {href: `#${sanitizedHeadingIdPrefix}${heading.id}`},
            children: [{type: 'text', value: heading.text}]
          }]
        }))
      }
    ]
  }
}

function containsTableOfContents(nodes: HastNode[]): boolean {
  return nodes.some(node =>
    node.tagName === 'notion-table-of-contents' ||
    (node.children ? containsTableOfContents(node.children) : false)
  )
}

// Replaces every official Notion placeholder with the same outline used for heading IDs.
function replaceTableOfContents(nodes: HastNode[], headings: MarkdownHeading[]): HastNode[] {
  return nodes.flatMap(node => {
    if (node.type === 'element' && node.tagName === 'notion-table-of-contents') {
      return headings.length > 0 ? [createTableOfContents(headings)] : []
    }

    if (node.children) node.children = replaceTableOfContents(node.children, headings)
    return [node]
  })
}

/**
 * Turns Notion's placeholder directory block into links after headings have
 * stable IDs, so the navigation always matches the final rendered Markdown.
 */
function rehypeNotionTableOfContents() {
  return (root: HastNode) => {
    const headings = collectMarkdownHeadings(root)
    if (!root.children) return

    const hasPlaceholder = containsTableOfContents(root.children)
    const renderedNodes = replaceTableOfContents(root.children, headings)
    root.children = !hasPlaceholder && headings.length >= 4
      ? [createTableOfContents(headings), ...renderedNodes]
      : renderedNodes
  }
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

/**
 * Keeps source tables intact while giving narrow screens a small visual cue
 * that the region itself, rather than the page, can scroll horizontally.
 */
function MarkdownTable({node: _node, ...props}: MarkdownTableProps) {
  return <div className='notion-table-wrap'>
    <div className='notion-table-scroll' role='region' aria-label='表格内容，可横向滚动' tabIndex={0}><table {...props} /></div>
    <span className='notion-table-scroll-cue' aria-hidden='true'>↔</span>
  </div>
}

// Keeps each visible heading addressable without changing its original Markdown content.
function HeadingPermalink({id, children}: Pick<MarkdownHeadingProps, 'id' | 'children'>) {
  if (!id) return <>{children}</>
  const label = textContent(children).trim()
  return <>
    {children}
    <a className='notion-heading-link' href={`#${id}`} tabIndex={-1} aria-label={label ? `链接至：${label}` : '段落链接'}>#</a>
  </>
}

function MarkdownHeadingOne({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h2 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h2>
}

function MarkdownHeadingTwo({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h2 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h2>
}

function MarkdownHeadingThree({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h3 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h3>
}

function MarkdownHeadingFour({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h4 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h4>
}

function MarkdownHeadingFive({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h5 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h5>
}

function MarkdownHeadingSix({children, node: _node, ...props}: MarkdownHeadingProps) {
  return <h6 {...props}><HeadingPermalink id={props.id}>{children}</HeadingPermalink></h6>
}

function NotionCallout({children, color, icon}: NotionElementProps) {
  return <aside className={`notion-callout ${colorClass(color) ?? ''}`.trim()}>
    {icon && <span className='notion-callout-icon' aria-hidden='true'>{icon}</span>}
    <div>{children}</div>
  </aside>
}

function NotionDetails({children, className, color, open}: NotionElementProps) {
  return <details className={[className, colorClass(color)].filter(Boolean).join(' ')} open={open}>{children}</details>
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

function normalizeNotionTableOfContents(markdown: string): string {
  // HTML custom elements need a hyphen. Notion's underscore tag would otherwise be emitted as prose by rehype-raw.
  return markdown
    .replace(/<table_of_contents\s*\/\s*>/gi, '<notion-table-of-contents></notion-table-of-contents>')
    .replace(/<\/?table_of_contents\b/gi, tag => tag.startsWith('</') ? '</notion-table-of-contents' : '<notion-table-of-contents')
}

function normalizeNotionMarkdown(markdown: string): string {
  // Notion adds block attributes and raw tables that standard Markdown parsers cannot safely interpret as-is.
  return transformOutsideFencedCode(markdown, prose =>
    normalizeNotionTableOfContents(removeEmptyReferenceSection(convertNotionTables(prose)).replace(/\s+\{(?:color="[^"]+"|toggle="true")\}/g, ''))
  )
}

const components = {
  h1: MarkdownHeadingOne,
  h2: MarkdownHeadingTwo,
  h3: MarkdownHeadingThree,
  h4: MarkdownHeadingFour,
  h5: MarkdownHeadingFive,
  h6: MarkdownHeadingSix,
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
    rehypePlugins={[[rehypeRaw], rehypeNotionTableOfContents, [rehypeSanitize, notionSanitizeSchema], rehypeKatex]}
    components={components as Components}
  >{removeDuplicateTitle(normalizeNotionMarkdown(markdown), title)}</ReactMarkdown>
}
