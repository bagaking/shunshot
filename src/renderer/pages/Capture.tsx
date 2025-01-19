import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

interface Point {
  x: number
  y: number
}

interface Rect {
  startX: number
  startY: number
  width: number
  height: number
}

interface DisplayInfo {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
}

const Capture: React.FC = () => {
  console.log('Capture component rendering')
  const navigate = useNavigate()
  
  const [isSelecting, setIsSelecting] = useState(false)
  const [startPoint, setStartPoint] = useState<Point | null>(null)
  const [selectedRect, setSelectedRect] = useState<Rect | null>(null)
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [backgroundImage, setBackgroundImage] = useState<HTMLImageElement | null>(null)

  // 组件挂载时的初始化
  useEffect(() => {
    console.log('Capture component mounted')
    return () => {
      console.log('Capture component unmounting')
    }
  }, [])

  // 监听截图数据
  useEffect(() => {
    console.log('Setting up screen capture data listener')
    const cleanup = window.electronAPI.onScreenCaptureData((data) => {
      console.log('Received screen capture data:', {
        bounds: data.displayInfo.bounds,
        scaleFactor: data.displayInfo.scaleFactor
      })
      
      const img = new Image()
      img.onload = () => {
        setBackgroundImage(img)
        setDisplayInfo(data.displayInfo)
        if (canvasRef.current) {
          const canvas = canvasRef.current
          // 设置画布的实际大小为屏幕的物理像素大小
          canvas.width = data.displayInfo.bounds.width
          canvas.height = data.displayInfo.bounds.height
          
          // 设置画布的显示大小为屏幕的逻辑像素大小
          canvas.style.width = `${data.displayInfo.bounds.width}px`
          canvas.style.height = `${data.displayInfo.bounds.height}px`
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // 清除之前的变换
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            // 绘制背景图
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            // 添加半透明遮罩
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }
        }
      }
      img.src = data.imageData
    })

    return cleanup
  }, [])

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

  const updateCanvas = () => {
    if (!canvasRef.current || !backgroundImage || !displayInfo) return
    
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // 清除画布
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    
    // 重置变换
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    
    // 绘制背景图
    ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
    
    // 绘制半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 如果有选区，清除选区的遮罩并添加装饰
    if (selectedRect) {
      const { startX, startY, width, height } = selectedRect
      const x = width > 0 ? startX : startX + width
      const y = height > 0 ? startY : startY + height
      const w = Math.abs(width)
      const h = Math.abs(height)

      // 清除选区的遮罩
      ctx.clearRect(x, y, w, h)
      
      // 绘制选区的背景
      ctx.drawImage(backgroundImage, x, y, w, h, x, y, w, h)

      // 绘制选区边框
      ctx.strokeStyle = '#2196F3'
      ctx.lineWidth = 2
      ctx.strokeRect(x, y, w, h)

      // 绘制选区外的深色遮罩
      const gradient = ctx.createRadialGradient(
        x + w/2, y + h/2, Math.min(w, h)/2,
        x + w/2, y + h/2, Math.max(w, h)
      )
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0.3)')
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0.6)')
      ctx.fillStyle = gradient

      // 绘制四个角的装饰
      const cornerSize = 12
      const cornerWidth = 2
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
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      ctx.lineWidth = 1

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
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('Mouse down:', { x: e.clientX, y: e.clientY })
    setIsSelecting(true)
    setStartPoint({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setMousePosition({ x: e.clientX, y: e.clientY })
    
    if (!isSelecting || !startPoint) return

    const width = e.clientX - startPoint.x
    const height = e.clientY - startPoint.y

    setSelectedRect({
      startX: startPoint.x,
      startY: startPoint.y,
      width,
      height,
    })
  }

  const handleMouseUp = () => {
    console.log('Mouse up, selection completed')
    setIsSelecting(false)
    if (selectedRect) {
      console.log('Selected rect:', selectedRect)
      // 确保矩形的宽高为正数
      const bounds = {
        x: selectedRect.width > 0 ? selectedRect.startX : selectedRect.startX + selectedRect.width,
        y: selectedRect.height > 0 ? selectedRect.startY : selectedRect.startY + selectedRect.height,
        width: Math.abs(selectedRect.width),
        height: Math.abs(selectedRect.height),
      }
      console.log('Normalized bounds:', bounds)
    }
  }

  // 更新画布
  useEffect(() => {
    updateCanvas()
  }, [selectedRect, backgroundImage])

  const handleKeyDown = (e: KeyboardEvent) => {
    console.log('Key pressed:', e.key)
    if (e.key === 'Escape') {
      console.log('Cancelling capture')
      window.electronAPI.cancelCapture()
      navigate('/')
    } else if (e.key === 'Enter' && selectedRect) {
      console.log('Completing capture with Enter key')
      const bounds = {
        x: selectedRect.width > 0 ? selectedRect.startX : selectedRect.startX + selectedRect.width,
        y: selectedRect.height > 0 ? selectedRect.startY : selectedRect.startY + selectedRect.height,
        width: Math.abs(selectedRect.width),
        height: Math.abs(selectedRect.height),
      }
      window.electronAPI.completeCapture(bounds)
      navigate('/')
    }
  }

  useEffect(() => {
    console.log('Setting up keyboard listener')
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      console.log('Cleaning up keyboard listener')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedRect])

  const renderControlPanel = () => {
    if (!selectedRect) return null

    const { startX, startY, width, height } = selectedRect
    const isPositiveWidth = width > 0
    const isPositiveHeight = height > 0
    const x = isPositiveWidth ? startX : startX + width
    const y = isPositiveHeight ? startY : startY + height
    const absWidth = Math.abs(width)
    const absHeight = Math.abs(height)

    return (
      <>
        {/* 尺寸提示 */}
        <div
          className="fixed bg-black/90 backdrop-blur text-white text-xs px-4 py-2 rounded-lg shadow-lg transform -translate-x-1/2 flex items-center space-x-2"
          style={{
            left: x + absWidth / 2,
            top: Math.max(10, y - 40),
          }}
        >
          <span className="font-mono">{absWidth} × {absHeight}</span>
          <span className="text-gray-400">|</span>
          <span className="text-gray-300">按 Enter 确认</span>
        </div>

        {/* 工具栏 */}
        <div
          className="fixed flex items-center space-x-3 bg-white/95 backdrop-blur shadow-xl rounded-xl px-4 py-3 transform -translate-x-1/2"
          style={{
            left: x + absWidth / 2,
            top: Math.min(window.innerHeight - 80, y + absHeight + 20),
          }}
        >
          <button
            onClick={() => {
              console.log('Completing capture via button')
              window.electronAPI.completeCapture({
                x,
                y,
                width: absWidth,
                height: absHeight,
              })
              navigate('/')
            }}
            className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-6 py-2 rounded-lg transition-all duration-150 shadow-sm hover:shadow-md font-medium pointer-events-auto"
          >
            确认
          </button>
          <button
            onClick={() => {
              console.log('Cancelling capture via button')
              window.electronAPI.cancelCapture()
              navigate('/')
            }}
            className="bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 px-6 py-2 rounded-lg transition-all duration-150 shadow-sm hover:shadow-md font-medium pointer-events-auto"
          >
            取消
          </button>
        </div>
      </>
    )
  }

  return (
    <div className="fixed inset-0 select-none overflow-hidden w-screen h-screen">
      {/* 初始提示 */}
      {!selectedRect && (
        <div className="fixed left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-center z-[9999]">
          <div className="bg-black/90 backdrop-blur px-8 py-6 rounded-2xl shadow-2xl">
            <p className="text-2xl font-bold mb-3">点击并拖动来选择截图区域</p>
            <p className="text-sm text-gray-300">按 ESC 取消，Enter 确认</p>
          </div>
        </div>
      )}

      {/* 鼠标位置提示 */}
      {!selectedRect && (
        <div
          className="fixed bg-black/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-[9999] font-mono"
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
        <div className="fixed inset-0 pointer-events-none z-[9999]">
          {renderControlPanel()}
        </div>
      )}
    </div>
  )
}

export default Capture 