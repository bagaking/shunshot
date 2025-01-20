import { WebContents, BrowserWindow } from 'electron'

/**
 * 日志工具类
 */
export class Logger {
  private static debugMode = !process.env.PROD

  /**
   * 获取窗口类型
   */
  private static getWindowType(
    sender: WebContents | null,
    mainWindow: BrowserWindow | null,
    captureWindow: BrowserWindow | null
  ): string {
    if (!sender) return 'main'
    if (sender === mainWindow?.webContents) return 'main'
    if (sender === captureWindow?.webContents) return 'capture'
    return 'unknown'
  }

  /**
   * 格式化错误对象
   */
  private static formatError(error: Error | null): string {
    if (!error) return ''
    return `${error.name}: ${error.message}\n${error.stack || ''}`
  }

  /**
   * 格式化日志消息
   */
  private static format(
    level: string,
    message: string,
    error: Error | null = null,
    sender: WebContents | null = null,
    mainWindow: BrowserWindow | null = null,
    captureWindow: BrowserWindow | null = null
  ): string {
    const timestamp = new Date().toISOString()
    const windowType = this.getWindowType(sender, mainWindow, captureWindow)
    const errorStr = error ? `\n${this.formatError(error)}` : ''
    return `[${timestamp}] [${windowType}] [${level}] ${message}${errorStr}`
  }

  /**
   * 调试日志
   */
  static debug(data: any): void {
    if (!this.debugMode) return
    const message = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
    console.debug(this.format('DEBUG', message))
  }

  /**
   * 普通日志
   */
  static log(message: string, ...args: any[]): void {
    console.log(`[LOG] ${message}`, ...args)
  }

  /**
   * 信息日志
   */
  static info(message: string, ...args: any[]): void {
    console.info(`[INFO] ${message}`, ...args)
  }

  /**
   * 警告日志
   */
  static warn(message: string, ...args: any[]): void {
    console.warn(`[WARN] ${message}`, ...args)
  }

  /**
   * 错误日志
   */
  static error(message: string, error?: Error): void {
    console.error(`[ERROR] ${message}`, error)
  }

  /**
   * 设置调试模式
   */
  static setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }
} 