import React, { useRef } from 'react'
import Draggable from 'react-draggable'

interface InfoPanelProps {
  x: number
  y: number
  width: number
  height: number
  scale?: number
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ x, y, width, height, scale = 1 }) => {
  const nodeRef = useRef(null)
  
  const screenX = x * scale
  const screenY = y * scale
  
  return (
    <Draggable
      nodeRef={nodeRef}
      defaultPosition={{ x: screenX + (width * scale) + 10, y: screenY }}
      bounds="parent"
    >
      <div ref={nodeRef} className="fixed bg-black/90 backdrop-blur-sm text-white px-4 py-2 rounded shadow-lg text-sm">
        <div>X: {Math.round(x)}</div>
        <div>Y: {Math.round(y)}</div>
        <div>W: {Math.round(width)}</div>
        <div>H: {Math.round(height)}</div>
      </div>
    </Draggable>
  )
} 