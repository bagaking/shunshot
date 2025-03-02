import { AgentConfig, AgentResult, AgentRunOptions, Conversation } from './agents'
import { Bounds } from '../common/2d'
import { OpenDialogOptions, OpenDialogReturnValue } from 'electron'

export interface ConversationListItem {
  id: string
  agentId: string
  preview: string
  timestamp: number
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
} 

declare global {
  interface Window {
    shunshotCoreAPI: IShunshotCoreAPI
  }
} 