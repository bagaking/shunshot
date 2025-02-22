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

// Base configuration interface
interface BaseConfig {
  fontFamily: string;
  useMaxWidth: boolean;
  padding: number;
  wrap: boolean;
  boxMargin: number;
  messageMargin: number;
  noteMargin: number;
  labelMargin: number;
}

// Common configuration
const commonConfig: BaseConfig = {
  fontFamily: 'consolas, ui-sans-serif, system-ui, -apple-system',
  useMaxWidth: false,
  padding: 8,
  wrap: true,
  boxMargin: 10,
  messageMargin: 35,
  noteMargin: 10,
  labelMargin: 8
}

// Initialize mermaid configuration
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  securityLevel: 'loose',
  
  // Flowchart specific config
  flowchart: {
    htmlLabels: true,
    nodeSpacing: 50,
    rankSpacing: 50,
    diagramPadding: 8,
    curve: 'basis'
  },

  // Sequence diagram config
  sequence: {
    actorMargin: 50,
    bottomMarginAdj: 20,
    messageAlign: 'center',
    mirrorActors: true,
    rightAngles: false,
    showSequenceNumbers: false
  },

  // State diagram config
  stateDiagram: {
    diagramPadding: 8,
    useMaxWidth: true
  },

  // Gantt chart config
  gantt: {
    titleTopMargin: 25,
    barHeight: 20,
    barGap: 4,
    topPadding: 50,
    gridLineStartPadding: 35
  },

  // Class diagram config
  classDiagram: {
    diagramPadding: 8,
    useMaxWidth: true
  },

  // Pie chart config
  pie: {
    textPosition: 0.75
  },

  // Bar chart config
  bar: {
    barWidth: 35,
    barGap: 4,
    xAxisLabelAngle: 45
  }
})

interface MermaidContainerProps {
  code: string
}

// Helper to detect chart type from code
const detectChartType = (code: string): string => {
  const firstLine = code.trim().split('\n')[0].toLowerCase()
  if (firstLine.includes('sequencediagram')) return 'sequence'
  if (firstLine.includes('classDiagram')) return 'class'
  if (firstLine.includes('stateDiagram')) return 'state'
  if (firstLine.includes('gantt')) return 'gantt'
  if (firstLine.includes('pie')) return 'pie'
  if (firstLine.includes('graph') || firstLine.includes('flowchart')) return 'flowchart'
  if (firstLine.includes('bar')) return 'bar'
  if (firstLine.includes('dashboard')) return 'dashboard'
  return 'unknown'
}

const MermaidContainer: React.FC<MermaidContainerProps> = ({ code }) => {
  const [showCode, setShowCode] = useState(false)
  const [error, setError] = useState<string>('')
  const [key, setKey] = useState(0)
  const containerId = `mermaid-${Math.random().toString(36).slice(2)}`
  const chartType = detectChartType(code)

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
      const errorMessage = err instanceof Error ? err.message : 'Failed to render diagram'
      let detailedError = `${chartType !== 'unknown' ? `Failed to render ${chartType} diagram` : 'Failed to render diagram'}`
      
      // Add more specific error information
      if (errorMessage.includes('Syntax error')) {
        detailedError += ': Syntax error in diagram code'
      } else if (errorMessage.includes('Parse error')) {
        detailedError += ': Invalid diagram structure'
      } else {
        detailedError += `: ${errorMessage}`
      }
      
      setError(detailedError)
    }
  }

  useEffect(() => {
    if (!showCode) {
      renderDiagram()
    }
  }, [showCode, code, key, containerId, chartType])

  // Get container class based on chart type
  const getContainerClass = () => {
    const baseClass = "relative group bg-[#1E1E1E] rounded-lg p-4 my-4"
    switch (chartType) {
      case 'gantt':
      case 'bar':
        return `${baseClass} overflow-x-auto`
      case 'sequence':
      case 'flowchart':
      case 'class':
      case 'state':
        return `${baseClass} overflow-auto`
      default:
        return baseClass
    }
  }

  return (
    <div className={getContainerClass()}>
      {/* Error bar with animation */}
      {error && (
        <div 
          className="absolute top-0 left-0 right-0 animate-fade-in"
          style={{
            animation: 'slideDown 0.3s ease-out'
          }}
        >
          <div className="bg-red-500/10 border-t-2 border-red-500 rounded-t-lg">
            <div className="px-4 py-2 text-sm text-red-500 font-medium flex items-center justify-between">
              <div className="flex items-center">
                <span className="mr-2">⚠️</span>
                {error}
              </div>
              <Button
                type="text"
                size="small"
                className="!text-red-500 hover:!text-red-600"
                onClick={renderDiagram}
                title="Retry rendering"
              >
                Retry
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
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

      {/* Content */}
      <div 
        className={error ? 'mt-12' : ''}
        style={{
          transition: 'margin-top 0.3s ease-out'
        }}
      >
        {showCode ? (
          <pre className="!bg-transparent !p-0 !m-0">
            <code className="!bg-transparent text-gray-300 whitespace-pre-wrap break-all">
              {code}
            </code>
          </pre>
        ) : (
          <div id={containerId} className={`mermaid ${chartType}`}>
            {code}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes slideDown {
          from {
            transform: translateY(-100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
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

/**
 * Mermaid Chart Examples:
 * 
 * 1. Flowchart:
 * ```mermaid
 * flowchart TD
 *   A[Start] --> B{Is it?}
 *   B -- Yes --> C[OK]
 *   B -- No --> D[End]
 * ```
 * 
 * 2. Sequence Diagram:
 * ```mermaid
 * sequenceDiagram
 *   Alice->>John: Hello John, how are you?
 *   John-->>Alice: Great!
 * ```
 * 
 * 3. State Diagram:
 * ```mermaid
 * stateDiagram-v2
 *   [*] --> Still
 *   Still --> [*]
 *   Still --> Moving
 *   Moving --> Still
 *   Moving --> Crash
 *   Crash --> [*]
 * ```
 * 
 * 4. Gantt Chart:
 * ```mermaid
 * gantt
 *   title A Gantt Diagram
 *   dateFormat  YYYY-MM-DD
 *   section Section
 *   A task           :a1, 2014-01-01, 30d
 *   Another task     :after a1, 20d
 * ```
 * 
 * 5. Class Diagram:
 * ```mermaid
 * classDiagram
 *   class Animal {
 *     +String name
 *     +move()
 *   }
 *   class Duck {
 *     +swim()
 *   }
 *   Animal <|-- Duck
 * ```
 * 
 * 6. Pie Chart:
 * ```mermaid
 * pie
 *   title Key elements in Product X
 *   "Calcium" : 42.96
 *   "Potassium" : 50.05
 *   "Magnesium" : 10.01
 *   "Iron" :  5
 * ```
 * 
 * 7. Bar Chart:
 * ```mermaid
 * bar
 *   title Orders by Month
 *   Jan 100
 *   Feb 150
 *   Mar 200
 * ```
 * 
 * 8. Dashboard:
 * ```mermaid
 * dashboard
 *   title System Metrics
 *   CPU "85%"
 *   Memory "60%"
 *   Disk "45%"
 * ```
 */

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