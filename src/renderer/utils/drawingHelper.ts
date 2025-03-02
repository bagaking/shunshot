import { DrawElementUnion, ToolType } from '../../types/capture'
import { Point, coordinates } from '../../common/2d'

/**
 * Drawing helper utility for rendering drawing elements
 * This module handles the rendering of different types of drawing elements
 * such as pencil lines, mosaic effects, and text
 */
export const drawingHelper = {
  /**
   * Transform a point from canvas space to device space
   * This is crucial for correct positioning of drawing elements
   */
  transformPoint(point: Point, scaleFactor: number): Point {
    return {
      x: point.x * scaleFactor,
      y: point.y * scaleFactor
    }
  },

  /**
   * Transform all points in an element from canvas space to device space
   */
  transformElementPoints(element: DrawElementUnion, scaleFactor: number): DrawElementUnion {
    const transformedPoints = element.points.map(point => this.transformPoint(point, scaleFactor))
    return {
      ...element,
      points: transformedPoints
    }
  },

  /**
   * Draw a pencil element on the canvas
   */
  drawPencilElement(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    scaleFactor: number
  ) {
    if (element.type !== ToolType.Pencil || element.points.length < 2) return

    // Transform points to device space
    const transformedElement = this.transformElementPoints(element, scaleFactor)
    const points = transformedElement.points

    ctx.save()
    ctx.beginPath()
    ctx.strokeStyle = element.color || '#FF0000'
    ctx.lineWidth = (element.lineWidth || 3) * scaleFactor
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    
    // Set opacity
    ctx.globalAlpha = element.opacity || 1

    // Draw path
    ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y)
    }
    ctx.stroke()
    ctx.restore()
  },

  /**
   * Apply mosaic effect to a specific area
   */
  applyMosaicEffect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    blockSize: number,
    initialCanvasState: ImageData
  ) {
    // Calculate block's top-left coordinates
    const blockX = Math.floor(x / blockSize) * blockSize
    const blockY = Math.floor(y / blockSize) * blockSize
    
    // Get color from the center of the block
    const centerX = Math.min(blockX + blockSize / 2, initialCanvasState.width - 1)
    const centerY = Math.min(blockY + blockSize / 2, initialCanvasState.height - 1)
    
    const index = (Math.floor(centerY) * initialCanvasState.width + Math.floor(centerX)) * 4
    const r = initialCanvasState.data[index]
    const g = initialCanvasState.data[index + 1]
    const b = initialCanvasState.data[index + 2]
    
    // Fill the block with that color
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
    ctx.fillRect(blockX, blockY, blockSize, blockSize)
  },

  /**
   * Draw a mosaic element on the canvas
   */
  drawMosaicElement(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    canvas: HTMLCanvasElement,
    initialCanvasState: ImageData | null,
    scaleFactor: number
  ) {
    if (element.type !== ToolType.Mosaic || element.points.length < 2 || !initialCanvasState) return

    // Transform points to device space
    const transformedElement = this.transformElementPoints(element, scaleFactor)
    const points = transformedElement.points
    const blockSize = (element.blockSize || 10) * scaleFactor
    
    ctx.save()
    // Set opacity
    ctx.globalAlpha = element.opacity || 1

    // Apply mosaic effect along the path
    for (let i = 1; i < points.length; i++) {
      const startPoint = points[i - 1]
      const endPoint = points[i]
      
      // Calculate distance and angle between points
      const dx = endPoint.x - startPoint.x
      const dy = endPoint.y - startPoint.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      
      // Distribute points evenly along the path
      const steps = Math.max(1, Math.floor(distance / (blockSize / 2)))
      
      for (let j = 0; j < steps; j++) {
        const t = j / steps
        const x = startPoint.x + dx * t
        const y = startPoint.y + dy * t
        
        // Apply mosaic effect
        this.applyMosaicEffect(ctx, x, y, blockSize, initialCanvasState)
      }
    }
    
    ctx.restore()
  },

  /**
   * Draw a text element on the canvas
   */
  drawTextElement(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    scaleFactor: number
  ) {
    if (element.type !== ToolType.Text || element.points.length === 0) return
    
    // Transform point to device space
    const transformedElement = this.transformElementPoints(element, scaleFactor)
    const position = transformedElement.points[0]
    
    ctx.save()
    ctx.font = `${(element.fontSize || 16) * scaleFactor}px ${element.fontFamily || 'Arial'}`
    ctx.fillStyle = element.color || '#FF0000'
    ctx.globalAlpha = element.opacity || 1
    
    // 添加文本阴影以提高可读性
    ctx.shadowColor = 'rgba(255, 255, 255, 0.8)'
    ctx.shadowBlur = 2 * scaleFactor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // Draw text
    if (element.text) {
      // 先绘制白色轮廓增强可见度
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 3 * scaleFactor
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(element.text, position.x, position.y)
      
      // 再绘制文本内容
      ctx.fillText(element.text, position.x, position.y)
    } else {
      // If no text, draw a cursor placeholder
      ctx.fillText('|', position.x, position.y)
    }
    
    ctx.restore()
  },

  /**
   * Calculate best label position to ensure it stays within bounds
   */
  calculateBestLabelPosition(
    labelWidth: number,
    labelHeight: number,
    preferredX: number,
    preferredY: number,
    bounds: {
      x: number,
      y: number,
      width: number,
      height: number
    },
    offset: number
  ): { x: number, y: number } {
    // Try positions in order of preference:
    // 1. Right of element
    // 2. Left of element
    // 3. Above element
    // 4. Below element
    // 5. Inside element (top-right)
    
    const positions = [
      // Right
      {
        x: preferredX,
        y: preferredY,
        valid: (preferredX + labelWidth) <= (bounds.x + bounds.width)
      },
      // Left
      {
        x: preferredX - labelWidth - offset * 2,
        y: preferredY,
        valid: (preferredX - labelWidth - offset * 2) >= bounds.x
      },
      // Above
      {
        x: Math.min(preferredX, bounds.x + bounds.width - labelWidth - offset),
        y: bounds.y - labelHeight - offset,
        valid: (bounds.y - labelHeight - offset) >= bounds.y
      },
      // Below
      {
        x: Math.min(preferredX, bounds.x + bounds.width - labelWidth - offset),
        y: bounds.y + bounds.height + offset,
        valid: (bounds.y + bounds.height + labelHeight + offset) <= (bounds.y + bounds.height)
      },
      // Inside top-right
      {
        x: bounds.x + bounds.width - labelWidth - offset,
        y: bounds.y + offset,
        valid: true // Always valid as fallback
      }
    ]

    // Return first valid position
    const position = positions.find(pos => pos.valid) || positions[positions.length - 1]
    return {
      x: position.x,
      y: position.y
    }
  },

  /**
   * Draw sequence label with beautiful styling
   */
  drawSequenceLabel(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
    scaleFactor: number,
    bounds: {
      x: number,
      y: number,
      width: number,
      height: number
    }
  ) {
    const fontSize = 10 * scaleFactor // 更小的字号
    const padding = 4 * scaleFactor // 更小的内边距
    const cornerRadius = 3 * scaleFactor // 更小的圆角

    ctx.save()
    
    // 测量文本宽度
    ctx.font = `300 ${fontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif` // 更细的字重
    const textMetrics = ctx.measureText(text)
    const textWidth = textMetrics.width
    const textHeight = fontSize
    
    // 计算标签尺寸
    const bgWidth = textWidth + padding * 2
    const bgHeight = textHeight + padding * 1.2

    // 获取最佳位置
    const bestPosition = this.calculateBestLabelPosition(
      bgWidth,
      bgHeight,
      x,
      y,
      bounds,
      padding
    )

    // 绘制标签背景
    ctx.beginPath()
    const bgX = bestPosition.x
    const bgY = bestPosition.y
    
    // 绘制圆角矩形背景
    ctx.beginPath()
    ctx.moveTo(bgX + cornerRadius, bgY)
    ctx.lineTo(bgX + bgWidth - cornerRadius, bgY)
    ctx.arcTo(bgX + bgWidth, bgY, bgX + bgWidth, bgY + cornerRadius, cornerRadius)
    ctx.lineTo(bgX + bgWidth, bgY + bgHeight - cornerRadius)
    ctx.arcTo(bgX + bgWidth, bgY + bgHeight, bgX + bgWidth - cornerRadius, bgY + bgHeight, cornerRadius)
    ctx.lineTo(bgX + cornerRadius, bgY + bgHeight)
    ctx.arcTo(bgX, bgY + bgHeight, bgX, bgY + bgHeight - cornerRadius, cornerRadius)
    ctx.lineTo(bgX, bgY + cornerRadius)
    ctx.arcTo(bgX, bgY, bgX + cornerRadius, bgY, cornerRadius)
    ctx.closePath()

    // 绘制玻璃效果
    ctx.shadowColor = 'rgba(0, 0, 0, 0.08)'
    ctx.shadowBlur = 2 * scaleFactor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 1 * scaleFactor
    
    // 半透明背景
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.fill()

    // 绘制文本
    ctx.shadowColor = 'transparent'
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, bgX + padding, bgY + bgHeight/2)

    ctx.restore()
  },

  /**
   * Calculate label position for rectangle
   */
  calculateRectLabelPosition(
    x: number,
    y: number,
    width: number,
    height: number,
    scaleFactor: number
  ): { x: number, y: number } {
    const offset = 4 * scaleFactor
    return {
      x: x + width + offset, // 放在右侧
      y: y - offset // 稍微往上偏移
    }
  },

  /**
   * Calculate label position for ellipse
   */
  calculateEllipseLabelPosition(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    scaleFactor: number
  ): { x: number, y: number } {
    const angle = Math.PI / 4 // 45度角
    const offset = 4 * scaleFactor
    
    // 在椭圆边缘45度角的位置
    const x = centerX + (radiusX * Math.cos(angle))
    const y = centerY - (radiusY * Math.sin(angle))
    
    return {
      x: x + offset,
      y: y - offset
    }
  },

  /**
   * Draw a rectangle element on the canvas
   */
  drawRectangleElement(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    scaleFactor: number,
    clipBounds?: { x: number, y: number, width: number, height: number }
  ) {
    if (element.type !== ToolType.Rectangle || element.points.length < 2) return

    const transformedElement = this.transformElementPoints(element, scaleFactor)
    const [start, end] = transformedElement.points
    
    // Calculate rectangle's position and size
    const x = Math.min(start.x, end.x)
    const y = Math.min(start.y, end.y)
    const width = Math.abs(end.x - start.x)
    const height = Math.abs(end.y - start.y)
    
    ctx.save()
    
    // 绘制阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = 4 * scaleFactor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2 * scaleFactor

    // 创建边框渐变
    const gradient = ctx.createLinearGradient(x, y, x + width, y + height)
    const baseColor = element.strokeStyle || '#1a73e8'
    gradient.addColorStop(0, baseColor)
    gradient.addColorStop(0.5, this.adjustColor(baseColor, 20))
    gradient.addColorStop(1, baseColor)
    
    // Set styles
    ctx.strokeStyle = gradient
    ctx.lineWidth = (element.strokeWidth || 2) * scaleFactor
    ctx.fillStyle = element.fillStyle || 'rgba(26, 115, 232, 0.1)'
    ctx.globalAlpha = element.opacity || 1
    
    // Set dash style with more elegant pattern
    if (element.dashArray) {
      ctx.setLineDash(element.dashArray.map(x => x * scaleFactor))
      ctx.lineDashOffset = -performance.now() / 50
    }
    
    // Draw rounded rectangle
    const radius = (element.cornerRadius || 4) * scaleFactor
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + width - radius, y)
    ctx.arcTo(x + width, y, x + width, y + radius, radius)
    ctx.lineTo(x + width, y + height - radius)
    ctx.arcTo(x + width, y + height, x + width - radius, y + height, radius)
    ctx.lineTo(x + radius, y + height)
    ctx.arcTo(x, y + height, x, y + height - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()
    
    // Fill and stroke
    ctx.fill()
    ctx.stroke()

    // Draw sequence number if exists
    if (element.sequence) {
      const labelPos = this.calculateRectLabelPosition(x, y, width, height, scaleFactor)
      this.drawSequenceLabel(
        ctx,
        `#${element.sequence}`,
        labelPos.x,
        labelPos.y,
        element.strokeStyle || '#1a73e8',
        scaleFactor,
        clipBounds || { x, y, width, height }
      )
    }
    
    ctx.restore()
  },

  /**
   * Draw an ellipse element on the canvas
   */
  drawEllipseElement(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    scaleFactor: number,
    clipBounds?: { x: number, y: number, width: number, height: number }
  ) {
    if (element.type !== ToolType.Ellipse || element.points.length < 2) return

    const transformedElement = this.transformElementPoints(element, scaleFactor)
    const [start, end] = transformedElement.points
    
    // Calculate ellipse's center and radii
    const centerX = (start.x + end.x) / 2
    const centerY = (start.y + end.y) / 2
    const radiusX = Math.abs(end.x - start.x) / 2
    const radiusY = Math.abs(end.y - start.y) / 2
    
    ctx.save()
    
    // 绘制阴影
    ctx.shadowColor = 'rgba(0, 0, 0, 0.1)'
    ctx.shadowBlur = 4 * scaleFactor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 2 * scaleFactor

    // 创建径向渐变
    const gradient = ctx.createRadialGradient(
      centerX, centerY, 0,
      centerX, centerY, Math.max(radiusX, radiusY)
    )
    const baseColor = element.strokeStyle || '#1a73e8'
    gradient.addColorStop(0.7, baseColor)
    gradient.addColorStop(0.85, this.adjustColor(baseColor, 20))
    gradient.addColorStop(1, baseColor)
    
    // Set styles
    ctx.strokeStyle = gradient
    ctx.lineWidth = (element.strokeWidth || 2) * scaleFactor
    ctx.fillStyle = element.fillStyle || 'rgba(26, 115, 232, 0.1)'
    ctx.globalAlpha = element.opacity || 1
    
    // Set dash style with more elegant pattern
    if (element.dashArray) {
      ctx.setLineDash(element.dashArray.map(x => x * scaleFactor))
      ctx.lineDashOffset = -performance.now() / 50
    }
    
    // Draw ellipse
    ctx.beginPath()
    ctx.ellipse(
      centerX,
      centerY,
      radiusX,
      radiusY,
      0,
      0,
      Math.PI * 2
    )
    ctx.closePath()
    
    // Fill and stroke
    ctx.fill()
    ctx.stroke()

    // Draw sequence number if exists
    if (element.sequence) {
      const labelPos = this.calculateEllipseLabelPosition(
        centerX,
        centerY,
        radiusX,
        radiusY,
        scaleFactor
      )
      this.drawSequenceLabel(
        ctx,
        `#${element.sequence}`,
        labelPos.x,
        labelPos.y,
        element.strokeStyle || '#1a73e8',
        scaleFactor,
        clipBounds || {
          x: centerX - radiusX,
          y: centerY - radiusY,
          width: radiusX * 2,
          height: radiusY * 2
        }
      )
    }
    
    ctx.restore()
  },

  /**
   * Adjust color brightness
   * @param color - The base color in hex format
   * @param percent - The percentage to adjust (-100 to 100)
   */
  adjustColor(color: string, percent: number): string {
    const num = parseInt(color.replace('#', ''), 16)
    const r = (num >> 16) + percent
    const g = ((num >> 8) & 0x00FF) + percent
    const b = (num & 0x0000FF) + percent
    
    return '#' + (
      0x1000000 +
      (r < 255 ? (r < 1 ? 0 : r) : 255) * 0x10000 +
      (g < 255 ? (g < 1 ? 0 : g) : 255) * 0x100 +
      (b < 255 ? (b < 1 ? 0 : b) : 255)
    ).toString(16).slice(1)
  },

  /**
   * Draw all drawing elements on the canvas
   */
  drawElements(
    ctx: CanvasRenderingContext2D,
    elements: DrawElementUnion[],
    currentElement: DrawElementUnion | null,
    canvas: HTMLCanvasElement,
    initialCanvasState: ImageData | null,
    scaleFactor: number
  ) {
    // Draw completed elements
    if (elements && elements.length > 0) {
      elements.forEach(element => {
        switch (element.type) {
          case ToolType.Pencil:
            this.drawPencilElement(ctx, element, scaleFactor)
            break
          case ToolType.Mosaic:
            if (initialCanvasState) {
              this.drawMosaicElement(ctx, element, canvas, initialCanvasState, scaleFactor)
            }
            break
          case ToolType.Text:
            this.drawTextElement(ctx, element, scaleFactor)
            break
          case ToolType.Rectangle:
            this.drawRectangleElement(ctx, element, scaleFactor)
            break
          case ToolType.Ellipse:
            this.drawEllipseElement(ctx, element, scaleFactor)
            break
        }
      })
    }
    
    // Draw current element being drawn
    if (currentElement) {
      switch (currentElement.type) {
        case ToolType.Pencil:
          this.drawPencilElement(ctx, currentElement, scaleFactor)
          break
        case ToolType.Mosaic:
          if (initialCanvasState) {
            this.drawMosaicElement(ctx, currentElement, canvas, initialCanvasState, scaleFactor)
          }
          break
        case ToolType.Text:
          this.drawTextElement(ctx, currentElement, scaleFactor)
          break
        case ToolType.Rectangle:
          this.drawRectangleElement(ctx, currentElement, scaleFactor)
          break
        case ToolType.Ellipse:
          this.drawEllipseElement(ctx, currentElement, scaleFactor)
          break
      }
    }
  }
} 