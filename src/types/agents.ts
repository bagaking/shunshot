import { Bounds } from '../common/2d'

export interface AgentModelConfig {
  id: string // e.g. 'vision' or 'inference'
  name: string // Display name
}

export interface AgentConfig {
  id: string
  name: string
  description: string
  icon: string
  systemPrompt: string
  modelConfig: AgentModelConfig
  enabled: boolean
  parameters: {
    temperature?: number // 控制随机性 0-2, 默认 1
    maxTokens?: number // 最大回复长度
    maxTurns?: number // 最大对话轮数
    [key: string]: any // 其他参数
  }
}

export interface AgentMessage {
  role: AgentRole
  content: string
  timestamp: number
  error?: string
}

export interface Conversation {
  id: string
  agentId: string
  messages: AgentMessage[]
  metadata: {
    createdAt: number
    updatedAt: number
    turnCount: number
    [key: string]: any
  }
}

export interface AgentResult {
  conversation: Conversation
  latestMessage?: AgentMessage
  error?: string
}

export type AgentRole = 'user' | 'assistant' | 'system'

export interface AgentRunOptions {
  selectedBounds: Bounds
  conversationId?: string
  parameters?: {
    messages?: AgentMessage[]
    [key: string]: any
  }
}

export const DEFAULT_AGENTS: AgentConfig[] = [
  {
    id: 'text-extractor',
    name: '文字提取',
    description: '提取图片中的文字内容',
    icon: '📝',
    systemPrompt: '请提取图片中的所有文字内容，保持原有格式和布局',
    modelConfig: {
      id: 'vision',
      name: '视觉模型'
    },
    enabled: true,
    parameters: {
      temperature: 0.7,
      maxTokens: 1000,
      maxTurns: 1
    }
  },
  {
    id: 'code-analyzer',
    name: '代码分析',
    description: '分析代码截图内容',
    icon: '💻',
    systemPrompt: '分析这段代码的功能、结构和潜在问题，并给出改进建议',
    modelConfig: {
      id: 'vision',
      name: '视觉模型'
    },
    enabled: true,
    parameters: {
      temperature: 0.3,
      maxTokens: 2000,
      maxTurns: 1
    }
  }
] 