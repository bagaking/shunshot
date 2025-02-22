import React, { useEffect, useState } from 'react'
import { Button } from 'antd'
import { CodeOutlined, PictureOutlined } from '@ant-design/icons'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import mermaid from 'mermaid'
import type { Components } from 'react-markdown'
import 'highlight.js/styles/github.css'

import { ChatCompletionContentPart } from '../../types/agents'

// Initialize mermaid configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  fontFamily: 'ui-sans-serif, system-ui, -apple-system',
  flowchart: {
    htmlLabels: true,
    curve: 'basis',
    padding: 8
  },
  sequence: {
    useMaxWidth: false,
    // width: "100%,
    // height: auto,
    actorMargin: 50,
    bottomMarginAdj: 20,
    messageMargin: 35,
    boxMargin: 10,
    noteMargin: 10,
    messageAlign: 'center',
    mirrorActors: true,
    wrap: true,
    rightAngles: false,
    showSequenceNumbers: false
  },
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    barGap: 4,
    topPadding: 50
  }
})

interface MermaidContainerProps {
  code: string
}

const MermaidContainer: React.FC<MermaidContainerProps> = ({ code }) => {
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState<string>('')
  const [key, setKey] = useState(0)
  const containerId = `mermaid-${Math.random().toString(36).slice(2)}`

  useEffect(() => {
    if (!showCode) {
      const renderDiagram = async () => {
        try {
          const container = document.getElementById(containerId)
          if (!container) return

          // Clear container
          container.innerHTML = code

          // Re-render
          await mermaid.run({
            querySelector: `#${containerId}`
          })
          setError('')
        } catch (err) {
          console.error('Mermaid rendering failed:', err)
          setError(err instanceof Error ? err.message : 'Failed to render diagram')
        }
      }
      renderDiagram()
    }
  }, [showCode, code, key, containerId])

  return (
    <div className="relative group bg-[#1E1E1E] rounded-lg p-4 my-4">
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Button
          type="text"
          size="small"
          icon={showCode ? <PictureOutlined /> : <CodeOutlined />}
          onClick={() => {
            setShowCode(!showCode)
            if (!showCode) {
              setKey(k => k + 1)
            }
          }}
          className="!text-gray-400 hover:!text-gray-100"
          title={showCode ? "Show diagram" : "Show code"}
        />
      </div>

      {showCode ? (
        <pre className="!bg-transparent !p-0 !m-0">
          <code className="!bg-transparent text-gray-300 whitespace-pre-wrap break-all">
            {code}
          </code>
        </pre>
      ) : (
        <>
          <div id={containerId} className="mermaid">
            {code}
          </div>
          {error && (
            <div className="mt-2 text-red-400 text-sm">
              Failed to render diagram: {error}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export const getMessageString = (content: string | ChatCompletionContentPart[]): string => {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter(part => part.type === 'text')
    .map(part => (part as { text: string }).text)
    .join('\n')
}

const processMermaidCode = (content: string): string => {
  // Match mermaid code blocks, including ``` markers
  const mermaidRegex = /```mermaid\s*([\s\S]*?)```/g
  let lastIndex = 0
  let result = ''
  let match

  while ((match = mermaidRegex.exec(content)) !== null) {
    // Add content before match
    result += content.slice(lastIndex, match.index)
    
    // Extract and clean mermaid code
    const mermaidCode = match[1].trim()
    
    // Wrap mermaid code with custom component
    result += `<mermaid-wrapper code="${encodeURIComponent(mermaidCode)}" />`
    
    lastIndex = match.index + match[0].length
  }

  // Add remaining content
  result += content.slice(lastIndex)
  return result
}

interface CodeBlockRendererProps {
  content: string | ChatCompletionContentPart[]
}

export const CodeBlockRenderer: React.FC<CodeBlockRendererProps> = ({ content }) => {
  const components: Partial<Components> = {
    // @ts-ignore - custom component type
    'mermaid-wrapper': ({ code }: { code: string }) => {
      const decodedCode = decodeURIComponent(code)
      return <MermaidContainer code={decodedCode} />
    }
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight]}
        components={components}
      >
        {typeof content === 'string' 
          ? processMermaidCode(content)
          : processMermaidCode(getMessageString(content))
        }
      </ReactMarkdown>
    </div>
  )
} 