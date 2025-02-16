import { screen } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'
import { mgrClipboard } from './mgrClipboard'
import { mgrOCR } from './mgrOCR'
import { mgrPreference } from './mgrPreference'
import { mgrShortcut } from './shortcut'
import { IShunshotCoreAPI } from '../types/electron'
import { CaptureBounds } from '../renderer/types/capture'

/**
 * 主进程处理器
 */
export const handlers: IShunshotCoreAPI = {
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

  onStartCapture: (callback: () => void) => {
    Logger.log('Registering onStartCapture callback')
    const unsubscribe = mgrCapture.onStart(callback)
    return unsubscribe
  },

  onScreenCaptureData: (callback) => {
    Logger.log('Registering onScreenCaptureData callback')
    const unsubscribe = mgrCapture.onData(callback)
    return unsubscribe
  },

  onCleanupComplete: (callback: () => void) => {
    Logger.log('Registering onCleanupComplete callback')
    const unsubscribe = mgrCapture.onCleanup(callback)
    return unsubscribe
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
      Logger.debug({ 
        message: 'Cropped image info',
        data: { croppedBounds: bounds, imageSize: croppedImage.getSize() }
      })

      // 将图像写入剪贴板
      mgrClipboard.copyImage(croppedImage)
      Logger.debug('Image copied to clipboard')

      // 获取窗口引用
      const captureWindow = mgrWindows.getCaptureWindow()
      if (!captureWindow) {
        Logger.warn('No capture window found')
        return
      }

      // 检查窗口状态
      if (captureWindow.isDestroyed()) {
        Logger.warn('Capture window is already destroyed')
        mgrWindows.setCaptureWindow(null)
        return
      }

      // 先隐藏窗口
      try {
        captureWindow.hide()
        Logger.debug('Capture window hidden')
      } catch (error) {
        Logger.error('Failed to hide window:', error)
      }

      // 清理资源
      mgrCapture.setCurrentData(null)
      Logger.debug('Capture data cleared')

      // 在下一个事件循环中关闭窗口
      setImmediate(() => {
        try {
          if (captureWindow && !captureWindow.isDestroyed()) {
            captureWindow.close()
            Logger.debug('Capture window closed')
          }
          mgrWindows.setCaptureWindow(null)
        } catch (error) {
          Logger.error('Error closing capture window:', error)
          // 即使关闭失败也清理引用
          mgrWindows.setCaptureWindow(null)
        }
      })

    } catch (error) {
      Logger.error('Failed to process capture', error as Error)
      // 出错时也要尝试清理
      mgrCapture.setCurrentData(null)
      mgrWindows.setCaptureWindow(null)
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
      Logger.debug({ 
        message: 'Cropped image info',
        data: { croppedBounds: bounds, imageSize: croppedImage.getSize() }
      })

      // 将图像写入剪贴板
      mgrClipboard.copyImage(croppedImage)
    } catch (error) {
      Logger.error('Failed to copy to clipboard', error as Error)
      throw error
    }
  },

  cancelCapture: () => {
    Logger.log('Received CANCEL_CAPTURE event')
    
    // 获取窗口引用
    const captureWindow = mgrWindows.getCaptureWindow()
    if (!captureWindow) {
      Logger.warn('No capture window found')
      return
    }

    // 检查窗口状态
    if (captureWindow.isDestroyed()) {
      Logger.warn('Capture window is already destroyed')
      mgrWindows.setCaptureWindow(null)
      return
    }

    // 先隐藏窗口
    try {
      captureWindow.hide()
      Logger.debug('Capture window hidden')
    } catch (error) {
      Logger.error('Failed to hide window:', error)
    }

    // 清理资源
    mgrCapture.setCurrentData(null)
    Logger.debug('Capture data cleared')

    // 在下一个事件循环中关闭窗口
    setImmediate(() => {
      try {
        if (captureWindow && !captureWindow.isDestroyed()) {
          captureWindow.close()
          Logger.debug('Capture window closed')
        }
        mgrWindows.setCaptureWindow(null)
      } catch (error) {
        Logger.error('Error closing capture window:', error)
        // 即使关闭失败也清理引用
        mgrWindows.setCaptureWindow(null)
      }
    })
  },

  // 窗口相关
  hideWindow: async () => {
    Logger.log('Hiding window')
    const captureWindow = mgrWindows.getCaptureWindow()
    if (captureWindow) {
      captureWindow.hide()
      Logger.debug({
        message: 'Capture window hidden',
        data: { timestamp: Date.now() }
      })
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

  openSettings: async () => {
    Logger.log('Opening settings window')
    await mgrWindows.createSettingsWindow()
  },

  setIgnoreSystemShortcuts: async (ignore: boolean) => {
    Logger.debug(`Setting ignore system shortcuts: ${ignore}`)
    if (ignore) {
      // 在录制时注销所有快捷键
      mgrShortcut.unregisterAll()
    } else {
      // 录制完成后重新注册快捷键
      mgrShortcut.registerShortcuts()
    }
  },

  // 插件相关
  loadPlugin: async (pluginId: string) => {
    // TODO: 实现插件加载
    Logger.log(`Loading plugin: ${pluginId}`)
  },

  // OCR 相关
  requestOCR: async (bounds: CaptureBounds) => {
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

  // 配置相关
  getPreference: async <T>(key: string) => {
    Logger.debug(`Getting preference: ${key}`)
    return mgrPreference.get<T>(key)
  },

  setPreference: async <T>(key: string, value: T) => {
    Logger.debug(`Setting preference: ${key}`)
    mgrPreference.set<T>(key, value)
  },

  // 系统相关
  platform: process.platform
}

