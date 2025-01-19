import React, { useRef, useState, useEffect } from 'react'
import { InfoPanel } from '../components/InfoPanel'
import { ToolBar } from '../components/ToolBar'
import { useCapture } from '../hooks/useCapture'
import { CaptureData } from '../types/capture'

interface CaptureProps {
  captureData: CaptureData | null
}

const Capture: React.FC<CaptureProps> = ({ captureData }) => {
  console.log('Capture component rendering')

  const {
    
    selectedRect,
    mousePosition,
    displayInfo,
    
    setDisplayInfo,
    setIsDraggingSelection,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleSelectionDrag,
    completeCapture,
    cancelCapture,
    getBoundsFromRect,
    handleOCR,
  } = useCapture()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null)

  // 组件挂载时的初始化
  useEffect(() => {
    console.log('Capture component mounted')
    return () => {
      console.log('Capture component unmounting')
    }
  }, [])

  // 处理截图数据
  useEffect(() => {
    if (!captureData) {
      console.log('No capture data available')
      return
    }

    console.log('Processing capture data:', {
      bounds: captureData.displayInfo.bounds,
      scaleFactor: captureData.displayInfo.scaleFactor,
      imageDataLength: captureData.imageData.length
    })
    
    const img = new Image()
    img.onload = () => {
      console.log('Background image loaded:', {
        width: img.width,
        height: img.height
      })
      setBackgroundImage(img)
      setDisplayInfo(captureData.displayInfo)
      
      if (canvasRef.current) {
        const canvas = canvasRef.current
        const scaleFactor = captureData.displayInfo.scaleFactor
        
        console.log('Setting canvas dimensions:', {
          physicalWidth: captureData.displayInfo.bounds.width * scaleFactor,
          physicalHeight: captureData.displayInfo.bounds.height * scaleFactor,
          displayWidth: captureData.displayInfo.bounds.width,
          displayHeight: captureData.displayInfo.bounds.height
        })
        
        // 设置画布的物理像素大小
        canvas.width = captureData.displayInfo.bounds.width * scaleFactor
        canvas.height = captureData.displayInfo.bounds.height * scaleFactor
        
        // 设置画布的显示大小
        canvas.style.width = `${captureData.displayInfo.bounds.width}px`
        canvas.style.height = `${captureData.displayInfo.bounds.height}px`
        
        updateCanvas()
      } else {
        console.error('Canvas reference not available')
      }
    }
    
    img.onerror = (error) => {
      console.error('Failed to load background image:', error)
    }
    
    img.src = captureData.imageData
  }, [captureData, setDisplayInfo])

  // 监听截图开始事件
  useEffect(() => {
    console.log('Setting up START_CAPTURE listener')
    const cleanup = window.electronAPI.onStartCapture(() => {
      console.log('START_CAPTURE event received')
    })

    return () => {
      console.log('Cleaning up START_CAPTURE listener')
      cleanup()
    }
  }, [])

  // 更新画布
  const updateCanvas = () => {
    if (!canvasRef.current || !backgroundImage || !displayInfo) {
      console.log('Cannot update canvas:', {
        hasCanvas: !!canvasRef.current,
        hasBackgroundImage: !!backgroundImage,
        hasDisplayInfo: !!displayInfo
      })
      return
    }
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      console.error('Failed to get canvas context')
      return
    }

    const scaleFactor = displayInfo.scaleFactor
    console.log('Updating canvas with scale factor:', scaleFactor)

    try {
      // 清除画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // 重置变换
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      // 应用缩放以匹配设备像素比
      ctx.scale(scaleFactor, scaleFactor)
      
      // 绘制背景图
      ctx.drawImage(backgroundImage, 0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
      
      // 绘制半透明遮罩
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)

      // 如果有选区，清除选区的遮罩并添加装饰
      if (selectedRect) {
        const { startX, startY, width, height } = selectedRect
        const x = width > 0 ? startX : startX + width
        const y = height > 0 ? startY : startY + height
        const w = Math.abs(width)
        const h = Math.abs(height)

        console.log('Drawing selection rect:', { x, y, w, h })

        // 清除选区的遮罩
        ctx.clearRect(x, y, w, h)
        
        // 重绘选区内容
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, w, h)
        ctx.clip()
        ctx.drawImage(backgroundImage, 0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
        ctx.restore()
        
        // 绘制选区边框
        ctx.strokeStyle = '#2196F3'
        ctx.lineWidth = 2 / scaleFactor
        ctx.strokeRect(x, y, w, h)

        // 绘制四个角的装饰
        const cornerSize = 12 / scaleFactor
        const cornerWidth = 2 / scaleFactor
        ctx.strokeStyle = '#2196F3'
        ctx.lineWidth = cornerWidth

        // 左上角
        ctx.beginPath()
        ctx.moveTo(x, y + cornerSize)
        ctx.lineTo(x, y)
        ctx.lineTo(x + cornerSize, y)
        ctx.stroke()

        // 右上角
        ctx.beginPath()
        ctx.moveTo(x + w - cornerSize, y)
        ctx.lineTo(x + w, y)
        ctx.lineTo(x + w, y + cornerSize)
        ctx.stroke()

        // 左下角
        ctx.beginPath()
        ctx.moveTo(x, y + h - cornerSize)
        ctx.lineTo(x, y + h)
        ctx.lineTo(x + cornerSize, y + h)
        ctx.stroke()

        // 右下角
        ctx.beginPath()
        ctx.moveTo(x + w - cornerSize, y + h)
        ctx.lineTo(x + w, y + h)
        ctx.lineTo(x + w, y + h - cornerSize)
        ctx.stroke()

        // 绘制参考线
        ctx.setLineDash([4 / scaleFactor, 4 / scaleFactor])
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 1 / scaleFactor

        // 水平参考线
        ctx.beginPath()
        ctx.moveTo(x, y + h/2)
        ctx.lineTo(x + w, y + h/2)
        ctx.stroke()

        // 垂直参考线
        ctx.beginPath()
        ctx.moveTo(x + w/2, y)
        ctx.lineTo(x + w/2, y + h)
        ctx.stroke()

        ctx.setLineDash([])
      }
    } catch (error) {
      console.error('Error updating canvas:', error)
    }
  }

  // 更新画布
  useEffect(() => {
    console.log('Canvas update triggered by dependency change')
    updateCanvas()
  }, [selectedRect, backgroundImage])

  return (
    <div className="fixed inset-0 select-none overflow-hidden w-screen h-screen">
      {/* 初始提示 */}
      {!selectedRect && (
        <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center z-[9999]">
          <div className="bg-black/95 backdrop-blur-sm px-8 py-6 rounded-2xl shadow-2xl">
            <p className="text-2xl font-bold mb-3">点击并拖动来选择截图区域</p>
            <p className="text-sm text-gray-400">按 ESC 取消，Enter 确认</p>
          </div>
        </div>
      )}

      {/* 鼠标位置提示 */}
      {!selectedRect && (
        <div
          className="fixed bg-black/95 backdrop-blur-sm text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-[9999] font-mono"
          style={{
            left: mousePosition.x + 15,
            top: mousePosition.y + 15,
          }}
        >
          {mousePosition.x}, {mousePosition.y}
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="absolute top-0 left-0 w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      />

      {selectedRect && (
        <>
          {/* 信息面板 */}
          <div
            className="absolute z-[9999]"
            style={{
              left: selectedRect.width > 0 
                ? selectedRect.startX
                : selectedRect.startX + selectedRect.width,
              top: Math.max(
                10, 
                (selectedRect.height > 0 
                  ? selectedRect.startY 
                  : selectedRect.startY + selectedRect.height) - 45
              ),
              
            }}
          >
            <InfoPanel
              width={Math.abs(selectedRect.width)}
              height={Math.abs(selectedRect.height)}
              onDragStart={() => setIsDraggingSelection(true)}
              onDrag={handleSelectionDrag}
              onDragStop={() => setIsDraggingSelection(false)}
            />
          </div>

          {/* 工具栏 */}
          <div
            className="absolute z-[9999]"
            style={{
              left: selectedRect.width > 0 
                ? selectedRect.startX
                : selectedRect.startX + selectedRect.width,
              top: Math.min(
                window.innerHeight - 50,
                (selectedRect.height > 0 
                  ? selectedRect.startY + selectedRect.height
                  : selectedRect.startY) + 10
              ),
            }}
          >
            <ToolBar
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
            />
          </div>
        </>
      )}
    </div>
  )
}

export default Capture 