import { globalShortcut } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'

/**
 * 快捷键管理器
 */
export class ShortcutManager {
  /**
   * 注册全局快捷键
   */
  registerShortcuts() {
    Logger.log('Registering global shortcuts...')
    // 根据平台设置默认快捷键
    const shortcut = process.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X'
    
    // 注册快捷键
    const ret = globalShortcut.register(shortcut, async () => {
      Logger.log('Screenshot shortcut triggered')
      try {
        // 隐藏主窗口
        const mainWindow = mgrWindows.getMainWindow()
        if (mainWindow) {
          Logger.log('Hiding main window')
          mainWindow.hide()
        }
        // 创建截图窗口
        await mgrCapture.createCaptureWindow()
      } catch (error) {
        Logger.error('Failed to handle screenshot shortcut', error as Error)
        // 如果出错，显示主窗口
        const mainWindow = mgrWindows.getMainWindow()
        if (mainWindow) {
          mainWindow.show()
        }
      }
    })

    if (!ret) {
      Logger.error('Failed to register shortcut', new Error(shortcut))
    } else {
      Logger.log('Shortcut registered successfully:', shortcut)
    }
  }

  /**
   * 注销所有快捷键
   */
  unregisterAll() {
    Logger.log('Unregistering all shortcuts')
    globalShortcut.unregisterAll()
  }
}

// 创建单例
export const mgrShortcut = new ShortcutManager() 