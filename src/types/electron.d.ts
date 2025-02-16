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
  onCleanupComplete: (callback: () => void) => () => void
  
  // 窗口相关
  hideWindow: () => Promise<void>
  showWindow: () => Promise<void>
  setWindowSize: (width: number, height: number) => Promise<void>
  openSettings: () => Promise<void>
  setIgnoreSystemShortcuts: (ignore: boolean) => Promise<void>

  // 插件相关
  loadPlugin: (pluginId: string) => Promise<void>

  // OCR 相关
  requestOCR: (bounds: CaptureBounds) => Promise<{ text?: string, error?: any }>

  // 配置相关
  getPreference: <T>(key: string) => Promise<T>
  setPreference: <T>(key: string, value: T) => Promise<void>

  // 系统相关
  platform: NodeJS.Platform
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    readonly shunshotCoreAPI: IShunshotCoreAPI
  }
}

// 防止 TypeScript 将此文件视为普通模块
export {}