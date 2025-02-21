import { translog } from './translog'
import { CaptureData } from '../../types/capture'

type EventCleanup = () => void
type DataCallback = (data: CaptureData) => void
type ErrorCallback = (error: Error) => void

interface EventHelperInterface {
  setupCaptureDataListener(onData: DataCallback, onError: ErrorCallback): EventCleanup
  setupCaptureStartListener(onStart: () => void): EventCleanup
}

class EventHelper implements EventHelperInterface {
  /**
   * 设置截图数据事件监听
   */
  setupCaptureDataListener(
    onData: DataCallback,
    onError: ErrorCallback
  ): EventCleanup {
    translog.debug('Setting up SCREEN_CAPTURE_DATA listener')
    
    try {
      const cleanup = window.shunshotCoreAPI.onScreenCaptureData((data) => {
        this.handleCaptureData(data, onData, onError)
      })

      return () => {
        translog.debug('Cleaning up SCREEN_CAPTURE_DATA listener')
        cleanup()
      }
    } catch (error) {
      translog.error('Failed to setup capture data listener:', error)
      onError(error instanceof Error ? error : new Error(String(error)))
      return () => {} // 返回空清理函数
    }
  }

  /**
   * 处理截图数据
   */
  private handleCaptureData(
    data: CaptureData,
    onData: DataCallback,
    onError: ErrorCallback
  ): void {
    translog.debug('SCREEN_CAPTURE_DATA event received', {
      hasImageBuffer: !!data.imageBuffer,
      imageBufferLength: data.imageBuffer?.length,
      imageSize: data.imageSize,
      hasDisplayInfo: !!data.displayInfo,
      displayInfo: data.displayInfo,
      timestamp: Date.now()
    })
    
    try {
      this.validateCaptureData(data)
      onData(data)
    } catch (error) {
      onError(error instanceof Error ? error : new Error(String(error)))
    }
  }

  /**
   * 验证截图数据
   */
  private validateCaptureData(data: CaptureData): void {
    if (!data) {
      throw new Error('Received empty capture data')
    }

    if (!data.imageBuffer || data.imageBuffer.length === 0) {
      throw new Error('No image buffer received')
    }

    if (!data.imageSize || !data.imageSize.width || !data.imageSize.height) {
      throw new Error('Invalid image size')
    }

    if (!data.displayInfo) {
      throw new Error('Received capture data without display info')
    }
  }

  /**
   * 设置截图开始事件监听
   */
  setupCaptureStartListener(onStart: () => void): EventCleanup {
    translog.debug('Setting up START_CAPTURE listener')
    
    try {
      const cleanup = window.shunshotCoreAPI.onStartCapture(() => {
        this.handleCaptureStart(onStart)
      })

      return () => {
        translog.debug('Cleaning up START_CAPTURE listener')
        cleanup()
      }
    } catch (error) {
      translog.error('Failed to setup capture start listener:', error)
      return () => {} // 返回空清理函数
    }
  }

  /**
   * 处理截图开始事件
   */
  private handleCaptureStart(onStart: () => void): void {
    translog.debug('START_CAPTURE event received')
    try {
      onStart()
    } catch (error) {
      translog.error('Error in capture start handler:', error)
    }
  }
}

export const eventHelper = new EventHelper() 