import type { ReactNode } from 'react'
import { MermaidDiagram } from './mermaid-diagram'

type Block = Record<string, any>

function RichText({ items }: { items: Array<any> }) {
  return <>{items.map((item, index) => {
    const text = item.plain_text ?? ''
    const content = item.annotations?.code ? <code>{text}</code> : text
    return item.href ? <a key={index} href={item.href} target='_blank' rel='noreferrer'>{content}</a> : <span key={index}>{content}</span>
  })}</>
}

export function NotionBlocks({ blocks }: { blocks: Block[] }) {
  return <div className='notion-content'>{blocks.map(block => <BlockView block={block} key={block.id} />)}</div>
}

function BlockView({ block }: { block: Block }): ReactNode {
  const value = block[block.type] ?? {}
  const text = value.rich_text ?? value.text ?? []
  switch (block.type) {
    case 'heading_1': return <h2><RichText items={text} /></h2>
    case 'heading_2': return <h3><RichText items={text} /></h3>
    case 'heading_3': return <h4><RichText items={text} /></h4>
    case 'bulleted_list_item': return <ul><li><RichText items={text} /></li></ul>
    case 'numbered_list_item': return <ol><li><RichText items={text} /></li></ol>
    case 'to_do': return <p><input type='checkbox' checked={Boolean(value.checked)} readOnly /> <RichText items={text} /></p>
    case 'quote': return <blockquote><RichText items={text} /></blockquote>
    case 'code': {
      // Notion keeps Mermaid diagrams in code blocks, so preserve other languages as source code.
      const language = typeof value.language === 'string' ? value.language.toLowerCase() : ''
      return language === 'mermaid'
        ? <MermaidDiagram chart={plain(text)} />
        : <pre><code>{plain(text)}</code></pre>
    }
    case 'divider': return <hr />
    case 'image': {
      const source = value.type === 'external' ? value.external?.url : value.file?.url
      return source ? <figure><img src={source} alt={plain(value.caption ?? [])} /><figcaption><RichText items={value.caption ?? []} /></figcaption></figure> : null
    }
    case 'bookmark': return <p><a href={value.url} target='_blank' rel='noreferrer'>{value.caption ? <RichText items={value.caption} /> : value.url}</a></p>
    case 'paragraph': return <p><RichText items={text} /></p>
    default: return text.length ? <p><RichText items={text} /></p> : null
  }
}

function plain(items: Array<any>): string {
  return items.map(item => item.plain_text ?? '').join('')
}
