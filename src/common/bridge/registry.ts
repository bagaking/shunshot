import { IMessageWrapper } from './types'
import { BridgeHandler } from './handler'

/**
 * Bridge Registry 类
 * 用于管理和分发消息到对应的 Handler
 */
export class BridgeRegistry {
  /** Handler 映射表 */
  private handlers = new Map<string, BridgeHandler<any>>()

  /**
   * 注册 Handler
   * @param bridgeId - Bridge 实例ID
   * @param handler - Handler 实例
   */
  registerHandler<T extends Record<string, any>>(
    bridgeId: string,
    handler: BridgeHandler<T>
  ): void {
    this.handlers.set(bridgeId, handler)
  }

  /**
   * 注销 Handler
   * @param bridgeId - Bridge 实例ID
   */
  unregisterHandler(bridgeId: string): void {
    this.handlers.delete(bridgeId)
  }

  /**
   * 分发消息到对应的 Handler
   * @param message - 消息包装器
   */
  async dispatch(message: IMessageWrapper): Promise<any> {
    const handler = this.handlers.get(message.ctx.bridgeId)
    if (!handler) {
      throw new Error(`No handler registered for bridge ${message.ctx.bridgeId}`)
    }

    return handler.handle(
      message.payload.method,
      message.payload.args
    )
  }
} 