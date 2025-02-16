import { app, BrowserWindow, desktopCapturer, screen, Display, NativeImage } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { SHUNSHOT_BRIDGE_PREFIX } from '../../src/types/shunshotBridge'
import { CaptureData } from '../../src/renderer/types/capture'

/**
 * 截图管理器
 */
export class CaptureManager {
  private currentData: {
    fullImage: NativeImage;
    bounds: { x: number; y: number; width: number; height: number };
  } | null = null

  private startSubscribers: Set<() => void> = new Set()
  private dataSubscribers: Set<(data: CaptureData) => void> = new Set()
  private cleanupSubscribers: Set<() => void> = new Set()

  // Update timeout constants
  private readonly WINDOW_CREATE_TIMEOUT = 5000; // 5 seconds
  private readonly URL_LOAD_TIMEOUT = 3000; // 3 seconds
  private readonly READY_SHOW_TIMEOUT = 3000; // 3 seconds
  private readonly DATA_SEND_TIMEOUT = 2000; // 2 seconds
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 500; // 0.5 second

  getCurrentData() {
    return this.currentData
  }

  onStart(callback: () => void): () => void {
    this.startSubscribers.add(callback)
    return () => this.startSubscribers.delete(callback)
  }

  onData(callback: (data: CaptureData) => void): () => void {
    this.dataSubscribers.add(callback)
    return () => this.dataSubscribers.delete(callback)
  }

  onCleanup(callback: () => void): () => void {
    this.cleanupSubscribers.add(callback)
    return () => this.cleanupSubscribers.delete(callback)
  }

  private notifyStartSubscribers(): void {
    this.startSubscribers.forEach(callback => {
      try {
        callback()
      } catch (error) {
        Logger.error('Error in start subscriber', error as Error)
      }
    })
  }

  private notifyDataSubscribers(data: CaptureData): void {
    this.dataSubscribers.forEach(callback => {
      try {
        callback(data)
      } catch (error) {
        Logger.error('Error in data subscriber', error as Error)
      }
    })
  }

  private notifyCleanupSubscribers(): void {
    this.cleanupSubscribers.forEach(callback => {
      try {
        callback()
      } catch (error) {
        Logger.error('Error in cleanup subscriber', error as Error)
      }
    })
  }

  setCurrentData(data: {
    fullImage: NativeImage;
    bounds: { x: number; y: number; width: number; height: number };
  } | null) {
    this.currentData = data
    if (data === null) {
      // 当数据被清理时通知订阅者
      this.notifyCleanupSubscribers()
    }
  }

  /**
   * Create a promise that rejects after a timeout
   */
  private createTimeout(ms: number, operation: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms: ${operation}`))
      }, ms)
    })
  }

  /**
   * Cleanup resources when window creation fails
   */
  private handleWindowCreationFailure(error: Error, captureWindow?: BrowserWindow | null) {
    Logger.error('Failed to create capture window', error)
    
    if (captureWindow) {
      try {
        captureWindow.close()
      } catch (closeError) {
        Logger.error('Error closing failed capture window', closeError as Error)
      }
    }
    
    mgrWindows.setCaptureWindow(null)
    this.setCurrentData(null)
    
    throw error
  }

  /**
   * Retry a function with delay
   * @param operation The async operation to retry
   * @returns A promise that resolves with the operation result
   */
  private async retryWithDelay<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        const result = await operation();
        return result;
      } catch (error) {
        lastError = error as Error;
        Logger.warn(`Attempt ${attempt} failed: ${error}`);
        
        const isLastAttempt = attempt === this.MAX_RETRIES;
        if (!isLastAttempt) {
          Logger.log(`Retrying in ${this.RETRY_DELAY}ms...`);
          await new Promise<void>(resolve => setTimeout(resolve, this.RETRY_DELAY));
        }
      }
    }
    
    throw lastError || new Error('Operation failed after retries');
  }

  /**
   * Create and setup the capture window
   */
  private async setupCaptureWindow(display: Display): Promise<BrowserWindow> {
    const operation = async () => {
      const win = new BrowserWindow({
        x: display.bounds.x,
        y: display.bounds.y,
        width: display.bounds.width,
        height: display.bounds.height,
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
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: false,
        },
        backgroundColor: '#00000000',
        show: false,
      });

      // Platform specific settings
      if (process.platform === 'darwin') {
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        win.setAlwaysOnTop(true, 'screen-saver', 1)
      } else {
        win.setAlwaysOnTop(true, 'pop-up-menu', 1)
      }

      win.setIgnoreMouseEvents(false)

      // Load URL with timeout
      const loadUrl = process.env.VITE_DEV_SERVER_URL
        ? `${process.env.VITE_DEV_SERVER_URL}/src/renderer/captureWindow.html`
        : `file://${join(process.env.DIST!, 'captureWindow.html')}`

      // 优化加载流程
      let isLoaded = false
      let isReady = false

      const loadPromise = new Promise<void>((resolve, reject) => {
        win.webContents.on('did-finish-load', () => {
          isLoaded = true
          if (isReady) resolve()
        })

        win.once('ready-to-show', () => {
          isReady = true
          if (isLoaded) resolve()
        })

        win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
          reject(new Error(`Failed to load window: ${errorDescription} (${errorCode})`))
        })
      })

      // 启动加载
      win.loadURL(loadUrl)

      // 等待加载完成
      await Promise.race([
        loadPromise,
        this.createTimeout(this.URL_LOAD_TIMEOUT, 'Window loading')
      ])

      return win;
    };

    return this.retryWithDelay(operation);
  }

  /**
   * Send capture data to window
   */
  private async sendCaptureData(
    captureWindow: BrowserWindow,
    thumbnail: NativeImage,
    focusedDisplay: Display
  ): Promise<void> {
    const operation = async () => {
      const imageDataUrl = thumbnail.toDataURL()
      
      if (!imageDataUrl || !imageDataUrl.startsWith('data:image/') || imageDataUrl.length === 0) {
        throw new Error('Invalid image data URL')
      }

      const captureData = {
        imageData: imageDataUrl,
        displayInfo: {
          bounds: focusedDisplay.bounds,
          scaleFactor: focusedDisplay.scaleFactor
        }
      }

      // Notify subscribers
      this.notifyStartSubscribers()
      this.notifyDataSubscribers(captureData)

      // Send events to window
      captureWindow.webContents.send(`${SHUNSHOT_BRIDGE_PREFIX}:onStartCapture`)
      captureWindow.webContents.send(`${SHUNSHOT_BRIDGE_PREFIX}:onScreenCaptureData`, captureData)
    };

    return this.retryWithDelay(operation);
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
    
    // 计算所有显示器的总边界
    const totalBounds = {
      x: Math.min(...displays.map(d => d.bounds.x)),
      y: Math.min(...displays.map(d => d.bounds.y)),
      width: Math.max(...displays.map(d => d.bounds.x + d.bounds.width)) - Math.min(...displays.map(d => d.bounds.x)),
      height: Math.max(...displays.map(d => d.bounds.y + d.bounds.height)) - Math.min(...displays.map(d => d.bounds.y))
    }

    const existingWindow = mgrWindows.getCaptureWindow()
    if (existingWindow) {
      Logger.log('Closing existing capture window...')
      existingWindow.close()
      mgrWindows.setCaptureWindow(null)
    }

    let captureWindow: BrowserWindow | null = null;

    try {
      // First get screen capture data
      Logger.debug('Capturing screen data...')
      const sources = await Promise.race([
        desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: Math.round(totalBounds.width * focusedDisplay.scaleFactor),
            height: Math.round(totalBounds.height * focusedDisplay.scaleFactor)
          }
        }),
        this.createTimeout(this.WINDOW_CREATE_TIMEOUT, 'Screen capture')
      ]);

      if (!sources || sources.length === 0) {
        throw new Error('No screen sources found')
      }

      // Find focused source
      const focusedSource = sources.find(source => {
        const sourceDisplay = displays.find(display => 
          source.display_id === display.id?.toString() || 
          source.id.includes(display.id?.toString() || '')
        )
        return sourceDisplay?.id === focusedDisplay.id
      }) || sources[0]

      const thumbnail = focusedSource.thumbnail
      
      // Validate thumbnail
      if (!thumbnail || thumbnail.isEmpty()) {
        throw new Error('Invalid thumbnail')
      }

      const thumbnailSize = thumbnail.getSize()
      if (thumbnailSize.width === 0 || thumbnailSize.height === 0) {
        throw new Error(`Invalid thumbnail dimensions: ${JSON.stringify(thumbnailSize)}`)
      }

      // Save capture data before creating window
      this.setCurrentData({
        fullImage: thumbnail,
        bounds: focusedDisplay.bounds
      })

      // Create and setup window with data ready
      Logger.debug('Screen data captured, creating window...')
      captureWindow = await this.setupCaptureWindow(focusedDisplay)
      
      mgrWindows.setCaptureWindow(captureWindow)

      // Send capture data immediately after window is ready
      Logger.debug('Window ready, sending capture data...')
      await this.sendCaptureData(captureWindow, thumbnail, focusedDisplay)

      // Show window
      captureWindow.show()
      captureWindow.moveTop()
      captureWindow.focus()

      // Open DevTools in dev mode
      if (!app.isPackaged) {
        captureWindow.webContents.openDevTools({ mode: 'detach' })
      }

      // Monitor window close
      captureWindow.on('closed', () => {
        Logger.debug({
          message: 'Capture window closed',
          data: { timestamp: Date.now() }
        })
        mgrWindows.setCaptureWindow(null)
      })

    } catch (error) {
      this.handleWindowCreationFailure(error as Error, captureWindow)
    }
  }
}

// 创建单例
export const mgrCapture = new CaptureManager() 