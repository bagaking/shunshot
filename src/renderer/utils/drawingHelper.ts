import { DrawElementUnion, ToolType, PenStyle } from '../../types/capture'
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
    
    // Set basic styles
    ctx.strokeStyle = element.color || '#FF0000'
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = element.opacity || 1
    
    // Apply pen style specific settings
    this.applyPenStyle(ctx, element, scaleFactor)
    
    // Use Catmull-Rom spline for smooth curve drawing
    if (points.length >= 3) {
      // For tapered strokes, we need to draw multiple paths with varying widths
      const taper = element.taper !== undefined ? element.taper : true;
      const pressureSensitivity = element.pressureSensitivity || 0.5;
      
      if (taper) {
        // Draw the stroke with tapered ends
        this.drawTaperedStroke(ctx, points, element, scaleFactor, pressureSensitivity);
      } else {
        // Start with the first point
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y)
        
        // For the first segment, use the first point as control point
        this.drawCurveSegment(ctx, points[0], points[0], points[1], points[2], element)
        
        // Draw middle segments with Catmull-Rom spline
        for (let i = 1; i < points.length - 2; i++) {
          this.drawCurveSegment(ctx, points[i-1], points[i], points[i+1], points[i+2], element)
        }
        
        // For the last segment, use the last point as control point
        const lastIdx = points.length - 1
        if (lastIdx >= 2) {
          this.drawCurveSegment(ctx, points[lastIdx-2], points[lastIdx-1], points[lastIdx], points[lastIdx], element)
        }
        
        ctx.stroke()
      }
    } else {
      // Fallback to simple line for very short strokes
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y)
      
      // Apply pressure sensitivity if available
      if (element.pressurePoints && element.pressurePoints[1]) {
        const pressure = element.pressurePoints[1]
        const baseWidth = (element.lineWidth || 3) * scaleFactor
        ctx.lineWidth = baseWidth * (0.5 + pressure * 0.5) // Scale width based on pressure
      }
      
      ctx.lineTo(points[1].x, points[1].y)
      ctx.stroke()
    }
    
    ctx.restore()
  },

  /**
   * Draw a tapered stroke with variable width based on pressure and position
   */
  drawTaperedStroke(
    ctx: CanvasRenderingContext2D,
    points: Point[],
    element: DrawElementUnion,
    scaleFactor: number,
    pressureSensitivity: number
  ) {
    if (element.type !== ToolType.Pencil || points.length < 2) return
    
    const baseWidth = (element.lineWidth || 3) * scaleFactor;
    const penStyle = element.penStyle || PenStyle.Normal;
    const pressurePoints = element.pressurePoints || Array(points.length).fill(1);
    
    // Calculate the total length of the stroke
    let totalLength = 0;
    const segmentLengths: number[] = [];
    const cumulativeLengths: number[] = [0];
    
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i-1].x;
      const dy = points[i].y - points[i-1].y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      segmentLengths.push(segmentLength);
      totalLength += segmentLength;
      cumulativeLengths.push(totalLength);
    }
    
    // Draw the stroke with varying width
    for (let i = 0; i < points.length - 1; i++) {
      // Calculate normalized position along the stroke (0 at start, 1 at end)
      const startPos = cumulativeLengths[i] / totalLength;
      const endPos = cumulativeLengths[i + 1] / totalLength;
      
      // Calculate width based on position (tapered at ends) and pressure
      const startPressure = pressurePoints[i] || 1;
      const endPressure = pressurePoints[i + 1] || 1;
      
      // Taper factor: smaller near ends, full size in middle
      const startTaper = this.calculateTaperFactor(startPos, penStyle);
      const endTaper = this.calculateTaperFactor(endPos, penStyle);
      
      // Apply pressure sensitivity
      const startWidth = baseWidth * (0.5 + startPressure * pressureSensitivity) * startTaper;
      const endWidth = baseWidth * (0.5 + endPressure * pressureSensitivity) * endTaper;
      
      // Draw segment with varying width
      this.drawVariableWidthSegment(
        ctx, 
        points[i], 
        points[i + 1],
        startWidth,
        endWidth,
        element.color || '#FF0000'
      );
    }
  },
  
  /**
   * Calculate taper factor based on position along the stroke
   */
  calculateTaperFactor(position: number, penStyle: PenStyle): number {
    // Different pen styles have different taper profiles
    switch (penStyle) {
      case PenStyle.Brush:
        // Brush has dramatic tapering at both ends
        return Math.sin(position * Math.PI) * 0.8 + 0.2;
        
      case PenStyle.Fountain:
        // Fountain pen has asymmetric tapering (thinner at start, fuller at end)
        return 0.3 + 0.7 * (position < 0.5 
          ? position * 2 
          : 1);
          
      case PenStyle.Pencil:
        // Pencil has subtle tapering
        return 0.7 + 0.3 * Math.sin(position * Math.PI);
        
      case PenStyle.Marker:
        // Marker has minimal tapering
        return 0.9 + 0.1 * Math.sin(position * Math.PI);
        
      default:
        // Normal pen has moderate tapering at both ends
        return 0.5 + 0.5 * Math.sin(position * Math.PI);
    }
  },
  
  /**
   * Draw a segment with variable width from start to end
   */
  drawVariableWidthSegment(
    ctx: CanvasRenderingContext2D,
    start: Point,
    end: Point,
    startWidth: number,
    endWidth: number,
    color: string
  ) {
    // Calculate the angle of the line
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    
    // Calculate perpendicular angle
    const perpAngle = angle + Math.PI / 2;
    
    // Calculate the corners of the segment
    const startX1 = start.x + Math.cos(perpAngle) * startWidth / 2;
    const startY1 = start.y + Math.sin(perpAngle) * startWidth / 2;
    const startX2 = start.x - Math.cos(perpAngle) * startWidth / 2;
    const startY2 = start.y - Math.sin(perpAngle) * startWidth / 2;
    
    const endX1 = end.x + Math.cos(perpAngle) * endWidth / 2;
    const endY1 = end.y + Math.sin(perpAngle) * endWidth / 2;
    const endX2 = end.x - Math.cos(perpAngle) * endWidth / 2;
    const endY2 = end.y - Math.sin(perpAngle) * endWidth / 2;
    
    // Draw the segment as a filled shape
    ctx.beginPath();
    ctx.moveTo(startX1, startY1);
    ctx.lineTo(endX1, endY1);
    ctx.lineTo(endX2, endY2);
    ctx.lineTo(startX2, startY2);
    ctx.closePath();
    
    // Fill with the stroke color
    ctx.fillStyle = color;
    ctx.fill();
  },

  /**
   * Apply pen style specific settings
   */
  applyPenStyle(
    ctx: CanvasRenderingContext2D,
    element: DrawElementUnion,
    scaleFactor: number
  ) {
    if (element.type !== ToolType.Pencil) return
    
    const baseWidth = (element.lineWidth || 3) * scaleFactor
    const penStyle = element.penStyle || PenStyle.Normal
    
    switch (penStyle) {
      case PenStyle.Brush:
        // Brush style: variable width, soft edges
        ctx.lineWidth = baseWidth
        ctx.shadowColor = element.color || '#FF0000'
        ctx.shadowBlur = baseWidth / 2
        // Add a subtle texture effect
        ctx.globalCompositeOperation = 'source-over'
        break
        
      case PenStyle.Pencil:
        // Pencil style: grainy texture
        ctx.lineWidth = baseWidth * 0.8
        ctx.shadowColor = '#000000'
        ctx.shadowBlur = 0.5
        // Create a slightly transparent stroke for pencil effect
        const color = element.color || '#FF0000'
        ctx.strokeStyle = this.adjustColorAlpha(color, 0.9)
        // Add a subtle texture
        ctx.globalCompositeOperation = 'source-over'
        break
        
      case PenStyle.Marker:
        // Marker style: bold, slightly transparent
        ctx.lineWidth = baseWidth * 1.2
        const markerColor = element.color || '#FF0000'
        ctx.strokeStyle = this.adjustColorAlpha(markerColor, 0.7)
        // Markers blend colors
        ctx.globalCompositeOperation = 'multiply'
        break
        
      case PenStyle.Fountain:
        // Fountain pen style: variable width based on direction
        ctx.lineWidth = baseWidth
        // Fountain pens have more character in their strokes
        ctx.lineCap = 'square'
        ctx.lineJoin = 'miter'
        ctx.miterLimit = 2
        // Add a subtle ink flow effect
        ctx.shadowColor = this.adjustColorAlpha(element.color || '#FF0000', 0.3)
        ctx.shadowBlur = baseWidth * 0.3
        break
        
      default:
        // Normal pen style
        ctx.lineWidth = baseWidth
        ctx.shadowColor = this.adjustColorAlpha(element.color || '#FF0000', 0.2)
        ctx.shadowBlur = baseWidth * 0.1
        break
    }
  },

  /**
   * Adjust color with alpha
   */
  adjustColorAlpha(color: string, alpha: number): string {
    // Convert hex to rgba
    if (color.startsWith('#')) {
      const r = parseInt(color.slice(1, 3), 16)
      const g = parseInt(color.slice(3, 5), 16)
      const b = parseInt(color.slice(5, 7), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    // If already rgba, adjust alpha
    if (color.startsWith('rgba')) {
      return color.replace(/[\d\.]+\)$/, `${alpha})`)
    }
    // If rgb, convert to rgba
    if (color.startsWith('rgb')) {
      return color.replace('rgb', 'rgba').replace(')', `, ${alpha})`)
    }
    return color
  },

  /**
   * Draw a Catmull-Rom curve segment for smooth path
   * This creates a smooth curve through the points without requiring control points
   */
  drawCurveSegment(
    ctx: CanvasRenderingContext2D,
    p0: Point,
    p1: Point,
    p2: Point,
    p3: Point,
    element?: DrawElementUnion,
    tension: number = 0.5
  ) {
    // Calculate Catmull-Rom control points (centripetal Catmull-Rom)
    const t = tension;
    
    // Calculate control points
    const d1 = Math.sqrt(Math.pow(p1.x - p0.x, 2) + Math.pow(p1.y - p0.y, 2));
    const d2 = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    const d3 = Math.sqrt(Math.pow(p3.x - p2.x, 2) + Math.pow(p3.y - p2.y, 2));
    
    // Compute tension vectors
    const t1x = t * (p2.x - p0.x) / (d1 + d2);
    const t1y = t * (p2.y - p0.y) / (d1 + d2);
    const t2x = t * (p3.x - p1.x) / (d2 + d3);
    const t2y = t * (p3.y - p1.y) / (d2 + d3);
    
    // Calculate control points for bezier curve
    const c1x = p1.x + t1x;
    const c1y = p1.y + t1y;
    const c2x = p2.x - t2x;
    const c2y = p2.y - t2y;
    
    // Apply pressure sensitivity if available
    if (element?.type === ToolType.Pencil && element.pressureSensitivity && element.pressurePoints) {
      const idx = element.points.findIndex(pt => pt.x === p1.x && pt.y === p1.y)
      if (idx >= 0 && idx < element.pressurePoints.length) {
        const pressure = element.pressurePoints[idx]
        const baseWidth = (element.lineWidth || 3) * (ctx.canvas.width / 1000) // Scale based on canvas size
        ctx.lineWidth = baseWidth * (0.5 + pressure * 0.5) // Scale width based on pressure
      }
    }
    
    // Draw the curve segment
    ctx.bezierCurveTo(c1x, c1y, c2x, c2y, p2.x, p2.y);
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
    const fontSize = (element.fontSize || 16) * scaleFactor
    
    ctx.save()
    ctx.font = `${fontSize}px ${element.fontFamily || 'Arial'}`
    ctx.fillStyle = element.color || '#FF0000'
    ctx.globalAlpha = element.opacity || 1
    
    // 增强文本阴影以提高可读性
    ctx.shadowColor = 'rgba(255, 255, 255, 0.9)'
    ctx.shadowBlur = 3 * scaleFactor
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
    
    // 计算文本基线位置，确保与输入框位置一致
    const textY = position.y + (fontSize * 0.7);
    
    // Draw text
    if (element.text) {
      // 先绘制白色轮廓增强可见度
      ctx.strokeStyle = 'white'
      ctx.lineWidth = 3 * scaleFactor
      ctx.lineJoin = 'round'
      ctx.miterLimit = 2
      ctx.strokeText(element.text, position.x, textY)
      
      // 再绘制文本内容
      ctx.fillText(element.text, position.x, textY)
    } else {
      // If no text, draw a cursor placeholder
      const cursorChar = '|'
      ctx.fillText(cursorChar, position.x, textY)
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