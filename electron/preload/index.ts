import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'
import { CaptureData, CaptureBounds } from '../../src/renderer/types/capture'
import { IElectronAPI } from '../../src/types/electron'
import { CHANNELS } from '../../src/types/ipc'

// 暴露给渲染进程的 API
const api: IElectronAPI = {
  captureScreen: () => {
    return ipcRenderer.invoke(CHANNELS.SCREENSHOT_CAPTURE)
  },

  onStartCapture: (callback: () => void) => {
    const wrappedCallback = (_event: IpcRendererEvent) => callback()
    ipcRenderer.on(CHANNELS.START_CAPTURE, wrappedCallback)
    return () => ipcRenderer.removeListener(CHANNELS.START_CAPTURE, wrappedCallback)
  },

  onScreenCaptureData: (callback: (data: CaptureData) => void) => {
    const wrappedCallback = (_event: IpcRendererEvent, data: CaptureData) => callback(data)
    ipcRenderer.on(CHANNELS.SCREEN_CAPTURE_DATA, wrappedCallback)
    return () => ipcRenderer.removeListener(CHANNELS.SCREEN_CAPTURE_DATA, wrappedCallback)
  },

  completeCapture: (bounds: CaptureBounds) => {
    return ipcRenderer.invoke(CHANNELS.COMPLETE_CAPTURE, bounds)
  },

  cancelCapture: () => {
    ipcRenderer.send(CHANNELS.CANCEL_CAPTURE)
  },

  copyToClipboard: (bounds: CaptureBounds) => {
    return ipcRenderer.invoke(CHANNELS.COPY_TO_CLIPBOARD, bounds)
  },

  // 窗口相关
  hideWindow: () => {
    return ipcRenderer.invoke(CHANNELS.HIDE_WINDOW)
  },

  showWindow: () => {
    return ipcRenderer.invoke(CHANNELS.SHOW_WINDOW)
  },

  setWindowSize: (width, height) => {
    return ipcRenderer.invoke(CHANNELS.SET_WINDOW_SIZE, width, height)
  },

  // 插件相关
  loadPlugin: (pluginId: string) => ipcRenderer.invoke(CHANNELS.PLUGIN_LOAD, pluginId),
  
  // 系统相关
  platform: process.platform,
  
  // 日志相关
  log: (level: 'log' | 'info' | 'warn' | 'error', ...args: any[]) => {
    ipcRenderer.send(CHANNELS.LOG, level, ...args)
  },

  // OCR 识别
  requestOCR: async (bounds: CaptureBounds) => {
    return await ipcRenderer.invoke(CHANNELS.OCR_REQUEST, bounds)
  },
} as const

// 重写 console 方法
const originalConsole = { ...console }
console.log = (...args) => {
  api.log('log', ...args)
  originalConsole.log(...args)
}
console.info = (...args) => {
  api.log('info', ...args)
  originalConsole.info(...args)
}
console.warn = (...args) => {
  api.log('warn', ...args)
  originalConsole.warn(...args)
}
console.error = (...args) => {
  api.log('error', ...args)
  originalConsole.error(...args)
}

// 使用 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('electronAPI', api)
