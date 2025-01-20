import { app, Menu, MenuItemConstructorOptions } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'

/**
 * 托盘菜单管理器
 */
export class TrayMenuManager {
  /**
   * 创建托盘菜单
   */
  createMenu(): Menu {
    const menuTemplate = this.getMenuTemplate()
    return Menu.buildFromTemplate(menuTemplate)
  }

  /**
   * 获取菜单模板
   */
  private getMenuTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: '显示主窗口',
        type: 'checkbox',
        checked: mgrWindows.getMainWindow()?.isVisible() ?? false,
        click: () => {
          const mainWindow = mgrWindows.getMainWindow()
          if (mainWindow) {
            if (mainWindow.isVisible()) {
              mainWindow.hide()
            } else {
              mainWindow.show()
              mainWindow.focus()
            }
          }
        }
      },
      {
        label: '开始截图',
        accelerator: process.platform === 'darwin' ? 'Cmd+Shift+X' : 'Ctrl+Shift+X',
        click: async () => {
          const mainWindow = mgrWindows.getMainWindow()
          if (mainWindow) {
            mainWindow.hide()
          }
          try {
            await mgrCapture.createCaptureWindow()
          } catch (error) {
            Logger.error('Failed to start capture from tray', error as Error)
            if (mainWindow) {
              mainWindow.show()
            }
          }
        }
      },
      { type: 'separator' },
      {
        label: '退出',
        click: () => {
          app.quit()
        }
      }
    ]
  }
}

// 创建单例
export const mgrTray = new TrayMenuManager() 