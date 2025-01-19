import { CaptureData, CaptureBounds } from '../renderer/types/capture'

// 定义 Electron API 接口
export interface IElectronAPI {
  // 截图相关
  captureScreen: () => Promise<void>
  onStartCapture: (callback: () => void) => () => void
  onScreenCaptureData: (callback: (data: CaptureData) => void) => () => void
  completeCapture: (bounds: CaptureBounds) => Promise<void>
  cancelCapture: () => void
  copyToClipboard: (bounds: CaptureBounds) => Promise<void>
  
  // 插件相关
  loadPlugin: (pluginId: string) => Promise<void>
  
  // 系统相关
  platform: string

  // 日志相关
  log: (level: 'log' | 'info' | 'warn' | 'error', ...args: any[]) => void
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    readonly electronAPI: IElectronAPI
  }
}

// 防止 TypeScript 将此文件视为普通模块
export {}