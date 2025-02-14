export const performanceHelper = {
  /**
   * 批量更新状态的包装器
   */
  batchUpdates<T>(updates: (() => void)[]): void {
    requestAnimationFrame(() => {
      updates.forEach(update => update())
    })
  },

  /**
   * RAF 包装器
   */
  scheduleUpdate(callback: () => void): void {
    requestAnimationFrame(callback)
  },

  /**
   * 防抖包装器
   */
  debounce<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let timeoutId: NodeJS.Timeout | null = null
    return (...args: Parameters<T>) => {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
      timeoutId = setTimeout(() => {
        callback(...args)
        timeoutId = null
      }, delay)
    }
  },

  /**
   * 节流函数
   */
  throttle<T extends (...args: any[]) => void>(
    callback: T,
    delay: number
  ): (...args: Parameters<T>) => void {
    let lastCall = 0
    return (...args: Parameters<T>) => {
      const now = Date.now()
      if (now - lastCall >= delay) {
        callback(...args)
        lastCall = now
      }
    }
  }
} 