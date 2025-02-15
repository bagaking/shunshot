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
    screenshot: {
      colors: ['#1890ff', '#69c0ff'],
      shadowColor: 'rgba(24, 144, 255, 0.3)',
      centerDotColor: '#1890ff'
    },
    recording: {
      colors: ['#ff4d4f'],
      shadowColor: 'rgba(255, 77, 79, 0.3)',
      centerDotColor: '#ff4d4f'
    },
    region: {
      colors: ['#52c41a'],
      shadowColor: 'rgba(82, 196, 26, 0.3)',
      centerDotColor: '#52c41a'
    },
    magnifier: {
      colors: ['#722ed1'],
      shadowColor: 'rgba(114, 46, 209, 0.3)',
      centerDotColor: '#722ed1'
    },
    colorPicker: {
      colors: ['#ff4d4f', '#faad14', '#1890ff', '#722ed1'],
      shadowColor: 'rgba(0, 0, 0, 0.2)',
      centerDotColor: '#fff'
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
    const lineWidth = 2 * scale

    // 保存当前上下文状态
    ctx.save()

    // 创建主外发光效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.2)'
    ctx.shadowBlur = 8 * scale
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'
    ctx.lineWidth = lineWidth + 4
    ctx.strokeRect(x, y, width, height)

    // 清除阴影以准备绘制其他元素
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0

    // 根据不同模式设置边框样式
    switch (mode) {
      case CaptureMode.Screenshot:
        // 截图模式：渐变边框效果
        const screenshotGradient = ctx.createLinearGradient(x, y, x + width, y + height)
        screenshotGradient.addColorStop(0, '#1890ff')
        screenshotGradient.addColorStop(0.5, '#69c0ff')
        screenshotGradient.addColorStop(1, '#1890ff')
        ctx.strokeStyle = screenshotGradient
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, width, height)
        break
        
      case CaptureMode.ScreenRecording:
        // 录屏模式：动画脉冲效果
        ctx.strokeStyle = '#ff4d4f'
        ctx.lineWidth = lineWidth
        ctx.setLineDash([8 * scale, 4 * scale])
        const pulseScale = (Math.sin(performance.now() / 500) + 1) / 2 // 0 to 1 pulse
        ctx.lineWidth = lineWidth * (1 + pulseScale * 0.5)
        ctx.lineDashOffset = -performance.now() / 50
        ctx.strokeRect(x, y, width, height)
        break
        
      case CaptureMode.RegionSelection:
        // 区域选择模式：智能参考线
        const guideColor = '#52c41a'
        ctx.strokeStyle = guideColor
        ctx.lineWidth = lineWidth
        
        // 主边框
        ctx.setLineDash([6 * scale, 3 * scale])
        ctx.strokeRect(x, y, width, height)
        
        // 智能参考线
        ctx.beginPath()
        ctx.setLineDash([4 * scale, 4 * scale])
        ctx.strokeStyle = `${guideColor}88`
        ctx.lineWidth = lineWidth / 2
        
        // 中心十字线
        ctx.moveTo(0, y + height / 2)
        ctx.lineTo(ctx.canvas.width, y + height / 2)
        ctx.moveTo(x + width / 2, 0)
        ctx.lineTo(x + width / 2, ctx.canvas.height)
        
        // 三分线
        for (let i = 1; i < 3; i++) {
          ctx.moveTo(x + (width * i) / 3, y)
          ctx.lineTo(x + (width * i) / 3, y + height)
          ctx.moveTo(x, y + (height * i) / 3)
          ctx.lineTo(x + width, y + (height * i) / 3)
        }
        ctx.stroke()
        break
        
      case CaptureMode.Magnifier:
        // 放大镜模式：镜头效果
        const lensGradient = ctx.createRadialGradient(
          x + width / 2,
          y + height / 2,
          Math.min(width, height) / 4,
          x + width / 2,
          y + height / 2,
          Math.min(width, height) / 2
        )
        lensGradient.addColorStop(0, '#722ed188')
        lensGradient.addColorStop(1, '#722ed1')
        ctx.strokeStyle = lensGradient
        ctx.lineWidth = lineWidth * 1.5
        ctx.strokeRect(x, y, width, height)
        
        // 添加镜头反光效果
        ctx.beginPath()
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
        ctx.lineWidth = lineWidth / 2
        const angle = Math.PI / 4
        ctx.arc(x + width / 2, y + height / 2, Math.min(width, height) / 3, angle, angle + Math.PI / 2)
        ctx.stroke()
        break
        
      case CaptureMode.ColorPicker:
        // 颜色选择器模式：彩虹渐变效果
        const rainbowGradient = ctx.createLinearGradient(x, y, x + width, y)
        rainbowGradient.addColorStop(0, '#ff4d4f')
        rainbowGradient.addColorStop(0.2, '#faad14')
        rainbowGradient.addColorStop(0.4, '#52c41a')
        rainbowGradient.addColorStop(0.6, '#1890ff')
        rainbowGradient.addColorStop(0.8, '#722ed1')
        rainbowGradient.addColorStop(1, '#eb2f96')
        ctx.strokeStyle = rainbowGradient
        ctx.lineWidth = lineWidth
        ctx.strokeRect(x, y, width, height)
        break
    }

    // 绘制高级角点装饰
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

      switch (mode) {
        case CaptureMode.Screenshot: {
          const style = this._cornerStyles.screenshot
          const gradient = this._createCornerGradient(ctx, cornerSize, style.colors)
          this._setShadowEffect(ctx, style.shadowColor, scale)
          this._drawBaseCorner(ctx, cornerSize, scale, { strokeStyle: gradient })
          this._drawCenterDot(ctx, scale, style.centerDotColor)
          break
        }

        case CaptureMode.ScreenRecording: {
          const style = this._cornerStyles.recording
          const pulseScale = (Math.sin(performance.now() / 500) + 1) / 2
          this._setShadowEffect(
            ctx,
            style.shadowColor,
            scale,
            4 * (1 + pulseScale * 0.5)
          )
          this._drawBaseCorner(ctx, cornerSize, scale, {
            strokeStyle: style.colors[0],
            lineWidth: 2 * scale * (1 + pulseScale * 0.3)
          })
          this._drawCenterDot(
            ctx,
            scale,
            style.centerDotColor,
            4,
            undefined,
            0.6 + pulseScale * 0.4
          )
          break
        }

        case CaptureMode.RegionSelection: {
          const style = this._cornerStyles.region
          this._setShadowEffect(ctx, style.shadowColor, scale)
          
          // 绘制手柄形状
          ctx.beginPath()
          ctx.moveTo(-cornerSize / 2, 0)
          ctx.lineTo(-cornerSize / 4, 0)
          ctx.moveTo(0, -cornerSize / 2)
          ctx.lineTo(0, -cornerSize / 4)
          ctx.strokeStyle = style.colors[0]
          ctx.lineWidth = 3 * scale
          ctx.stroke()
          
          this._drawCenterDot(ctx, scale, style.centerDotColor)
          break
        }

        case CaptureMode.Magnifier: {
          const style = this._cornerStyles.magnifier
          this._setShadowEffect(ctx, style.shadowColor, scale)
          
          // 绘制镜头光圈形状
          ctx.beginPath()
          const radius = cornerSize / 3
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4
            const startX = Math.cos(angle) * radius
            const startY = Math.sin(angle) * radius
            ctx.moveTo(0, 0)
            ctx.lineTo(startX, startY)
          }
          ctx.strokeStyle = style.colors[0]
          ctx.lineWidth = 1.5 * scale
          ctx.stroke()
          
          this._drawCenterDot(ctx, scale, style.centerDotColor, 2)
          break
        }

        case CaptureMode.ColorPicker: {
          const style = this._cornerStyles.colorPicker
          const gradient = this._createCornerGradient(ctx, cornerSize, style.colors, true)
          this._setShadowEffect(ctx, style.shadowColor, scale)
          this._drawBaseCorner(ctx, cornerSize, scale, { strokeStyle: gradient })
          this._drawCenterDot(ctx, scale, style.centerDotColor, 3, gradient)
          break
        }
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

      // 根据不同模式处理选区内容
      switch (mode) {
        case CaptureMode.ScreenRecording:
          // 录屏模式：直接清除遮罩，显示实时内容
          ctx.clearRect(
            physicalBounds.x,
            physicalBounds.y,
            physicalBounds.width,
            physicalBounds.height
          )
          break

        case CaptureMode.Magnifier:
          // 放大镜模式：放大选区内容
          ctx.save()
          ctx.clearRect(
            physicalBounds.x,
            physicalBounds.y,
            physicalBounds.width,
            physicalBounds.height
          )
          
          // 创建放大效果
          const zoomFactor = 2
          ctx.drawImage(
            backgroundImage,
            physicalBounds.x / scale,
            physicalBounds.y / scale,
            physicalBounds.width / (scale * zoomFactor),
            physicalBounds.height / (scale * zoomFactor),
            physicalBounds.x,
            physicalBounds.y,
            physicalBounds.width,
            physicalBounds.height
          )
          ctx.restore()
          break

        case CaptureMode.ColorPicker:
          // 颜色选择器模式：显示颜色信息
          ctx.clearRect(
            physicalBounds.x,
            physicalBounds.y,
            physicalBounds.width,
            physicalBounds.height
          )
          // 在这里可以添加颜色信息的显示
          break

        default:
          // 截图模式：直接从原始背景图绘制高清内容
          ctx.save()
          ctx.clearRect(
            physicalBounds.x,
            physicalBounds.y,
            physicalBounds.width,
            physicalBounds.height
          )
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
          break
      }

      // 绘制选区边框和装饰
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
  }
} 