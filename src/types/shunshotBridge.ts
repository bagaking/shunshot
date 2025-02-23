import { IpcMain, IpcRenderer } from 'electron'
import { Bridge, IBridgeOptions } from '../common/bridge'
import { IShunshotCoreAPI } from './shunshotapi'

export const SHUNSHOT_BRIDGE_PREFIX = "shunshot"
export const SHUNSHOT_WINDOW_ID_PREFIX = SHUNSHOT_BRIDGE_PREFIX + "-window-"

/**
 * Electron Bridge 用于处理主进程和渲染进程之间的通信
 */
export class ShunshotCoreBridge extends Bridge<IShunshotCoreAPI> {
  constructor(options?: IBridgeOptions) {
    super({
      id: SHUNSHOT_BRIDGE_PREFIX,  // 主进程默认使用固定 ID
      prefix: SHUNSHOT_BRIDGE_PREFIX,
      enableLog: true,
      ...options,  // 允许覆盖默认值
    })
  }

  /**
   * 验证 Bridge ID
   * @param bridgeId - 要验证的 Bridge ID
   */
  protected validateBridgeId(bridgeId: string): boolean {
    // 主进程的 bridge 接受所有以 SHUNSHOT_WINDOW_ID_PREFIX 开头的 ID
    return bridgeId.startsWith(SHUNSHOT_WINDOW_ID_PREFIX) || bridgeId === SHUNSHOT_BRIDGE_PREFIX
  }

  /**
   * 获取接口原型
   */
  protected getPrototype(): Record<string, any> {
    return {
      // 截图相关
      captureScreen: async () => {},
      onStartCapture: () => () => {},
      onScreenCaptureData: () => () => {},
      completeCapture: async () => {},
      cancelCapture: () => {},
      copyToClipboard: async () => {},
      
      // 窗口相关
      hideWindow: async () => {},
      showWindow: async () => {},
      setWindowSize: async () => {},
      showOpenDialog: async () => ({ canceled: true, filePaths: [] }),

      // 插件相关
      loadPlugin: async () => {},

      // OCR 相关
      requestOCR: async () => ({}),

      // 系统相关
      platform: process.platform,

      // Agent 相关
      getAgents: async () => [],
      createAgent: async () => false,
      deleteAgent: async () => false,
      updateAgent: async () => false,
      runAgent: async () => ({}),

      // 日志相关
      mainLog: {
        log: (..._args: any[]) => {},
        info: (..._args: any[]) => {},
        warn: (..._args: any[]) => {},
        error: (..._args: any[]) => {},
        debug: (..._args: any[]) => {},
      }
    }
  }
} 