import { app, ipcMain } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { ShunshotCoreBridge } from '../../src/types/shunshotBridge'
import { IShunshotCoreAPI } from '../../src/types/electron'
import { handlers } from './handlers'
import { mgrWindows } from './mgrWindows'
import { mgrShortcut } from './shortcut'
import { mgrTray } from './trayMenu'
import { initTransLog } from './translog'
import { BrowserWindow } from 'electron'

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
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../renderer')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

Logger.log('Environment variables: ' + JSON.stringify({
  DIST_ELECTRON: process.env.DIST_ELECTRON,
  DIST: process.env.DIST,
  VITE_PUBLIC: process.env.VITE_PUBLIC,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
}))

// 禁用 Windows 7 的 GPU 加速
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// 安装调试工具
if (!app.isPackaged) {
  app.whenReady().then(() => {
    Logger.log('Installing dev tools...')
    import('electron-devtools-installer').then(({ default: installExtension, REACT_DEVELOPER_TOOLS }) => {
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => Logger.log(`Added Extension: ${JSON.stringify(name)}`))
        .catch((err) => Logger.error('Failed to install extension', err as Error))
    })
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
    
    // 设置托盘菜单管理器
    mgrWindows.setMenuManager(mgrTray)
    
    // 创建系统托盘
    mgrWindows.createTray()
    
    // 注册快捷键
    mgrShortcut.registerShortcuts()
    
    Logger.log('App initialization completed')
  } catch (error) {
    Logger.error('Failed to initialize app', error as Error)
    app.quit()
  }
})

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  Logger.log('All windows closed')
  // 注销所有快捷键
  mgrShortcut.unregisterAll()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
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