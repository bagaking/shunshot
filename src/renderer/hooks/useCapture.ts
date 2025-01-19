import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Point, Rect, DisplayInfo, CaptureBounds } from '../types/capture'
import { debugHelper } from '../utils/DebugHelper'

export const useCapture = () => {
  const navigate = useNavigate()
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null)
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)

  // 确保坐标在有效范围内
  const clampCoordinates = useCallback((x: number, y: number): Point => {
    if (!displayInfo) return { x, y }
    return {
      x: Math.max(0, Math.min(x, displayInfo.bounds.width)),
      y: Math.max(0, Math.min(y, displayInfo.bounds.height))
    }
  }, [displayInfo])

  // 处理选区拖动
  const handleSelectionDrag = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedRect || !displayInfo) {
      debugHelper.logEvent('Cannot drag selection: missing rect or display info')
      return
    }

    try {
      const newStartX = Math.max(0, Math.min(
        displayInfo.bounds.width - Math.abs(selectedRect.width),
        selectedRect.startX + deltaX
      ))
      const newStartY = Math.max(0, Math.min(
        displayInfo.bounds.height - Math.abs(selectedRect.height),
        selectedRect.startY + deltaY
      ))

      debugHelper.logEvent('Dragging selection')
      console.log('Dragging selection:', {
        deltaX,
        deltaY,
        newStartX,
        newStartY,
        bounds: displayInfo.bounds
      })

      setSelectedRect({
        ...selectedRect,
        startX: newStartX,
        startY: newStartY
      })
    } catch (error) {
      console.error('Error during selection drag:', error)
    }
  }, [selectedRect, displayInfo])

  // 处理鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    try {
      const { x, y } = clampCoordinates(e.clientX, e.clientY)
      debugHelper.logEvent('Mouse down')
      console.log('Mouse down:', { x, y })
      
      setIsSelecting(true)
      setStartPoint({ x, y })
      setSelectedRect(null)
    } catch (error) {
      console.error('Error during mouse down:', error)
    }
  }, [clampCoordinates])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    try {
      const { x, y } = clampCoordinates(e.clientX, e.clientY)
      setMousePosition({ x, y })
      
      if (!isSelecting || !startPoint) return

      // 计算选区大小
      const width = x - startPoint.x
      const height = y - startPoint.y

      // 确保选区至少有 1px 的大小
      if (Math.abs(width) < 1 || Math.abs(height) < 1) return

      debugHelper.logEvent('Updating selection')
      console.log('Updating selection:', {
        startX: startPoint.x,
        startY: startPoint.y,
        width,
        height
      })

      setSelectedRect({
        startX: startPoint.x,
        startY: startPoint.y,
        width,
        height,
      })
    } catch (error) {
      console.error('Error during mouse move:', error)
    }
  }, [isSelecting, startPoint, clampCoordinates])

  const handleMouseUp = useCallback(() => {
    debugHelper.logEvent('Mouse up')
    console.log('Mouse up, ending selection')
    setIsSelecting(false)
  }, [])

  // 处理快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    debugHelper.logEvent(`Key pressed: ${e.key}`)
    console.log('Key pressed:', e.key)
    try {
      if (e.key === 'Escape') {
        debugHelper.logEvent('Canceling capture via ESC')
        cancelCapture()
      } else if (e.key === 'Enter' && selectedRect) {
        const bounds = getBoundsFromRect(selectedRect)
        if (bounds.width < 1 || bounds.height < 1) {
          console.warn('Invalid selection size:', bounds)
          return
        }
        debugHelper.logEvent('Completing capture via Enter')
        completeCapture(bounds)
      }
    } catch (error) {
      console.error('Error handling key press:', error)
      // 即使出错也尝试导航回主页
      if (e.key === 'Escape') {
        try {
          navigate('/')
        } catch (navError) {
          console.error('Failed to navigate after error:', navError)
        }
      }
    }
  }, [selectedRect])

  // 获取选区边界
  const getBoundsFromRect = useCallback((rect: Rect): CaptureBounds => {
    try {
      const bounds = {
        x: rect.width > 0 ? rect.startX : rect.startX + rect.width,
        y: rect.height > 0 ? rect.startY : rect.startY + rect.height,
        width: Math.abs(rect.width),
        height: Math.abs(rect.height)
      }

      debugHelper.logEvent('Calculated bounds')
      console.log('Calculated bounds:', bounds)
      return bounds
    } catch (error) {
      console.error('Error calculating bounds:', error)
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0
      }
    }
  }, [])

  // 完成截图
  const completeCapture = useCallback(async (bounds: CaptureBounds) => {
    debugHelper.logEvent('Completing capture')
    console.log('Completing capture with bounds:', bounds)
    
    if (!displayInfo) {
      console.error('No display info available')
      return
    }

    try {
      // 转换为实际像素坐标
      const scaledBounds = {
        x: Math.round(bounds.x * displayInfo.scaleFactor),
        y: Math.round(bounds.y * displayInfo.scaleFactor),
        width: Math.round(bounds.width * displayInfo.scaleFactor),
        height: Math.round(bounds.height * displayInfo.scaleFactor)
      }
      
      debugHelper.logEvent('Scaled bounds calculated')
      console.log('Scaled bounds:', scaledBounds)

      // 复制到剪贴板
      console.log('Copying to clipboard')
      const copyResult = await window.electronAPI.copyToClipboard(scaledBounds)
      debugHelper.logEvent(`Copy to clipboard result: ${copyResult}`)
      
      // 完成截图
      await window.electronAPI.completeCapture(scaledBounds)
      debugHelper.logEvent('Capture completed')
      
      // 等待操作完成
      await new Promise(resolve => setTimeout(resolve, 200))
      
      // 最后导航回主页
      navigate('/')
    } catch (error: unknown) {
      console.error('Failed to complete capture:', error)
      debugHelper.logEvent(`Error: ${error instanceof Error ? error.message : String(error)}`)
      
      // 即使出错也尝试导航回主页
      try {
        navigate('/')
      } catch (navError: unknown) {
        console.error('Failed to navigate after error:', navError)
        debugHelper.logEvent(`Navigation error: ${navError instanceof Error ? navError.message : String(navError)}`)
      }
    }
  }, [navigate, displayInfo])

  // 取消截图
  const cancelCapture = useCallback(() => {
    debugHelper.logEvent('Canceling capture')
    console.log('Canceling capture')
    try {
      // 重置所有状态
      setIsSelecting(false)
      setStartPoint(null)
      setSelectedRect(null)
      setMousePosition({ x: 0, y: 0 })
      
      // 发送取消事件
      window.electronAPI.cancelCapture()
      
      // 导航回主页
      navigate('/')
    } catch (error) {
      console.error('Error canceling capture:', error)
      // 即使出错也尝试导航回主页
      try {
        navigate('/')
      } catch (navError) {
        console.error('Failed to navigate after error:', navError)
      }
    }
  }, [navigate])

  // 设置键盘事件监听
  useEffect(() => {
    debugHelper.logEvent('Setting up keyboard event listener')
    console.log('Setting up keyboard event listener')
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      debugHelper.logEvent('Cleaning up keyboard event listener')
      console.log('Cleaning up keyboard event listener')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    isSelecting,
    selectedRect,
    mousePosition,
    displayInfo,
    isDraggingSelection,
    setDisplayInfo,
    setIsDraggingSelection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSelectionDrag,
    completeCapture,
    cancelCapture,
    getBoundsFromRect,
  }
} 