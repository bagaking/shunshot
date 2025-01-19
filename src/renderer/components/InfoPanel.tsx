import React, { useCallback, useEffect, useState } from 'react'
import Draggable from 'react-draggable'

interface InfoPanelProps {
  width: number
  height: number
  onDrag: (deltaX: number, deltaY: number) => void
  onDragStart: () => void
  onDragStop: () => void
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ 
  width, 
  height,
  onDrag,
  onDragStart,
  onDragStop
}) => {
  const [isDragging, setIsDragging] = useState(false)
  const [position, setPosition] = useState({ x: 0, y: 0 })

  // 处理拖动开始
  const handleDragStart = useCallback((e: any) => {
    console.log('InfoPanel drag start')
    setIsDragging(true)
    onDragStart()
  }, [onDragStart])

  // 处理拖动
  const handleDrag = useCallback((e: any, data: any) => {
    try {
      console.log('InfoPanel dragging:', {
        deltaX: data.deltaX,
        deltaY: data.deltaY
      })
      onDrag(data.deltaX, data.deltaY)
      setPosition({ x: data.x, y: data.y })
    } catch (error) {
      console.error('Error during InfoPanel drag:', error)
    }
  }, [onDrag])

  // 处理拖动结束
  const handleDragStop = useCallback((e: any) => {
    console.log('InfoPanel drag stop')
    setIsDragging(false)
    onDragStop()
  }, [onDragStop])

  // 监听窗口大小变化，确保面板不会超出视口
  useEffect(() => {
    const handleResize = () => {
      if (position.x < 0 || position.x > window.innerWidth - 300 ||
          position.y < 0 || position.y > window.innerHeight - 50) {
        setPosition({
          x: Math.max(0, Math.min(position.x, window.innerWidth - 300)),
          y: Math.max(0, Math.min(position.y, window.innerHeight - 50))
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [position])

  return (
    <Draggable
      onStart={handleDragStart}
      onDrag={handleDrag}
      onStop={handleDragStop}
      position={position}
      handle=".handle"
      bounds="parent"
      defaultPosition={{ x: 0, y: 0 }}
      positionOffset={{ x: 0, y: 0 }}
      scale={1}
    >
      <div className={`flex items-center space-x-4 bg-black/95 backdrop-blur-sm text-white px-5 py-2.5 
      rounded-lg shadow-lg transition-all duration-150 select-none
        ${isDragging ? 'ring-2 ring-blue-500/50' : ''}
      `}>
        {/* 拖动手柄 */}
        <div className="handle flex items-center -ml-2 mr-2 cursor-move group">
          <svg 
            className="w-4 h-4 text-gray-500 group-hover:text-gray-300 transition-colors" 
            viewBox="0 0 24 24" 
            fill="currentColor"
          >
            <circle cx="6" cy="6" r="2" />
            <circle cx="12" cy="6" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="6" cy="12" r="2" />
            <circle cx="12" cy="12" r="2" />
            <circle cx="18" cy="12" r="2" />
          </svg>
        </div>

        {/* 尺寸信息 */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400 text-xs">宽</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {width.toLocaleString()}
            </span>
          </div>
          <div className="w-px h-3 bg-gray-600" />
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400 text-xs">高</span>
            <span className="font-mono text-sm font-medium tabular-nums">
              {height.toLocaleString()}
            </span>
          </div>
        </div>
        
        {/* 分隔线 */}
        <div className="w-px h-3 bg-gray-600" />
        
        {/* 快捷键提示 */}
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Enter</kbd>
          <span>确认</span>
          <span className="mx-1">·</span>
          <kbd className="px-1.5 py-0.5 bg-gray-800 rounded">Esc</kbd>
          <span>取消</span>
        </div>
      </div>
    </Draggable>
  )
} 