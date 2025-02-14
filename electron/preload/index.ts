import { contextBridge, ipcRenderer } from 'electron'
import { SHUNSHOT_BRIDGE_PREFIX } from '../../src/types/shunshotBridge'
import { IShunshotCoreAPI } from '../../src/types/electron'
import { ITransLogAPI } from '../../src/types/translog'

// 创建安全的IPC包装器
const createSecureIPC = () => {
  const validChannels = [
    'translog:log',
    'translog:info',
    'translog:warn',
    'translog:error',
    'translog:debug',
    `${SHUNSHOT_BRIDGE_PREFIX}:captureScreen`,
    `${SHUNSHOT_BRIDGE_PREFIX}:onStartCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:onScreenCaptureData`,
    `${SHUNSHOT_BRIDGE_PREFIX}:completeCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:cancelCapture`,
    `${SHUNSHOT_BRIDGE_PREFIX}:copyToClipboard`,
    `${SHUNSHOT_BRIDGE_PREFIX}:hideWindow`,
    `${SHUNSHOT_BRIDGE_PREFIX}:showWindow`,
    `${SHUNSHOT_BRIDGE_PREFIX}:setWindowSize`,
    `${SHUNSHOT_BRIDGE_PREFIX}:loadPlugin`,
    `${SHUNSHOT_BRIDGE_PREFIX}:requestOCR`,
  ]

  return {
    invoke: (channel: string, ...args: any[]) => {
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, ...args)
      }
      throw new Error(`Invalid channel: ${channel}`)
    },
    on: (channel: string, callback: (...args: any[]) => void) => {
      if (validChannels.includes(channel)) {
        const wrappedCallback = (_: any, ...args: any[]) => {
          console.debug(`[Preload] Received event on channel: ${channel}`, {
            hasArgs: args.length > 0,
            timestamp: Date.now()
          })
          callback(...args)
        }
        ipcRenderer.on(channel, wrappedCallback)
        return () => {
          console.debug(`[Preload] Removing listener for channel: ${channel}`)
          ipcRenderer.removeListener(channel, wrappedCallback)
        }
      }
      throw new Error(`Invalid channel: ${channel}`)
    }
  }
}

// 创建日志 API
const translogAPI: ITransLogAPI = {
  log: async (...args: any[]) => ipcRenderer.invoke('translog:log', ...args),
  info: async (...args: any[]) => ipcRenderer.invoke('translog:info', ...args),
  warn: async (...args: any[]) => ipcRenderer.invoke('translog:warn', ...args),
  error: async (...args: any[]) => ipcRenderer.invoke('translog:error', ...args),
  debug: async (...args: any[]) => ipcRenderer.invoke('translog:debug', ...args),
}

// 创建核心 API
const createCoreAPI = (secureIPC: ReturnType<typeof createSecureIPC>): IShunshotCoreAPI => {
  console.debug('[Preload] Creating core API')
  return {
    platform: process.platform,
    captureScreen: async () => {
      console.debug('[Preload] Invoking captureScreen')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:captureScreen`)
    },
    onStartCapture: (callback) => {
      console.debug('[Preload] Setting up onStartCapture listener')
      return secureIPC.on(`${SHUNSHOT_BRIDGE_PREFIX}:onStartCapture`, callback)
    },
    onScreenCaptureData: (callback) => {
      console.debug('[Preload] Setting up onScreenCaptureData listener')
      return secureIPC.on(`${SHUNSHOT_BRIDGE_PREFIX}:onScreenCaptureData`, callback)
    },
    completeCapture: async (bounds) => {
      console.debug('[Preload] Invoking completeCapture')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:completeCapture`, bounds)
    },
    cancelCapture: () => {
      console.debug('[Preload] Invoking cancelCapture')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:cancelCapture`)
    },
    copyToClipboard: async (bounds) => {
      console.debug('[Preload] Invoking copyToClipboard')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:copyToClipboard`, bounds)
    },
    hideWindow: async () => {
      console.debug('[Preload] Invoking hideWindow')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:hideWindow`)
    },
    showWindow: async () => {
      console.debug('[Preload] Invoking showWindow')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:showWindow`)
    },
    setWindowSize: async (width, height) => {
      console.debug('[Preload] Invoking setWindowSize')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:setWindowSize`, width, height)
    },
    loadPlugin: async (pluginId) => {
      console.debug('[Preload] Invoking loadPlugin')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:loadPlugin`, pluginId)
    },
    requestOCR: async (bounds) => {
      console.debug('[Preload] Invoking requestOCR')
      return secureIPC.invoke(`${SHUNSHOT_BRIDGE_PREFIX}:requestOCR`, bounds)
    },
  }
}

// 初始化 API
try {
  console.debug('[Preload] Starting API initialization')
  const secureIPC = createSecureIPC()
  const coreAPI = createCoreAPI(secureIPC)

  // 暴露 API 到 window 对象
  contextBridge.exposeInMainWorld('translogAPI', translogAPI)
  contextBridge.exposeInMainWorld('shunshotCoreAPI', coreAPI)
  
  console.debug('[Preload] APIs initialized successfully', {
    hasTranslogAPI: !!translogAPI,
    hasCoreAPI: !!coreAPI,
    timestamp: Date.now()
  })
} catch (error) {
  console.error('[Preload] Failed to initialize APIs:', error instanceof Error ? error : new Error(String(error)))
  
  // 提供基本的降级 API
  const fallbackAPI = {
    platform: process.platform,
    captureScreen: async () => { throw new Error('API not available') },
    onStartCapture: () => () => {},
    onScreenCaptureData: () => () => {},
    completeCapture: async () => { throw new Error('API not available') },
    cancelCapture: () => {},
    copyToClipboard: async () => { throw new Error('API not available') },
    hideWindow: async () => { throw new Error('API not available') },
    showWindow: async () => { throw new Error('API not available') },
    setWindowSize: async () => { throw new Error('API not available') },
    loadPlugin: async () => { throw new Error('API not available') },
    requestOCR: async () => ({ error: 'API not available' }),
  }

  contextBridge.exposeInMainWorld('translogAPI', {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: console.debug.bind(console),
  })
  contextBridge.exposeInMainWorld('shunshotCoreAPI', fallbackAPI)
  
  console.debug('[Preload] Fallback APIs initialized', {
    timestamp: Date.now()
  })
}

// 通知渲染进程 preload 脚本已完成加载
window.addEventListener('DOMContentLoaded', () => {
  console.debug('[Preload] DOM content loaded', {
    timestamp: Date.now()
  })
})
