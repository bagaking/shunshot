import React, { useRef, useState, useEffect, useCallback } from 'react'
import { InfoPanel } from '../components/InfoPanel'
import { ToolBar } from '../components/ToolBar'
import { DebugPanel } from '../components/DebugPanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
import { useCapture } from '../hooks/useCapture'
import { CaptureData, DisplayInfo } from '../types/capture'
import { translog } from '../utils/translog'
import { canvasHelper } from '../utils/canvasHelper'
import { performanceHelper } from '../utils/performanceHelper'
import { eventHelper } from '../utils/eventHelper'
import { positionHelper } from '../utils/positionHelper'
import { canvasRenderHelper } from '../utils/canvasRenderHelper'

// 使用 React.memo 优化子组件
const MemoizedInfoPanel = React.memo(InfoPanel)
const MemoizedToolBar = React.memo(ToolBar)
const MemoizedDebugPanel = React.memo(DebugPanel)

interface CaptureProps {
  captureData: CaptureData | null
  displayInfo: DisplayInfo | null
  onDisplayInfoChange: (info: DisplayInfo | null) => void
}

const Capture: React.FC<CaptureProps> = ({ captureData, displayInfo, onDisplayInfoChange }) => {
  // console.log('Capture component rendering')

  const {
    selectedRect,
    mousePosition,
    setDisplayInfo,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    completeCapture,
    cancelCapture,
    getBoundsFromRect,
    handleOCR,
    resetSelection,
  } = useCapture({ displayInfo, onDisplayInfoChange })

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
  const [isScreenRecording, setIsScreenRecording] = useState(false)

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
      const img = new Image()
      loadingImageRef.current = img

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          if (loadingImageRef.current === img) {
            setBackgroundImage(img)
            // Reset initial canvas state when loading new image
            setInitialCanvasState(null)
            resolve()
          }
        }
        img.onerror = (error) => reject(error)
        img.src = data.imageData
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
            isScreenRecording,
            getBoundsFromRect,
            setInitialCanvasState,
            setCanvasInfo,
            startTime
          })
        })

        updateCanvasRef.current = frameId
      } catch (error) {
        handleError(error as Error, 'updateCanvas')
      }
    }, 16),
    [canvasRef, backgroundImage, displayInfo, selectedRect, getBoundsFromRect, handleError, isScreenRecording, initialCanvasState]
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
      imageDataLength: captureData.imageData.length,
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
      const totalScale = canvasHelper.setCanvasDimensions(
        canvasRef.current,
        displayInfo,
        (dimensions) => setCanvasInfo({
          width: dimensions.width,
          height: dimensions.height,
          style: {
            width: `${displayInfo.bounds.width}px`,
            height: `${displayInfo.bounds.height}px`
          }
        })
      )

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
    setIsScreenRecording(newIsScreenRecording)
  }, [])

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
          className="absolute top-0 left-0 w-full h-full cursor-crosshair"
          style={{
            zIndex: 1,
            backgroundColor: 'transparent'
          }}
        />

        {selectedRect && (
          <>
            {/* 信息面板 */}
            <div
              className="absolute z-[9999]"
              style={positionHelper.calculateInfoPanelPosition(
                selectedRect,
                getBoundsFromRect(selectedRect),
                displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1
              )}
            >
              <MemoizedInfoPanel
                x={getBoundsFromRect(selectedRect).x}
                y={getBoundsFromRect(selectedRect).y}
                width={getBoundsFromRect(selectedRect).width}
                height={getBoundsFromRect(selectedRect).height}
                scale={displayInfo ? displayInfo.scaleFactor / (window.devicePixelRatio || 1) : 1}
              />
            </div>

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
                isScreenRecording={isScreenRecording}
                onModeChange={handleModeChange}
              />
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  )
}

export default React.memo(Capture) 