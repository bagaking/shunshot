import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

// 暴露安全的 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 截图相关
  captureScreen: () => ipcRenderer.invoke('SCREENSHOT_CAPTURE'),
  cancelCapture: () => ipcRenderer.invoke('CANCEL_CAPTURE'),
  completeCapture: (bounds: { x: number, y: number, width: number, height: number }) => 
    ipcRenderer.invoke('COMPLETE_CAPTURE', bounds),
  
  // 监听截图开始
  onStartCapture: (callback: () => void) => {
    const wrappedCallback = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on('START_CAPTURE', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('START_CAPTURE', wrappedCallback)
    }
  },
  
  // 监听屏幕截图数据
  onScreenCaptureData: (callback: (imageData: string) => void) => {
    const wrappedCallback = (_event: IpcRendererEvent, imageData: string) => callback(imageData)
    ipcRenderer.on('SCREEN_CAPTURE_DATA', wrappedCallback)
    return () => {
      ipcRenderer.removeListener('SCREEN_CAPTURE_DATA', wrappedCallback)
    }
  },
  
  // 插件相关
  loadPlugin: (pluginId: string) => ipcRenderer.invoke('PLUGIN_LOAD', pluginId),
  
  // 系统相关
  platform: process.platform,
}) 