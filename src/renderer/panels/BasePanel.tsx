import React from 'react'
import { Position, Size } from '../../types/panel'
import { motion, useDragControls } from 'framer-motion'
import { MinusOutlined, BorderOutlined, CloseOutlined } from '@ant-design/icons'

export interface BasePanelProps {
  id: string
  position: Position
  size: Size
  title?: string
  headerContent?: React.ReactNode
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
  headerContent,
  isMinimized = false,
  onMove,
  onResize,
  onMinimize,
  onClose,
  children
}) => {
  const dragControls = useDragControls()
  
  const handlePanelClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  return (
    <motion.div
      className="agent-panel fixed bg-white rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.12)] select-text overflow-hidden"
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 48 : size.height,
        zIndex: 1000,
      }}
      drag
      dragControls={dragControls}
      dragListener={false}
      dragElastic={0.3}
      dragMomentum={false}
      dragTransition={{
        power: 0.2,
        timeConstant: 200,
        bounceStiffness: 200,
        bounceDamping: 20
      }}
      onDragEnd={(_, info) => {
        onMove?.(id, {
          x: position.x + info.offset.x,
          y: position.y + info.offset.y
        })
      }}
      initial={false}
      animate={{
        height: isMinimized ? 48 : size.height,
        scale: isMinimized ? 0.98 : 1,
        y: isMinimized ? position.y + 4 : position.y
      }}
      transition={{ 
        type: "spring",
        stiffness: 300,
        damping: 30
      }}
      onClick={handlePanelClick}
      onKeyDown={e => e.stopPropagation()}
      whileHover={{ scale: 1.002 }}
    >
      <div className="flex flex-col h-full">
        <div 
          className="panel-header flex-none h-12 px-4 flex items-center justify-between bg-transparent cursor-grab active:cursor-grabbing select-none"
          onPointerDown={(e) => {
            e.preventDefault()
            dragControls.start(e)
          }}
        >
          {headerContent || (
            <h3 className="text-sm font-medium text-gray-700 truncate flex items-center">
              <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
              {title}
            </h3>
          )}
          <div className="panel-controls flex items-center space-x-1">
            <motion.button
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-black/5 text-gray-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onMinimize?.(id)
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isMinimized ? <BorderOutlined /> : <MinusOutlined />}
            </motion.button>
            <motion.button
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 text-gray-500 hover:text-red-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation()
                onClose?.(id)
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <CloseOutlined />
            </motion.button>
          </div>
        </div>
        {!isMinimized && (
          <motion.div 
            className="panel-content flex-1 overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        )}
      </div>
    </motion.div>
  )
} 