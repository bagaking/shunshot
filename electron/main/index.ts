import { app, BrowserWindow, ipcMain, globalShortcut, screen, desktopCapturer, clipboard } from 'electron'
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

// 存储当前截图数据
let currentCaptureData: {
  fullImage: Electron.NativeImage;
  bounds: { x: number; y: number; width: number; height: number };
} | null = null;

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
    console.log('Screen capture source:', {
      id: primarySource.id,
      name: primarySource.name,
      thumbnailSize: {
        width: primarySource.thumbnail.getSize().width,
        height: primarySource.thumbnail.getSize().height
      }
    })

    // 保存原始图像
    currentCaptureData = {
      fullImage: primarySource.thumbnail,
      bounds: totalBounds
    }
    console.log('Saved original capture data:', {
      imageSize: {
        width: currentCaptureData.fullImage.getSize().width,
        height: currentCaptureData.fullImage.getSize().height
      },
      bounds: currentCaptureData.bounds
    })
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
      backgroundColor: '#00000000', // 确保背景透明
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
        // 先发送截图数据
        captureWindow.webContents.send('SCREEN_CAPTURE_DATA', {
          imageData: thumbnail,
          displayInfo: {
            bounds: totalBounds,
            scaleFactor: primaryDisplay.scaleFactor
          }
        })

        // 确保窗口在最顶层
        captureWindow.moveTop()
        captureWindow.focus()

        // 发送开始截图消息
        console.log('Sending START_CAPTURE event')
        captureWindow.webContents.send('START_CAPTURE')
      }
    })

    // 开发工具
    if (!app.isPackaged) {
      captureWindow.webContents.openDevTools({ mode: 'detach' })
    }

    // 构建加载 URL
    let loadUrl: string
    if (process.env.VITE_DEV_SERVER_URL) {
      // 开发环境：使用 vite 开发服务器
      loadUrl = `${process.env.VITE_DEV_SERVER_URL}/src/renderer/capture.html`
      console.log('Development mode, loading from:', loadUrl)
    } else {
      // 生产环境：使用打包后的文件
      loadUrl = `file://${join(process.env.DIST, 'capture.html')}`
      console.log('Production mode, loading from:', loadUrl)
    }

    console.log('Loading URL:', loadUrl)
    
    try {
      await captureWindow.loadURL(loadUrl)
      console.log('URL loaded successfully')
    } catch (error) {
      console.error('Failed to load URL:', error)
      console.error('Current working directory:', process.cwd())
      console.error('DIST path:', process.env.DIST)
      throw error // 确保错误被传播
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
ipcMain.handle('SCREENSHOT_CAPTURE', async () => {
  console.log('Screenshot capture requested via IPC')
  try {
    if (mainWindow) {
      mainWindow.hide()
    }
    await createCaptureWindow()
  } catch (error) {
    console.error('Failed to handle screenshot request:', error)
    // 如果出错，显示主窗口
    if (mainWindow) {
      mainWindow.show()
    }
    throw error // 将错误传递给渲染进程
  }
})

// 处理插件相关的 IPC 通信
ipcMain.handle('PLUGIN_LOAD', async (event, pluginId: string) => {
  // TODO: 实现插件加载
})

// IPC 事件处理
ipcMain.on('CANCEL_CAPTURE', () => {
  console.log('Received CANCEL_CAPTURE event')
  if (captureWindow) {
    captureWindow.close()
    captureWindow = null
  }
  if (mainWindow) {
    mainWindow.show()
  }
})

ipcMain.handle('COMPLETE_CAPTURE', async (event, bounds) => {
  console.log('Received COMPLETE_CAPTURE event with bounds:', bounds)
  try {
    if (!captureWindow || !currentCaptureData) {
      throw new Error('No capture window or capture data available')
    }

    console.log('Current capture data:', {
      imageSize: {
        width: currentCaptureData.fullImage.getSize().width,
        height: currentCaptureData.fullImage.getSize().height
      },
      bounds: currentCaptureData.bounds
    })

    // 验证边界值
    if (bounds.x < 0 || bounds.y < 0 || 
        bounds.width <= 0 || bounds.height <= 0 ||
        bounds.x + bounds.width > currentCaptureData.fullImage.getSize().width ||
        bounds.y + bounds.height > currentCaptureData.fullImage.getSize().height) {
      throw new Error(`Invalid bounds: ${JSON.stringify(bounds)} for image size ${JSON.stringify(currentCaptureData.fullImage.getSize())}`)
    }

    // 更新选区范围
    currentCaptureData.bounds = bounds
    console.log('Updated capture data bounds:', currentCaptureData.bounds)

    // 关闭截图窗口
    captureWindow.close()
    captureWindow = null

    // 显示主窗口
    if (mainWindow) {
      mainWindow.show()
    }

    return true
  } catch (error) {
    console.error('Failed to complete capture:', error)
    // 如果出错，显示主窗口
    if (mainWindow) {
      mainWindow.show()
    }
    throw error
  }
})

ipcMain.handle('COPY_TO_CLIPBOARD', async (event, bounds) => {
  console.log('Received COPY_TO_CLIPBOARD event with bounds:', bounds)
  try {
    if (!currentCaptureData?.fullImage) {
      throw new Error('No capture image available')
    }

    const fullImage = currentCaptureData.fullImage
    console.log('Preparing to crop image:', {
      fullImageSize: {
        width: fullImage.getSize().width,
        height: fullImage.getSize().height
      },
      cropBounds: bounds
    })

    // 检查边界值是否合理
    if (bounds.x < 0 || bounds.y < 0 || 
        bounds.width <= 0 || bounds.height <= 0 ||
        bounds.x + bounds.width > fullImage.getSize().width ||
        bounds.y + bounds.height > fullImage.getSize().height) {
      throw new Error(`Invalid crop bounds: ${JSON.stringify(bounds)} for image size ${JSON.stringify(fullImage.getSize())}`)
    }

    // 从原始图像中裁剪选中区域
    const croppedImage = fullImage.crop(bounds)
    console.log('Cropped image size:', croppedImage.getSize())
    
    try {
      // 清除剪贴板
      console.log('Clearing clipboard...')
      clipboard.clear()
      
      // 复制到剪贴板
      console.log('Writing image to clipboard...')
      clipboard.writeImage(croppedImage)
      
      // 验证是否成功复制
      console.log('Verifying clipboard content...')
      const clipboardImage = clipboard.readImage()
      const clipboardSize = clipboardImage.getSize()
      console.log('Clipboard image size:', clipboardSize)
      
      if (clipboardSize.width === 0 || clipboardSize.height === 0) {
        throw new Error('Failed to copy image to clipboard - image size is zero')
      }
      
      // 验证图片尺寸是否匹配
      if (clipboardSize.width !== croppedImage.getSize().width || 
          clipboardSize.height !== croppedImage.getSize().height) {
        throw new Error(`Clipboard image size mismatch - expected: ${JSON.stringify(croppedImage.getSize())}, got: ${JSON.stringify(clipboardSize)}`)
      }
      
      console.log('Image copied to clipboard successfully')
    } catch (clipboardError) {
      console.error('Clipboard operation failed:', clipboardError)
      
      // 尝试使用备用方法
      console.log('Trying alternative clipboard method...')
      const pngBuffer = croppedImage.toPNG()
      const alternativeImage = require('electron').nativeImage.createFromBuffer(pngBuffer)
      clipboard.writeImage(alternativeImage)
      
      // 再次验证
      const clipboardImage = clipboard.readImage()
      const clipboardSize = clipboardImage.getSize()
      console.log('Clipboard image size (alternative method):', clipboardSize)
      
      if (clipboardSize.width === 0 || clipboardSize.height === 0) {
        throw new Error('Failed to copy image to clipboard (alternative method)')
      }
    }
    
    // 清除当前截图数据
    currentCaptureData = null
    console.log('Cleared capture data')
    
    return true
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
    throw error
  }
})

// 处理日志
ipcMain.on('LOG', (event, level: 'log' | 'info' | 'warn' | 'error', ...args) => {
  const windowType = event.sender === mainWindow?.webContents ? 'main' : 
                    event.sender === captureWindow?.webContents ? 'capture' : 
                    'unknown'
  
  const timestamp = new Date().toISOString()
  const prefix = `[${timestamp}] [${windowType}]`
  
  switch (level) {
    case 'log':
      console.log(prefix, ...args)
      break
    case 'info':
      console.info(prefix, ...args)
      break
    case 'warn':
      console.warn(prefix, ...args)
      break
    case 'error':
      console.error(prefix, ...args)
      break
  }
}) 