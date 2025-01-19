interface DisplayInfo {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
}

interface ScreenCaptureData {
  imageData: string
  displayInfo: DisplayInfo
}

export interface IElectronAPI {
  // 截图相关
  captureScreen: () => Promise<void>
  cancelCapture: () => Promise<void>
  completeCapture: (bounds: { x: number, y: number, width: number, height: number }) => Promise<void>
  onStartCapture: (callback: () => void) => () => void
  onScreenCaptureData: (callback: (data: ScreenCaptureData) => void) => () => void
  
  // 插件相关
  loadPlugin: (pluginId: string) => Promise<void>
  
  // 系统相关
  platform: string
}

declare global {
  interface Window {
    electronAPI: IElectronAPI
  }
} 