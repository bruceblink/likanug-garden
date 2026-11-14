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
function tableCellToMarkdown(cell: string): string {
  return cell
    .trim()
    .replace(/<br\s*\/?\s*>/gi, '<br />')
    .replace(/\r?\n\s*/g, '<br />')
    .replace(/\|/g, '\\|')
}

// v1 的带样式表格需要转换为 GFM；普通表格和代码围栏保持原样。
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
    return [
      `| ${header.join(' | ')} |`,
      `| ${header.map(() => '---').join(' | ')} |`,
      ...bodyRows.map(row => `| ${row.join(' | ')} |`)
    ].join('\n').replace(/^/, '\n\n').concat('\n\n')
  })
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

// v2 的 toggle 是带标题的容器；转换为标准 details，确保 Markdown 解析器保留正文块。
function normalizeNotionToggles(markdown: string): string {
  return markdown.replace(/<toggle\b([^>]*)>([\s\S]*?)<\/toggle>/gi, (_, attributes: string, body: string) => {
    const content = body.trim()
    const separator = content.search(/\n\s*\n/)
    const title = separator < 0 ? content : content.slice(0, separator).trim()
    const children = separator < 0 ? '' : content.slice(separator).trim()
    const color = attributes.match(/\bcolor\s*=\s*(["'][^"']+["'])/i)?.[1]
    const detailsAttributes = color ? ` color=${color}` : ''
    return `<details${detailsAttributes}><summary>${title}</summary>${children ? `\n\n${children}\n\n` : ''}</details>`
  })
}

// 只在代码围栏外清理 v1 属性，避免文章中的示例代码被改写。
export function normalizeNotionMarkdown(markdown: string): string {
  return transformOutsideFencedCode(markdown, prose =>
    transformOutsideInlineCode(prose, inlineSafeProse =>
      normalizeNotionTableOfContents(
        normalizeNotionToggles(
          removeEmptyReferenceSection(convertNotionTables(inlineSafeProse))
            .replace(/\s+\{[^{}\n]*(?:color="[^"]+"|toggle="true")[^{}\n]*\}/g, '')
        )
      )
    )
  )
}

// 只删除正文开头的重复标题，代码围栏中的同名示例必须保留。
export function removeDuplicateTitle(markdown: string, title?: string): string {
  if (!title) return markdown
  const normalizedTitle = title.trim().replace(/\s+/g, ' ')
  const lines = markdown.split(/\r?\n/)
  let fence: {character: string; length: number} | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const marker = line.match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      const closingFence = new RegExp(`^\\s*${fence.character}{${fence.length},}\\s*$`)
      if (closingFence.test(line)) fence = null
      continue
    }
    if (marker) {
      fence = {character: marker[1][0], length: marker[1].length}
      continue
    }

    const match = line.match(/^#\s+(.+?)(?:\s+\{[^\n]*\})?\s*$/)
    if (!match) continue
    if (match[1].trim().replace(/\s+/g, ' ') !== normalizedTitle) return markdown
    lines.splice(index, 1)
    while (index < lines.length && lines[index].trim() === '') lines.splice(index, 1)
    return lines.join('\n')
  }

  return markdown
}
