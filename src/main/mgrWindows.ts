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
      show: false, // 默认不显示
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

    // 监听窗口显示/隐藏事件
    mainWindow.on('show', () => {
      Logger.debug('Main window shown')
    })

    mainWindow.on('hide', () => {
      Logger.debug('Main window hidden')
    })

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
      Logger.debug('Settings window already exists, focusing existing window')
      this.settingsWindow.focus()
      return this.settingsWindow
    }

    const preloadPath = join(process.env.DIST_PRELOAD!, 'index.js')
    Logger.log(`preloadPath: ${preloadPath}`)
    
    // 记录窗口创建配置
    const windowConfig = {
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
    }
    
    Logger.debug({
      message: 'Creating window with config',
      data: windowConfig
    })
    const settingsWindow = new BrowserWindow(windowConfig)

    // 设置窗口位置 - 居中显示
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const x = Math.floor((screenWidth - 800) / 2)
    const y = Math.floor((screenHeight - 600) / 2)
    Logger.debug({
      message: `Setting window position to x:${x}, y:${y}`
    })
    settingsWindow.setPosition(x, y)

    // 监听窗口状态变化
    settingsWindow.on('show', () => {
      Logger.debug(`Settings window shown - bounds:${JSON.stringify(settingsWindow.getBounds())}, visible:${settingsWindow.isVisible()}, focused:${settingsWindow.isFocused()}`)
    })

    settingsWindow.on('hide', () => {
      Logger.debug('Settings window hidden')
    })

    settingsWindow.on('focus', () => {
      Logger.debug('Settings window focused')
    })

    settingsWindow.on('blur', () => {
      Logger.debug('Settings window lost focus')
    })

    settingsWindow.on('move', () => {
      Logger.debug(`Settings window moved to ${JSON.stringify(settingsWindow.getBounds())}`)
    })

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
      const devUrl = process.env.VITE_DEV_SERVER_URL.replace(/\/$/, '') + '/src/renderer/settingsWindow.html'
      Logger.log(`Loading dev URL: ${devUrl}`)
      try {
        await settingsWindow.loadURL(devUrl)
        Logger.debug('Dev URL loaded successfully')
        // 在开发模式下，页面加载完成后显示窗口
        if (!settingsWindow.isDestroyed()) {
          settingsWindow.show()
          settingsWindow.focus()
          Logger.debug('Settings window shown and focused after dev URL load')
        }
      } catch (error) {
        Logger.error(`Failed to load dev URL: ${error}`)
        throw error
      }
      
      if (!app.isPackaged) {
        settingsWindow.webContents.openDevTools({ mode: 'detach' })
        Logger.debug({
          message: 'DevTools opened'
        })
      }
    } else {
      const filePath = join(process.env.DIST_RENDERER!, 'settingsWindow.html')
      Logger.log(`Loading file: ${filePath}`)
      
      if (!existsSync(filePath)) {
        Logger.error(`Settings window HTML file not found at: ${filePath}`)
        throw new Error(`Settings window HTML file not found at: ${filePath}`)
      }

      try {
        await settingsWindow.loadFile(filePath)
        Logger.log('Settings window file loaded successfully')
        // 在生产模式下，页面加载完成后显示窗口
        if (!settingsWindow.isDestroyed()) {
          settingsWindow.show()
          settingsWindow.focus()
          Logger.debug('Settings window shown and focused after file load')
        }
      } catch (error) {
        Logger.error(`Failed to load settings window file: ${error}`)
        throw error
      }
    }

    // 添加更多事件监听来帮助调试
    settingsWindow.webContents.on('did-start-loading', () => {
      Logger.debug('Settings window started loading')
    })

    settingsWindow.webContents.on('did-finish-load', () => {
      Logger.debug(`Settings window finished loading URL: ${settingsWindow.webContents.getURL()}`)
    })

    settingsWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      Logger.error(`Settings window failed to load: ${errorDescription} (code: ${errorCode})`)
    })

    settingsWindow.webContents.on('dom-ready', () => {
      Logger.debug('Settings window DOM ready')
    })

    // macOS 特定设置
    if (process.platform === 'darwin') {
      Logger.debug('Configuring macOS specific settings')
      settingsWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    // 窗口准备好时显示
    settingsWindow.once('ready-to-show', () => {
      Logger.debug(`Settings window ready to show - destroyed:${settingsWindow.isDestroyed()}, visible:${settingsWindow.isVisible()}`)
      if (!settingsWindow.isDestroyed()) {
        settingsWindow.show()
        settingsWindow.focus()
        Logger.debug('Settings window shown and focused')
      }
    })

    // 窗口关闭时清理引用
    settingsWindow.on('closed', () => {
      Logger.debug('Settings window closed')
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