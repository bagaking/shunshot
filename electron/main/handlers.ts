import { screen } from 'electron'
import { IShunshotCoreAPI } from '../../src/types/electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'
import { mgrClipboard } from './mgrClipboard'
import { mgrOCR } from './mgrOCR'

/**
 * 主进程处理器
 */
export const handlers: {
  [K in Exclude<keyof IShunshotCoreAPI, 'platform'>]: IShunshotCoreAPI[K] extends (...args: any[]) => any
    ? (...args: Parameters<IShunshotCoreAPI[K]>) => ReturnType<IShunshotCoreAPI[K]>
    : never
} = {
  // 截图相关
  captureScreen: async () => {
    Logger.log('Screenshot capture requested')
    try {
      await mgrCapture.createCaptureWindow()
    } catch (error) {
      Logger.error('Failed to handle screenshot capture', error as Error)
      throw error
    }
  },

  completeCapture: async (bounds) => {
    Logger.log('Received COMPLETE_CAPTURE event')
    
    const currentData = mgrCapture.getCurrentData()
    if (!currentData) {
      Logger.error('No capture data available')
      return
    }

    try {
      const { fullImage } = currentData
      const { x, y, width, height } = bounds

      // 创建裁剪后的图像
      const croppedImage = fullImage.crop({ x, y, width, height })
      Logger.debug({ croppedBounds: bounds, imageSize: croppedImage.getSize() })

      // 将图像写入剪贴板
      mgrClipboard.copyImage(croppedImage)

      // 清理资源
      mgrCapture.setCurrentData(null)
      Logger.log('Cleaned up capture data')

      // 关闭截图窗口
      const captureWindow = mgrWindows.getCaptureWindow()
      if (captureWindow) {
        captureWindow.close()
      }
    } catch (error) {
      Logger.error('Failed to process capture', error as Error)
      throw error
    }
  },

  copyToClipboard: async (bounds) => {
    Logger.log('Received COPY_TO_CLIPBOARD event')
    
    const currentData = mgrCapture.getCurrentData()
    if (!currentData) {
      Logger.error('No capture data available')
      return
    }

    try {
      const { fullImage } = currentData
      const { x, y, width, height } = bounds

      // 创建裁剪后的图像
      const croppedImage = fullImage.crop({ x, y, width, height })
      Logger.debug({ croppedBounds: bounds, imageSize: croppedImage.getSize() })

      // 将图像写入剪贴板
      mgrClipboard.copyImage(croppedImage)
    } catch (error) {
      Logger.error('Failed to copy to clipboard', error as Error)
      throw error
    }
  },

  cancelCapture: () => {
    Logger.log('Received CANCEL_CAPTURE event')
    
    // 清理资源
    mgrCapture.setCurrentData(null)
    Logger.log('Cleaned up capture data')

    // 关闭截图窗口
    const captureWindow = mgrWindows.getCaptureWindow()
    if (captureWindow) {
      captureWindow.close()
    }
  },

  // 窗口相关
  hideWindow: async () => {
    Logger.log('Hiding main window')
    const mainWindow = mgrWindows.getMainWindow()
    if (mainWindow) {
      mainWindow.hide()
    }
  },

  showWindow: async () => {
    Logger.log('Showing main window')
    const mainWindow = mgrWindows.getMainWindow()
    if (mainWindow) {
      mainWindow.show()
      mainWindow.focus()
    }
  },

  setWindowSize: async (width: number, height: number) => {
    Logger.log(`Setting window size to ${width}x${height}`)
    const mainWindow = mgrWindows.getMainWindow()
    if (mainWindow) {
      // 设置窗口大小，包括边框
      mainWindow.setSize(width, height)
      // 设置内容区域大小，不包括边框
      mainWindow.setContentSize(width, height)
      // 由于窗口大小变化，需要重新计算位置以保持在右下角
      const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
      mainWindow.setPosition(screenWidth - width - 20, screenHeight - height - 20)
    }
  },

  // 插件相关
  loadPlugin: async (pluginId: string) => {
    // TODO: 实现插件加载
    Logger.log(`Loading plugin: ${pluginId}`)
  },

  // OCR 相关
  requestOCR: async (bounds) => {
    Logger.log('Received OCR request')
    
    const currentData = mgrCapture.getCurrentData()
    if (!currentData) {
      Logger.error('No capture data available')
      return { error: 'No capture data available' }
    }

    try {
      const { fullImage } = currentData
      const { x, y, width, height } = bounds

      // 裁剪选中区域
      const croppedImage = fullImage.crop({ x, y, width, height })
      
      // 调用 OCR
      return await mgrOCR.recognizeText(croppedImage)
    } catch (error) {
      Logger.error('Failed to process OCR', error as Error)
      return { error: 'OCR processing failed' }
    }
  },

  // 事件监听相关
  onStartCapture: () => {
    throw new Error('Event handler should not be called in main process')
  },

  onScreenCaptureData: () => {
    throw new Error('Event handler should not be called in main process')
  },

  // 日志相关
  log: (level, ...args) => {
    switch (level) {
      case 'log':
        Logger.log(args.join(' '))
        break
      case 'info':
        Logger.info(args.join(' '))
        break
      case 'warn':
        Logger.warn(args.join(' '))
        break
      case 'error':
        Logger.error(args.join(' '))
        break
    }
  }
}

