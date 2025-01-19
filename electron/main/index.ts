import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer } from 'electron'
import { join } from 'path'

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

// 创建截图窗口
const createCaptureWindow = async () => {
  console.log('Creating capture window...')
  const displays = screen.getAllDisplays()
  const primaryDisplay = screen.getPrimaryDisplay()
  
  // 计算所有显示器的总边界（包括工作区域之外的部分）
  const totalBounds = {
    x: Math.min(...displays.map(d => d.bounds.x)),
    y: Math.min(...displays.map(d => d.bounds.y)),
    width: Math.max(...displays.map(d => d.bounds.x + d.bounds.width)) - Math.min(...displays.map(d => d.bounds.x)),
    height: Math.max(...displays.map(d => d.bounds.y + d.bounds.height)) - Math.min(...displays.map(d => d.bounds.y))
  }

  console.log('Total screen bounds:', totalBounds)
  console.log('Primary display:', {
    bounds: primaryDisplay.bounds,
    workArea: primaryDisplay.workArea,
    scaleFactor: primaryDisplay.scaleFactor
  })

  // 如果已存在截图窗口，先关闭
  if (captureWindow) {
    console.log('Closing existing capture window...')
    captureWindow.close()
    captureWindow = null
  }

  try {
    // 先获取屏幕截图
    console.log('Capturing screen content...')
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
    const thumbnail = primarySource.thumbnail.toDataURL()
    console.log('Screen content captured')

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
    })

    console.log('Capture window created')

    // macOS 特定设置
    if (process.platform === 'darwin') {
      // 确保窗口在所有工作区可见，包括全屏应用
      captureWindow.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true
      })
      
      // 设置窗口层级为屏幕保护程序级别，确保在菜单栏之上
      captureWindow.setAlwaysOnTop(true, 'screen-saver', 1)
    } else {
      // 其他平台使用最高层级
      captureWindow.setAlwaysOnTop(true, 'pop-up-menu', 1)
    }

    // 设置窗口接收鼠标事件
    captureWindow.setIgnoreMouseEvents(false)

    // 监听窗口加载错误
    captureWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
      console.error('Capture window failed to load:', { errorCode, errorDescription })
    })

    // 监听页面加载完成
    captureWindow.webContents.on('did-finish-load', () => {
      console.log('Capture window loaded successfully')
      if (captureWindow) {
        console.log('Sending screen capture data')
        captureWindow.webContents.send('SCREEN_CAPTURE_DATA', {
          imageData: thumbnail,
          displayInfo: {
            bounds: totalBounds,
            scaleFactor: primaryDisplay.scaleFactor
          }
        })
        
        // 确保窗口在最顶层
        captureWindow.moveTop()
      }
    })

    // 开发工具
    if (!app.isPackaged) {
      captureWindow.webContents.openDevTools({ mode: 'detach' })
    }

    const loadUrl = process.env.VITE_DEV_SERVER_URL 
      ? `${process.env.VITE_DEV_SERVER_URL}#/capture`
      : `file://${join(process.env.DIST, 'index.html')}#/capture`

    console.log('Loading URL:', loadUrl)
    
    try {
      await captureWindow.loadURL(loadUrl)
      console.log('URL loaded successfully')
    } catch (error) {
      console.error('Failed to load URL:', error)
    }

    // 截图窗口准备好后显示
    captureWindow.once('ready-to-show', () => {
      console.log('Capture window ready to show')
      if (captureWindow) {
        captureWindow.show()
        captureWindow.focus()
        // 发送开始截图消息
        console.log('Sending START_CAPTURE event')
        captureWindow.webContents.send('START_CAPTURE')
        
        // 再次确保窗口在最顶层
        captureWindow.moveTop()
      }
    })

    // 监听窗口关闭
    captureWindow.on('closed', () => {
      console.log('Capture window closed')
      captureWindow = null
    })

  } catch (error) {
    console.error('Failed to create capture window:', error)
  }
}

const createWindow = async () => {
  console.log('Creating main window...')
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
  const ret = globalShortcut.register(shortcut, () => {
    console.log('Screenshot shortcut triggered')
    if (mainWindow) {
      console.log('Hiding main window')
      mainWindow.hide() // 隐藏主窗口
    }
    createCaptureWindow() // 创建截图窗口
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
ipcMain.handle('SCREENSHOT_CAPTURE', async () => {
  console.log('Screenshot capture requested via IPC')
  if (mainWindow) {
    mainWindow.hide()
  }
  createCaptureWindow()
})

// 处理插件相关的 IPC 通信
ipcMain.handle('PLUGIN_LOAD', async (event, pluginId: string) => {
  // TODO: 实现插件加载
})

// 处理取消截图
ipcMain.handle('CANCEL_CAPTURE', () => {
  console.log('Screenshot cancelled')
  if (captureWindow) {
    captureWindow.close()
    captureWindow = null
  }
  if (mainWindow) {
    mainWindow.show()
  }
})

// 处理完成截图
ipcMain.handle('COMPLETE_CAPTURE', async (event, bounds: { x: number, y: number, width: number, height: number }) => {
  console.log('Screenshot completed with bounds:', bounds)
  // TODO: 实现实际的截图功能
  if (captureWindow) {
    captureWindow.close()
    captureWindow = null
  }
  if (mainWindow) {
    mainWindow.show()
  }
}) 