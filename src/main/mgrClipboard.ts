import { clipboard } from 'electron'
import type { NativeImage } from 'electron'
import { Logger } from './logger'

/**
 * 剪贴板管理器
 */
export class ClipboardManager {
  /**
   * 复制图像到剪贴板
   */
  copyImage(image: NativeImage) {
    try {
      clipboard.writeImage(image)
      Logger.log('Image copied to clipboard')
    } catch (error) {
      Logger.error('Failed to copy image to clipboard', error as Error)
      throw error
    }
  }

  /**
   * 复制文本到剪贴板
   */
  copyText(text: string) {
    try {
      clipboard.writeText(text)
      Logger.log('Text copied to clipboard')
    } catch (error) {
      Logger.error('Failed to copy text to clipboard', error as Error)
      throw error
    }
  }
}

// 创建单例
export const mgrClipboard = new ClipboardManager() 