import { contextBridge, IpcRenderer, ipcRenderer } from 'electron'
import { SHUNSHOT_BRIDGE_PREFIX, SHUNSHOT_WINDOW_ID_PREFIX, ShunshotCoreBridge } from '../../src/types/shunshotBridge'
import { IShunshotCoreAPI } from '../../src/types/electron'

/**
 * 创建 Electron Preload API 的默认实现
 * 只处理特殊情况，其他方法由 Bridge 自动实现
 */
export function createDefaultPreloadApi(ipcRenderer: IpcRenderer): Partial<IShunshotCoreAPI> {
  return {
    // 系统相关 - 直接返回静态值
    platform: process.platform,
  }
}

// 创建默认的 API 实现
const defaultApi = createDefaultPreloadApi(ipcRenderer)
const bridgeID = SHUNSHOT_WINDOW_ID_PREFIX + Date.now().toString()

// 创建 bridge 实例
const bridge = new ShunshotCoreBridge({
  id: bridgeID,
  prefix: SHUNSHOT_BRIDGE_PREFIX,
  enableLog: true
})

// 创建完整的 API
const api = bridge.createPreloadApi(ipcRenderer, defaultApi) as IShunshotCoreAPI
 

// 使用 contextBridge 安全地暴露 API
contextBridge.exposeInMainWorld('shunshotCoreAPI', api)
contextBridge.exposeInMainWorld('mainLog', api.mainLog)
