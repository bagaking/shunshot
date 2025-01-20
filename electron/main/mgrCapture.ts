import { app, BrowserWindow, desktopCapturer, screen } from 'electron'
import type { NativeImage } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'

/**
 * 截图管理器
 */
export class CaptureManager {
  private currentData: {
    fullImage: NativeImage;
    bounds: { x: number; y: number; width: number; height: number };
  } | null = null

  getCurrentData() {
    return this.currentData
  }

  setCurrentData(data: typeof this.currentData) {
    this.currentData = data
  }

  /**
   * 创建截图窗口
   */
  async createCaptureWindow() {
    Logger.log('Creating capture window...')
    const displays = screen.getAllDisplays()
    const primaryDisplay = screen.getPrimaryDisplay()
    
    // 获取当前鼠标所在的屏幕
    const mousePoint = screen.getCursorScreenPoint()
    const focusedDisplay = screen.getDisplayNearestPoint(mousePoint)
    Logger.debug(`Mouse position and focused display: ${JSON.stringify({ mousePoint, focusedDisplay: focusedDisplay.bounds })}`)
    
    // 计算所有显示器的总边界
    const totalBounds = {
      x: Math.min(...displays.map(d => d.bounds.x)),
      y: Math.min(...displays.map(d => d.bounds.y)),
      width: Math.max(...displays.map(d => d.bounds.x + d.bounds.width)) - Math.min(...displays.map(d => d.bounds.x)),
      height: Math.max(...displays.map(d => d.bounds.y + d.bounds.height)) - Math.min(...displays.map(d => d.bounds.y))
    }

    Logger.debug({ totalBounds, primaryDisplay: { bounds: primaryDisplay.bounds, scaleFactor: primaryDisplay.scaleFactor } })

    const existingWindow = mgrWindows.getCaptureWindow()
    if (existingWindow) {
      Logger.log('Closing existing capture window...')
      existingWindow.close()
      mgrWindows.setCaptureWindow(null)
    }

    try {
      // 获取屏幕截图
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: Math.round(totalBounds.width * focusedDisplay.scaleFactor),
          height: Math.round(totalBounds.height * focusedDisplay.scaleFactor)
        }
      })

      if (!sources || sources.length === 0) {
        throw new Error('No screen sources found')
      }

      // 找到当前聚焦屏幕对应的源
      const focusedSource = sources.find(source => {
        const sourceDisplay = displays.find(display => 
          source.display_id === display.id?.toString() || 
          source.id.includes(display.id?.toString() || '')
        )
        return sourceDisplay?.id === focusedDisplay.id
      }) || sources[0]

      const thumbnail = focusedSource.thumbnail
      Logger.debug({ sourceId: focusedSource.id, thumbnailSize: thumbnail.getSize() })

      // 保存原始图像和聚焦屏幕信息
      this.setCurrentData({
        fullImage: thumbnail,
        bounds: focusedDisplay.bounds
      })

      // 创建截图窗口 - 使用聚焦屏幕的位置和大小
      const captureWindow = new BrowserWindow({
        x: focusedDisplay.bounds.x,
        y: focusedDisplay.bounds.y,
        width: focusedDisplay.bounds.width,
        height: focusedDisplay.bounds.height,
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
          preload: join(process.env.DIST_ELECTRON!, 'preload/index.js'),
          nodeIntegration: true,
          contextIsolation: true,
          webSecurity: false,
        },
        backgroundColor: '#00000000',
      })

      mgrWindows.setCaptureWindow(captureWindow)

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
        Logger.error('Capture window failed to load', new Error(`Error ${errorCode}: ${errorDescription}`))
      })

      captureWindow.webContents.on('did-finish-load', () => {
        const currentWindow = mgrWindows.getCaptureWindow()
        if (!currentWindow) return
        
        currentWindow.webContents.send('START_CAPTURE')
        currentWindow.webContents.send('SCREEN_CAPTURE_DATA', {
          imageData: thumbnail.toDataURL(),
          displayInfo: {
            bounds: focusedDisplay.bounds,
            scaleFactor: focusedDisplay.scaleFactor
          }
        })

        currentWindow.moveTop()
        currentWindow.focus()
      })

      // 开发工具
      if (!app.isPackaged) {
        captureWindow.webContents.openDevTools({ mode: 'detach' })
      }

      // 加载页面
      const loadUrl = process.env.VITE_DEV_SERVER_URL
        ? `${process.env.VITE_DEV_SERVER_URL}/src/renderer/capture.html`
        : `file://${join(process.env.DIST!, 'capture.html')}`

      try {
        await captureWindow.loadURL(loadUrl)
      } catch (error) {
        Logger.error('Failed to load URL', error)
        throw error
      }

      // 窗口准备好后显示
      captureWindow.once('ready-to-show', () => {
        const currentWindow = mgrWindows.getCaptureWindow()
        if (!currentWindow) return
        currentWindow.show()
        currentWindow.focus()
        currentWindow.moveTop()
      })

      captureWindow.on('closed', () => {
        Logger.log('Capture window closed')
        mgrWindows.setCaptureWindow(null)
      })

    } catch (error) {
      Logger.error('Failed to create capture window', error)
      throw error
    }
  }
}

// 创建单例
export const mgrCapture = new CaptureManager() 