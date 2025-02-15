import React from 'react'

interface InfoPanelProps {
  x: number
  y: number
  width: number
  height: number
  scale?: number
  style?: React.CSSProperties
}

export const InfoPanel: React.FC<InfoPanelProps> = ({ 
  x, 
  y, 
  width, 
  height, 
  scale = 1,
  style 
}) => {
  return (
    <div 
      className="fixed select-none group transition-all duration-200 ease-in-out
                 bg-gray-800/75 backdrop-blur-sm text-white 
                 border border-white/5 hover:border-white/10
                 shadow-md hover:shadow-lg
                 rounded-md overflow-hidden"
      style={style}
    >
      <div className="flex items-center h-7 px-2 space-x-3">
        {/* Handle (visual only) */}
        <div className="w-4 h-4 rounded-full bg-white/10 group-hover:bg-white/15 
                       flex items-center justify-center transition-colors duration-200">
          <div className="w-2 h-2 bg-white/20 rounded-full group-hover:bg-white/30" />
        </div>

        {/* Content */}
        <div className="flex items-center space-x-3 text-sm">
          <div className="flex items-center space-x-1">
            <span className="text-white/40">X</span>
            <span className="font-medium tabular-nums">{Math.round(x)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-white/40">Y</span>
            <span className="font-medium tabular-nums">{Math.round(y)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-white/40">W</span>
            <span className="font-medium tabular-nums">{Math.round(width)}</span>
          </div>
          <div className="flex items-center space-x-1">
            <span className="text-white/40">H</span>
            <span className="font-medium tabular-nums">{Math.round(height)}</span>
          </div>
        </div>
      </div>
    </div>
  )
} 