import { IpcRenderer, IpcMain, BrowserWindow } from 'electron'
import { IBridgeOptions, IMessageContext, IMessageWrapper, FunctionPropertyNames, BridgeChannels } from './types'

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
    this.id = options.id
    this.prefix = options.prefix ?? 'bridge'
    this.enableLog = options.enableLog ?? true
    this.messageHandlers = new Map()
    
    // 初始化通道名称
    this.requestChannel = BridgeChannels.toMain(this.prefix)
    this.eventChannel = BridgeChannels.toRenderer(this.prefix)
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
  ): T {
    const api = {} as T

    // 获取接口中定义的所有方法名
    const methodKeys = Object.keys(customImpl || {}) as (keyof T)[]

    // 先处理自定义实现
    for (const key of methodKeys) {
      if (customImpl?.[key]) {
        api[key] = customImpl[key] as T[typeof key]
      }
    }

    // 获取所有未实现的方法
    const remainingKeys = Object.keys(this.getPrototype<T>()).filter(
      key => !api.hasOwnProperty(key)
    ) as (keyof T)[]

    // 处理剩余的方法
    for (const key of remainingKeys) {
      const methodName = String(key)

      // 处理事件监听方法 (on* 方法)
      if (methodName.startsWith('on') && methodName.length > 2) {
        const eventName = methodName.charAt(2).toLowerCase() + methodName.slice(3)
        const method = ((callback: Function) => {
          const wrappedCallback = (...args: any[]) => callback(...args)
          this.on(eventName as keyof T, wrappedCallback as any)
          return () => {
            const handlers = this.messageHandlers.get(eventName)
            if (handlers) {
              const index = handlers.indexOf(wrappedCallback)
              if (index > -1) {
                handlers.splice(index, 1)
              }
            }
          }
        }) as T[typeof key]

        api[key] = method
        continue
      }

      // 处理普通方法
      type MethodType = T[typeof key] & Function
      const method = ((...args: Parameters<MethodType>) => {
        const wrapped = this.wrapMessage({
          method: key,
          args
        })

        if (this.enableLog) {
          console.log(`[Bridge:${this.id}] Request:`, wrapped)
        }

        return ipcRenderer.invoke(this.requestChannel, wrapped)
      }) as T[typeof key]

      api[key] = method
    }

    // 监听来自主进程的事件
    ipcRenderer.on(this.eventChannel, (_, message: IMessageWrapper) => {
      if (message.ctx.bridgeId !== this.id) return
      
      const handlers = this.messageHandlers.get(message.payload.method) || []
      if (handlers.length > 0) {
        if (this.enableLog) {
          console.log(`[Bridge:${this.id}] Received Event:`, message)
        }
        handlers.forEach(handler => handler(...message.payload.args))
      }
    })

    return api
  }

  /**
   * 获取接口原型
   */
  protected getPrototype<T>(): T {
    return {} as T
  }

  /**
   * 注册事件处理器
   * @param method - 方法名
   * @param handler - 处理函数
   */
  on<K extends keyof T>(
    method: K,
    handler: T[K] extends Function ? T[K] : never
  ): () => void {
    const handlers = this.messageHandlers.get(method as string) || []
    handlers.push(handler)
    this.messageHandlers.set(method as string, handlers)
    
    return () => {
      const handlers = this.messageHandlers.get(method as string)
      if (handlers) {
        const index = handlers.indexOf(handler)
        if (index > -1) {
          handlers.splice(index, 1)
          if (handlers.length === 0) {
            this.messageHandlers.delete(method as string)
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
      [K in FunctionPropertyNames<T>]: T[K] extends (...args: infer P) => infer R
        ? (...args: P) => R | Promise<R>
        : never
    }
  ): void {
    // 验证所有方法都已实现
    const requiredMethods = Object.keys(handlers) as (keyof typeof handlers)[]
    const missingMethods = requiredMethods.filter(method => !handlers[method])
    
    if (missingMethods.length > 0) {
      throw new Error(`Missing handler implementations for methods: ${missingMethods.join(', ')}`)
    }

    ipcMain.handle(this.requestChannel, async (_event, message: IMessageWrapper) => {
      if (!this.validateBridgeId(message.ctx.bridgeId)) {
        throw new Error(`Invalid bridge ID: ${message.ctx.bridgeId}`)
      }

      const { method, args } = message.payload
      const handler = handlers[method as keyof typeof handlers]

      if (!handler) {
        throw new Error(`No handler registered for method: ${String(method)}`)
      }

      if (this.enableLog) {
        console.log(`[Bridge:${this.id}] Handle Request:`, message)
      }

      try {
        const result = await handler(...args)
        return result
      } catch (error) {
        console.error(`[Bridge:${this.id}] Error in ${String(method)}:`, error)
        throw error
      }
    })
  }

  /**
   * 验证 Bridge ID
   * 子类可以重写此方法以实现自定义的 ID 验证逻辑
   * @param bridgeId - 要验证的 Bridge ID
   */
  protected validateBridgeId(bridgeId: string): boolean {
    return bridgeId === this.id
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
    ...args: Parameters<T[K] extends Function ? T[K] : never>
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