import { translog } from './translog'
import { CaptureData } from '../types/capture'

interface EventCleanup {
  (): void
}


export const eventHelper = {
  /**
   * 设置截图数据事件监听
   */
  setupCaptureDataListener(
    onData: (data: CaptureData) => void,
    onError: (error: Error) => void
  ): EventCleanup {
    translog.debug('Setting up SCREEN_CAPTURE_DATA listener')
    
    const cleanup = window.shunshotCoreAPI.onScreenCaptureData((data) => {
      translog.debug('SCREEN_CAPTURE_DATA event received', {
        hasImageData: !!data.imageData,
        imageDataLength: data.imageData?.length,
        hasDisplayInfo: !!data.displayInfo,
        displayInfo: data.displayInfo,
        timestamp: Date.now()
      })
      
      try {
        if (!data) {
          throw new Error('Received empty capture data')
        }

        if (!data.imageData) {
          throw new Error('Received capture data without image data')
        }

        if (!data.displayInfo) {
          throw new Error('Received capture data without display info')
        }

        onData(data)
      } catch (error) {
        onError(error as Error)
      }
    })

    return () => {
      translog.debug('Cleaning up SCREEN_CAPTURE_DATA listener')
      cleanup()
    }
  },

  /**
   * 设置截图开始事件监听
   */
  setupCaptureStartListener(
    onStart: () => void
  ): EventCleanup {
    translog.debug('Setting up START_CAPTURE listener')
    
    const cleanup = window.shunshotCoreAPI.onStartCapture(() => {
      translog.debug('START_CAPTURE event received')
      onStart()
    })

    return () => {
      translog.debug('Cleaning up START_CAPTURE listener')
      cleanup()
    }
  },

  /**
   * 设置键盘事件监听器
   */
  setupKeyboardListeners({
    onEscape
  }: {
    onEscape: () => void
  }): EventCleanup {
    translog.debug('Setting up keyboard event listeners')
    
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        translog.debug('Escape key pressed')
        onEscape()
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      translog.debug('Cleaning up keyboard event listeners')
      window.removeEventListener('keydown', handleKeyDown)
    }
  }
} 