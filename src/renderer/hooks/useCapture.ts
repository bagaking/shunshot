import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Point, Rect, DisplayInfo, CaptureBounds } from '../types/capture'
import { debugHelper } from '../utils/DebugHelper'
import { translog } from '../utils/translog'

interface UseCaptureProps {
  displayInfo: DisplayInfo | null
  onDisplayInfoChange: (info: DisplayInfo | null) => void
}

export const useCapture = ({ displayInfo, onDisplayInfoChange }: UseCaptureProps) => {
  const navigate = useNavigate()
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null)
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
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
      translog.debug('Cannot drag selection: missing rect or display info')
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

      translog.debug('Dragging selection', {
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
      translog.error('Error during selection drag:', error)
    }
  }, [selectedRect, displayInfo])

  const handleOCR = useCallback(async (bounds: CaptureBounds): Promise<{text?: string, error?: any}> => {
    translog.debug('Completing capture', { bounds })
    
    if (!displayInfo) {
      const error = 'No display info available'
      translog.error(error)
      return {error}
    }

    try {
      // 转换为实际像素坐标
      const scaledBounds = {
        x: Math.round(bounds.x * displayInfo.scaleFactor),
        y: Math.round(bounds.y * displayInfo.scaleFactor),
        width: Math.round(bounds.width * displayInfo.scaleFactor),
        height: Math.round(bounds.height * displayInfo.scaleFactor)
      }
      
      translog.debug('Scaled bounds calculated', { scaledBounds })
      return await window.shunshotCoreAPI.requestOCR(scaledBounds)
      
    } catch (error: unknown) {
      return { error }
    }
    
  }, [displayInfo])

  // 处理鼠标事件
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    try {
      const { x, y } = clampCoordinates(e.clientX, e.clientY)
      translog.debug('Mouse down', { x, y })
      
      setIsSelecting(true)
      setStartPoint({ x, y })
      setSelectedRect(null)
    } catch (error) {
      translog.error('Error during mouse down:', error)
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

      translog.debug('Updating selection', {
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
      translog.error('Error during mouse move:', error)
    }
  }, [isSelecting, startPoint, clampCoordinates])

  const handleMouseUp = useCallback(() => {
    translog.debug('Mouse up, ending selection')
    setIsSelecting(false)
  }, [])

  // 处理快捷键
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    translog.debug('Key pressed', { key: e.key })
    try {
      if (e.key === 'Escape') {
        translog.debug('Canceling capture via ESC')
        cancelCapture()
      } else if (e.key === 'Enter' && selectedRect) {
        const bounds = getBoundsFromRect(selectedRect)
        if (bounds.width < 1 || bounds.height < 1) {
          translog.warn('Invalid selection size:', bounds)
          return
        }
        translog.debug('Completing capture via Enter')
        completeCapture(bounds)
      }
    } catch (error) {
      translog.error('Error handling key press:', error)
      // 即使出错也尝试导航回主页
      if (e.key === 'Escape') {
        try {
          navigate('/')
        } catch (navError) {
          translog.error('Failed to navigate after error:', navError)
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

      translog.debug('Calculated bounds', { bounds })
      return bounds
    } catch (error) {
      translog.error('Error calculating bounds:', error)
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
    translog.debug('Completing capture', { bounds })
    
    if (!displayInfo) {
      translog.error('No display info available')
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
      
      translog.debug('Scaled bounds calculated', { scaledBounds })

      // 先隐藏窗口
      translog.debug('Hiding window')
      await window.shunshotCoreAPI.hideWindow()

      // 复制到剪贴板
      translog.debug('Copying to clipboard')
      const copyResult = await window.shunshotCoreAPI.copyToClipboard(scaledBounds)
      translog.debug('Copy to clipboard result', { result: copyResult })
      
      // 完成截图
      await window.shunshotCoreAPI.completeCapture(scaledBounds)
      translog.debug('Capture completed')
      
      // 等待主进程完成清理
      await new Promise<void>((resolve) => {
        const cleanup = window.shunshotCoreAPI.onCleanupComplete(() => {
          cleanup() // 移除监听器
          resolve()
        })
      })
      
      // 最后导航回主页
      navigate('/')
    } catch (error: unknown) {
      translog.error('Failed to complete capture:', error)
      
      // 即使出错也尝试导航回主页
      try {
        await window.shunshotCoreAPI.hideWindow()
        navigate('/')
      } catch (navError: unknown) {
        translog.error('Failed to navigate after error:', navError)
      }
    }
  }, [navigate, displayInfo])

  // 取消截图
  const cancelCapture = useCallback(async () => {
    translog.debug('Canceling capture')
    try {
      // 先隐藏窗口
      await window.shunshotCoreAPI.hideWindow()
      
      // 取消截图
      await window.shunshotCoreAPI.cancelCapture()
      
      // 等待主进程完成清理
      await new Promise<void>((resolve) => {
        const cleanup = window.shunshotCoreAPI.onCleanupComplete(() => {
          cleanup() // 移除监听器
          resolve()
        })
      })
      
      navigate('/')
    } catch (error) {
      translog.error('Failed to cancel capture:', error)
      // 即使出错也尝试导航回主页
      try {
        await window.shunshotCoreAPI.hideWindow()
        navigate('/')
      } catch (navError) {
        translog.error('Failed to navigate after error:', navError)
      }
    }
  }, [navigate])

  // 重置选区状态
  const resetSelection = useCallback(() => {
    translog.debug('Resetting selection state')
    setIsSelecting(false)
    setStartPoint(null)
    setSelectedRect(null)
  }, [])

  // 设置键盘事件监听
  useEffect(() => {
    translog.debug('Setting up keyboard event listeners')
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      translog.debug('Cleaning up keyboard event listeners')
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return {
    selectedRect,
    mousePosition,
    displayInfo,
    setDisplayInfo: onDisplayInfoChange,
    setIsDraggingSelection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSelectionDrag,
    completeCapture,
    cancelCapture,
    getBoundsFromRect,
    handleOCR,
    resetSelection,
  }
} 