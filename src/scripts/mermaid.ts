type MermaidModule = typeof import('mermaid').default

let mermaidLoader: Promise<MermaidModule> | undefined
let renderSequence = 0

// Mermaid 只在文章包含图表时加载，避免首页和普通文章承担额外脚本。
function loadMermaid(): Promise<MermaidModule> {
  mermaidLoader ??= import('mermaid').then(({default: mermaid}) => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      suppressErrorRendering: true,
      theme: 'dark'
    })
    return mermaid
  })
  return mermaidLoader
}

// 将服务端输出的 Mermaid 源码占位块替换为安全配置生成的 SVG。
async function renderMermaidBlocks(): Promise<void> {
  const blocks = Array.from(document.querySelectorAll<HTMLElement>('[data-mermaid]'))
  if (blocks.length === 0) return

  const mermaid = await loadMermaid()
  await Promise.all(blocks.map(async (block) => {
    const chart = block.querySelector('code')?.textContent?.trim() ?? ''
    if (!chart) return

    try {
      const result = await mermaid.render(`mermaid-${++renderSequence}`, chart)
      block.className = 'mermaid-diagram-canvas'
      block.setAttribute('role', 'img')
      block.setAttribute('aria-label', 'Mermaid diagram')
      block.replaceChildren()
      block.insertAdjacentHTML('afterbegin', result.svg)
    } catch (error) {
      console.error('Unable to render Mermaid diagram', error)
      block.className = 'mermaid-diagram-error'
    }
  }))
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => void renderMermaidBlocks(), {once: true})
} else {
  void renderMermaidBlocks()
}
