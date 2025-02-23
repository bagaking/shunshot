import { Bounds } from '../common/2d'

export type AgentModelGene = "vision" | "reasoning" | "standard"

export interface AgentModelConfig {
  gene: AgentModelGene // e.g. 'vision' or 'reasoning'
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

 
export type ChatCompletionContentPart =
  | ChatCompletionContentPartText
  | ChatCompletionContentPartImage
  | ChatCompletionContentPartInputAudio;
 
export interface ChatCompletionContentPartImage {
  image_url: {
    url: string;
    detail?: 'auto' | 'low' | 'high';
  }
  type: 'image_url';
}

export interface ChatCompletionContentPartInputAudio {
  input_audio: { 
    data: string; 
    format: 'wav' | 'mp3';
  }
  type: 'input_audio';
}

export interface ChatCompletionContentPartText {
  text: string;
  type: 'text';
}


export interface AgentMessage {
  role: AgentRole
  content: string | ChatCompletionContentPart[]
  timestamp?: number
  error?: string
  agent?: {
    id: string
    name: string
    icon: string
    description?: string
  }
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
  conversation?: Conversation
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
      gene: 'vision',
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
      gene: 'vision',
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