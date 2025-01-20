/**
 * Bridge 通道名称管理
 */
export class BridgeChannels {
  /**
   * 创建从渲染进程到主进程的请求通道名称
   * @param prefix - Bridge 前缀
   */
  static toMain(prefix: string): string {
    return `${prefix}:renderer-to-main:request`
  }

  /**
   * 创建从主进程到渲染进程的响应通道名称
   * @param prefix - Bridge 前缀
   */
  static toRenderer(prefix: string): string {
    return `${prefix}:main-to-renderer:event`
  }

  /**
   * 创建完整的通道名称
   * @param prefix - Bridge 前缀
   * @param direction - 通信方向
   * @param type - 消息类型
   */
  static create(prefix: string, direction: 'up' | 'down', type: string): string {
    return `${prefix}:${direction === 'up' ? 'renderer-to-main' : 'main-to-renderer'}:${type}`
  }
}

/**
 * 消息上下文接口
 * 用于在消息传递过程中携带元数据
 */
export interface IMessageContext {
  /** Bridge 实例ID */
  bridgeId: string
  /** 消息唯一ID */
  messageId: string
  /** 消息时间戳 */
  timestamp: number
  /** 元数据 */
  meta?: Record<string, any>
}

/**
 * 消息包装器接口
 * 用于封装消息内容和上下文
 */
export interface IMessageWrapper<T = any> {
  /** 消息上下文 */
  ctx: IMessageContext
  /** 消息负载 */
  payload: T
}

/**
 * Bridge 配置接口
 */
export interface IBridgeOptions {
  /** Bridge 实例ID */
  id: string
  /** 事件名称前缀 */
  prefix?: string
  /** 是否开启日志 */
  enableLog?: boolean
}

/**
 * 类型工具函数
 */
export type FunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? K : never
}[keyof T]

export type NonFunctionPropertyNames<T> = {
  [K in keyof T]: T[K] extends Function ? never : K
}[keyof T]

export type UnwrapPromise<T> = T extends Promise<infer U> 
  ? UnwrapPromise<U>
  : T extends Promise<infer U> | infer U
  ? U
  : T

export type AsyncifyReturnType<T> = T extends (...args: infer P) => infer R
  ? (...args: P) => Promise<UnwrapPromise<R>>
  : never 