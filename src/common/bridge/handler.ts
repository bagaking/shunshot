/**
 * Bridge Handler 基类
 * 用于处理来自特定 Bridge 实例的消息
 * @template T - API 接口定义
 */
export abstract class BridgeHandler<T extends Record<string, any>> {
  constructor(protected bridgeId: string) {}

  /**
   * 处理消息
   * @param method - 方法名
   * @param args - 方法参数
   */
  abstract handle(method: keyof T, args: any[]): Promise<any>
} 