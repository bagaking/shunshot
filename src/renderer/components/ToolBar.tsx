import React, { useState } from 'react'
import { CaptureBounds } from '../types/capture'

interface ToolBarProps {
  onConfirm: () => void
  onCancel: () => void
  onOCR: ()=> Promise<{text?: string, error?: any}>
  selectedBounds: CaptureBounds | null
  isScreenRecording?: boolean
  onModeChange?: (isScreenRecording: boolean) => void
}

interface ToolButton {
  icon: JSX.Element
  tooltip: string
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
}

interface OCRResult {
  text?: string
  error?: string
}

export const ToolBar: React.FC<ToolBarProps> = ({
  onConfirm,
  onCancel,
  onOCR,
  selectedBounds,
  isScreenRecording = false,
  onModeChange
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string>('')
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  const handleOCR = async () => {
    if (!selectedBounds) {
      setOcrResult({ error: '请先选择要识别的区域' })
      return
    }

    setIsProcessing(true)
    try {
      const result = await onOCR()
      if (result.error) {
        setOcrResult({ 
          error: result.error 
        })
      } else {
        setOcrResult({ 
          text: result.text 
        })
      }
    } catch (error) {
      setOcrResult({ error: '识别失败,请重试' })
    } finally {
      setIsProcessing(false)
    }
  }

  const tools: ToolButton[] = [
    {
      tooltip: '矩形选择',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
        </svg>
      )
    },
    {
      tooltip: '椭圆选择',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 3c4.97 0 9 3.13 9 7s-4.03 7-9 7-9-3.13-9-7 4.03-7 9-7z" />
        </svg>
      )
    },
    {
      tooltip: '画笔',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
        </svg>
      )
    },
    {
      tooltip: '马赛克',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      )
    },
    {
      tooltip: '文字',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
        </svg>
      )
    },
    {
      tooltip: 'OCR 识别',
      icon: (
        <svg className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M7 3a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V7.414a2 2 0 00-.586-1.414l-3.414-3.414A2 2 0 0013.586 2H7zm5 1v3a2 2 0 002 2h3M7 13h10M7 17h10M7 9h3" />
        </svg>
      ),
      onClick: handleOCR,
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: isScreenRecording ? '切换到截图' : '切换到录屏',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {isScreenRecording ? (
            <path d="M3 9a2 2 0 012-2h14a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          ) : (
            <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14v-4z M3 8v8a2 2 0 002 2h10a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2z" />
          )}
        </svg>
      ),
      onClick: () => onModeChange?.(!isScreenRecording)
    },
    {
      tooltip: 'AI 助手',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.51 0 10-4.48 10-10S17.51 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
          <path d="M9 9a3 3 0 015.12-2.12L15.24 8m-.01 4l-1.13 1.12a3 3 0 01-5.12-2.12" />
          <circle cx="12" cy="12" r="2" />
        </svg>
      )
    }
  ]

  const actions: ToolButton[] = [
    {
      tooltip: '取消',
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M6 18L18 6M6 6l12 12" />
        </svg>
      ),
      onClick: onCancel
    },
    {
      tooltip: '确认',
      primary: true,
      icon: (
        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 13l4 4L19 7" />
        </svg>
      ),
      onClick: onConfirm
    },
  ]

  return (
    <div className="flex flex-col items-start space-y-2">
      <div className="flex items-center space-x-1 bg-white/90 backdrop-blur-sm shadow-md rounded-lg p-1">
        {/* 工具按钮组 */}
        <div className="flex items-center space-x-0.5">
          {tools.map((tool, index) => (
            <div key={index} className="relative group">
              <button
                className={`w-7 h-7 rounded-md flex items-center justify-center text-gray-500 transition-colors duration-150 ${
                  tool.disabled 
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:text-gray-900 active:text-blue-600'
                }`}
                onMouseEnter={() => setActiveTooltip(tool.tooltip)}
                onMouseLeave={() => setActiveTooltip('')}
                onClick={tool.onClick}
                disabled={tool.disabled}
              >
                {tool.icon}
              </button>
              {activeTooltip === tool.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] text-white bg-gray-800/90 rounded shadow-sm whitespace-nowrap">
                  {tool.tooltip}
                  {tool.disabled && !isProcessing && ' (请先选择区域)'}
                  {isProcessing && ' (处理中...)'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 分隔线 */}
        <div className="w-[1px] self-stretch mx-0.5 bg-gray-200/80" />

        {/* 操作按钮组 */}
        <div className="flex items-center space-x-0.5">
          {actions.map((action, index) => (
            <div key={index} className="relative group">
              <button
                onClick={action.onClick}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 ${
                  action.primary
                    ? 'text-blue-500 hover:text-blue-600 active:text-blue-700'
                    : 'text-gray-500 hover:text-gray-900 active:text-red-600'
                }`}
                onMouseEnter={() => setActiveTooltip(action.tooltip)}
                onMouseLeave={() => setActiveTooltip('')}
              >
                {action.icon}
              </button>
              {activeTooltip === action.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] text-white bg-gray-800/90 rounded shadow-sm whitespace-nowrap">
                  {action.tooltip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* OCR 结果展示 */}
      {ocrResult && (
        <div className={`max-w-md p-2 rounded-lg shadow-md text-sm ${
          ocrResult.error 
            ? 'bg-red-50 text-red-600 border border-red-200' 
            : 'bg-white/90 backdrop-blur-sm text-gray-700'
        }`}>
          {ocrResult.error ? (
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{ocrResult.error}</span>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">识别结果:</span>
                <button
                  onClick={() => navigator.clipboard.writeText(ocrResult.text || '')}
                  className="text-xs text-blue-500 hover:text-blue-600"
                >
                  复制
                </button>
              </div>
              <p className="whitespace-pre-wrap">{ocrResult.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
} 