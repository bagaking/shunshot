import { app, Menu, MenuItemConstructorOptions, nativeImage, Tray } from 'electron'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { mgrCapture } from './mgrCapture'
import { join } from 'path'
import { existsSync } from 'fs'

/**
 * 托盘管理器
 */
export class TrayManager {
  private tray: Tray | null = null

  /**
   * 生成默认的小猫图标
   */
  private createDefaultTrayIcon(): Electron.NativeImage {
    const size = 32
    const canvas = new Uint8Array(size * size * 4)
    const color = process.platform === 'darwin' ? 0 : 255 // 黑色或白色
    
    // 清空画布
    canvas.fill(0)
    
    // 定义一个简单的小猫图案 (16x16 像素, 放在 32x32 的中心)
    const catPattern = [
      "00000100000000100000", 
      "00000111000011100000", 
      "00000111100111100000", // 耳朵和头部
      "00011111111111111000",
      "00111100011000111100",
      "00111100011000111100",
      "00001100011000110000", // 脸部
      "00000111111111100000",
      "00000001111110000000",
      "00000000011000000000"  
    ]
    
    const startX = (32 - catPattern[0].length) / 2 // 居中放置
    const startY = 12
    
    // 绘制图案
    catPattern.forEach((row, y) => {
      row.split('').forEach((pixel, x) => {
        if (pixel === '1') {
          const pos = ((startY + y) * size + (startX + x)) * 4
          canvas[pos] = color     // R
          canvas[pos + 1] = color // G
          canvas[pos + 2] = color // B
          canvas[pos + 3] = 255   // A
        }
      })
    })
    
    // 创建图标
    return nativeImage.createFromBuffer(Buffer.from(canvas), {
      width: size,
      height: size
    })
  }

  /**
   * 加载托盘图标
   */
  private loadTrayIcon(): Electron.NativeImage {
    try {
      // 尝试加载自定义图标
      const iconPath = join(process.env.VITE_PUBLIC || '', 'tray.png')
      if (existsSync(iconPath)) {
        const icon = nativeImage.createFromPath(iconPath)
        if (!icon.isEmpty()) {
          Logger.debug({
            message: 'Custom icon loaded',
            data: {
              path: iconPath,
              size: icon.getSize()
            }
          })
          return icon
        }
      }
    } catch (error) {
      Logger.error('Failed to load custom icon', error as Error)
    }
    
    // 使用默认图标
    const icon = this.createDefaultTrayIcon()
    Logger.debug({
      message: 'Using default cat icon',
      data: {
        size: icon.getSize()
      }
    })
    return icon
  }

  /**
   * 创建托盘菜单
   */
  private createMenu(): Menu {
    const menuTemplate = this.getMenuTemplate()
    return Menu.buildFromTemplate(menuTemplate)
  }

  /**
   * 获取菜单模板
   */
  private getMenuTemplate(): MenuItemConstructorOptions[] {
    return [
      {
        label: 'Shunshot',
        enabled: false,
        icon: process.platform === 'darwin' ? undefined : '/path/to/icon.png'
      },
      {
        label: `Version ${app.getVersion()}`,
        enabled: false
      },
      { type: 'separator' },
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
        label: '设置',
        click: async () => {
          await mgrWindows.createSettingsWindow()
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

  /**
   * 创建或更新托盘
   */
  createTray() {
    Logger.log('Creating tray...')
    
    // 加载图标
    const icon = this.loadTrayIcon()
    
    // 仅在 macOS 上使用模板模式
    if (process.platform === 'darwin') {
      icon.setTemplateImage(true)
    }
    
    // 如果已存在托盘，先销毁
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
    
    // 创建托盘
    this.tray = new Tray(icon)
    this.tray.setToolTip('Shunshot')
    
    // 设置菜单和事件处理
    const updateMenu = () => {
      if (this.tray) {
        const menu = this.createMenu()
        this.tray.setContextMenu(menu)
      }
    }
    
    // 设置点击行为
    if (process.platform === 'win32') {
      // Windows: 左键点击显示菜单
      this.tray.on('click', () => {
        this.tray?.popUpContextMenu()
      })
    } else {
      // macOS: 左键点击切换主窗口
      this.tray.on('click', () => {
        const mainWindow = mgrWindows.getMainWindow()
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide()
          } else {
            mainWindow.show()
            mainWindow.focus()
          }
        }
      })
    }
    
    // 初始化菜单
    updateMenu()
    
    // 监听窗口显示/隐藏事件以更新菜单
    const mainWindow = mgrWindows.getMainWindow()
    if (mainWindow) {
      mainWindow.on('show', updateMenu)
      mainWindow.on('hide', updateMenu)
    }
    
    Logger.log('Tray created successfully')
    return this.tray
  }

  /**
   * 获取托盘实例
   */
  getTray(): Tray | null {
    return this.tray
  }

  /**
   * 销毁托盘
   */
  destroy() {
    if (this.tray) {
      this.tray.destroy()
      this.tray = null
    }
  }
}

// 创建单例
export const mgrTray = new TrayManager()