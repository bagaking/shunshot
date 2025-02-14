import { DisplayInfo } from '../types/capture'
import { translog } from './translog'

interface CanvasConfig {
  alpha?: boolean
  desynchronized?: boolean
  willReadFrequently?: boolean
}

export const canvasHelper = {
  /**
   * 获取优化的 canvas 上下文
   */
  getContext(canvas: HTMLCanvasElement, config: CanvasConfig = {}) {
    return canvas.getContext('2d', {
      alpha: config.alpha ?? true,
      desynchronized: config.desynchronized ?? true,
      willReadFrequently: config.willReadFrequently ?? false
    })
  },

  /**
   * 设置 canvas 尺寸，处理 HiDPI
   */
  setCanvasDimensions(
    canvas: HTMLCanvasElement,
    displayInfo: DisplayInfo,
    callback?: (dimensions: { width: number; height: number }) => void
  ) {
    const scaleFactor = displayInfo.scaleFactor
    const devicePixelRatio = window.devicePixelRatio || 1
    const totalScale = scaleFactor / devicePixelRatio

    // 设置物理像素大小
    canvas.width = Math.round(displayInfo.bounds.width * scaleFactor)
    canvas.height = Math.round(displayInfo.bounds.height * scaleFactor)

    // 设置 CSS 显示大小
    canvas.style.width = `${displayInfo.bounds.width}px`
    canvas.style.height = `${displayInfo.bounds.height}px`

    callback?.({ width: canvas.width, height: canvas.height })

    return totalScale
  },

  /**
   * 清理 canvas 资源
   */
  cleanup(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
  }
} 