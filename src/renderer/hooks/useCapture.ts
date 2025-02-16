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

  // 坐标限制
  const clampCoordinates = useCallback((x: number, y: number): Point => {
    if (!displayInfo) return { x, y }
    return {
      x: Math.max(0, Math.min(x, displayInfo.bounds.width)),
      y: Math.max(0, Math.min(y, displayInfo.bounds.height))
    }
  }, [displayInfo])

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
      return { x: 0, y: 0, width: 0, height: 0 }
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
      const scaledBounds = getScaledBounds(bounds, displayInfo.scaleFactor)
      await performCapture(scaledBounds)
      await cleanupAndNavigate()
    } catch (error) {
      handleCaptureError(error)
    }
  }, [navigate, displayInfo])

  // 获取缩放后的边界
  const getScaledBounds = (bounds: CaptureBounds, scaleFactor: number) => ({
    x: Math.round(bounds.x * scaleFactor),
    y: Math.round(bounds.y * scaleFactor),
    width: Math.round(bounds.width * scaleFactor),
    height: Math.round(bounds.height * scaleFactor)
  })

  // 执行截图
  const performCapture = async (scaledBounds: CaptureBounds) => {
    translog.debug('Scaled bounds calculated', { scaledBounds })
    await window.shunshotCoreAPI.hideWindow()
    await window.shunshotCoreAPI.copyToClipboard(scaledBounds)
    await window.shunshotCoreAPI.completeCapture(scaledBounds)
  }

  // 清理并导航
  const cleanupAndNavigate = async () => {
    await new Promise<void>((resolve) => {
      const cleanup = window.shunshotCoreAPI.onCleanupComplete(() => {
        cleanup()
        resolve()
      })
    })
    navigate('/')
  }

  // 处理截图错误
  const handleCaptureError = async (error: unknown) => {
    translog.error('Failed to complete capture:', error)
    try {
      await window.shunshotCoreAPI.hideWindow()
      navigate('/')
    } catch (navError) {
      translog.error('Failed to navigate after error:', navError)
    }
  }

  // 取消截图
  const cancelCapture = useCallback(async () => {
    translog.debug('Canceling capture')
    try {
      await window.shunshotCoreAPI.hideWindow()
      await window.shunshotCoreAPI.cancelCapture()
      await cleanupAndNavigate()
    } catch (error) {
      handleCaptureError(error)
    }
  }, [navigate])

  // 处理快捷键
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    logKeyEvent(event)
    handleKeyboardShortcuts(event)
  }, [selectedRect, getBoundsFromRect, completeCapture, cancelCapture])

  // 记录按键事件
  const logKeyEvent = (event: KeyboardEvent) => {
    console.debug('[renderer] Key event detected:', {
      key: event.key,
      keyCode: event.keyCode,
      type: event.type,
      eventPhase: event.eventPhase,
      target: event.target,
      currentTarget: event.currentTarget,
      hasFocus: document.hasFocus(),
      activeElement: document.activeElement?.tagName,
      timestamp: Date.now(),
    })
  }

  // 处理键盘快捷键
  const handleKeyboardShortcuts = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      handleEscapeKey(event)
    } else if (event.key === 'Enter' && selectedRect) {
      handleEnterKey(event)
    } else if (event.key === 'F12') {
      handleF12Key(event)
    }
  }

  // 处理 Escape 键
  const handleEscapeKey = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    console.debug('[renderer] Escape key detected, initiating cancellation...')
    try {
      cancelCapture()
      console.debug('[renderer] Cancellation completed successfully')
    } catch (error) {
      console.error('[renderer] Error during cancellation:', error)
    }
  }

  // 处理 Enter 键
  const handleEnterKey = (event: KeyboardEvent) => {
    console.debug('[renderer] Enter key pressed')
    event.preventDefault()
    event.stopPropagation()
    const bounds = getBoundsFromRect(selectedRect!)
    if (bounds.width < 1 || bounds.height < 1) {
      console.warn('[renderer] Invalid selection size:', bounds)
      return
    }
    console.debug('[renderer] Completing capture via Enter')
    void completeCapture(bounds)
  }

  // 处理 F12 键
  const handleF12Key = (event: KeyboardEvent) => {
    event.preventDefault()
    event.stopPropagation()
    debugHelper.isEnabled ? debugHelper.disable() : debugHelper.enable()
  }

  // 处理选区拖动
  const handleSelectionDrag = useCallback((deltaX: number, deltaY: number) => {
    if (!selectedRect || !displayInfo) {
      console.debug('[renderer] Cannot drag selection: missing rect or display info')
      return
    }

    try {
      const { newStartX, newStartY } = calculateNewPosition(
        selectedRect,
        deltaX,
        deltaY,
        displayInfo.bounds
      )

      console.debug('[renderer] Dragging selection', {
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
      console.error('[renderer] Error during selection drag:', error)
    }
  }, [selectedRect, displayInfo])

  // 计算新位置
  const calculateNewPosition = (
    rect: Rect,
    deltaX: number,
    deltaY: number,
    bounds: { width: number; height: number }
  ) => ({
    newStartX: Math.max(0, Math.min(
      bounds.width - Math.abs(rect.width),
      rect.startX + deltaX
    )),
    newStartY: Math.max(0, Math.min(
      bounds.height - Math.abs(rect.height),
      rect.startY + deltaY
    ))
  })

  // OCR 处理
  const handleOCR = useCallback(async (bounds: CaptureBounds): Promise<{text?: string, error?: any}> => {
    translog.debug('Starting OCR', { bounds })
    
    if (!displayInfo) {
      const error = 'No display info available'
      translog.error(error)
      return { error }
    }

    try {
      const scaledBounds = getScaledBounds(bounds, displayInfo.scaleFactor)
      translog.debug('Scaled bounds calculated', { scaledBounds })
      return await window.shunshotCoreAPI.requestOCR(scaledBounds)
    } catch (error) {
      return { error }
    }
  }, [displayInfo])

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    try {
      const { x, y } = clampCoordinates(e.clientX, e.clientY)
      console.debug('[renderer] Mouse down', { x, y })
      
      setIsSelecting(true)
      setStartPoint({ x, y })
      setSelectedRect(null)
    } catch (error) {
      console.error('[renderer] Error during mouse down:', error)
    }
  }, [clampCoordinates])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    try {
      const { x, y } = clampCoordinates(e.clientX, e.clientY)
      setMousePosition({ x, y })
      
      if (!isSelecting || !startPoint) return

      updateSelection(x, y)
    } catch (error) {
      console.error('[renderer] Error during mouse move:', error)
    }
  }, [isSelecting, startPoint, clampCoordinates])

  // 更新选区
  const updateSelection = (x: number, y: number) => {
    if (!startPoint) return

    const width = x - startPoint.x
    const height = y - startPoint.y

    if (Math.abs(width) < 1 || Math.abs(height) < 1) return

    console.debug('[renderer] Updating selection', {
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
  }

  const handleMouseUp = useCallback(() => {
    console.debug('[renderer] Mouse up, ending selection')
    setIsSelecting(false)
  }, [])

  // 重置选区
  const resetSelection = useCallback(() => {
    console.debug('[renderer] Resetting selection state')
    setIsSelecting(false)
    setStartPoint(null)
    setSelectedRect(null)
  }, [])

  // 设置键盘事件监听
  useEffect(() => {
    console.debug('[renderer] Setting up keyboard event listeners')
    
    window.addEventListener('keydown', handleKeyDown, true)
    document.addEventListener('keydown', handleKeyDown, true)
    
    return () => {
      console.debug('[renderer] Cleaning up keyboard event listeners')
      window.removeEventListener('keydown', handleKeyDown, true)
      document.removeEventListener('keydown', handleKeyDown, true)
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