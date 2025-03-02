import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { DisplayInfo, ToolType, DrawElementUnion, PenStyle } from '../../types/capture'
import { debugHelper } from '../utils/DebugHelper'
import { translog } from '../utils/translog'
import { Point, Rect, Bounds, coordinates } from '../../common/2d'
import { useDrawing } from './useDrawing'

interface UseCaptureProps {
  displayInfo: DisplayInfo | null
  onDisplayInfoChange: (info: DisplayInfo | null) => void
  onComplete?: () => void
}

export const useCapture = ({ displayInfo, onDisplayInfoChange, onComplete }: UseCaptureProps) => {
  const navigate = useNavigate()
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null)
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [isDraggingSelection, setIsDraggingSelection] = useState(false)
  
  // 获取选区边界
  const getBoundsFromRect = useCallback((canvasSpaceRect: Rect): Bounds => {
    try {
      const displaySpaceBounds = coordinates.canvasToDisplay(canvasSpaceRect)

      translog.debug('Canvas to display space transformation', { 
        canvasSpace: canvasSpaceRect,
        displaySpace: displaySpaceBounds
      })
      
      return displaySpaceBounds
    } catch (error) {
      translog.error('Error calculating display space bounds:', error)
      return { x: 0, y: 0, width: 0, height: 0 }
    }
  }, [])
  
  // 使用 useDrawing hook 管理绘图相关状态，传入选区边界和显示信息
  const drawing = useDrawing(
    selectedRect ? getBoundsFromRect(selectedRect) : null,
    displayInfo
  )

  // 坐标限制
  const clampCoordinates = useCallback((x: number, y: number): Point => {
    if (!displayInfo) return { x, y }
    return coordinates.clamp({ x, y }, displayInfo.bounds)
  }, [displayInfo])

  // 完成截图
  const completeCapture = useCallback(
    async (bounds: Bounds) => {
      if (!displayInfo) return

      try {
        translog.debug('[Area Debug] Capture completion', {
          bounds,
          displayInfo
        })

        // 如果有绘图元素，需要先将带有绘图的图像保存到主进程
        if (drawing.drawElements.length > 0) {
          try {
            // 使用 useDrawing hook 中的 saveAnnotatedImage 函数保存带有标注的图像
            await drawing.saveAnnotatedImage()
            
            translog.debug('Annotated image sent to main process', {
              hasDrawElements: drawing.drawElements.length > 0,
              bounds
            })
          } catch (error) {
            translog.error('Failed to save annotated image:', error)
            // 即使保存带注释的图像失败，也继续执行截图
          }
        }

        // 修改调用顺序：先复制到剪贴板，再完成截图
        // 这样可以确保在 completeCapture 清理数据之前，copyToClipboard 已经使用了数据
        await window.shunshotCoreAPI.copyToClipboard(bounds)
        await performCapture(bounds)
        
        onComplete?.()
      } catch (error) {
        translog.error('Failed to complete capture', error as Error)
      }
    },
    [displayInfo, onComplete, drawing.drawElements, drawing.saveAnnotatedImage]
  )

  // 获取缩放后的边界
  const getScaledBounds = (bounds: Bounds, scaleFactor: number) => ({
    x: Math.round(bounds.x * scaleFactor),
    y: Math.round(bounds.y * scaleFactor),
    width: Math.round(bounds.width * scaleFactor),
    height: Math.round(bounds.height * scaleFactor)
  })

  // 执行截图
  const performCapture = async (scaledBounds: Bounds) => {
    translog.debug('Scaled bounds calculated', { scaledBounds })
    await window.shunshotCoreAPI.hideWindow()
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
    // 忽略来自输入框和聊天面板的事件
    const target = event.target as HTMLElement
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.getAttribute('role') === 'textbox' ||
      target.getAttribute('contenteditable') === 'true' ||
      // 检查是否在聊天面板内
      target.closest('.agent-panel') ||
      // 检查是否是 antd mentions 组件
      target.closest('.ant-mentions')
    ) {
      return
    }

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
  const handleOCR = useCallback(async (displaySpaceBounds: Bounds): Promise<{text?: string, error?: any}> => {
    if (!displayInfo) {
      const error = 'No display info available'
      translog.error(error)
      return { error }
    }

    try {
      translog.debug('OCR request coordinate spaces', {
        displaySpace: {
          bounds: displaySpaceBounds,
          info: displayInfo
        }
      })

      return await window.shunshotCoreAPI.requestOCR(displaySpaceBounds)
    } catch (error) {
      translog.error('OCR request failed:', error)
      return { error }
    }
  }, [displayInfo])

  // 鼠标事件处理
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    try {
      const canvasSpacePoint = clampCoordinates(e.clientX, e.clientY)
      translog.debug('Mouse down in canvas space', { 
        canvasSpace: canvasSpacePoint,
        rawClient: { x: e.clientX, y: e.clientY },
        activeTool: drawing.activeTool
      })
      
      // 根据当前工具处理鼠标按下事件
      if (drawing.activeTool === ToolType.None || 
          drawing.activeTool === ToolType.RectSelect || 
          drawing.activeTool === ToolType.EllipseSelect) {
        // 默认选区工具
        setIsSelecting(true)
        setStartPoint(canvasSpacePoint)
        setSelectedRect(null)
      } else {
        // 绘图工具
        drawing.startDrawing(canvasSpacePoint)
      }
    } catch (error) {
      translog.error('Error during mouse down:', error)
    }
  }, [clampCoordinates, drawing])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    try {
      const canvasSpacePoint = clampCoordinates(e.clientX, e.clientY)
      setMousePosition(canvasSpacePoint)
      
      if (isSelecting && startPoint) {
        // 更新选区
        updateCanvasSpaceSelection(canvasSpacePoint.x, canvasSpacePoint.y)
      } else if (drawing.isDrawing) {
        // 更新绘制
        drawing.updateCurrentElement(canvasSpacePoint)
      }
    } catch (error) {
      translog.error('Error during mouse move:', error)
    }
  }, [isSelecting, startPoint, clampCoordinates, drawing])

  // 更新选区
  const updateCanvasSpaceSelection = (x: number, y: number) => {
    if (!startPoint) return

    const width = x - startPoint.x
    const height = y - startPoint.y

    if (Math.abs(width) < 1 || Math.abs(height) < 1) return

    translog.debug('Updating canvas space selection', {
      canvasSpace: {
        start: startPoint,
        current: { x, y },
        width,
        height
      }
    })

    setSelectedRect({
      startX: startPoint.x,
      startY: startPoint.y,
      width,
      height,
    })
  }

  const handleMouseUp = useCallback(() => {
    console.debug('[renderer] Mouse up, ending selection/drawing')
    
    if (isSelecting) {
      setIsSelecting(false)
    }
    
    if (drawing.isDrawing) {
      drawing.finishDrawing()
    }
  }, [isSelecting, drawing])

  // 重置选区
  const resetSelection = useCallback(() => {
    console.debug('[renderer] Resetting selection state')
    setIsSelecting(false)
    setStartPoint(null)
    setSelectedRect(null)
    drawing.resetDrawing()
  }, [drawing])

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
    // 绘图相关
    activeTool: drawing.activeTool,
    handleToolChange: drawing.setActiveTool,
    drawElements: drawing.drawElements,
    currentElement: drawing.currentElement,
    drawColor: drawing.drawColor,
    setDrawColor: drawing.setDrawColor,
    lineWidth: drawing.lineWidth,
    setLineWidth: drawing.setLineWidth,
    mosaicSize: drawing.mosaicSize,
    setMosaicSize: drawing.setMosaicSize,
    // 笔触风格相关
    penStyle: drawing.penStyle,
    setPenStyle: drawing.setPenStyle,
    // 文本编辑相关
    editingText: drawing.editingText,
    textInputValue: drawing.textInputValue,
    textInputRef: drawing.textInputRef,
    handleTextInputChange: drawing.handleTextInputChange,
    completeTextEditing: drawing.completeTextEditing,
    cancelTextEditing: drawing.cancelTextEditing
  }
} 