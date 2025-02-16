import { app, ipcMain } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { ShunshotCoreBridge } from '../types/shunshotBridge'
import { IShunshotCoreAPI } from '../types/electron'
import { handlers } from './handlers'
import { mgrWindows } from './mgrWindows'
import { mgrShortcut } from './shortcut'
import { mgrTray } from './trayMenu'
import { mgrPreference } from './mgrPreference'
import { initTransLog } from './translog' 

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.js    > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.DIST_MAIN = __dirname
process.env.DIST = join(__dirname, '..')
process.env.DIST_PRELOAD = join(process.env.DIST, 'preload')
process.env.DIST_RENDERER = join(process.env.DIST, 'src/renderer')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_MAIN, '../public')
  : process.env.DIST

Logger.log('Environment variables: ' + JSON.stringify({
  DIST: process.env.DIST,
  DIST_MAIN: process.env.DIST_MAIN,
  DIST_PRELOAD: process.env.DIST_PRELOAD,
  DIST_RENDERER: process.env.DIST_RENDERER,
  VITE_PUBLIC: process.env.VITE_PUBLIC,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
}))

// 禁用 Windows 7 的 GPU 加速
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// 安装调试工具
if (!app.isPackaged) {
  app.whenReady().then(async () => {
    try {
      Logger.log('Installing dev tools...')
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer')
      await installExtension(REACT_DEVELOPER_TOOLS)
      Logger.log('React DevTools installed successfully')
    } catch (err) {
      Logger.error('Failed to install extension', err instanceof Error ? err : new Error(String(err)))
    }
  })
}

// 创建 Bridge 实例
const bridge = new ShunshotCoreBridge()

// 注册主进程处理器
bridge.registerMainHandlers(ipcMain, handlers)

// 应用程序初始化
app.whenReady().then(async () => {
  Logger.log('App ready, initializing...')
  
  try {
    // 初始化日志系统
    initTransLog()
    
    // 创建主窗口
    await mgrWindows.createMainWindow()
    
    // 创建系统托盘
    try {
      const tray = mgrTray.createTray()
      if (!tray) {
        throw new Error('Failed to create tray')
      }
      Logger.log('Tray created successfully')
    } catch (error) {
      Logger.error('Failed to create tray', error as Error)
      // 托盘创建失败不阻止应用继续运行
    }
    
    // 注册快捷键
    mgrShortcut.registerShortcuts()
    
    // 监听配置变更
    mgrPreference.subscribe((key, value) => {
      if (key === 'system.captureShortcut') {
        mgrShortcut.unregisterAll()
        mgrShortcut.registerShortcuts()
      }
    })
    
    Logger.log('App initialization completed')
  } catch (error) {
    Logger.error('Failed to initialize app', error as Error)
    app.quit()
  }
})

// 清理所有资源
const cleanup = () => {
  Logger.log('Cleaning up resources...')
  
  // 注销所有快捷键
  mgrShortcut.unregisterAll()
  
  // 关闭所有窗口
  const windows = [
    mgrWindows.getMainWindow(),
    mgrWindows.getCaptureWindow(),
    mgrWindows.getSettingsWindow()
  ]
  
  windows.forEach(window => {
    if (window && !window.isDestroyed()) {
      window.close()
    }
  })
  
  // 销毁托盘
  mgrTray.destroy()
  
  Logger.log('Cleanup completed')
}

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  Logger.log('All windows closed')
  cleanup()
  app.quit()
})

app.on('before-quit', () => {
  Logger.log('Application is quitting')
  cleanup()
})

app.on('activate', async () => {
  Logger.log('App activated')
  if (!mgrWindows.getMainWindow()) {
    try {
      await mgrWindows.createMainWindow()
    } catch (error) {
      Logger.error('Failed to create main window on activate', error as Error)
    }
  }
}) 