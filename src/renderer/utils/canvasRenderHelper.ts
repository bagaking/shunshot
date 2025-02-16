import { DisplayInfo, Rect, CaptureMode } from '../types/capture'
import { translog } from './translog'

interface RenderConfig {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  backgroundImage: HTMLImageElement
  displayInfo: DisplayInfo
  selectedRect: Rect | null
  initialCanvasState: ImageData | null
  mode: CaptureMode
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
  // 内部样式配置
  _cornerStyles: {
    primary: {
      screenshot: {
        colors: ['#2563EB', '#3B82F6'],
        shadowColor: 'rgba(37, 99, 235, 0.25)',
        centerDotColor: '#2563EB'
      },
      recording: {
        colors: ['#DC2626'],
        shadowColor: 'rgba(220, 38, 38, 0.25)',
        centerDotColor: '#DC2626'
      }
    },
    secondary: {
      colors: ['#8c8c8c'],
      shadowColor: 'rgba(0, 0, 0, 0.2)',
      centerDotColor: '#8c8c8c'
    }
  },

  // 创建渐变的辅助函数
  _createCornerGradient(
    ctx: CanvasRenderingContext2D,
    cornerSize: number,
    colors: string[],
    isRainbow = false
  ) {
    const gradient = ctx.createLinearGradient(
      -cornerSize / 2,
      -cornerSize / 2,
      cornerSize / 2,
      cornerSize / 2
    )
    
    if (isRainbow) {
      colors.forEach((color, index) => {
        gradient.addColorStop(index / (colors.length - 1), color)
      })
    } else {
      gradient.addColorStop(0, colors[0])
      gradient.addColorStop(1, colors[colors.length - 1] || colors[0])
    }
    
    return gradient
  },

  // 绘制基础L形角点的辅助函数
  _drawBaseCorner(
    ctx: CanvasRenderingContext2D,
    cornerSize: number,
    scale: number,
    style: { strokeStyle: string | CanvasGradient; lineWidth?: number }
  ) {
    ctx.beginPath()
    ctx.moveTo(-cornerSize / 2, 0)
    ctx.lineTo(0, 0)
    ctx.lineTo(0, -cornerSize / 2)
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth || 2 * scale
    ctx.stroke()
  },

  // 绘制中心点的辅助函数
  _drawCenterDot(
    ctx: CanvasRenderingContext2D,
    scale: number,
    color: string,
    size = 3,
    strokeStyle?: string | CanvasGradient,
    opacity = 1
  ) {
    ctx.beginPath()
    ctx.arc(0, 0, size * scale, 0, Math.PI * 2)
    ctx.fillStyle = opacity === 1 ? color : `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
    ctx.fill()
    if (strokeStyle) {
      ctx.strokeStyle = strokeStyle
      ctx.lineWidth = scale
      ctx.stroke()
    }
  },

  // 设置阴影效果的辅助函数
  _setShadowEffect(
    ctx: CanvasRenderingContext2D,
    shadowColor: string,
    scale: number,
    blur = 4
  ) {
    ctx.shadowColor = shadowColor
    ctx.shadowBlur = blur * scale
  },

  // 绘制选区边框和装饰
  drawSelectionBorder(
    ctx: CanvasRenderingContext2D,
    bounds: { x: number; y: number; width: number; height: number },
    scale: number,
    mode: CaptureMode
  ) {
    const { x, y, width, height } = bounds
    const cornerSize = 12 * scale
    const lineWidth = 1.5 * scale  // 减小基础线宽

    // 保存当前上下文状态
    ctx.save()

    if (mode === CaptureMode.Screenshot || mode === CaptureMode.ScreenRecording) {
      // 主要模式：现代化的边框效果
      if (mode === CaptureMode.Screenshot) {
        // 截图模式：清晰专业的边框
        // 柔和的外发光效果
        ctx.shadowColor = 'rgba(37, 99, 235, 0.15)'
        ctx.shadowBlur = 6 * scale
        ctx.strokeStyle = '#3B82F6'
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, width, height)

        // 内部渐变边框
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
        gradient.addColorStop(0, '#2563EB80')  // 半透明渐变
        gradient.addColorStop(0.5, '#3B82F6')
        gradient.addColorStop(1, '#2563EB80')
        ctx.strokeStyle = gradient
        ctx.lineWidth = lineWidth * 0.8  // 更细的内边框
        ctx.strokeRect(x, y, width, height)

      } else {
        // 录屏模式：动态录制效果
        const pulseScale = (Math.sin(performance.now() / 800) + 1) / 2  // 降低动画速度

        // 柔和的外发光效果
        ctx.shadowColor = 'rgba(220, 38, 38, 0.2)'
        ctx.shadowBlur = 8 * scale
        ctx.strokeStyle = '#DC262680'  // 半透明主色
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, width, height)

        // 动态虚线边框
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
        ctx.strokeStyle = '#DC2626'
        ctx.lineWidth = lineWidth * 0.8
        const dashLength = 6 * scale  // 减小虚线长度
        ctx.setLineDash([dashLength, dashLength])
        ctx.lineDashOffset = -performance.now() / 100  // 降低动画速度
        ctx.strokeRect(x, y, width, height)

        // 录制指示器动画 - 移到左上角并优化大小
        const indicatorSize = 4 * scale  // 减小指示器大小
        const padding = 6 * scale
        
        // 绘制内圆
        ctx.beginPath()
        ctx.arc(
          x + padding + indicatorSize,
          y + padding + indicatorSize,
          indicatorSize * (0.6 + pulseScale * 0.2),  // 减小脉冲范围
          0,
          Math.PI * 2
        )
        ctx.fillStyle = '#DC2626'
        ctx.fill()
        
        // 绘制外圈光晕
        ctx.beginPath()
        ctx.arc(
          x + padding + indicatorSize,
          y + padding + indicatorSize,
          indicatorSize * (1 + pulseScale * 0.3),
          0,
          Math.PI * 2
        )
        ctx.strokeStyle = '#DC262640'  // 更透明的光晕
        ctx.lineWidth = scale * 0.5
        ctx.stroke()
      }
    } else {
      // 次要模式：简洁的灰色边框
      ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
      ctx.shadowBlur = 4 * scale
      ctx.strokeStyle = '#8c8c8c80'  // 半透明灰色
      ctx.lineWidth = lineWidth
      ctx.setLineDash([4 * scale, 3 * scale])  // 减小虚线间距
      ctx.strokeRect(x, y, width, height)
    }

    // 绘制角点装饰
    this.drawCornerDecorations(ctx, x, y, width, height, cornerSize, mode, scale)

    // 恢复上下文状态
    ctx.restore()
  },

  // 新增：绘制高级角点装饰的方法
  drawCornerDecorations(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    cornerSize: number,
    mode: CaptureMode,
    scale: number
  ) {
    const corners = [
      { x: x, y: y }, // 左上
      { x: x + width, y: y }, // 右上
      { x: x, y: y + height }, // 左下
      { x: x + width, y: y + height } // 右下
    ]

    corners.forEach((corner, index) => {
      ctx.save()
      ctx.translate(corner.x, corner.y)
      ctx.rotate((Math.PI / 2) * index)

      if (mode === CaptureMode.Screenshot || mode === CaptureMode.ScreenRecording) {
        if (mode === CaptureMode.Screenshot) {
          // 截图模式：简洁现代的角点
          const style = this._cornerStyles.primary.screenshot
          this._setShadowEffect(ctx, style.shadowColor, scale, 4)
          
          // 更细腻的L形角点
          ctx.beginPath()
          ctx.moveTo(-cornerSize / 2, 0)
          ctx.lineTo(0, 0)
          ctx.lineTo(0, -cornerSize / 2)
          const gradient = this._createCornerGradient(ctx, cornerSize, style.colors)
          ctx.strokeStyle = gradient
          ctx.lineWidth = 1.5 * scale  // 更细的线条
          ctx.stroke()
          
          // 更小的装饰点
          this._drawCenterDot(ctx, scale, style.centerDotColor, 1.5)
          
        } else {
          // 录屏模式：动态角点效果
          const style = this._cornerStyles.primary.recording
          const pulseScale = (Math.sin(performance.now() / 800) + 1) / 2
          
          // 柔和的外发光
          this._setShadowEffect(ctx, style.shadowColor, scale, 6 * (1 + pulseScale * 0.2))
          
          // 动态L形角点
          ctx.beginPath()
          ctx.moveTo(-cornerSize / 2, 0)
          ctx.lineTo(0, 0)
          ctx.lineTo(0, -cornerSize / 2)
          ctx.strokeStyle = `${style.colors[0]}CC`  // 稍微透明
          ctx.lineWidth = 1.5 * scale * (1 + pulseScale * 0.15)  // 减小动画幅度
          ctx.stroke()
          
          // 更小的动态圆点
          const dotScale = 1 + pulseScale * 0.2
          this._drawCenterDot(ctx, scale * dotScale, style.centerDotColor, 2)
          
          // 更柔和的光环
          ctx.beginPath()
          ctx.arc(0, 0, 3 * scale * (1 + pulseScale * 0.15), 0, Math.PI * 2)
          ctx.strokeStyle = `${style.colors[0]}20`  // 更透明的光环
          ctx.lineWidth = scale * 0.5
          ctx.stroke()
        }
      } else {
        // 次要模式：更简单的角点
        const style = this._cornerStyles.secondary
        this._setShadowEffect(ctx, style.shadowColor, scale, 3)
        this._drawBaseCorner(ctx, cornerSize, scale, { 
          strokeStyle: `${style.colors[0]}99`,  // 更透明
          lineWidth: 1.5 * scale 
        })
        this._drawCenterDot(ctx, scale, style.centerDotColor, 1.5)
      }

      ctx.restore()
    })
  },

  render(config: RenderConfig) {
    const {
      canvas,
      ctx,
      backgroundImage,
      displayInfo,
      selectedRect,
      initialCanvasState,
      mode,
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

    // 绘制半透明遮罩
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)' // 30% 透明度的黑色遮罩
    ctx.fillRect(0, 0, canvas.width, canvas.height)

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

      // 清除选区内的遮罩,显示原图
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = 'rgba(0, 0, 0, 1)'
      ctx.fillRect(physicalBounds.x, physicalBounds.y, physicalBounds.width, physicalBounds.height)
      
      // 恢复正常绘制模式
      ctx.globalCompositeOperation = 'source-over'

      // 只在截图模式下重绘原始内容
      if (mode === CaptureMode.Screenshot && initialCanvasState) {
        ctx.putImageData(
          initialCanvasState,
          0,
          0,
          physicalBounds.x,
          physicalBounds.y,
          physicalBounds.width,
          physicalBounds.height
        )
      }
      
      // 使用新的边框绘制方法
      this.drawSelectionBorder(ctx, physicalBounds, scale, mode)
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
  },

  drawSizeLabel(ctx: CanvasRenderingContext2D, bounds: { x: number; y: number; width: number; height: number }) {
    const label = `${bounds.width} x ${bounds.height}`
    
    ctx.font = '12px Arial'
    ctx.fillStyle = '#1a73e8'
    ctx.fillText(
      label,
      bounds.x + bounds.width + 8,
      bounds.y + bounds.height + 16
    )
  }
} 