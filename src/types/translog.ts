export type LogLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export interface ITransLogAPI {
  log: (...args: any[]) => Promise<void>
  info: (...args: any[]) => Promise<void>
  warn: (...args: any[]) => Promise<void>
  error: (...args: any[]) => Promise<void>
  debug: (...args: any[]) => Promise<void>
}

// 扩展全局 Window 接口
declare global {
  interface Window {
    readonly translogAPI: ITransLogAPI
  }
}

// 防止 TypeScript 将此文件视为普通模块
export {} 