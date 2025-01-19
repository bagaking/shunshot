import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, clipboard } from 'electron'
import { join } from 'path'
import { CHANNELS } from '../../src/types/ipc'
import { Logger } from './logger'

// 设置环境变量
process.env.DIST_ELECTRON = join(__dirname, '..')
process.env.DIST = join(process.env.DIST_ELECTRON, '../renderer')
process.env.VITE_PUBLIC = process.env.VITE_DEV_SERVER_URL
  ? join(process.env.DIST_ELECTRON, '../public')
  : process.env.DIST

console.log('Environment variables:', {
  DIST_ELECTRON: process.env.DIST_ELECTRON,
  DIST: process.env.DIST,
  VITE_PUBLIC: process.env.VITE_PUBLIC,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
})

// 禁用 Windows 7 的 GPU 加速
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// 安装调试工具
if (!app.isPackaged) {
  app.whenReady().then(() => {
    console.log('Installing dev tools...')
    import('electron-devtools-installer').then(({ default: installExtension, REACT_DEVELOPER_TOOLS }) => {
      installExtension(REACT_DEVELOPER_TOOLS)
        .then((name) => console.log(`Added Extension: ${name}`))
        .catch((err) => console.log('An error occurred: ', err))
    })
  })
}

let mainWindow: BrowserWindow | null = null
let captureWindow: BrowserWindow | null = null

// 存储当前截图数据
let currentCaptureData: {
  fullImage: Electron.NativeImage;
  bounds: { x: number; y: number; width: number; height: number };
} | null = null;

// 创建截图窗口
const createCaptureWindow = async () => {
  Logger.log('Creating capture window...')
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  
  // 计算所有显示器的总边界
  const totalBounds = {
    x: Math.min(...displays.map(d => d.bounds.x)),
    y: Math.min(...displays.map(d => d.bounds.y)),
    width: Math.max(...displays.map(d => d.bounds.x + d.bounds.width)) - Math.min(...displays.map(d => d.bounds.x)),
    height: Math.max(...displays.map(d => d.bounds.y + d.bounds.height)) - Math.min(...displays.map(d => d.bounds.y))
  }

  Logger.debug({ totalBounds, primaryDisplay: { bounds: primaryDisplay.bounds, scaleFactor: primaryDisplay.scaleFactor } })

  if (captureWindow) {
    Logger.log('Closing existing capture window...')
    captureWindow.close()
    captureWindow = null
  }

  try {
    // 获取屏幕截图
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.round(totalBounds.width * primaryDisplay.scaleFactor),
        height: Math.round(totalBounds.height * primaryDisplay.scaleFactor)
      }
    })

    if (!sources || sources.length === 0) {
      throw new Error('No screen sources found')
    }

    const primarySource = sources[0]
    const thumbnail = primarySource.thumbnail
    Logger.debug({ sourceId: primarySource.id, thumbnailSize: thumbnail.getSize() })

    // 保存原始图像
    currentCaptureData = {
      fullImage: thumbnail,
      bounds: totalBounds
    }

    // 创建截图窗口
    captureWindow = new BrowserWindow({
      x: totalBounds.x,
      y: totalBounds.y,
      width: totalBounds.width,
      height: totalBounds.height,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      fullscreenable: false,
      hasShadow: false,
      enableLargerThanScreen: true,
      type: 'panel',
      webPreferences: {
        preload: join(process.env.DIST_ELECTRON, 'preload/index.js'),
        nodeIntegration: true,
        contextIsolation: true,
        webSecurity: false,
      },
      backgroundColor: '#00000000',
    })

    // macOS 特定设置
    if (process.platform === 'darwin') {
      captureWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
      captureWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    } else {
      captureWindow.setAlwaysOnTop(true, 'pop-up-menu', 1)
    }

    captureWindow.setIgnoreMouseEvents(false)

    // 监听窗口事件
    captureWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      Logger.error('Capture window failed to load', new Error(`Error ${errorCode}: ${errorDescription}`), captureWindow?.webContents || null, mainWindow, captureWindow)
    })

    captureWindow.webContents.on('did-finish-load', () => {
      if (!captureWindow) return
      
      // 发送截图数据
      captureWindow.webContents.send(CHANNELS.SCREEN_CAPTURE_DATA, {
        imageData: primarySource.thumbnail.toDataURL(),
        displayInfo: {
          bounds: totalBounds,
          scaleFactor: primaryDisplay.scaleFactor
        }
      })

      captureWindow.moveTop()
      captureWindow.focus()
      captureWindow.webContents.send(CHANNELS.START_CAPTURE)
    })

    // 开发工具
    if (!app.isPackaged) {
      captureWindow.webContents.openDevTools({ mode: 'detach' })
    }

    // 加载页面
    const loadUrl = process.env.VITE_DEV_SERVER_URL
      ? `${process.env.VITE_DEV_SERVER_URL}/src/renderer/capture.html`
      : `file://${join(process.env.DIST, 'capture.html')}`

    try {
      await captureWindow.loadURL(loadUrl)
    } catch (error) {
      Logger.error('Failed to load URL', error)
      throw error
    }

    // 窗口准备好后显示
    captureWindow.once('ready-to-show', () => {
      if (!captureWindow) return
      captureWindow.show()
      captureWindow.focus()
      captureWindow.moveTop()
    })

    captureWindow.on('closed', () => {
      Logger.log('Capture window closed')
      captureWindow = null
    })

  } catch (error) {
    Logger.error('Failed to create capture window', error)
    throw error
  }
}

const createWindow = async () => {
  Logger.log('Creating main window...')
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(process.env.DIST_ELECTRON, 'preload/index.js'),
      nodeIntegration: true,
      contextIsolation: true,
    },
  })

  // 加载页面
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(process.env.DIST, 'index.html'))
  }

  console.log('Main window created')
}

// 注册全局快捷键
const registerShortcuts = () => {
  console.log('Registering global shortcuts...')
  // 根据平台设置默认快捷键
  const shortcut = process.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X'
  
  // 注册快捷键
  const ret = globalShortcut.register(shortcut, async () => {
    console.log('Screenshot shortcut triggered')
    try {
      // 隐藏主窗口
      if (mainWindow) {
        console.log('Hiding main window')
        mainWindow.hide()
      }
      // 创建截图窗口
      await createCaptureWindow()
    } catch (error) {
      console.error('Failed to handle screenshot shortcut:', error)
      // 如果出错，显示主窗口
      if (mainWindow) {
        mainWindow.show()
      }
    }
  })

  if (!ret) {
    console.error('Failed to register shortcut:', shortcut)
  } else {
    console.log('Shortcut registered successfully:', shortcut)
  }
}

app.whenReady().then(() => {
  console.log('App ready, initializing...')
  createWindow()
  registerShortcuts()
})

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  console.log('All windows closed')
  // 注销所有快捷键
  globalShortcut.unregisterAll()
  
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  console.log('App activated')
  if (mainWindow === null) {
    createWindow()
  }
})

// 处理截图相关的 IPC 通信
ipcMain.handle(CHANNELS.SCREENSHOT_CAPTURE, async (event) => {
  Logger.log('Screenshot capture requested', event.sender, mainWindow, captureWindow)
  
  try {
    await createCaptureWindow()
  } catch (error) {
    Logger.error('Failed to handle screenshot capture', error as Error, event.sender, mainWindow, captureWindow)
  }
})

// 处理插件相关的 IPC 通信
ipcMain.handle(CHANNELS.PLUGIN_LOAD, async (event, pluginId: string) => {
  // TODO: 实现插件加载
})

// 处理截图取消
ipcMain.on(CHANNELS.CANCEL_CAPTURE, (event) => {
  Logger.log('Received CANCEL_CAPTURE event', event.sender, mainWindow, captureWindow)
  
  // 清理资源
  currentCaptureData = null
  Logger.log('Cleaned up capture data', event.sender, mainWindow, captureWindow)

  // 关闭截图窗口
  if (captureWindow) {
    captureWindow.close()
  }
})

ipcMain.handle(CHANNELS.COMPLETE_CAPTURE, async (event, bounds) => {
  Logger.log('Received COMPLETE_CAPTURE event', event.sender, mainWindow, captureWindow)
  
  if (!currentCaptureData) {
    Logger.error('No capture data available', null, event.sender, mainWindow, captureWindow)
    return
  }

  try {
    const { fullImage } = currentCaptureData
    const { x, y, width, height } = bounds

    // 创建裁剪后的图像
    const croppedImage = fullImage.crop({ x, y, width, height })
    Logger.debug({ croppedBounds: bounds, imageSize: croppedImage.getSize() })

    // 将图像写入剪贴板
    clipboard.writeImage(croppedImage)
    Logger.log('Image copied to clipboard', event.sender, mainWindow, captureWindow)

    // 清理资源
    currentCaptureData = null
    Logger.log('Cleaned up capture data', event.sender, mainWindow, captureWindow)

    // 关闭截图窗口
    if (captureWindow) {
      captureWindow.close()
    }
  } catch (error) {
    Logger.error('Failed to process capture', error as Error, event.sender, mainWindow, captureWindow)
  }
})

ipcMain.handle(CHANNELS.COPY_TO_CLIPBOARD, async (event, bounds) => {
  Logger.log('Received COPY_TO_CLIPBOARD event', event.sender, mainWindow, captureWindow)
  
  if (!currentCaptureData) {
    Logger.error('No capture data available', null, event.sender, mainWindow, captureWindow)
    return
  }

  try {
    const { fullImage } = currentCaptureData
    const { x, y, width, height } = bounds

    // 创建裁剪后的图像
    const croppedImage = fullImage.crop({ x, y, width, height })
    Logger.debug({ croppedBounds: bounds, imageSize: croppedImage.getSize() })

    // 将图像写入剪贴板
    clipboard.writeImage(croppedImage)
    Logger.log('Image copied to clipboard', event.sender, mainWindow, captureWindow)
  } catch (error) {
    Logger.error('Failed to copy to clipboard', error as Error, event.sender, mainWindow, captureWindow)
  }
})

// 处理日志
ipcMain.on(CHANNELS.LOG, (event, level: 'log' | 'info' | 'warn' | 'error', ...args) => {
  switch (level) {
    case 'log':
      Logger.log(args.join(' '), event.sender, mainWindow, captureWindow)
      break
    case 'info':
      Logger.info(args.join(' '), event.sender, mainWindow, captureWindow)
      break
    case 'warn':
      Logger.warn(args.join(' '), event.sender, mainWindow, captureWindow)
      break
    case 'error':
      Logger.error(args.join(' '), null, event.sender, mainWindow, captureWindow)
      break
  }
}) 