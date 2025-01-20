import { CaptureData, CaptureBounds } from '../renderer/types/capture'

// 定义 Electron API 接口
export interface IShunshotCoreAPI {
  // 截图相关
  captureScreen: () => Promise<void>
  onStartCapture: (callback: () => void) => () => void
  onScreenCaptureData: (callback: (data: CaptureData) => void) => () => void
  completeCapture: (bounds: CaptureBounds) => Promise<void>
  cancelCapture: () => void
  copyToClipboard: (bounds: CaptureBounds) => Promise<void>
  
  // 窗口相关
  hideWindow: () => Promise<void>
  showWindow: () => Promise<void>
  setWindowSize: (width: number, height: number) => Promise<void>

  // 插件相关
  loadPlugin: (pluginId: string) => Promise<void>

  // OCR 相关
  requestOCR: (bounds: CaptureBounds) => Promise<{ text?: string, error?: any }>

  // 系统相关
  platform: string

  // 日志相关
  mainLog: {
    log: (...args: any[]) => void
    info: (...args: any[]) => void
    warn: (...args: any[]) => void
    error: (...args: any[]) => void
    debug: (...args: any[]) => void
  }
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    readonly shunshotCoreAPI: IShunshotCoreAPI
    readonly mainLog: ILogger
  }
}

// 防止 TypeScript 将此文件视为普通模块
export {}