import { app, BrowserWindow, screen, nativeImage, Tray } from 'electron'
import { join } from 'path' 
import { Logger } from './logger'
import { existsSync } from 'fs'

/**
 * 窗口管理器
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private captureWindow: BrowserWindow | null = null
  private settingsWindow: BrowserWindow | null = null

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getCaptureWindow(): BrowserWindow | null {
    return this.captureWindow
  }

  getSettingsWindow(): BrowserWindow | null {
    return this.settingsWindow
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  setCaptureWindow(window: BrowserWindow | null): void {
    this.captureWindow = window
  }

  setSettingsWindow(window: BrowserWindow | null): void {
    this.settingsWindow = window
  }

  /**
   * 创建主窗口
   */
  async createMainWindow() {
    Logger.log('Creating main window...')
    const preloadPath = join(process.env.DIST_PRELOAD!, 'index.js')
    Logger.log(`preloadPath: ${preloadPath}`)
    const mainWindow = new BrowserWindow({
      width: 200,
      height: 272,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: true,
      type: 'panel',
    })

    // 设置窗口位置 - 默认在右下角
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    mainWindow.setPosition(screenWidth - 300, screenHeight - 400)

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
      const devUrl = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/src/renderer/mainWindow.html'
      Logger.log(`Loading dev URL: ${devUrl}`)
      await mainWindow.loadURL(devUrl)
      if (!app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }
    } else {
      const filePath = join(process.env.DIST_RENDERER!, 'mainWindow.html')
      Logger.log(`Loading file: ${filePath}`)
      await mainWindow.loadFile(filePath)
    }

    // macOS 特定设置
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    this.setMainWindow(mainWindow)
    Logger.log('Main window created')

    // 窗口关闭时清理引用
    mainWindow.on('closed', () => {
      Logger.log('Main window closed')
      this.setMainWindow(null)
    })

    return mainWindow
  }

  /**
   * 创建设置窗口
   */
  async createSettingsWindow() {
    Logger.log('Creating settings window...')

    if (this.settingsWindow) {
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    const preloadPath = join(process.env.DIST_PRELOAD!, 'index.js')
    Logger.log(`preloadPath: ${preloadPath}`)
    const settingsWindow = new BrowserWindow({
      width: 800,
      height: 600,
      title: '设置',
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      show: false,
      frame: true,
      resizable: true,
      fullscreenable: false,
      backgroundColor: '#ffffff',
    })

    // 设置窗口位置 - 居中显示
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const x = Math.floor((screenWidth - 800) / 2)
    const y = Math.floor((screenHeight - 600) / 2)
    settingsWindow.setPosition(x, y)

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
      const devUrl = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/src/renderer/settingsWindow.html'
      Logger.log(`Loading dev URL: ${devUrl}`)
      await settingsWindow.loadURL(devUrl)
      if (!app.isPackaged) {
        settingsWindow.webContents.openDevTools({ mode: 'detach' })
      }
    } else {
      const filePath = join(process.env.DIST_RENDERER!, 'settingsWindow.html')
      Logger.log(`Loading file: ${filePath}`)
      await settingsWindow.loadFile(filePath)
    }

    // macOS 特定设置
    if (process.platform === 'darwin') {
      settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    // 窗口准备好时显示
    settingsWindow.once('ready-to-show', () => {
      settingsWindow.show()
      settingsWindow.focus()
    })

    // 窗口关闭时清理引用
    settingsWindow.on('closed', () => {
      this.settingsWindow = null
    })

    this.settingsWindow = settingsWindow
    Logger.log('Settings window created')
    return settingsWindow
  }
}

// 创建单例
export const mgrWindows = new WindowManager()

// 导出便捷访问方法
export const mainWindow = () => mgrWindows.getMainWindow()
export const captureWindow = () => mgrWindows.getCaptureWindow()
export const settingsWindow = () => mgrWindows.getSettingsWindow() 