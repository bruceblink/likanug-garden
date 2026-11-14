import {Children, isValidElement, type ComponentProps, type ReactNode} from 'react'
import katex from 'katex'
import ReactMarkdown, {type Components} from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, {defaultSchema} from 'rehype-sanitize'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import {normalizeNotionMarkdown, removeDuplicateTitle} from './notion-markdown-utils.ts'

type NotionElementProps = {
  children?: ReactNode
  className?: string
  color?: string
  icon?: string
  url?: string
  src?: unknown
  source?: unknown
  alt?: string
  inline?: string
  underline?: string
  open?: boolean
  heading?: string
  checked?: string
  ratio?: string
  start?: string
  end?: string
  startTime?: string
  endTime?: string
  timeZone?: string
  'start-time'?: string
  'end-time'?: string
  'time-zone'?: string
  starttime?: string
  timezone?: string
  'definition-id'?: string
  integration?: string
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
  'equation',
  'quote',
  'toggle',
  'todo',
  'columns',
  'column',
  'file',
  'image',
  'page',
  'folder',
  'database',
  'pdf',
  'audio',
  'video',
  'bookmark',
  'embed',
  'link-preview',
  'mention',
  'mention-user',
  'mention-page',
  'mention-database',
  'mention-data-source',
  'mention-agent',
  'mention-date',
  'date',
  'synced_block',
  'synced_block_reference',
  'synced-block',
  'synced-block-reference',
  'notion-table-of-contents',
  'table-of-contents',
  'notion-image',
  'empty-block',
  'unknown',
  'external_object_instance',
  'external-object-instance',
  'custom-block'
]

const sanitizedHeadingIdPrefix = defaultSchema.clobberPrefix ?? ''

// Allow the official Notion-flavored tags through sanitization while keeping arbitrary HTML out.
const notionSanitizeSchema = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), ...notionTags, 'nav'],
  attributes: {
    ...defaultSchema.attributes,
    callout: ['icon', 'color'],
    equation: ['color'],
    quote: ['color'],
    toggle: ['heading', 'color'],
    todo: ['checked', 'color'],
    details: ['color', 'open', ['className', 'notion-toc']],
    span: ['color', 'underline'],
    file: ['src', 'source', 'color'],
    image: ['src', 'source', 'color'],
    'notion-image': ['src', 'source', 'color'],
    page: ['url', 'color'],
    folder: ['url', 'color'],
    database: ['url', 'inline', 'icon', 'color'],
    pdf: ['src', 'source', 'color'],
    audio: ['src', 'source', 'color', 'controls'],
    video: ['src', 'source', 'color', 'controls', 'poster', 'width', 'height'],
    bookmark: ['url', 'source'],
    embed: ['url', 'source'],
    'link-preview': ['url', 'source'],
    mention: ['url', 'type'],
    'mention-user': ['url'],
    'mention-page': ['url'],
    'mention-database': ['url'],
    'mention-data-source': ['url'],
    'mention-agent': ['url'],
    'mention-date': ['start', 'end', 'starttime', 'timezone', 'startTime', 'timeZone'],
    date: ['start', 'end', 'start-time', 'end-time', 'time-zone', 'startTime', 'endTime', 'timeZone'],
    synced_block: ['url'],
    synced_block_reference: ['url'],
    'synced-block': ['url'],
    'synced-block-reference': ['url', 'notice'],
    'external-object-instance': ['integration'],
    unknown: ['url', 'alt'],
    'custom-block': ['definition-id', 'url'],
    table: ['fit-page-width', 'header-row', 'header-column', 'fitPageWidth', 'headerRow', 'headerColumn'],
    colgroup: [],
    col: ['width', 'color'],
    tr: ['color'],
    th: ['color'],
    td: ['color'],
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
  return <a {...props} href={safeUrl} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>{children}</a>
}

function MarkdownImage({src, alt = '', node: _node, ...props}: MarkdownImageProps) {
  const safeSrc = typeof src === 'string' ? safeHref(src) : undefined
  if (!safeSrc) return null
  // Notion returns temporary signed image URLs, so the renderer uses a normal img element.
  return <img src={safeSrc} alt={alt} loading='lazy' decoding='async' {...props} />
}

function MarkdownCode({children, className, inline: _inline, node: _node, ...props}: MarkdownCodeProps) {
  const language = className?.match(/language-([\w-]+)/)?.[1]?.toLowerCase()
  return <code className={className} data-language={language} {...props}>{children}</code>
}

function mediaSource(src?: unknown, source?: unknown): string | undefined {
  // v1 使用 src，v2 使用 source；统一处理后再执行协议校验。
  const value = typeof source === 'string' ? source : src
  return typeof value === 'string' ? safeHref(value) : undefined
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

function isTableOfContentsPlaceholder(node: HastNode): boolean {
  // 目录占位标签在 rehypeRaw 中可能位于段落内部，需要单独识别。
  return node.type === 'element' && node.tagName === 'notion-table-of-contents'
}

const blockPlaceholderTags = new Set([
  'callout',
  'equation',
  'quote',
  'todo',
  'columns',
  'column',
  'notion-image',
  'custom-block',
  'external-object-instance',
  'synced-block',
  'synced-block-reference'
])

function isBlockPlaceholder(node: HastNode): boolean {
  return node.type === 'element' && Boolean(node.tagName && blockPlaceholderTags.has(node.tagName))
}

// HTML 自定义块可能先被 Markdown 解析器放入 p；提升到同级，避免块元素嵌套在 p 中。
function promoteBlockPlaceholders(nodes: HastNode[]): HastNode[] {
  return nodes.flatMap(node => {
    if (node.tagName === 'p' && node.children?.some(isBlockPlaceholder)) {
      const replacement: HastNode[] = []
      let proseChildren: HastNode[] = []
      for (const child of node.children) {
        if (isBlockPlaceholder(child)) {
          if (proseChildren.length > 0) replacement.push({...node, children: proseChildren})
          replacement.push(child)
          proseChildren = []
        } else {
          proseChildren.push(child)
        }
      }
      if (proseChildren.length > 0) replacement.push({...node, children: proseChildren})
      return replacement
    }
    if (node.children) node.children = promoteBlockPlaceholders(node.children)
    return [node]
  })
}

// Replaces every official Notion placeholder with the same outline used for heading IDs.
function replaceTableOfContents(nodes: HastNode[], headings: MarkdownHeading[]): HastNode[] {
  return nodes.flatMap(node => {
    if (isTableOfContentsPlaceholder(node)) {
      return headings.length > 0 ? [createTableOfContents(headings)] : []
    }

    // 自定义标签会先被 Markdown 解析器放进 p；提升到同级，避免 details 嵌套在 p 中触发 hydration 错误。
    if (node.tagName === 'p' && node.children?.some(isTableOfContentsPlaceholder)) {
      const replacement: HastNode[] = []
      let proseChildren: HastNode[] = []
      for (const child of node.children) {
        if (isTableOfContentsPlaceholder(child)) {
          if (proseChildren.length > 0) replacement.push({...node, children: proseChildren})
          if (headings.length > 0) replacement.push(createTableOfContents(headings))
          proseChildren = []
        } else {
          proseChildren.push(child)
        }
      }
      if (proseChildren.length > 0) replacement.push({...node, children: proseChildren})
      return replacement
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

    root.children = promoteBlockPlaceholders(root.children)
    const hasPlaceholder = containsTableOfContents(root.children)
    const renderedNodes = replaceTableOfContents(root.children, headings)
    root.children = !hasPlaceholder && headings.length >= 4
      ? [createTableOfContents(headings), ...renderedNodes]
      : renderedNodes
  }
}

/**
 * React Markdown owns the outer pre element for fenced blocks. Mermaid blocks
 * become static placeholders; an Astro page script upgrades them in the browser.
 */
function MarkdownPre({children, node: _node, ...props}: MarkdownPreProps) {
  const codeChild = Children.toArray(children).find(child =>
    isValidElement<{className?: string; children?: ReactNode}>(child)
  )

  if (
    isValidElement<{className?: string; children?: ReactNode}>(codeChild) &&
    /(?:^|\s)language-mermaid(?:\s|$)/.test(codeChild.props.className ?? '')
  ) {
    const chart = textContent(codeChild.props.children).replace(/\n$/, '')
    return <div className='mermaid-diagram-loading' data-mermaid><pre><code>{chart}</code></pre></div>
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
    <a className='notion-heading-link' href={`#${id}`} aria-label={label ? `链接至：${label}` : '段落链接'}>#</a>
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

function NotionEquation({children, color}: NotionElementProps) {
  const source = textContent(children).trim()
  if (!source) return null
  const html = katex.renderToString(source, {displayMode: true, throwOnError: false, trust: false})
  return <div className={`notion-equation ${colorClass(color) ?? ''}`.trim()} dangerouslySetInnerHTML={{__html: html}} />
}

function NotionQuote({children}: NotionElementProps) {
  // v2 quote 直接映射为语义化 blockquote。
  return <blockquote>{children}</blockquote>
}

function NotionTodo({children, checked}: NotionElementProps) {
  // v2 todo 的 checked 属性只决定展示状态，不允许文章页面修改它。
  return <div className='notion-todo'>
    <input type='checkbox' checked={checked === 'true'} readOnly aria-label={checked === 'true' ? '已完成' : '未完成'} />
    <span>{children}</span>
  </div>
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

function NotionReference({children, url, source, className}: NotionElementProps & {className?: string}) {
  const reference = typeof source === 'string' ? source : url
  if (reference && /^(?:user|agent|collection):\/\//i.test(reference)) {
    return <span className={`notion-reference ${className ?? ''}`.trim()}>{children ?? reference}</span>
  }
  return <ExternalLink className={`notion-reference ${className ?? ''}`.trim()} href={reference}>{children ?? reference ?? '打开 Notion'}</ExternalLink>
}

function NotionMedia({children, src, source, className}: NotionElementProps & {className?: string}) {
  const safeUrl = mediaSource(src, source)
  if (!safeUrl) return null
  return <a className={`notion-media ${className ?? ''}`.trim()} href={safeUrl} target='_blank' rel='noreferrer'>{children ?? '打开媒体文件'}</a>
}

function NotionImage({children, src, source, alt = ''}: NotionElementProps) {
  // v2 image 的 caption 作为图注显示，签名 URL 仍使用普通 img 加载。
  const safeSrc = mediaSource(src, source)
  if (!safeSrc) return null
  const caption = children ?? alt
  // Notion 的图片 URL 是短期签名地址，直接使用普通 img 加载。
  return <figure><img src={safeSrc} alt={alt || textContent(children)} loading='lazy' decoding='async' />{caption && <figcaption>{caption}</figcaption>}</figure>
}

function NotionAudio({src, source}: NotionElementProps) {
  const safeUrl = mediaSource(src, source)
  return safeUrl ? <audio controls src={safeUrl}>你的浏览器不支持音频播放。</audio> : null
}

function NotionVideo({src, source}: NotionElementProps) {
  const safeUrl = mediaSource(src, source)
  return safeUrl ? <video controls src={safeUrl}>你的浏览器不支持视频播放。</video> : null
}

function NotionDate(props: NotionElementProps) {
  // 日期标签只负责展示 Notion 返回的日期和时区信息。
  const {children, start, end} = props
  const startTime = props.startTime ?? props['start-time'] ?? props.starttime
  const endTime = props.endTime ?? props['end-time']
  const timeZone = props.timeZone ?? props['time-zone'] ?? props.timezone
  const label = children ?? [start, end].filter(Boolean).join(' – ')
  const time = [startTime, endTime].filter(Boolean).join(' – ')
  return <time className='notion-mention-date' dateTime={start}>{label}{time ? ` ${time}` : ''}{timeZone ? ` (${timeZone})` : ''}</time>
}

function NotionUnsupported({children, integration, url, alt, 'definition-id': definitionId}: NotionElementProps) {
  const label = children ?? alt ?? integration ?? (definitionId ? `自定义区块 ${definitionId}` : 'Notion 内容')
  return <div className='notion-unknown'>未支持的 Notion 内容：{label} {url && <ExternalLink href={url}>在 Notion 中打开</ExternalLink>}</div>
}

function NotionUnknown({url, alt}: NotionElementProps) {
  return <div className='notion-unknown'>未支持的 Notion 内容：{alt ?? 'unknown'} {url && <ExternalLink href={url}>在 Notion 中打开</ExternalLink>}</div>
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
  equation: NotionEquation,
  quote: NotionQuote,
  todo: NotionTodo,
  details: NotionDetails,
  columns: NotionColumns,
  column: NotionColumn,
  file: NotionMedia,
  image: NotionImage,
  'notion-image': NotionImage,
  pdf: NotionMedia,
  audio: NotionAudio,
  video: NotionVideo,
  bookmark: NotionReference,
  embed: NotionReference,
  'link-preview': NotionReference,
  page: NotionReference,
  folder: NotionReference,
  database: NotionReference,
  mention: NotionReference,
  'mention-user': NotionReference,
  'mention-page': NotionReference,
  'mention-database': NotionReference,
  'mention-data-source': NotionReference,
  'mention-agent': NotionReference,
  'mention-date': NotionDate,
  date: NotionDate,
  synced_block: ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  synced_block_reference: ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  'synced-block': ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  'synced-block-reference': ({children}: NotionElementProps) => <div className='notion-synced-block'>{children}</div>,
  'external-object-instance': NotionUnsupported,
  'custom-block': NotionUnsupported,
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
