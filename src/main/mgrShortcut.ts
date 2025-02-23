import { globalShortcut } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'
import { mgrPreference } from './mgrPreference'

/**
 * 快捷键管理器
 */
export class ShortcutManager {
  /**
   * 转换快捷键格式
   */
  private convertShortcut(shortcut: string): string {
    return shortcut
      .split('+')
      .map(key => {
        switch (key.trim()) {
          case 'Command':
          case 'Cmd':
            return process.platform === 'darwin' ? 'Command' : 'Control'
          case 'Control':
          case 'Ctrl':
            return 'Control'
          case 'Alt':
            return 'Alt'
          case 'Shift':
            return 'Shift'
          default:
            return key.toUpperCase()
        }
      })
      .join('+')
  }

  /**
   * 注册全局快捷键
   */
  registerShortcuts() {
    Logger.log('Registering global shortcuts...')
    
    try {
      // 从配置中获取快捷键
      const rawShortcut = mgrPreference.get<string>('system.captureShortcut')
      const shortcut = this.convertShortcut(rawShortcut)
      
      Logger.debug(`Registering shortcut: ${shortcut} (converted from ${rawShortcut})`)
      
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
          // 开始截图
          await mgrCapture.startCapture()
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
        Logger.error('Failed to register shortcut', new Error(`Failed to register shortcut: ${shortcut}`))
      } else {
        Logger.log(`Shortcut registered successfully: ${shortcut}`)
      }
    } catch (error) {
      Logger.error('Failed to register shortcuts', error as Error)
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