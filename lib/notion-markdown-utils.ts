// Notion Markdown 的清理逻辑保持为纯函数，方便在服务端渲染前复用和验证。

function transformOutsideFencedCode(markdown: string, transform: (prose: string) => string): string {
  const parts: string[] = []
  const lines = markdown.split(/\r?\n/)
  let buffer: string[] = []
  let fence: {character: string; length: number} | null = null

  const flushProse = () => {
    if (buffer.length === 0) return
    parts.push(transform(buffer.join('\n')))
    buffer = []
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

// 行内代码同样必须保持原样，避免示例中的 Notion 标签被当作真实块处理。
function transformOutsideInlineCode(markdown: string, transform: (prose: string) => string): string {
  const inlineCode: string[] = []
  const protectedMarkdown = markdown.replace(/(`+)([^`\n]*?)\1/g, match => {
    const index = inlineCode.push(match) - 1
    return `\u0000${index}\u0000`
  })
  const transformed = transform(protectedMarkdown)
  return transformed.replace(/\u0000(\d+)\u0000/g, (_, index: string) => inlineCode[Number(index)])
}

// 把 v1 表格单元格折叠成 GFM 可接受的一行，并保留换行与竖线。
// v1 和 v2 的 HTML 表格保留原始结构，交给 rehypeRaw 解析以避免丢失列标题、颜色和宽度。
function convertNotionTables(markdown: string): string {
  return markdown.replace(/<table\b[\s\S]*?<\/table>/gi, table => `\n\n${table.trim()}\n\n`)
}

// 删除 Notion 输出的空“参考文章”区块，避免页面出现孤立列表标记。
function removeEmptyReferenceSection(markdown: string): string {
  return markdown.replace(/(?:^|\n)#{1,6}\s*(?:📎\s*)?参考文章\s*\n(?:\s*[-*+]\s*)+\s*$/u, '\n')
}

// v1 使用下划线标签，v2 使用连字符标签；统一为安全的内部占位标签。
function normalizeNotionTableOfContents(markdown: string): string {
  return markdown
    .replace(/<table_of_contents\b([^>]*)\/\s*>/gi, '<notion-table-of-contents$1></notion-table-of-contents>')
    .replace(/<table-of-contents\b([^>]*)\/\s*>/gi, '<notion-table-of-contents$1></notion-table-of-contents>')
    .replace(/<\/?table_of_contents\b/gi, tag => tag.startsWith('</') ? '</notion-table-of-contents' : '<notion-table-of-contents')
    .replace(/<\/?table-of-contents\b/gi, tag => tag.startsWith('</') ? '</notion-table-of-contents' : '<notion-table-of-contents')
}

// 规范化 v1/v2 的块标签，避免下划线标签被 rehypeRaw 当作普通文本。
function normalizeNotionBlockTags(markdown: string): string {
  return markdown
    .replace(/<image\b([^>]*)>([\s\S]*?)<\/image>/gi, '<notion-image$1>$2</notion-image>')
    .replace(/<image\b([^>]*)\/\s*>/gi, '<notion-image$1></notion-image>')
    .replace(/<\/?synced_block\b/gi, tag => tag.startsWith('</') ? '</synced-block' : '<synced-block')
    .replace(/<\/?synced_block_reference\b/gi, tag => tag.startsWith('</') ? '</synced-block-reference' : '<synced-block-reference')
    .replace(/<\/?external_object_instance\b/gi, tag => tag.startsWith('</') ? '</external-object-instance' : '<external-object-instance')
    .replace(/<custom-block\b([^>]*)\/\s*>/gi, '<custom-block$1></custom-block>')
    .replace(/<external-object-instance\b([^>]*)\/\s*>/gi, '<external-object-instance$1></external-object-instance>')
}

function matchingToggleEnd(markdown: string, start: number): number | undefined {
  const tags = /<\/?toggle\b[^>]*>/gi
  tags.lastIndex = start
  let depth = 0
  let match: RegExpExecArray | null
  while ((match = tags.exec(markdown))) {
    if (match[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return match.index
    } else {
      depth += 1
    }
  }
  return undefined
}

// v2 的 toggle 是带标题的容器；使用状态扫描保留嵌套正文和标题级别。
function normalizeNotionToggles(markdown: string): string {
  const openPattern = /<toggle\b([^>]*)>/gi
  let output = ''
  let cursor = 0
  let match: RegExpExecArray | null
  while ((match = openPattern.exec(markdown))) {
    const end = matchingToggleEnd(markdown, match.index)
    if (end === undefined) break
    const closeEnd = markdown.indexOf('>', end) + 1
    if (closeEnd <= end) break
    output += markdown.slice(cursor, match.index)
    const attributes = match[1]
    const body = markdown.slice(openPattern.lastIndex, end)
    const content = body.trim()
    const separator = content.search(/\n\s*\n/)
    const title = separator < 0 ? content : content.slice(0, separator).trim()
    const children = separator < 0 ? '' : normalizeNotionToggles(content.slice(separator).trim())
    const color = attributes.match(/\bcolor\s*=\s*(["'][^"']+["'])/i)?.[1]
    const heading = attributes.match(/\bheading\s*=\s*(["'])(h[1-4])\1/i)?.[2]
    const detailsAttributes = color ? ` color=${color}` : ''
    const summaryClass = heading ? ` class="notion-toggle-heading notion-toggle-${heading}"` : ''
    output += `<details${detailsAttributes}><summary${summaryClass}>${title}</summary>${children ? `\n\n${children}\n\n` : ''}</details>`
    cursor = closeEnd
    openPattern.lastIndex = closeEnd
  }
  return output + markdown.slice(cursor)
}

// 只在代码围栏外清理 v1 属性，避免文章中的示例代码被改写。
export function normalizeNotionMarkdown(markdown: string): string {
  return transformOutsideFencedCode(markdown, prose =>
    transformOutsideInlineCode(prose, inlineSafeProse =>
      normalizeNotionTableOfContents(
        normalizeNotionBlockTags(normalizeNotionToggles(
          removeEmptyReferenceSection(convertNotionTables(inlineSafeProse))
            .replace(/\s+\{[^{}\n]*(?:color="[^"]+"|toggle="true")[^{}\n]*\}/g, '')
        ))
      )
    )
  )
}

// 只删除正文开头的重复标题，代码围栏中的同名示例必须保留。
export function removeDuplicateTitle(markdown: string, title?: string): string {
  if (!title) return markdown
  const normalizedTitle = title.trim().replace(/\s+/g, ' ')
  const lines = markdown.split(/\r?\n/)
  const firstIndex = lines.findIndex(line => line.trim() !== '')
  if (firstIndex < 0 || /^\s*(`{3,}|~{3,})/.test(lines[firstIndex])) return markdown
  const match = lines[firstIndex].match(/^#\s+(.+?)(?:\s+\{[^\n]*\})?\s*$/)
  if (!match || match[1].trim().replace(/\s+/g, ' ') !== normalizedTitle) return markdown
  lines.splice(firstIndex, 1)
  while (firstIndex < lines.length && lines[firstIndex].trim() === '') lines.splice(firstIndex, 1)
  return lines.join('\n')
}
