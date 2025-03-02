import { useState, useCallback, useEffect, useRef } from 'react'
import { DrawElementUnion, ToolType, TextElement } from '../../types/capture'
import { Point, Bounds, DisplayInfo } from '../../common/2d'
import { v4 as uuidv4 } from 'uuid'
import { translog } from '../utils/translog'
import { performanceHelper } from '../utils/performanceHelper'

// 定义一组优雅的配色方案
const COLOR_SCHEMES = [
  {
    strokeStyle: '#805ad5', // 紫色
    fillStyle: 'rgba(128, 90, 213, 0.1)'
  },
  {
    strokeStyle: '#38a169', // 绿色
    fillStyle: 'rgba(56, 161, 105, 0.1)'
  },
  {
    strokeStyle: '#3182ce', // 蓝色
    fillStyle: 'rgba(49, 130, 206, 0.1)'
  },
  {
    strokeStyle: '#dd6b20', // 橙色
    fillStyle: 'rgba(221, 107, 32, 0.1)'
  },
  {
    strokeStyle: '#d53f8c', // 粉色
    fillStyle: 'rgba(213, 63, 140, 0.1)'
  }
]

/**
 * Hook for managing drawing state and operations
 */
export const useDrawing = (selectedBounds?: Bounds | null, displayInfo?: DisplayInfo | null) => {
  // Drawing state
  const [activeTool, setActiveTool] = useState<ToolType>(ToolType.None)
  const [drawElements, setDrawElements] = useState<DrawElementUnion[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentElement, setCurrentElement] = useState<DrawElementUnion | null>(null)
  const [drawColor, setDrawColor] = useState<string>('#e53e3e') // 更新为偏红色调，与工具栏保持一致
  const [lineWidth, setLineWidth] = useState<number>(2) // 更细的线条
  const [mosaicSize, setMosaicSize] = useState<number>(10) // Default mosaic size
  const [colorIndex, setColorIndex] = useState(0) // 当前颜色索引
  
  // 文本编辑状态
  const [editingText, setEditingText] = useState<boolean>(false)
  const [textInputValue, setTextInputValue] = useState<string>('')
  const textInputRef = useRef<HTMLInputElement | null>(null)

  // 基础图形样式
  const baseShapeStyle = {
    strokeWidth: 2,
    cornerRadius: 4,
    dashArray: [6, 4] as number[] | undefined // 虚线样式
  }

  // 保存操作的状态追踪
  const saveInProgressRef = useRef(false)
  const pendingSaveRef = useRef(false)

  // 获取下一个颜色方案
  const getNextColorScheme = useCallback(() => {
    const scheme = COLOR_SCHEMES[colorIndex]
    setColorIndex((colorIndex + 1) % COLOR_SCHEMES.length)
    return scheme
  }, [colorIndex])

  /**
   * 保存带有标注的图像到主进程
   */
  const saveAnnotatedImage = useCallback(async () => {
    if (!selectedBounds || drawElements.length === 0) return
    
    // 如果已经有保存操作在进行中，标记为需要再次保存并返回
    if (saveInProgressRef.current) {
      pendingSaveRef.current = true
      return
    }
    
    saveInProgressRef.current = true

    try {
      // 获取原始 canvas
      const canvasRef = document.querySelector('canvas')
      if (!canvasRef) {
        throw new Error('Canvas element not found')
      }

      // 创建临时 canvas 来渲染带有标注的图像
      const tempCanvas = document.createElement('canvas')
      const scaleFactor = displayInfo?.scaleFactor || window.devicePixelRatio || 1
      
      // 从 Bounds 获取设备空间坐标
      const deviceSpaceBounds = {
        x: selectedBounds.x * scaleFactor,
        y: selectedBounds.y * scaleFactor,
        width: selectedBounds.width * scaleFactor,
        height: selectedBounds.height * scaleFactor
      }
      
      // 设置临时 canvas 尺寸
      tempCanvas.width = deviceSpaceBounds.width
      tempCanvas.height = deviceSpaceBounds.height
      
      const tempCtx = tempCanvas.getContext('2d')
      if (!tempCtx) {
        throw new Error('Failed to get temp canvas context')
      }
      
      const ctx = canvasRef.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to get canvas context')
      }
      
      // 从原始 canvas 裁剪选区部分
      const imageData = ctx.getImageData(
        deviceSpaceBounds.x,
        deviceSpaceBounds.y,
        deviceSpaceBounds.width,
        deviceSpaceBounds.height
      )
      
      // 将裁剪的图像数据绘制到临时 canvas
      tempCtx.putImageData(imageData, 0, 0)
      
      // 调整坐标系，因为临时 canvas 的原点是选区的左上角
      tempCtx.save()
      tempCtx.translate(-deviceSpaceBounds.x, -deviceSpaceBounds.y)
      
      // 获取原始 canvas 的初始状态
      const canvasInitialState = document.createElement('canvas')
      canvasInitialState.width = canvasRef.width
      canvasInitialState.height = canvasRef.height
      const initialCtx = canvasInitialState.getContext('2d')
      
      if (initialCtx) {
        initialCtx.drawImage(canvasRef, 0, 0)
        
        // 使用 drawingHelper 绘制元素
        const drawingHelper = await import('../utils/drawingHelper').then(m => m.drawingHelper)
        drawingHelper.drawElements(
          tempCtx,
          drawElements,
          currentElement,
          tempCanvas,
          imageData,
          scaleFactor
        )
      }
      
      tempCtx.restore()
      
      // 将临时 canvas 转换为 data URL
      const dataUrl = tempCanvas.toDataURL('image/png')
      
      // 发送带有标注的图像到主进程
      await window.shunshotCoreAPI.saveAnnotatedImage(dataUrl, selectedBounds)
      
      translog.debug('Annotated image saved to main process', {
        hasDrawElements: drawElements.length > 0,
        bounds: selectedBounds
      })
    } catch (error) {
      translog.error('Failed to save annotated image:', error)
    } finally {
      saveInProgressRef.current = false
      
      // 如果在保存过程中有新的保存请求，则再次执行保存
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false
        setTimeout(() => saveAnnotatedImage(), 0)
      }
    }
  }, [drawElements, currentElement, selectedBounds, displayInfo])

  // 创建一个防抖版本的保存函数
  const debouncedSaveAnnotatedImage = useCallback(
    performanceHelper.debounce(() => {
      saveAnnotatedImage()
    }, 300), // 300ms 的防抖延迟
    [saveAnnotatedImage]
  )

  // 当绘图元素变化时，保存标注图像
  useEffect(() => {
    if (drawElements.length > 0 && selectedBounds) {
      debouncedSaveAnnotatedImage()
    }
  }, [drawElements, debouncedSaveAnnotatedImage, selectedBounds])

  /**
   * Handle tool change
   */
  const handleToolChange = useCallback((tool: ToolType) => {
    translog.debug('Tool changed', { tool })
    setActiveTool(tool)
    // If changing tools, end current drawing
    if (isDrawing) {
      setIsDrawing(false)
      if (currentElement) {
        setDrawElements(prev => [...prev, currentElement])
        setCurrentElement(null)
      }
    }
  }, [isDrawing, currentElement])

  /**
   * Create a new drawing element
   */
  const createDrawElement = useCallback((point: Point): DrawElementUnion | null => {
    if (!activeTool || activeTool === ToolType.None) {
      return null
    }

    const baseElement = {
      id: uuidv4(),
      points: [point],
      opacity: 1
    }

    switch (activeTool) {
      case ToolType.Pencil:
        return {
          ...baseElement,
          type: ToolType.Pencil,
          color: drawColor,
          lineWidth
        }
      case ToolType.Mosaic:
        return {
          ...baseElement,
          type: ToolType.Mosaic,
          blockSize: mosaicSize
        }
      case ToolType.Text:
        return {
          ...baseElement,
          type: ToolType.Text,
          text: '',
          fontSize: 16,
          fontFamily: 'Arial',
          color: drawColor
        }
      case ToolType.Rectangle:
      case ToolType.Ellipse: {
        const colorScheme = getNextColorScheme()
        const sequence = drawElements.filter(el => 
          el.type === ToolType.Rectangle || el.type === ToolType.Ellipse
        ).length + 1

        return {
          ...baseElement,
          type: activeTool,
          ...baseShapeStyle,
          ...colorScheme,
          sequence
        }
      }
      default:
        return null
    }
  }, [activeTool, drawColor, lineWidth, mosaicSize, drawElements, getNextColorScheme])

  /**
   * Update the current drawing element
   */
  const updateCurrentElement = useCallback((point: Point) => {
    if (!currentElement || !isDrawing) return

    // 如果是文本元素，不需要更新点，只需要移动位置
    if (currentElement.type === ToolType.Text) {
      setCurrentElement(prev => {
        if (!prev) return null
        return {
          ...prev,
          points: [point] // 文本元素只需要一个点表示位置
        }
      })
      return
    }

    setCurrentElement(prev => {
      if (!prev) return null

      // 对于图形元素，我们只需要更新终点
      if (prev.type === ToolType.Rectangle || prev.type === ToolType.Ellipse) {
        return {
          ...prev,
          points: [prev.points[0], point] // 保持起点不变，更新终点
        }
      }

      // 对于其他元素，添加新的点
      return {
        ...prev,
        points: [...prev.points, point]
      }
    })
    
    // 如果有当前绘制的元素，也保存标注图像（使用防抖版本）
    if (selectedBounds && currentElement) {
      debouncedSaveAnnotatedImage()
    }
  }, [currentElement, isDrawing, debouncedSaveAnnotatedImage, selectedBounds])

  /**
   * Finish the current drawing
   */
  const finishDrawing = useCallback(() => {
    if (!currentElement) return

    // 如果是文本元素，开始编辑文本
    if (currentElement.type === ToolType.Text) {
      setEditingText(true)
      setTextInputValue('')
      
      // 在下一个渲染周期后聚焦文本输入框
      setTimeout(() => {
        if (textInputRef.current) {
          textInputRef.current.focus()
        }
      }, 0)
      
      return
    }

    setDrawElements(prev => [...prev, currentElement])
    setCurrentElement(null)
    setIsDrawing(false)
  }, [currentElement])

  /**
   * Handle text input change
   */
  const handleTextInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInputValue(e.target.value)
    
    // 同时更新当前元素的文本
    if (currentElement && currentElement.type === ToolType.Text) {
      setCurrentElement(prev => {
        if (!prev || prev.type !== ToolType.Text) return prev
        return {
          ...prev,
          text: e.target.value,
          color: drawColor // 确保使用当前选择的颜色
        } as TextElement
      })
    }
  }, [currentElement, drawColor])

  /**
   * Complete text editing
   */
  const completeTextEditing = useCallback(() => {
    if (!currentElement || currentElement.type !== ToolType.Text) return
    
    // 如果文本为空，不添加元素
    if (!textInputValue.trim()) {
      setCurrentElement(null)
      setEditingText(false)
      setIsDrawing(false)
      return
    }
    
    // 添加完成的文本元素
    const finalTextElement: TextElement = {
      ...currentElement,
      text: textInputValue
    }
    
    setDrawElements(prev => [...prev, finalTextElement])
    setCurrentElement(null)
    setEditingText(false)
    setIsDrawing(false)
    setTextInputValue('')
    
    // 保存带有文本的图像
    if (selectedBounds) {
      debouncedSaveAnnotatedImage()
    }
  }, [currentElement, textInputValue, selectedBounds, debouncedSaveAnnotatedImage])

  /**
   * Cancel text editing
   */
  const cancelTextEditing = useCallback(() => {
    setCurrentElement(null)
    setEditingText(false)
    setIsDrawing(false)
    setTextInputValue('')
  }, [])

  /**
   * Start drawing at a point
   */
  const startDrawing = useCallback((point: Point) => {
    // 如果正在编辑文本，先完成文本编辑
    if (editingText) {
      completeTextEditing()
      return
    }
    
    const newElement = createDrawElement(point)
    if (newElement) {
      setCurrentElement(newElement)
      setIsDrawing(true)
    }
  }, [createDrawElement, editingText, completeTextEditing])

  /**
   * Reset all drawing state
   */
  const resetDrawing = useCallback(() => {
    setActiveTool(ToolType.None)
    setDrawElements([])
    setCurrentElement(null)
    setIsDrawing(false)
  }, [])

  return {
    // State
    activeTool,
    drawElements,
    currentElement,
    isDrawing,
    drawColor,
    lineWidth,
    mosaicSize,
    
    // Text editing state
    editingText,
    textInputValue,
    textInputRef,
    
    // Setters
    setDrawColor,
    setLineWidth,
    setMosaicSize,
    
    // Actions
    handleToolChange,
    startDrawing,
    updateCurrentElement,
    finishDrawing,
    resetDrawing,
    saveAnnotatedImage,
    
    // Text editing actions
    handleTextInputChange,
    completeTextEditing,
    cancelTextEditing
  }
} 