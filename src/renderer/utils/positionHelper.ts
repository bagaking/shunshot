import { Rect, CaptureBounds } from '../types/capture'

interface Position {
  left: number
  top: number
}

export const positionHelper = {
  /**
   * 计算信息面板位置
   */
  calculateInfoPanelPosition(
    selectedRect: Rect,
    bounds: CaptureBounds,
    scale: number = 1
  ): Position {
    // Use same base coordinate as toolbar
    const x = selectedRect.width > 0
      ? selectedRect.startX
      : selectedRect.startX + selectedRect.width
    
    const y = selectedRect.height > 0
      ? selectedRect.startY
      : selectedRect.startY

    return {
      left: Math.min(
        window.innerWidth - 200,
        Math.max(0, x * scale)
      ),
      top: Math.min(
        window.innerHeight - 50,
        Math.max(10, y * scale - 45)  // Position above selection
      )
    }
  },

  /**
   * 计算工具栏位置
   */
  calculateToolbarPosition(
    selectedRect: Rect,
    scale: number = 1
  ): Position {
    const x = selectedRect.width > 0
      ? selectedRect.startX
      : selectedRect.startX + selectedRect.width
    
    const y = selectedRect.height > 0
      ? selectedRect.startY + selectedRect.height
      : selectedRect.startY

    return {
      left: Math.min(
        window.innerWidth - 200,
        Math.max(0, x * scale)
      ),
      top: Math.min(
        window.innerHeight - 50,
        Math.max(50, y * scale + 10)
      )
    }
  }
} 