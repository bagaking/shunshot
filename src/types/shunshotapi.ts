import { AgentConfig, AgentResult, AgentRunOptions, Conversation } from './agents'
import { Bounds } from '../common/2d'
import { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

export interface ConversationListItem {
  id: string
  agentId: string
  preview: string
  timestamp: number
}

// OCR处理模式枚举
export enum OCRProcessMode {
  Default = 'default',       // 普通识别
  Formal = 'formal',         // 正式化
  Simple = 'simple',         // 简化表达
  Polish = 'polish',         // 润色完善
  Bullets = 'bullets',       // 要点归纳
  Expand = 'expand'          // 内容扩展
}

export interface IShunshotCoreAPI {
  // 截图相关
  captureScreen: () => Promise<void>
  onStartCapture: (callback: () => void) => () => void
  onScreenCaptureData: (callback: (data: any) => void) => () => void
  onCleanupComplete: (callback: () => void) => () => void
  completeCapture: (bounds: Bounds) => Promise<void>
  copyToClipboard: (bounds: Bounds) => Promise<void>
  saveAnnotatedImage: (imageDataUrl: string, bounds: Bounds) => Promise<void>
  cancelCapture: () => void

  // 窗口相关
  hideWindow: () => Promise<void>
  showWindow: () => Promise<void>
  setWindowSize: (width: number, height: number) => Promise<void>
  openSettings: () => Promise<void>
  setIgnoreSystemShortcuts: (ignore: boolean) => Promise<void>
  showOpenDialog: (options: OpenDialogOptions) => Promise<OpenDialogReturnValue>

  // OCR相关
  requestOCR: (bounds: Bounds) => Promise<{ text?: string, error?: any }>
  ocrWithOptions: (params: { 
    bounds: Bounds, 
    options?: { 
      mode?: OCRProcessMode, 
      customPrompt?: string 
    },
    existingText?: string
  }) => Promise<{ text?: string, error?: any }>

  // 系统相关
  platform: string

  // 插件相关
  loadPlugin: (pluginId: string) => Promise<void>

  // 配置相关
  getPreference: <T>(key: string) => Promise<T | undefined>
  setPreference: <T>(key: string, value: T) => void

  // Agent相关
  getAgents: () => Promise<AgentConfig[]>
  createAgent: (agent: AgentConfig) => Promise<boolean>
  updateAgent: (id: string, config: Partial<AgentConfig>) => Promise<boolean>
  deleteAgent: (id: string) => Promise<boolean>
  runAgent: (id: string, options: AgentRunOptions) => Promise<AgentResult>

  // 会话相关
  getConversations: () => Promise<ConversationListItem[]>
  getConversation: (id: string) => Promise<Conversation | null>
  updateConversation: (id: string, message: string, targetAgentId?: string) => Promise<Conversation>

  // 错误日志相关
  logError: (errorInfo: any) => Promise<void>
} 

declare global {
  interface Window {
    shunshotCoreAPI: IShunshotCoreAPI
  }
} 