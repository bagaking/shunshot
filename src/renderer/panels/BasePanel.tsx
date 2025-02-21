import React from 'react'
import { Position, Size } from '../../types/panel'
import { motion } from 'framer-motion'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'

export interface BasePanelProps {
  id: string
  position: Position
  size: Size
  title?: string
  isMinimized?: boolean
  onMove?: (id: string, position: Position) => void
  onResize?: (id: string, size: Size) => void
  onMinimize?: (id: string) => void
  onClose?: (id: string) => void
  children?: React.ReactNode
}

export const BasePanel: React.FC<BasePanelProps> = ({
  id,
  position,
  size,
  title = '',
  isMinimized = false,
  onMove,
  onResize,
  onMinimize,
  onClose,
  children
}) => {
  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <motion.div
      className="agent-panel fixed bg-white rounded-lg shadow-lg select-text"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 40 : size.height,
        zIndex: 1000,
      }}
      drag
      dragElastic={0}
      dragMomentum={false}
      dragTransition={{
        power: 0,
        timeConstant: 0
      }}
      onDragEnd={(_, info) => {
        onMove?.(id, {
          x: position.x + info.offset.x,
          y: position.y + info.offset.y
        })
      }}
      animate={{
        height: isMinimized ? 40 : size.height,
        scale: isMinimized ? 0.95 : 1,
      }}
      transition={{ 
        duration: 0.2,
        ease: 'easeInOut'
      }}
      onClick={handlePanelClick}
      onKeyDown={e => e.stopPropagation()}
    >
      <div className="flex flex-col h-full">
        <div 
          className="panel-header flex-none h-10 px-3 flex items-center justify-between bg-gray-50 border-b border-gray-200"
          style={{ cursor: 'move' }}
        >
          <h3 className="text-sm font-medium text-gray-700 truncate">{title}</h3>
          <div className="panel-controls flex items-center space-x-1">
            <button
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onMinimize?.(id)
              }}
            >
              {isMinimized ? <BorderOutlined /> : <MinusOutlined />}
            </button>
            <button
              className="w-6 h-6 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onClose?.(id)
              }}
            >
              <CloseOutlined />
            </button>
          </div>
        </div>
        {!isMinimized && (
          <div className="panel-content flex-1 overflow-hidden">
            {children}
          </div>
        )}
      </div>
    </motion.div>
  )
} 