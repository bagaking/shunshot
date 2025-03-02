import React, { useRef, useState, useEffect, useCallback } from 'react'
import { InfoPanel } from '../components/InfoPanel'
import { ToolBar } from '../components/ToolBar'
import { DebugPanel } from '../components/DebugPanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useCapture } from '../hooks/useCapture'
import { CaptureData, CaptureMode, ToolType } from '../../types/capture'
import { translog } from '../utils/translog'
import { performanceHelper } from '../utils/performanceHelper'
import { eventHelper } from '../utils/eventHelper'
import { positionHelper } from '../utils/positionHelper'
import { canvasRenderHelper } from '../utils/canvasRenderHelper'
import { useCaptureContext } from '../providers/CaptureProvider'

// 使用 React.memo 优化子组件
const MemoizedInfoPanel = React.memo(InfoPanel)
const MemoizedToolBar = React.memo(ToolBar)
const MemoizedDebugPanel = React.memo(DebugPanel)

const Capture: React.FC = () => {
  const { captureData, displayInfo, setDisplayInfo } = useCaptureContext()

  const {
    selectedRect,
    mousePosition,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    completeCapture,
    cancelCapture,
    getBoundsFromRect,
    handleOCR,
    resetSelection,
    // 绘图相关
    activeTool,
    handleToolChange: setActiveTool,
    drawElements,
    currentElement,
    drawColor,
    setDrawColor,
    lineWidth,
    setLineWidth,
    mosaicSize,
    setMosaicSize,
    // 笔触风格相关
    penStyle,
    setPenStyle,
    // 文本编辑相关
    editingText,
    textInputValue,
    textInputRef,
    handleTextInputChange,
    completeTextEditing,
    cancelTextEditing
  } = useCapture({ displayInfo, onDisplayInfoChange: setDisplayInfo })

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null)
  const [initialCanvasState, setInitialCanvasState] = useState<ImageData | null>(null)
  const [lastError, setLastError] = useState<Error | null>(null)
  const [canvasInfo, setCanvasInfo] = useState<{
    width?: number
    height?: number
    style?: {
      width?: string
      height?: string
    }
  } | null>(null)
  const loadingImageRef = useRef<HTMLImageElement | null>(null)
  const updateCanvasRef = useRef<number>(0)
  const [captureMode, setCaptureMode] = useState<CaptureMode>(CaptureMode.Screenshot)

  // 错误处理函数
  const handleError = useCallback((error: Error, context: string) => {
    translog.error(`Error in ${context}:`, error)
    setLastError(error)
  }, [])

  // 加载图片
  const loadImage = useCallback(async (data: CaptureData) => {
    // 清理旧的加载操作
    if (loadingImageRef.current) {
      loadingImageRef.current.src = ''
      loadingImageRef.current = null
    }

    translog.debug('Starting to load image', {
      timestamp: Date.now()
    })

    try {
      // 创建 Uint8ClampedArray 视图并转换颜色空间
      const { width, height } = data.imageSize
      const buffer = new Uint8ClampedArray(data.imageBuffer.length)
      
      // 转换 BGRA 到 RGBA
      for (let i = 0; i < data.imageBuffer.length; i += 4) {
        buffer[i] = data.imageBuffer[i + 2]     // R <- B
        buffer[i + 1] = data.imageBuffer[i + 1] // G <- G
        buffer[i + 2] = data.imageBuffer[i]     // B <- R
        buffer[i + 3] = data.imageBuffer[i + 3] // A <- A
      }
      
      const imageData = new ImageData(buffer, width, height)
      
      // 使用 createImageBitmap 创建位图
      const bitmap = await createImageBitmap(imageData)
      
      // 创建临时 canvas 来转换 bitmap 为 image
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = width
      tempCanvas.height = height
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        throw new Error('Failed to get temp canvas context')
      }
      
      tempCtx.drawImage(bitmap, 0, 0)
      
      const img = new Image()
      loadingImageRef.current = img

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          if (loadingImageRef.current === img) {
            setBackgroundImage(img)
            setInitialCanvasState(null)
            resolve()
          }
        }
        img.onerror = (error) => reject(error)
        img.src = tempCanvas.toDataURL()
      })

      translog.debug('Image loaded successfully', {
        timestamp: Date.now()
      })
    } catch (error) {
      handleError(error as Error, 'loadImage')
    }
  }, [handleError])

  // 防抖的画布更新函数
  const debouncedUpdateCanvas = useCallback(
    performanceHelper.throttle(async () => {
      if (!canvasRef.current || !backgroundImage || !displayInfo) {
        return
      }

      const startTime = performance.now()
      translog.debug('Starting canvas update', {
        timestamp: Date.now()
      })

      try {
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          throw new Error('Failed to get canvas context')
        }

        // 使用 requestAnimationFrame 来优化渲染
        const frameId = requestAnimationFrame(() => {
          canvasRenderHelper.render({
            canvas,
            ctx,
            backgroundImage,
            displayInfo,
            selectedRect,
            initialCanvasState,
            mode: captureMode,
            getBoundsFromRect,
            setInitialCanvasState,
            setCanvasInfo,
            startTime,
            // 绘图相关
            drawElements,
            currentElement,
            activeTool
          })
        })

        updateCanvasRef.current = frameId
      } catch (error) {
        handleError(error as Error, 'updateCanvas')
      }
    }, 16),
    [canvasRef, backgroundImage, displayInfo, selectedRect, getBoundsFromRect, handleError, captureMode, initialCanvasState, drawElements, currentElement, activeTool]
  )

  // 监听画布更新依赖项变化
  useEffect(() => {
    void debouncedUpdateCanvas()

    return () => {
      if (updateCanvasRef.current) {
        cancelAnimationFrame(updateCanvasRef.current)
      }
    }
  }, [debouncedUpdateCanvas])

  // 处理截图数据
  useEffect(() => {
    if (!captureData) {
      return
    }

    translog.debug('Processing capture data', {
      bounds: captureData.displayInfo.bounds,
      scaleFactor: captureData.displayInfo.scaleFactor,
      imageBufferLength: captureData.imageBuffer.length,
      imageSize: captureData.imageSize,
      timestamp: Date.now()
    })
    
    void loadImage(captureData)
  }, [captureData, loadImage])

  // 监听截图开始事件
  useEffect(() => {
    const cleanup = eventHelper.setupCaptureStartListener(() => {
      setBackgroundImage(null)
      resetSelection()
      setLastError(null)
      setCanvasInfo(null)
    })

    return cleanup
  }, [resetSelection])

  // 监听画布更新
  useEffect(() => {
    let isUpdating = false
    let needsUpdate = false

    const updateIfNeeded = async () => {
      if (isUpdating) {
        needsUpdate = true
        return
      }

      try {
        isUpdating = true
        await debouncedUpdateCanvas()
      } finally {
        isUpdating = false
        if (needsUpdate) {
          needsUpdate = false
          void updateIfNeeded()
        }
      }
    }

    if (backgroundImage && displayInfo && canvasRef.current) {
      void updateIfNeeded()
    }
  }, [backgroundImage, displayInfo, selectedRect, debouncedUpdateCanvas])

  // 设置 canvas 尺寸
  useEffect(() => {
    if (!canvasRef.current || !displayInfo) {
      translog.debug('Cannot set canvas dimensions', {
        hasCanvas: !!canvasRef.current,
        hasDisplayInfo: !!displayInfo,
        timestamp: Date.now()
      })
      return
    }

    try {
      performanceHelper.scheduleUpdate(() => {
        void debouncedUpdateCanvas()
      })
    } catch (error) {
      handleError(error as Error, 'setCanvasDimensions')
    }
  }, [displayInfo, handleError, debouncedUpdateCanvas])

  // Add event listeners to canvas
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleCanvasMouseDown = (event: MouseEvent) => {
      if (!canvasRef.current || !displayInfo) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scale = displayInfo.scaleFactor / (window.devicePixelRatio || 1)
      
      // 计算相对于画布的实际坐标 - 除以 scale 而不是乘以
      const x = (event.clientX - rect.left) / scale
      const y = (event.clientY - rect.top) / scale
      
      const syntheticEvent = {
        clientX: x,
        clientY: y,
        target: event.target,
        currentTarget: event.currentTarget,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
      } as React.MouseEvent<HTMLCanvasElement>
      handleMouseDown(syntheticEvent)
    }

    const handleCanvasMouseMove = (event: MouseEvent) => {
      if (!canvasRef.current || !displayInfo) return
      const rect = canvasRef.current.getBoundingClientRect()
      const scale = displayInfo.scaleFactor / (window.devicePixelRatio || 1)
      
      // 计算相对于画布的实际坐标 - 除以 scale 而不是乘以
      const x = (event.clientX - rect.left) / scale
      const y = (event.clientY - rect.top) / scale
      
      const syntheticEvent = {
        clientX: x,
        clientY: y,
        target: event.target,
        currentTarget: event.currentTarget,
        preventDefault: () => event.preventDefault(),
        stopPropagation: () => event.stopPropagation()
      } as React.MouseEvent<HTMLCanvasElement>
      handleMouseMove(syntheticEvent)
    }

    const handleCanvasMouseUp = () => {
      if (!canvasRef.current || !displayInfo) return
      handleMouseUp()
    }

    canvas.addEventListener('mousedown', handleCanvasMouseDown)
    canvas.addEventListener('mousemove', handleCanvasMouseMove)
    canvas.addEventListener('mouseup', handleCanvasMouseUp)

    return () => {
      canvas.removeEventListener('mousedown', handleCanvasMouseDown)
      canvas.removeEventListener('mousemove', handleCanvasMouseMove)
      canvas.removeEventListener('mouseup', handleCanvasMouseUp)
    }
  }, [canvasRef, displayInfo, handleMouseDown, handleMouseMove, handleMouseUp])

  // 处理模式切换
  const handleModeChange = useCallback((newIsScreenRecording: boolean) => {
    setCaptureMode(newIsScreenRecording ? CaptureMode.ScreenRecording : CaptureMode.Screenshot)
  }, [])

  // 更新鼠标光标样式
  const getCursorStyle = useCallback(() => {
    switch (activeTool) {
      case ToolType.Pencil:
        return 'cursor-pencil'
      case ToolType.Mosaic:
        return 'cursor-crosshair'
      case ToolType.Text:
        return 'cursor-text'
      default:
        return 'cursor-crosshair'
    }
  }, [activeTool])

  // 处理工具变更
  const handleToolChange = useCallback((tool: ToolType) => {
    translog.debug('Tool changed', { tool })
    setActiveTool(tool)
    // 如果当前正在绘制，结束绘制
    if (currentElement) {
      if (editingText) {
        completeTextEditing()
      }
    }
  }, [setActiveTool, currentElement, editingText, completeTextEditing])

  // 渲染文本输入框
  const renderTextInput = () => {
    // 确保只有在编辑文本状态且当前元素是文本类型时才渲染输入框
    if (!editingText || !currentElement || currentElement.type !== ToolType.Text) {
      return null
    }

    const position = currentElement.points[0]
    if (!position) return null

    // 计算输入框位置 - 确保与文本元素位置一致
    const fontSize = currentElement.fontSize || 16
    
    // 获取当前的缩放比例
    const scale = displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1
    
    const inputStyle: React.CSSProperties = {
      // position 属性由 className="fixed" 提供
      left: `${position.x * scale}px`,
      top: `${position.y * scale}px`,
      minWidth: '100px',
      background: 'transparent',
      border: 'none',
      outline: 'none',
      color: currentElement.color || drawColor,
      fontSize: `${fontSize}px`,
      fontFamily: currentElement.fontFamily || 'Arial',
      padding: '0',
      margin: '0',
      // 添加文本阴影以提高可读性
      textShadow: '0px 0px 2px rgba(255, 255, 255, 0.8)'
      // 移除 transform 属性
    }

    return (
      <input
        type="text"
        className="fixed" // 使用 fixed 类，与 InfoPanel 一致
        style={inputStyle}
        value={textInputValue}
        onChange={handleTextInputChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            completeTextEditing()
          }
        }}
        autoFocus
      />
    )
  }

  return (
    <ErrorBoundary>
      <div className="fixed inset-0 select-none overflow-hidden w-screen h-screen bg-transparent">
        <MemoizedDebugPanel
          backgroundImage={backgroundImage}
          captureData={captureData}
          displayInfo={displayInfo}
          canvasInfo={canvasInfo}
          lastError={lastError}
          onRetry={() => {
            setLastError(null)
            setBackgroundImage(null)
            setDisplayInfo(null)
            setCanvasInfo(null)
          }}
          mousePosition={mousePosition}
          selectedRect={selectedRect}
        />

        <canvas
          ref={canvasRef}
          className={`absolute top-0 left-0 w-full h-full ${getCursorStyle()}`}
          style={{
            zIndex: 1,
            backgroundColor: 'transparent'
          }}
        />

        {selectedRect && (
          <>
            {/* 信息面板 */}
            <MemoizedInfoPanel
              x={getBoundsFromRect(selectedRect).x}
              y={getBoundsFromRect(selectedRect).y}
              width={getBoundsFromRect(selectedRect).width}
              height={getBoundsFromRect(selectedRect).height}
              scale={displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1}
              style={{
                ...positionHelper.calculateInfoPanelPosition(
                  selectedRect,
                  getBoundsFromRect(selectedRect),
                  displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1
                ),
                zIndex: 9999
              }}
            />

            {/* 工具栏 */}
            <div
              className="absolute z-[9999]"
              style={positionHelper.calculateToolbarPosition(
                selectedRect,
                displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1
              )}
            >
              <MemoizedToolBar
                onConfirm={() => {
                  const bounds = getBoundsFromRect(selectedRect)
                  completeCapture(bounds)
                }}
                onCancel={cancelCapture}
                onOCR={() => {
                  const bounds = getBoundsFromRect(selectedRect)
                  return handleOCR(bounds)
                }}
                selectedBounds={selectedRect ? getBoundsFromRect(selectedRect) : null}
                isScreenRecording={captureMode === CaptureMode.ScreenRecording}
                onModeChange={handleModeChange}
                onToolChange={handleToolChange}
                activeTool={activeTool}
                drawColor={drawColor}
                onColorChange={setDrawColor}
                lineWidth={lineWidth}
                onLineWidthChange={setLineWidth}
                penStyle={penStyle}
                onPenStyleChange={setPenStyle}
              />
            </div>
          </>
        )}

        {/* 文本输入框 */}
        {renderTextInput()}
      </div>
    </ErrorBoundary>
  )
}

export default Capture 