import { app, BrowserWindow, dialog, nativeImage, screen } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'
import { mgrClipboard } from './mgrClipboard'
import { mgrOCR } from './mgrOCR'
import { mgrPreference } from './mgrPreference'
import { mgrShortcut } from './mgrShortcut'
import { IShunshotCoreAPI } from '../types/shunshotapi'
import { Bounds, image } from '../common/2d'
import { mgrAgents } from './mgrAgents'
import { AgentResult, AgentRunOptions } from '../types/agents'
import { mgrConversation } from './mgrConversation'

function MakeImage(bounds: Bounds): ReturnType<typeof nativeImage.createEmpty> | { error: string } {
  const currentData = mgrCapture.getCurrentData()
  if (!currentData) {
    Logger.error('No capture data available')
    return { error: 'No capture data available' }
  }
  try {
    
    // Log input validation
    Logger.debug({
      message: '[MkImg] Input validation',
      data: {
        currentData: currentData,
        bounds: bounds,
      },
    })

    // 使用新的图像处理模块裁剪图像
    const croppedImage = currentData.getFinalImage(bounds)
    if (!croppedImage) {
      Logger.error('Failed to crop image')
      return { error: 'Failed to crop image' }
    }

    // 验证图像尺寸
    if (!image.meetsMinimumSize(croppedImage)) {
      const size = croppedImage.getSize()
      return { 
        error: `Image dimensions are too small. Minimum allowed dimension: 10 pixels. Current dimensions: width = ${size.width}, height = ${size.height}` 
      }
    }
    return croppedImage
  } catch (error) {
    Logger.error('Failed to make image', error as Error)
    return { error: 'Failed to make image' }
  }
}

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

  completeCapture: async (bounds: Bounds) => {
    Logger.log('Received COMPLETE_CAPTURE event')
    
    const currentData = mgrCapture.getCurrentData()
    if (!currentData) {
      Logger.error('No capture data available')
      return
    }

    try {
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

      // 在下一个事件循环中关闭窗口
      setImmediate(() => {
        try {
          if (captureWindow && !captureWindow.isDestroyed()) {
            captureWindow.close()
            Logger.debug('Capture window closed')
          }
          mgrWindows.setCaptureWindow(null)
          
          // 在窗口关闭后再清理资源，确保所有使用 CaptureData 的操作都已完成
          mgrCapture.setCurrentData(null)
          Logger.debug('Capture data cleared')
        } catch (error) {
          Logger.error('Error closing capture window:', error)
          // 即使关闭失败也清理引用
          mgrWindows.setCaptureWindow(null)
          mgrCapture.setCurrentData(null)
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



  copyToClipboard: async (bounds: Bounds) => {
    Logger.log('Received COPY_TO_CLIPBOARD event')
    
    const currentData = mgrCapture.getCurrentData()
    if (!currentData) {
      Logger.error('No capture data available')
      return
    }

    try {
      const finalImage = currentData.getFinalImage(bounds)
      if (finalImage) {
        Logger.debug('Using final image for clipboard')
        mgrClipboard.copyImage(finalImage)
      } else {
        Logger.error('No final image available')
        return
      }
    } catch (error) {
      Logger.error('Failed to copy to clipboard', error as Error)
      throw error
    }
  },

  saveAnnotatedImage: async (imageDataUrl, bounds) => {
    Logger.log('Received SAVE_ANNOTATED_IMAGE event')
    
    try {
      // Convert data URL to NativeImage
      const base64Data = imageDataUrl.replace(/^data:image\/\w+;base64,/, '')
      const buffer = Buffer.from(base64Data, 'base64')
      const annotatedImage = nativeImage.createFromBuffer(buffer)
      
      // Validate the image
      if (annotatedImage.isEmpty()) {
        Logger.error('Annotated image is empty')
        throw new Error('Annotated image is empty')
      }
      
      const imageSize = annotatedImage.getSize()
      Logger.debug({
        message: 'Annotated image created',
        data: {
          imageSize,
          bounds
        }
      })
      
      // Store the annotated image in the capture manager
      mgrCapture.setAnnotatedImage(annotatedImage, bounds)
      
      Logger.debug({
        message: 'Annotated image saved successfully',
        data: {
          imageSize,
          bounds
        }
      })
    } catch (error) {
      Logger.error('Failed to save annotated image', error as Error)
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

  setWindowSize: async (width, height) => {
    Logger.log('Received SET_WINDOW_SIZE event')
    
    const mainWindow = mgrWindows.getMainWindow()
    if (!mainWindow) {
      Logger.warn('No main window found')
      return
    }

    try {
      mainWindow.setContentSize(width, height)
      // 由于窗口大小变化，需要重新计算位置以保持在右下角
      const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
      mainWindow.setPosition(screenWidth - width - 20, screenHeight - height - 20)
    } catch (error) {
      Logger.error('Failed to set window size', error as Error)
      throw error
    }
  },

  openSettings: async () => {
    Logger.log('Opening settings window')
    await mgrWindows.createSettingsWindow()
  },

  showOpenDialog: async (options) => {
    Logger.debug({message: 'Showing open dialog', data: { options }})
    const mainWindow = mgrWindows.getMainWindow()
    return dialog.showOpenDialog(mainWindow!, options)
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
  requestOCR: async (bounds: Bounds) => {
    Logger.log('Received OCR request')
    try {
      const croppedImage = MakeImage(bounds) 
      if (!croppedImage) {
        Logger.error({message: 'Failed to make image', data: { error: 'Failed to make image' }})
        return { error: 'Failed to make image' }
      }
      if ('error' in croppedImage) {
        Logger.error({message: 'Failed to make image', data: { error: croppedImage.error }})
        return { error: croppedImage.error }
      }
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
  platform: process.platform,

  // 会话相关
  getConversations: async () => {
    Logger.log('Getting conversations list')
    try {
      return await mgrConversation.getConversations()
    } catch (error) {
      Logger.error('Failed to get conversations:', error)
      throw error
    }
  },

  getConversation: async (id: string) => {
    Logger.log(`Getting conversation: ${id}`)
    try {
      return await mgrConversation.loadConversation(id)
    } catch (error) {
      Logger.error(`Failed to get conversation ${id}:`, error)
      throw error
    }
  },

  updateConversation: async (id: string, message: string, targetAgentId?: string) => {
    Logger.log(`Updating conversation: ${id}`)
    try {
      return await mgrConversation.updateConversationWithMessage(id, message, targetAgentId)
    } catch (error) {
      Logger.error(`Failed to update conversation ${id}:`, error)
      throw error
    }
  },

  // Agent 相关方法
  getAgents: async () => {
    return mgrAgents.getAgents()
  },

  createAgent: async (agent) => {
    return mgrAgents.createAgent(agent)
  },

  updateAgent: async (id, config) => {
    return mgrAgents.updateAgent(id, config)
  },

  deleteAgent: async (id) => {
    return mgrAgents.deleteAgent(id)
  },

  runAgent: async (id, options: AgentRunOptions): Promise<AgentResult> => {
    console.log('Received agent request')
    
    try {
      let croppedImage = null;

      // Only get cropped image for new conversations
      if (!options.conversationId) {
        const result = await MakeImage(options.selectedBounds)
        if ('error' in result) {
          return { error: result.error }
        }
        croppedImage = result;
      }

      // Sanitize messages to ensure they are serializable
      const sanitizedOptions = {
        ...options,
        parameters: options.parameters ? {
          ...options.parameters,
          messages: options.parameters.messages?.map(msg => ({
            role: msg.role,
            content: Array.isArray(msg.content) 
              ? msg.content.map(part => {
                  if (part.type === 'text') {
                    return {
                      type: 'text' as const,
                      text: part.text
                    }
                  } else if (part.type === 'image_url') {
                    return {
                      type: 'image_url' as const,
                      image_url: {
                        url: part.image_url.url,
                        detail: part.image_url.detail || 'auto'
                      }
                    }
                  }
                  return part
                })
              : msg.content,
            timestamp: msg.timestamp
          }))
        } : undefined
      }

      // Run agent with sanitized options
      const agentResult = await mgrAgents.runAgent(id, croppedImage, sanitizedOptions)

      // Ensure the response is serializable
      return {
        conversation: agentResult.conversation ? {
          id: agentResult.conversation.id,
          agentId: agentResult.conversation.agentId,
          messages: agentResult.conversation.messages.map(msg => ({
            role: msg.role,
            content: Array.isArray(msg.content)
              ? msg.content.map(part => {
                  if (part.type === 'text') {
                    return {
                      type: 'text' as const,
                      text: part.text
                    }
                  } else if (part.type === 'image_url') {
                    return {
                      type: 'image_url' as const,
                      image_url: {
                        url: part.image_url.url,
                        detail: part.image_url.detail || 'auto'
                      }
                    }
                  }
                  return part
                })
              : msg.content,
            timestamp: msg.timestamp
          })),
          metadata: {
            createdAt: agentResult.conversation.metadata.createdAt,
            updatedAt: agentResult.conversation.metadata.updatedAt,
            turnCount: agentResult.conversation.metadata.turnCount
          }
        } : undefined,
        latestMessage: agentResult.latestMessage ? {
          role: agentResult.latestMessage.role,
          content: agentResult.latestMessage.content,
          timestamp: agentResult.latestMessage.timestamp
        } : undefined,
        error: agentResult.error
      }
    } catch (error) {
      console.error('Error in runAgent:', error)
      return { error: error instanceof Error ? error.message : 'Unknown error occurred' }
    }
  }
}

