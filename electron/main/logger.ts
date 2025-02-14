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
    if (mainWindow && sender === mainWindow.webContents) return 'main'
    if (captureWindow && sender === captureWindow.webContents) return 'capture'
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
    message: string | { message: string; data?: any },
    error: Error | null = null,
    sender: WebContents | null = null,
    mainWindow: BrowserWindow | null = null,
    captureWindow: BrowserWindow | null = null
  ): string {
    const timestamp = new Date().toISOString()
    const windowType = this.getWindowType(sender, mainWindow, captureWindow)
    const errorStr = error ? `\n${this.formatError(error)}` : ''
    
    let messageStr: string
    let dataStr = ''
    
    if (typeof message === 'string') {
      messageStr = message
    } else {
      messageStr = message.message
      if (message.data) {
        try {
          dataStr = `\nData: ${JSON.stringify(message.data, null, 2)}`
        } catch (err) {
          dataStr = `\nData: [Unable to stringify data: ${err}]`
        }
      }
    }
    
    return `[${timestamp}] [${windowType}] [${level}] ${messageStr}${dataStr}${errorStr}`
  }

  /**
   * 调试日志
   */
  static debug(message: string | { message: string; data?: any }): void {
    if (!this.debugMode) return
    console.debug(this.format('DEBUG', message))
  }

  /**
   * 普通日志
   */
  static log(message: string | { message: string; data?: any }): void {
    console.log(this.format('LOG', message))
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
  static warn(message: string | { message: string; data?: any }): void {
    console.warn(this.format('WARN', message))
  }

  /**
   * 错误日志
   */
  static error(message: string | { message: string; data?: any }, error?: Error): void {
    console.error(this.format('ERROR', message, error))
  }

  /**
   * 设置调试模式
   */
  static setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
  }
} 