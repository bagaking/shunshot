import React, { useState } from 'react'

interface ToolBarProps {
  onConfirm: () => void
  onCancel: () => void
}

interface ToolButton {
  icon: JSX.Element
  tooltip: string
  onClick?: () => void
  primary?: boolean
}

export const ToolBar: React.FC<ToolBarProps> = ({ onConfirm, onCancel }) => {
  const [activeTooltip, setActiveTooltip] = useState<string>('')

  const tools: ToolButton[] = [
    {
      tooltip: '矩形选择',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      )
    },
    {
      tooltip: '椭圆选择',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="8" />
        </svg>
      )
    },
    {
      tooltip: '画笔',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a.996.996 0 000-1.41l-2.34-2.34a.996.996 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
        </svg>
      )
    },
    {
      tooltip: '马赛克',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 4h4v4H4V4zm6 0h4v4h-4V4zm6 0h4v4h-4V4zM4 10h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4zM4 16h4v4H4v-4zm6 0h4v4h-4v-4zm6 0h4v4h-4v-4z" />
        </svg>
      )
    },
    {
      tooltip: '文字',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9.62 12h4.76L12 5.67 9.62 12zm2.38-8L16.5 13h2.1l-4.75-11H10.15L5.4 13h2.1l4.5-9z" />
        </svg>
      )
    }
  ]

  const actions: ToolButton[] = [
    {
      tooltip: '确认',
      primary: true,
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
        </svg>
      ),
      onClick: onConfirm
    },
    {
      tooltip: '取消',
      icon: (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      ),
      onClick: onCancel
    }
  ]

  return (
    <div className="flex items-center space-x-1.5 bg-white/95 backdrop-blur-sm shadow-lg rounded-xl p-1.5">
      {/* 工具按钮组 */}
      <div className="flex items-center space-x-1">
        {tools.map((tool, index) => (
          <div key={index} className="relative group">
            <button
              className="w-8 h-8 rounded-lg bg-gray-100 hover:bg-gray-200 active:bg-gray-300 flex items-center justify-center text-gray-700 transition-all duration-150"
              onMouseEnter={() => setActiveTooltip(tool.tooltip)}
              onMouseLeave={() => setActiveTooltip('')}
              onClick={tool.onClick}
            >
              {tool.icon}
            </button>
            {activeTooltip === tool.tooltip && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap">
                {tool.tooltip}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 分隔线 */}
      <div className="w-px self-stretch bg-gray-200" />

      {/* 操作按钮组 */}
      <div className="flex items-center space-x-1">
        {actions.map((action, index) => (
          <div key={index} className="relative group">
            <button
              onClick={action.onClick}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-150 ${
                action.primary
                  ? 'bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700'
              }`}
              onMouseEnter={() => setActiveTooltip(action.tooltip)}
              onMouseLeave={() => setActiveTooltip('')}
            >
              {action.icon}
            </button>
            {activeTooltip === action.tooltip && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-gray-800 rounded whitespace-nowrap">
                {action.tooltip}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
} 