import { app, BrowserWindow, screen, nativeImage, Tray } from 'electron'
import { join } from 'path' 
import { Logger } from './logger'
import { existsSync, readFileSync } from 'fs'

/**
 * 检查HTML文件内容，用于调试
 * 这个函数不会修改任何行为，只会记录信息
 */
function debugHtmlContent(filePath: string) {
  if (!existsSync(filePath)) {
    Logger.log(`HTML file does not exist: ${filePath}`);
    return;
  }
  
  try {
    Logger.log(`===== DEBUG HTML CONTENT: ${filePath} =====`);
    const content = readFileSync(filePath, 'utf8');
    
    // 检查文件大小
    Logger.log(`File size: ${content.length} bytes`);
    
    // 检查DOCTYPE
    const hasDoctype = content.includes('<!DOCTYPE html>');
    Logger.log(`Has DOCTYPE: ${hasDoctype}`);
    
    // 检查根元素
    const hasHtmlTag = content.includes('<html');
    Logger.log(`Has HTML tag: ${hasHtmlTag}`);
    
    // 检查head和body
    const hasHead = content.includes('<head');
    const hasBody = content.includes('<body');
    Logger.log(`Has head tag: ${hasHead}`);
    Logger.log(`Has body tag: ${hasBody}`);
    
    // 检查root元素
    const hasRoot = content.includes('id="root"');
    Logger.log(`Has root element: ${hasRoot}`);
    
    // 检查脚本引用
    const scriptMatches = content.match(/<script[^>]*src="([^"]+)"[^>]*>/g);
    Logger.log('Script references:');
    if (scriptMatches && scriptMatches.length > 0) {
      scriptMatches.forEach(match => {
        Logger.log(`- ${match}`);
      });
    } else {
      Logger.log('- No script references found');
    }
    
    // 检查内联脚本
    const inlineScriptMatches = content.match(/<script[^>]*>([\s\S]*?)<\/script>/g);
    Logger.log('Inline scripts:');
    if (inlineScriptMatches && inlineScriptMatches.length > 0) {
      Logger.log(`- Found ${inlineScriptMatches.length} inline scripts`);
    } else {
      Logger.log('- No inline scripts found');
    }
    
    // 检查CSP
    const cspMatch = content.match(/<meta[^>]*http-equiv="Content-Security-Policy"[^>]*content="([^"]+)"[^>]*>/);
    if (cspMatch) {
      Logger.log(`Content Security Policy: ${cspMatch[1]}`);
    } else {
      Logger.log('No Content Security Policy found');
    }
    
    Logger.log(`===== END DEBUG HTML CONTENT =====`);
  } catch (err) {
    Logger.log(`Error reading HTML file: ${err.message}`);
  }
}

/**
 * 调试辅助函数 - 用于跟踪窗口加载过程
 * 这个函数不会修改任何行为，只会记录信息
 */
function debugWindowLoading(windowName: string, paths: string[]) {
  Logger.log(`===== DEBUG ${windowName.toUpperCase()} WINDOW LOADING =====`);
  Logger.log(`Window: ${windowName}`);
  Logger.log(`Process type: ${process.type}`);
  Logger.log(`Is packaged: ${app.isPackaged}`);
  Logger.log(`App path: ${app.getAppPath()}`);
  
  // 检查所有可能的路径
  Logger.log('Checking possible HTML paths:');
  paths.forEach((p, index) => {
    const exists = existsSync(p);
    Logger.log(`[${index + 1}] ${p}: ${exists ? 'EXISTS' : 'NOT FOUND'}`);
    
    // 如果文件存在，检查其大小和修改时间
    if (exists) {
      try {
        const fs = require('fs');
        const stats = fs.statSync(p);
        Logger.log(`    - Size: ${stats.size} bytes`);
        Logger.log(`    - Modified: ${stats.mtime}`);
        Logger.log(`    - Created: ${stats.birthtime}`);
      } catch (err) {
        Logger.log(`    - Error getting file stats: ${err.message}`);
      }
    }
  });
  
  Logger.log(`===== END DEBUG ${windowName.toUpperCase()} WINDOW LOADING =====`);
  return paths;
}

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
   * 加载应用图标
   */
  private loadAppIcon(): Electron.NativeImage | undefined {
    try {
      // 尝试从多个位置加载应用图标
      const iconPaths = [
        join(app.getAppPath(), 'build', process.platform === 'win32' ? 'icon.ico' : process.platform === 'darwin' ? 'icon.icns' : 'icon.png'),
        join(process.env.DIST || '', 'build', process.platform === 'win32' ? 'icon.ico' : process.platform === 'darwin' ? 'icon.icns' : 'icon.png')
      ]
      
      for (const iconPath of iconPaths) {
        if (existsSync(iconPath)) {
          const icon = nativeImage.createFromPath(iconPath)
          if (!icon.isEmpty()) {
            Logger.debug({
              message: 'Custom app icon loaded',
              data: {
                path: iconPath,
                size: icon.getSize()
              }
            })
            return icon
          }
        }
      }
      
      Logger.debug('No custom app icon found, using default')
      return undefined
    } catch (error) {
      Logger.error('Failed to load custom app icon', error as Error)
      return undefined
    }
  }

  /**
   * 创建主窗口
   */
  async createMainWindow() {
    Logger.log('Creating main window...')
    const preloadPath = join(process.env.DIST_PRELOAD!, 'index.js')
    Logger.log(`preloadPath: ${preloadPath}`)
    
    // 加载应用图标
    const appIcon = this.loadAppIcon()
    
    const mainWindow = new BrowserWindow({
      width: 800,
      height: 600,
      webPreferences: {
        preload: preloadPath,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
      },
      frame: true,
      transparent: false,
      resizable: true,
      alwaysOnTop: false,
      skipTaskbar: false,
      hasShadow: true,
      show: false, // 默认不显示，等加载完成后显示
      icon: appIcon // 设置应用图标
    })

    // 设置窗口位置 - 居中显示
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize
    const x = Math.floor((screenWidth - 800) / 2)
    const y = Math.floor((screenHeight - 600) / 2)
    mainWindow.setPosition(x, y)

    // 加载页面
    if (process.env.VITE_DEV_SERVER_URL) {
      // 开发环境：使用 Vite 开发服务器
      const devUrl = `${process.env.VITE_DEV_SERVER_URL}/src/renderer/mainWindow.html`
      Logger.log(`Loading dev URL: ${devUrl}`)
      await mainWindow.loadURL(devUrl)
      if (!app.isPackaged) {
        mainWindow.webContents.openDevTools({ mode: 'detach' })
      }
    } else {
      // 生产环境：加载编译后的 HTML 文件
      // 首先尝试加载 dist/mainWindow.html
      const filePath = join(process.env.DIST_RENDERER!, 'mainWindow.html')
      Logger.log(`Loading file: ${filePath}`)
      
      try {
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }
        // 检查HTML文件内容
        debugHtmlContent(filePath);
        await mainWindow.loadFile(filePath)
      } catch (error) {
        Logger.error(`Failed to load main window from ${filePath}:`, error)
        
        // 尝试备用路径 - 检查多个可能的位置
        const possiblePaths = [
          join(process.env.DIST!, 'mainWindow.html'),
          join(process.env.DIST!, 'src/renderer/mainWindow.html'),
          join(process.env.DIST!, 'renderer/mainWindow.html')
        ]
        
        // 使用调试函数记录路径信息，但不改变路径列表
        debugWindowLoading('main', possiblePaths);
        
        let loaded = false
        for (const path of possiblePaths) {
          Logger.log(`Trying alternative path: ${path}`)
          if (existsSync(path)) {
            await mainWindow.loadFile(path)
            loaded = true
            break
          }
        }
        
        if (!loaded) {
          throw new Error(`Main window HTML file not found at any expected location`)
        }
      }
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
    
    // 加载应用图标
    const appIcon = this.loadAppIcon()
    
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
      icon: appIcon // 设置应用图标
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
      
      try {
        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }
        // 检查HTML文件内容
        debugHtmlContent(filePath);
        await settingsWindow.loadFile(filePath)
        
        if (!settingsWindow.isDestroyed()) {
          settingsWindow.show()
          settingsWindow.focus()
          Logger.debug('Settings window shown and focused after file load')
        }
      } catch (error) {
        Logger.error(`Failed to load settings window from ${filePath}:`, error)
        
        // 尝试备用路径 - 检查多个可能的位置
        const possiblePaths = [
          join(process.env.DIST!, 'settingsWindow.html'),
          join(process.env.DIST!, 'src/renderer/settingsWindow.html'),
          join(process.env.DIST!, 'renderer/settingsWindow.html')
        ]
        
        // 使用调试函数记录路径信息，但不改变路径列表
        debugWindowLoading('settings', possiblePaths);
        
        let loaded = false
        for (const path of possiblePaths) {
          Logger.log(`Trying alternative path: ${path}`)
          if (existsSync(path)) {
            await settingsWindow.loadFile(path)
            loaded = true
            
            if (!settingsWindow.isDestroyed()) {
              settingsWindow.show()
              settingsWindow.focus()
              Logger.debug('Settings window shown and focused after alternative file load')
            }
            break
          }
        }
        
        if (!loaded) {
          throw new Error(`Settings window HTML file not found at any expected location`)
        }
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