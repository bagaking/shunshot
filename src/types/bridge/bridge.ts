import { IpcRenderer, IpcMain, BrowserWindow } from 'electron'
import { IBridgeOptions, IMessageContext, IMessageWrapper, BridgeAPI, AsyncFunction, EventHandler } from './types'

/**
 * Bridge 类用于自动生成 IPC 通信代码
 * @template T - API 接口定义
 */
export class Bridge<T extends Record<string, any>> {
  /** Bridge 实例ID */
  private readonly id: string
  /** 事件名称前缀 */
  private readonly prefix: string
  /** 是否开启日志 */
  private readonly enableLog: boolean
  /** 消息处理器映射 */
  private readonly messageHandlers: Map<string, Function[]>
  /** 请求通道名称 */
  private readonly requestChannel: string
  /** 事件通道名称 */
  private readonly eventChannel: string

  constructor(options: IBridgeOptions) {
    if (!options?.id) {
      throw new Error('Bridge ID is required')
    }
    
    this.id = options.id
    this.prefix = options.prefix ?? 'bridge'
    this.enableLog = options.enableLog ?? true
    this.messageHandlers = new Map()
    
    this.requestChannel = `${this.prefix}:to-main`
    this.eventChannel = `${this.prefix}:to-renderer`
  }

  /**
   * 创建消息上下文
   */
  protected createContext(): IMessageContext {
    return {
      bridgeId: this.id,
      messageId: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      timestamp: Date.now()
    }
  }

  /**
   * 包装消息
   * @param payload - 消息负载
   */
  protected wrapMessage<P>(payload: P): IMessageWrapper<P> {
    return {
      ctx: this.createContext(),
      payload
    }
  }

  /**
   * 创建 preload API
   * @param ipcRenderer - electron 的 ipcRenderer 实例
   * @param customImpl - 自定义实现的方法
   */
  createPreloadApi(
    ipcRenderer: IpcRenderer,
    customImpl?: Partial<T>
  ): BridgeAPI<T> {
    if (!ipcRenderer) {
      throw new Error('ipcRenderer is required')
    }

    const api = {} as BridgeAPI<T>

    try {
      // 处理自定义实现
      if (customImpl) {
        Object.assign(api, customImpl)
      }

      // 获取所有方法名
      const methodNames = Object.keys(this.getPrototype()) as Array<keyof T>

      // 为每个未实现的方法创建代理
      for (const methodName of methodNames) {
        if (!(methodName in api)) {
          const eventName = `${this.prefix}:${String(methodName)}`
          
          // 处理事件监听方法
          if (typeof methodName === 'string' && methodName.startsWith('on')) {
            (api as any)[methodName] = ((callback: (...args: any[]) => void) => {
              ipcRenderer.on(eventName, (_, ...args) => callback(...args))
              return () => {
                ipcRenderer.removeListener(eventName, callback)
              }
            }) as any
          } else {
            // 处理普通方法
            (api as any)[methodName] = (async (...args: any[]) => {
              return ipcRenderer.invoke(eventName, ...args)
            }) as any
          }
        }
      }

      return api
    } catch (error) {
      console.error('Failed to create preload API:', error)
      throw error
    }
  }

  /**
   * 获取接口原型
   */
  protected getPrototype(): Record<string, any> {
    return {}
  }

  /**
   * 注册事件处理器
   * @param method - 方法名
   * @param handler - 处理函数
   */
  on<K extends keyof T>(
    method: K,
    handler: T[K] extends EventHandler<any> ? Parameters<T[K]>[0] : never
  ): () => void {
    const handlers = this.messageHandlers.get(String(method)) || []
    handlers.push(handler)
    this.messageHandlers.set(String(method), handlers)
    
    return () => {
      const handlers = this.messageHandlers.get(String(method))
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
          if (handlers.length === 0) {
            this.messageHandlers.delete(String(method))
          }
        }
      }
    }
  }

  /**
   * 注册主进程的请求处理器
   * @param ipcMain - electron 的 ipcMain 实例
   * @param handlers - 处理器实现
   */
  registerMainHandlers(
    ipcMain: IpcMain,
    handlers: {
      [K in keyof T]: T[K] extends AsyncFunction<any> ? T[K] :
        T[K] extends EventHandler<any> ? never :
        T[K] extends Function ? (...args: Parameters<T[K]>) => Promise<ReturnType<T[K]>> :
        never
    }
  ): void {
    // 验证所有方法都已实现
    const methodNames = Object.keys(handlers)
    for (const methodName of methodNames) {
      const eventName = `${this.prefix}:${methodName}`
      ipcMain.handle(eventName, async (event, ...args) => {
        try {
          const handler = handlers[methodName as keyof T]
          if (!handler) {
            throw new Error(`No handler registered for method: ${methodName}`)
          }
          return await handler(...args)
        } catch (error) {
          console.error(`[Bridge:${this.id}] Error in ${methodName}:`, error)
          throw error
        }
      })
    }
  }

  /**
   * 发送事件到渲染进程
   * @param window - 目标窗口
   * @param method - 方法名
   * @param args - 方法参数
   */
  emit<K extends keyof T>(
    window: BrowserWindow,
    method: K,
    ...args: T[K] extends EventHandler<any> ? Parameters<Parameters<T[K]>[0]> : never
  ): void {
    if (window.isDestroyed()) {
      console.warn(`[Bridge:${this.id}] Window is destroyed`)
      return
    }

    const message = this.wrapMessage({
      method,
      args
    })

    if (this.enableLog) {
      console.log(`[Bridge:${this.id}] Emit Event:`, message)
    }

    window.webContents.send(this.eventChannel, message)
  }

  /**
   * 广播事件到所有渲染进程
   * @param method - 方法名
   * @param args - 方法参数
   */
  broadcast<K extends keyof T>(
    method: K,
    ...args: Parameters<T[K] extends Function ? T[K] : never>
  ): void {
    const message = this.wrapMessage({
      method,
      args
    })

    if (this.enableLog) {
      console.log(`[Bridge:${this.id}] Broadcast Event:`, message)
    }

    // TODO: 实现广播逻辑
  }
} 