import { app, BrowserWindow, screen, nativeImage, Tray } from 'electron'
import { join } from 'path' 
import { Logger } from './logger'

/**
 * 窗口管理器
 */
export class WindowManager {
  private mainWindow: BrowserWindow | null = null
  private captureWindow: BrowserWindow | null = null
  private tray: Tray | null = null
  private menuManager: any = null

  setMenuManager(manager: any) {
    this.menuManager = manager
  }

  getMainWindow(): BrowserWindow | null {
    return this.mainWindow
  }

  getCaptureWindow(): BrowserWindow | null {
    return this.captureWindow
  }

  getTray(): Tray | null {
    return this.tray
  }

  setMainWindow(window: BrowserWindow | null): void {
    this.mainWindow = window
  }

  setCaptureWindow(window: BrowserWindow | null): void {
    this.captureWindow = window
  }

  setTray(tray: Tray | null): void {
    this.tray = tray
  }

  /**
   * 创建主窗口
   */
  async createMainWindow() {
    Logger.log('Creating main window...')
    const mainWindow = new BrowserWindow({
      width: 200,
      height: 272,
      webPreferences: {
        preload: join(process.env.DIST_ELECTRON!, 'preload/index.js'),
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
      const filePath = join(process.env.DIST!, 'mainWindow.html')
      Logger.log(`Loading file: ${filePath}`)
      await mainWindow.loadFile(filePath)
    }

    // macOS 特定设置
    if (process.platform === 'darwin') {
      mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    }

    this.setMainWindow(mainWindow)
    Logger.log('Main window created')
    return mainWindow
  }

  /**
   * 创建系统托盘
   */
  createTray() {
    Logger.log('Creating tray icon...')
    
    // 定义 SVG 图标数据 - 使用 data URL，采用 template 风格
    const svgIcon = `data:image/svg+xml;base64,${Buffer.from(`
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M7 3C4.79086 3 3 4.79086 3 7V15C3 17.2091 4.79086 19 7 19H15C17.2091 19 19 17.2091 19 15V7C19 4.79086 17.2091 3 15 3H7ZM5 7C5 5.89543 5.89543 5 7 5H15C16.1046 5 17 5.89543 17 7V15C17 16.1046 16.1046 17 15 17H7C5.89543 17 5 16.1046 5 15V7Z" fill="black"/>
      <path d="M8 11L10 13L14 9" stroke="black" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    `).toString('base64')}`
    
    // 创建图标
    const icon = nativeImage.createFromDataURL(svgIcon)
    icon.setTemplateImage(true)
    
    // 创建 Tray
    const tray = new Tray(icon)
    tray.setToolTip('Shunshot')

    // 设置菜单
    const updateMenu = () => {
      if (this.menuManager) {
        tray.setContextMenu(this.menuManager.createMenu())
      }
    }

    // 初始化菜单
    updateMenu()

    // 监听窗口显示/隐藏事件以更新菜单
    this.mainWindow?.on('show', updateMenu)
    this.mainWindow?.on('hide', updateMenu)
    
    // 点击托盘图标时切换主窗口显示状态
    tray.on('click', () => {
      updateMenu()
    })

    this.setTray(tray)
    return tray
  }
}

// 创建单例
export const mgrWindows = new WindowManager()

// 导出便捷访问方法
export const mainWindow = () => mgrWindows.getMainWindow()
export const captureWindow = () => mgrWindows.getCaptureWindow() 