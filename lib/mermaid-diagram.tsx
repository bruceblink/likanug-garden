'use client'

import { useEffect, useId, useState } from 'react'

type MermaidDiagramProps = {
  chart: string
}

type RenderedDiagram = {
  chart: string
  svg: string
  failed: boolean
}

let mermaidLoader: Promise<typeof import('mermaid').default> | null = null
let renderSequence = 0

/** Loads Mermaid once and applies a strict, browser-safe configuration for article content. */
function loadMermaid() {
  mermaidLoader ??= import('mermaid').then(({ default: mermaid }) => {
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

/** Renders Mermaid source in the browser so server-side article pages stay compatible. */
export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const diagramId = `mermaid-${useId().replaceAll(':', '')}`
  const [renderedDiagram, setRenderedDiagram] = useState<RenderedDiagram | null>(null)

  useEffect(() => {
    let isCurrent = true

    /** Loads Mermaid only in the browser and ignores results from an unmounted diagram. */
    async function renderDiagram() {
      try {
        const mermaid = await loadMermaid()
        const result = await mermaid.render(`${diagramId}-${++renderSequence}`, chart)
        if (isCurrent) {
          setRenderedDiagram({ chart, svg: result.svg, failed: false })
        }
      } catch (error) {
        console.error('Unable to render Mermaid diagram', error)
        if (isCurrent) {
          setRenderedDiagram({ chart, svg: '', failed: true })
        }
      }
    }

    void renderDiagram()

    return () => {
      isCurrent = false
    }
  }, [chart, diagramId])

  // A changed chart stays in the loading state until its own asynchronous render finishes.
  const currentDiagram = renderedDiagram?.chart === chart ? renderedDiagram : null

  if (currentDiagram?.failed) {
    return <pre className='mermaid-diagram-error'><code>{chart}</code></pre>
  }

  if (!currentDiagram?.svg) {
    return <div className='mermaid-diagram-loading' aria-live='polite'>Rendering diagram...</div>
  }

  return <div aria-label='Mermaid diagram' className='mermaid-diagram-canvas' role='img' dangerouslySetInnerHTML={{ __html: currentDiagram.svg }} />
}
