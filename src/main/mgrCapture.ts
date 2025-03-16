import { app, BrowserWindow, desktopCapturer, screen, Display, NativeImage } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { mgrWindows } from './mgrWindows'
import { SHUNSHOT_BRIDGE_PREFIX } from '../types/shunshotBridge'
import { CaptureData } from '../types/capture'
import { Bounds, image } from '../common/2d'
import { existsSync } from 'fs'

// 导入调试函数的声明，不需要实现，因为它在mgrWindows.ts中已经实现
declare function debugWindowLoading(windowName: string, paths: string[]): string[];

export class CaptureImageData {
  public fullImage?: NativeImage;
  public bounds?: Bounds;
  public annotatedImage?: NativeImage;
  public annotatedBounds?: Bounds;

  constructor(data: {
    fullImage?: NativeImage;
    bounds?: Bounds;
    annotatedImage?: NativeImage;
    annotatedBounds?: Bounds;
  }) {
    this.fullImage = data?.fullImage;
    this.bounds = data?.bounds;
    this.annotatedImage = data?.annotatedImage;
    this.annotatedBounds = data?.annotatedBounds;
  }

  getFinalImage(bounds: Bounds): NativeImage {
    if (this.annotatedImage) {
      return this.annotatedImage;
    }

    if (!this.fullImage) {
      throw new Error('No full image available')
    }

    const croppedImage = image.cropFromDisplay(
      this.fullImage,
      bounds,
      this.bounds
    )
    return croppedImage
  }
} 

/**
 * 截图管理器
 */
export class CaptureManager {
  private currentData: CaptureImageData | null = null

  private startSubscribers: Set<() => void> = new Set()
  private dataSubscribers: Set<(data: CaptureData) => void> = new Set()
  private cleanupSubscribers: Set<() => void> = new Set()

  // Update timeout constants
  private readonly WINDOW_CREATE_TIMEOUT = 5000; // 5 seconds
  private readonly URL_LOAD_TIMEOUT = 3000; // 3 seconds 
  private readonly MAX_RETRIES = 2;
  private readonly RETRY_DELAY = 500; // 0.5 second

  getCurrentData(): CaptureImageData {
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
    this.currentData = new CaptureImageData(data)
    if (data === null) {
      // 当数据被清理时通知订阅者
      this.notifyCleanupSubscribers()
    }
  }

  /**
   * 设置带有标注的图像
   * @param annotatedImage 带有标注的图像
   * @param bounds 图像边界
   */
  setAnnotatedImage(
    annotatedImage: NativeImage,
    bounds: { x: number; y: number; width: number; height: number }
  ) {
    if (!this.currentData) {
      Logger.warn('Cannot set annotated image: no current data')
      return
    }
    
    this.currentData = new CaptureImageData({
      ...this.currentData,
      annotatedImage,
      annotatedBounds: bounds
    })
    
    Logger.debug({
      message: 'Annotated image set',
      data: {
        hasAnnotatedImage: !!annotatedImage,
        bounds
      }
    })
  }

  /**
   * 获取带有标注的图像
   * @returns 带有标注的图像，如果不存在则返回原始图像
   */
  getAnnotatedImage() {
    if (!this.currentData) {
      return null
    }
    
    return this.currentData.annotatedImage || this.currentData.fullImage
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
      const preloadPath = join(process.env.DIST_PRELOAD!, 'index.js')
      Logger.debug({
        message: 'Creating capture window with config',
        data: {
          preloadPath,
          display: {
            bounds: display.bounds,
            scaleFactor: display.scaleFactor,
            id: display.id
          },
          env: {
            DIST_PRELOAD: process.env.DIST_PRELOAD,
            VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL
          }
        }
      })

      // 基础窗口配置
      const baseConfig: Electron.BrowserWindowConstructorOptions = {
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
        webPreferences: {
          preload: preloadPath,
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: false,
          webSecurity: false,
        },
        backgroundColor: '#00000000',
        show: false,
        type: 'panel'
      }

      // macOS 特定配置
      const darwinConfig: Partial<Electron.BrowserWindowConstructorOptions> = process.platform === 'darwin' 
        ? {
            titleBarStyle: 'hidden',
            trafficLightPosition: { x: -100, y: -100 },
            roundedCorners: false,
            focusable: true,
          }
        : {}

      const windowConfig = {
        ...baseConfig,
        ...darwinConfig
      }

      Logger.debug({
        message: 'Window configuration prepared',
        data: windowConfig
      })

      const win = new BrowserWindow(windowConfig)
      Logger.debug({ message: 'Capture window instance created' })

      // 设置平台特定行为
      if (process.platform === 'darwin') {
        this.setupDarwinWindowBehavior(win)
        Logger.debug({ message: 'Darwin-specific window behavior set up' })
      }

      win.setIgnoreMouseEvents(false)
      this.setupWindowEventListeners(win)
      await this.setupWindowLoading(win)

      return win
    }

    return this.retryWithDelay(operation)
  }

  /**
   * 设置 macOS 特定的窗口行为
   */
  private setupDarwinWindowBehavior(win: BrowserWindow): void {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
    win.setAlwaysOnTop(true, 'screen-saver', 1)
    app.dock?.show()
    app.focus({ steal: true })
    win.setWindowButtonVisibility(false)
  }

  /**
   * 设置窗口事件监听器
   */
  private setupWindowEventListeners(win: BrowserWindow): void {
    // 监听失焦事件
    win.on('blur', () => {
      Logger.debug('Window lost focus, attempting to regain')
      if (!win.isDestroyed()) {
        if (process.platform === 'darwin') {
          app.focus({ steal: true })
          win.setAlwaysOnTop(true, 'screen-saver', 1)
        }
        win.focus()
      }
    })

    // 监听所有输入事件以保持焦点
    win.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && !win.isFocused()) {
        if (process.platform === 'darwin') {
          app.focus({ steal: true })
          win.setAlwaysOnTop(true, 'screen-saver', 1)
        }
        win.focus()
      }
    })

    // 在显示窗口之前先激活它
    win.once('ready-to-show', () => {
      Logger.debug('Capture window ready to show')
      if (process.platform === 'darwin') {
        app.dock?.show()
        app.focus({ steal: true })
        win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
        win.setAlwaysOnTop(true, 'screen-saver', 1)
      }
      win.show()
      win.moveTop()
      win.focus()
    })

    // 监听窗口关闭
    win.on('closed', () => {
      Logger.debug({
        message: 'Capture window closed',
        data: { timestamp: Date.now() }
      })
      mgrWindows.setCaptureWindow(null)
    })
  }

  /**
   * 设置窗口加载
   */
  private async setupWindowLoading(win: BrowserWindow): Promise<void> {
    // 使用更一致的路径处理方式
    let loadUrl: string;
    
    if (process.env.VITE_DEV_SERVER_URL) {
      // 开发环境：使用 Vite 开发服务器
      loadUrl = `${process.env.VITE_DEV_SERVER_URL}/src/renderer/captureWindow.html`;
    } else {
      // 生产环境：加载编译后的 HTML 文件
      const filePath = join(process.env.DIST_RENDERER!, 'captureWindow.html');
      
      // 检查文件是否存在
      if (!existsSync(filePath)) {
        // 尝试备用路径 - 检查多个可能的位置
        const possiblePaths = [
          join(process.env.DIST!, 'captureWindow.html'),
          join(process.env.DIST!, 'src/renderer/captureWindow.html'),
          join(process.env.DIST!, 'renderer/captureWindow.html')
        ];
        
        // 使用调试函数记录路径信息，但不改变路径列表
        debugWindowLoading('capture', possiblePaths);
        
        let found = false;
        for (const path of possiblePaths) {
          Logger.log(`Trying alternative path: ${path}`);
          if (existsSync(path)) {
            loadUrl = `file://${path}`;
            found = true;
            break;
          }
        }
        
        if (!found) {
          throw new Error(`Capture window HTML file not found at any expected location`);
        }
      } else {
        loadUrl = `file://${filePath}`;
      }
    }

    Logger.debug({
      message: 'Setting up window loading',
      data: {
        loadUrl,
        webContentsId: win.webContents.id,
        isDestroyed: win.isDestroyed()
      }
    })

    let isLoaded = false
    let isReady = false

    const loadPromise = new Promise<void>((resolve, reject) => {
      win.webContents.on('did-start-loading', () => {
        Logger.debug({ message: 'Window started loading' })
      })

      win.webContents.on('did-finish-load', () => {
        Logger.debug({ message: 'Window finished loading' })
        isLoaded = true
        if (isReady) resolve()
      })

      win.once('ready-to-show', () => {
        Logger.debug({ message: 'Window ready to show' })
        isReady = true
        if (isLoaded) resolve()
      })

      win.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
        const error = new Error(`Failed to load window: ${errorDescription} (${errorCode})`)
        Logger.error({
          message: 'Window failed to load',
          data: { loadUrl }
        }, error)
        reject(error)
      })

      win.webContents.on('console-message', (_, level, message, line, sourceId) => {
        const levels = ['debug', 'log', 'info', 'warn', 'error']
        Logger.debug({
          message: `[Renderer Console] [${levels[level] || 'unknown'}] ${message}`,
          data: {
            line,
            source: sourceId.replace(process.cwd(), '')
          }
        })
      })
    })

    Logger.debug({
      message: 'Loading URL',
      data: { loadUrl }
    })
    win.loadURL(loadUrl)

    await Promise.race([
      loadPromise,
      this.createTimeout(this.URL_LOAD_TIMEOUT, 'Window loading')
    ])

    // 在开发模式下打开 DevTools
    if (!app.isPackaged) {
      Logger.debug('Opening DevTools in development mode')
      win.webContents.openDevTools({ mode: 'detach' })
    }
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
      // 获取原始图像数据
      const imageBuffer = thumbnail.toBitmap()
      const imageSize = thumbnail.getSize()
      
      if (!imageBuffer || imageBuffer.length === 0) {
        throw new Error('Invalid image buffer')
      }

      const captureData = {
        imageBuffer,
        imageSize,
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
      Logger.info('[Perf] send to renderer')
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

  async startCapture() {
    Logger.info('[Perf] capture start')
    try {
      await this.createCaptureWindow()
    } catch (error) {
      Logger.error('Failed to start capture', error as Error)
      throw error
    }
  }
}

// 创建单例
export const mgrCapture = new CaptureManager() 