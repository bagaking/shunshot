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

// 选区控制面板组件
const SelectionControls: React.FC<{
  rect: Rect
  onConfirm: () => void
  onCancel: () => void
}> = ({ rect, onConfirm, onCancel }) => {
  const { startX, startY, width, height } = rect
  const isPositiveWidth = width > 0
  const isPositiveHeight = height > 0
  const x = isPositiveWidth ? startX : startX + width
  const y = isPositiveHeight ? startY : startY + height
  const absWidth = Math.abs(width)
  const absHeight = Math.abs(height)

  return (
    <>
      {/* 尺寸信息面板 */}
      <div
        className="fixed flex items-center space-x-4 bg-black/95 backdrop-blur-sm text-white px-5 py-2.5 rounded-lg shadow-lg transform -translate-x-1/2 z-[9999]"
        style={{
          left: x + absWidth / 2,
          top: Math.max(10, y - 45),
        }}
      >
        {/* 尺寸信息 */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400 text-xs">宽</span>
            <span className="font-mono text-sm font-medium">{absWidth}</span>
          </div>
          <div className="w-px h-3 bg-gray-600" />
          <div className="flex items-center space-x-1.5">
            <span className="text-gray-400 text-xs">高</span>
            <span className="font-mono text-sm font-medium">{absHeight}</span>
          </div>
        </div>
        
        {/* 分隔线 */}
        <div className="w-px h-3 bg-gray-600" />
        
        {/* 快捷键提示 */}
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <span>Enter</span>
          <span>确认</span>
          <span className="mx-1">·</span>
          <span>Esc</span>
          <span>取消</span>
        </div>
      </div>

      {/* 工具栏 */}
      <div
        className="fixed flex items-center space-x-2 bg-white/95 backdrop-blur-sm shadow-xl rounded-xl p-1.5 transform -translate-x-1/2 z-[9999]"
        style={{
          left: x + absWidth / 2,
          top: Math.min(window.innerHeight - 80, y + absHeight + 20),
        }}
      >
        <button
          onClick={onConfirm}
          className="flex items-center space-x-1 bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-4 py-1.5 rounded-lg transition-all duration-150 shadow-sm hover:shadow-md text-sm font-medium pointer-events-auto"
        >
          <span>确认</span>
          <span className="text-xs opacity-75">⏎</span>
        </button>
        <button
          onClick={onCancel}
          className="flex items-center space-x-1 bg-gray-100 hover:bg-gray-200 active:bg-gray-300 text-gray-700 px-4 py-1.5 rounded-lg transition-all duration-150 shadow-sm hover:shadow-md text-sm font-medium pointer-events-auto"
        >
          <span>取消</span>
          <span className="text-xs opacity-75">Esc</span>
        </button>
      </div>
    </>
  )
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
          const scaleFactor = data.displayInfo.scaleFactor
          
          // 设置画布的物理像素大小
          canvas.width = data.displayInfo.bounds.width * scaleFactor
          canvas.height = data.displayInfo.bounds.height * scaleFactor
          
          // 设置画布的显示大小
          canvas.style.width = `${data.displayInfo.bounds.width}px`
          canvas.style.height = `${data.displayInfo.bounds.height}px`
          
          const ctx = canvas.getContext('2d')
          if (ctx) {
            // 清除之前的变换
            ctx.setTransform(1, 0, 0, 1, 0, 0)
            // 应用缩放以匹配设备像素比
            ctx.scale(scaleFactor, scaleFactor)
            // 绘制背景图
            ctx.drawImage(img, 0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
            // 添加半透明遮罩
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
            ctx.fillRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
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

    const scaleFactor = displayInfo.scaleFactor

    // 清除画布
    ctx.clearRect(0, 0, canvas.width / scaleFactor, canvas.height / scaleFactor)
    
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
      ctx.lineWidth = 2 / scaleFactor // 调整线宽以适应设备像素比
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
        <SelectionControls
          rect={selectedRect}
          onConfirm={() => {
            const bounds = {
              x: selectedRect.width > 0 ? selectedRect.startX : selectedRect.startX + selectedRect.width,
              y: selectedRect.height > 0 ? selectedRect.startY : selectedRect.startY + selectedRect.height,
              width: Math.abs(selectedRect.width),
              height: Math.abs(selectedRect.height),
            }
            window.electronAPI.completeCapture(bounds)
            navigate('/')
          }}
          onCancel={() => {
            window.electronAPI.cancelCapture()
            navigate('/')
          }}
        />
      )}
    </div>
  )
}

export default Capture 