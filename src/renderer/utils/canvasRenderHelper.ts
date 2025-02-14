import { DisplayInfo, Rect } from '../types/capture'
import { translog } from './translog'

interface RenderConfig {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  backgroundImage: HTMLImageElement
  displayInfo: DisplayInfo
  selectedRect: Rect | null
  initialCanvasState: ImageData | null
  isScreenRecording: boolean
  getBoundsFromRect: (rect: Rect) => { x: number; y: number; width: number; height: number }
  setInitialCanvasState: (state: ImageData) => void
  setCanvasInfo: (info: {
    width: number
    height: number
    style: {
      width: string
      height: string
    }
  }) => void
  startTime: number
}

export const canvasRenderHelper = {
  render(config: RenderConfig) {
    const {
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
    } = config

    // 只在初始化或尺寸变化时设置画布尺寸
    if (
      canvas.width !== displayInfo.bounds.width * displayInfo.scaleFactor ||
      canvas.height !== displayInfo.bounds.height * displayInfo.scaleFactor
    ) {
      // 设置物理像素大小
      canvas.width = displayInfo.bounds.width * displayInfo.scaleFactor
      canvas.height = displayInfo.bounds.height * displayInfo.scaleFactor
      
      // 设置 CSS 显示大小
      canvas.style.width = `${displayInfo.bounds.width}px`
      canvas.style.height = `${displayInfo.bounds.height}px`

      // 初始绘制背景图 (使用物理像素大小)
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
      
      // 保存初始状态
      setInitialCanvasState(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }

    // 如果有初始状态，恢复它
    if (initialCanvasState) {
      ctx.putImageData(initialCanvasState, 0, 0)
    } else {
      // 如果没有初始状态，重新绘制背景
      ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height)
      setInitialCanvasState(ctx.getImageData(0, 0, canvas.width, canvas.height))
    }

    // 如果有选区,绘制选区
    if (selectedRect) {
      const bounds = getBoundsFromRect(selectedRect)
      const scale = displayInfo.scaleFactor

      // 计算物理像素坐标
      const physicalBounds = {
        x: Math.round(bounds.x * scale),
        y: Math.round(bounds.y * scale),
        width: Math.round(bounds.width * scale),
        height: Math.round(bounds.height * scale)
      }

      // 绘制半透明遮罩 (使用物理像素坐标)
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 清除选区部分的遮罩并绘制内容
      if (isScreenRecording) {
        // 录屏模式：直接清除遮罩，显示实时内容
        ctx.clearRect(
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height
        )
      } else {
        // 截图模式：直接从原始背景图绘制高清内容
        ctx.save()
        
        // 清除选区的遮罩
        ctx.clearRect(
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height
        )
        
        // 创建裁剪区域 (使用物理像素坐标)
        ctx.beginPath()
        ctx.rect(
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height
        )
        ctx.clip()
        
        // 直接使用原始图像绘制 (使用物理像素坐标)
        ctx.drawImage(
          backgroundImage,
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height,
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height
        )
        
        ctx.restore()
      }

      // 绘制选区边框 (使用物理像素坐标)
      ctx.strokeStyle = '#1890ff'
      ctx.lineWidth = 2 * scale
      ctx.strokeRect(
        physicalBounds.x,
        physicalBounds.y,
        physicalBounds.width,
        physicalBounds.height
      )
    }

    setCanvasInfo({
      width: canvas.width,
      height: canvas.height,
      style: {
        width: canvas.style.width,
        height: canvas.style.height
      }
    })

    const endTime = performance.now()
    translog.debug('Canvas update completed', {
      duration: endTime - startTime,
      timestamp: Date.now()
    })
  }
} 