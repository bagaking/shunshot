import React, { useEffect, useRef } from 'react'
import { PenStyle } from '../../types/capture'
import { Pencil, Edit3, Type, Feather } from 'lucide-react'

interface BrushSettingsProps {
  onClose: () => void
  onColorSelect: (color: string) => void
  onLineWidthChange: (width: number) => void
  onPenStyleChange?: (style: PenStyle, sensitivity?: number, taper?: boolean) => void
  currentColor: string
  currentLineWidth: number
  currentPenStyle?: PenStyle
}

/**
 * A compact and elegant brush settings component for selecting colors, line widths, and pen styles
 * Optimized for minimal space usage and Apple Design Award level UX
 */
export const BrushSettings: React.FC<BrushSettingsProps> = ({
  onClose,
  onColorSelect,
  onLineWidthChange,
  onPenStyleChange,
  currentColor,
  currentLineWidth,
  currentPenStyle = PenStyle.Normal
}) => {
  // Color palette organized by color families
  const colorPalette = [
    // Row 1: Primary colors
    ['#000000', '#e53e3e', '#dd6b20', '#ecc94b', '#38a169', '#3182ce', '#805ad5', '#d53f8c'],
    // Row 2: Lighter variants
    ['#4a5568', '#ff6b6b', '#ed8936', '#f6e05e', '#48bb78', '#4299e1', '#9f7aea', '#ed64a6'],
    // Row 3: Pastel variants
    ['#a0aec0', '#ff8787', '#f6ad55', '#faf089', '#9ae6b4', '#63b3ed', '#d6bcfa', '#fbb6ce'],
    // Row 4: Grayscale
    ['#e2e8f0', '#ffffff'],
  ];

  // Line width options
  const lineWidths = [1, 2, 3, 5, 8];

  // Pen style options with icons and labels
  const penStyles = [
    { value: PenStyle.Normal, label: '普通', icon: <Pencil className="w-3 h-3" /> },
    { value: PenStyle.Brush, label: '毛笔', icon: <Edit3 className="w-3 h-3" /> },
    { value: PenStyle.Pencil, label: '铅笔', icon: <Pencil className="w-3 h-3" /> },
    { value: PenStyle.Marker, label: '马克笔', icon: <Type className="w-3 h-3" /> },
    { value: PenStyle.Fountain, label: '钢笔', icon: <Feather className="w-3 h-3" /> }
  ];

  // Handle click outside to close the panel
  const panelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  return (
    <div 
      ref={panelRef}
      className="bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border border-gray-200/50 p-2 brush-settings-container z-50 w-[200px] overflow-hidden"
      style={{ 
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)',
      }}
    >
      {/* Compact header with current color preview */}
      <div className="flex items-center justify-end mb-1.5">
        <div 
          className="w-4 h-4 rounded-full shadow-sm" 
          style={{ 
            backgroundColor: currentColor,
            border: currentColor === '#ffffff' ? '1px solid #e2e8f0' : 'none',
          }}
        />
      </div>
      
      {/* Color palette - no title, just colors */}
      <div className="mb-2">
        {colorPalette.map((row, rowIndex) => (
          <div key={rowIndex} className="flex gap-1 mb-1 justify-center">
            {row.map((color) => (
              <button
                key={color}
                onClick={() => onColorSelect(color)}
                className={`w-4 h-4 rounded-full transition-all duration-200 hover:scale-110 focus:outline-none ${
                  currentColor === color 
                    ? 'ring-2 ring-offset-1 ring-blue-400 scale-110 shadow-md' 
                    : 'hover:shadow-sm'
                }`}
                style={{ 
                  backgroundColor: color,
                  boxShadow: currentColor === color ? '0 2px 4px rgba(0, 0, 0, 0.1)' : '0 1px 2px rgba(0, 0, 0, 0.06)',
                  border: color === '#ffffff' ? '1px solid #e2e8f0' : 'none',
                  transform: currentColor === color ? 'scale(1.1)' : 'scale(1)'
                }}
                aria-label={`选择颜色 ${color}`}
              />
            ))}
          </div>
        ))}
      </div>
      
      {/* Subtle divider */}
      <div className="h-px bg-gray-200/50 my-1.5"></div>
      
      {/* Line width selector - no title, just visual indicators */}
      <div className="mb-2">
        <div className="flex justify-between items-center px-1">
          {lineWidths.map((width) => (
            <button
              key={width}
              onClick={() => onLineWidthChange(width)}
              className={`group flex flex-col items-center justify-center py-0.5 px-1 rounded transition-all duration-200 ${
                currentLineWidth === width 
                  ? 'bg-blue-50 shadow-sm transform scale-105' 
                  : 'hover:bg-gray-50'
              }`}
            >
              <div 
                className={`rounded-full transition-all duration-200 ${
                  currentLineWidth === width ? 'scale-110' : 'group-hover:scale-105'
                }`}
                style={{ 
                  width: `${width * 2}px`, 
                  height: `${width * 2}px`,
                  backgroundColor: currentColor,
                  boxShadow: currentLineWidth === width ? '0 1px 3px rgba(0, 0, 0, 0.15)' : 'none'
                }}
              />
              <span className={`text-[8px] mt-0.5 ${
                currentLineWidth === width ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}>{width}</span>
            </button>
          ))}
        </div>
      </div>
      
      {/* Pen style selector - only show if handler is provided */}
      {onPenStyleChange && (
        <>
          <div className="h-px bg-gray-200/50 my-1.5"></div>
          <div className="px-1">
            <div className="grid grid-cols-5 gap-0.5">
              {penStyles.map((style) => (
                <button
                  key={style.value}
                  onClick={() => onPenStyleChange(style.value)}
                  className={`flex flex-col items-center justify-center p-0.5 rounded transition-all duration-200 ${
                    currentPenStyle === style.value 
                      ? 'bg-blue-50 ring-1 ring-blue-100 shadow-sm transform scale-105' 
                      : 'hover:bg-gray-50'
                  }`}
                  title={style.label}
                >
                  <div className={`${
                    currentPenStyle === style.value ? 'text-blue-500' : 'text-gray-600'
                  }`}>
                    {style.icon}
                  </div>
                  <span className={`text-[7px] ${
                    currentPenStyle === style.value ? 'text-blue-500 font-medium' : 'text-gray-500'
                  }`}>{style.label}</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}; 