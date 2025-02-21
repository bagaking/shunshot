import OpenAI from 'openai'
import { AgentConfig, AgentResult, AgentRunOptions, DEFAULT_AGENTS, Conversation, AgentMessage } from '../types/agents'
import { mgrPreference } from './mgrPreference'
import { Logger } from './logger'
import { mgrCapture } from './mgrCapture'
import { image } from '../common/2d'
import { omit } from 'lodash'

interface ModelConfig {
  apiKey: string
  baseURL: string
  modelName: string
}

export class AgentsManager {
  private agents: Map<string, AgentConfig> = new Map()
  private openaiClients: Map<string, OpenAI | null> = new Map()
  private conversations: Map<string, Conversation> = new Map()

  constructor() {
    this.loadAgents()
    this.initializeOpenAI()
    
    // 监听配置变更
    mgrPreference.subscribe((key) => {
      if (key === 'agents' || key.startsWith('aiModel.')) {
        this.loadAgents()
        this.initializeOpenAI()
      }
    })
  }

  private loadAgents() {
    try {
      const storedAgents = mgrPreference.get<AgentConfig[]>('agents')
      
      // 如果没有存储的 agents 或者数组为空，使用默认配置
      if (!storedAgents || storedAgents.length === 0) {
        this.agents = new Map(DEFAULT_AGENTS.map(agent => [agent.id, agent]))
        mgrPreference.set('agents', DEFAULT_AGENTS)
        Logger.log('Initialized with default agents')
      } else {
        // 验证每个 agent 的配置是否完整
        const validAgents = storedAgents.filter(agent => {
          const isValid = agent && agent.id && agent.modelConfig && 
            (agent.modelConfig.id === 'vision' || agent.modelConfig.id === 'inference')
          if (!isValid) {
            Logger.warn(`Invalid agent config found: ${JSON.stringify(agent)}`)
          }
          return isValid
        })
        
        this.agents = new Map(validAgents.map(agent => [agent.id, agent]))
        
        // 如果过滤后没有有效的 agents，使用默认配置
        if (validAgents.length === 0) {
          this.agents = new Map(DEFAULT_AGENTS.map(agent => [agent.id, agent]))
          mgrPreference.set('agents', DEFAULT_AGENTS)
          Logger.log('No valid agents found, restored defaults')
        }
      }
      
      Logger.log(`Loaded ${this.agents.size} agents successfully`)
    } catch (error) {
      Logger.error('Failed to load agents', error as Error)
      // 发生错误时使用默认配置
      this.agents = new Map(DEFAULT_AGENTS.map(agent => [agent.id, agent]))
      try {
        mgrPreference.set('agents', DEFAULT_AGENTS)
        Logger.log('Restored default agents after error')
      } catch (e) {
        Logger.error('Failed to restore default agents', e as Error)
      }
    }
  }

  private async initializeOpenAI() {
    try {
      // 初始化视觉模型客户端
      const visionConfig = await mgrPreference.get<ModelConfig>('aiModel.vision')
      this.openaiClients.set('vision', visionConfig?.apiKey ? new OpenAI({
        apiKey: visionConfig.apiKey,
        baseURL: visionConfig.baseURL,
      }) : null)

      // 初始化推理模型客户端
      const inferenceConfig = await mgrPreference.get<ModelConfig>('aiModel.inference')
      this.openaiClients.set('inference', inferenceConfig?.apiKey ? new OpenAI({
        apiKey: inferenceConfig.apiKey,
        baseURL: inferenceConfig.baseURL,
      }) : null)

      Logger.log('OpenAI clients initialized')
    } catch (error) {
      Logger.error(`Failed to initialize OpenAI clients: ${error instanceof Error ? error.message : String(error)}`)
      this.openaiClients.clear()
    }
  }

  async getAgents(): Promise<AgentConfig[]> {
    return Array.from(this.agents.values())
  }

  async createAgent(agent: AgentConfig): Promise<boolean> {
    try {
      if (this.agents.has(agent.id)) {
        Logger.warn(`Agent already exists: ${agent.id}`)
        return false
      }

      this.agents.set(agent.id, agent)
      
      // 保存所有 agents
      const allAgents = Array.from(this.agents.values())
      mgrPreference.set('agents', allAgents)

      Logger.log(`Agent created successfully: ${agent.id}`)
      return true
    } catch (error) {
      Logger.error(`Failed to create agent: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async deleteAgent(id: string): Promise<boolean> {
    try {
      if (!this.agents.has(id)) {
        Logger.warn(`Agent not found: ${id}`)
        return false
      }

      this.agents.delete(id)
      
      // 保存更新后的所有 agents
      const allAgents = Array.from(this.agents.values())
      mgrPreference.set('agents', allAgents)

      Logger.log(`Agent deleted successfully: ${id}`)
      return true
    } catch (error) {
      Logger.error(`Failed to delete agent: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<boolean> {
    try {
      const agent = this.agents.get(id)
      if (!agent) {
        Logger.warn(`Agent not found: ${id}`)
        return false
      }

      const updatedAgent = { ...agent, ...updates }
      this.agents.set(id, updatedAgent)

      // 保存更新后的所有 agents
      const allAgents = Array.from(this.agents.values())
      mgrPreference.set('agents', allAgents)

      Logger.log(`Agent updated successfully: ${id}`)
      return true
    } catch (error) {
      Logger.error(`Failed to update agent: ${error instanceof Error ? error.message : String(error)}`)
      return false
    }
  }

  async runAgent(id: string, options: AgentRunOptions): Promise<AgentResult> {
    try {
      const agent = this.agents.get(id)
      if (!agent) {
        throw new Error(`Agent not found: ${id}`)
      }

      if (!agent.enabled) {
        throw new Error(`Agent is disabled: ${id}`)
      }

      // 验证模型配置
      if (!agent.modelConfig || !agent.modelConfig.id) {
        throw new Error(`Invalid model configuration for agent: ${id}`)
      }

      const openai = this.openaiClients.get(agent.modelConfig.id)
      if (!openai) {
        throw new Error(`OpenAI client not initialized for model: ${agent.modelConfig.id}`)
      }

      const modelConfig = await mgrPreference.get<ModelConfig>(`aiModel.${agent.modelConfig.id}`)
      if (!modelConfig?.modelName) {
        throw new Error(`Model name not configured for: ${agent.modelConfig.id}`)
      }

      // 获取当前捕获数据
      const currentData = mgrCapture.getCurrentData()
      if (!currentData) {
        throw new Error('No capture data available')
      }

      if (!currentData.fullImage) {
        throw new Error('No image data available')
      }

      // 验证选择区域
      if (!options.selectedBounds || 
          options.selectedBounds.width <= 0 || 
          options.selectedBounds.height <= 0) {
        throw new Error('Invalid selection bounds')
      }

      // 裁剪图像
      Logger.debug(`Cropping image with bounds: ${JSON.stringify(options.selectedBounds)}`)
      const croppedImage = image.cropFromDisplay(
        currentData.fullImage,
        options.selectedBounds,
        currentData.bounds
      )

      if (!croppedImage) {
        throw new Error('Failed to crop image')
      }

      // 验证裁剪后的图像
      if (!image.meetsMinimumSize(croppedImage)) {
        throw new Error('Cropped image is too small')
      }

      // 转换为 base64
      const imageData = croppedImage.toDataURL()
      
      Logger.debug(`Running agent ${id} with model ${modelConfig.modelName}`)
      agent.parameters = agent.parameters || {}
      const otherParams = omit(agent.parameters, 'messages')

      // Get or create conversation
      const conversationId = options.conversationId || crypto.randomUUID()
      let conversation = this.conversations.get(conversationId) || {
        id: conversationId,
        agentId: id,
        messages: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          turnCount: 0
        }
      }

      // Add system message if it's a new conversation
      if (conversation.messages.length === 0) {
        conversation.messages.push({
          role: 'system',
          content: agent.systemPrompt,
          timestamp: Date.now()
        })
      }

      // Add user message with image
      const userMessage: AgentMessage = {
        role: 'user',
        content: JSON.stringify([
          { type: 'text', text: '请分析这张图片' },
          {
            type: 'image_url',
            image_url: { url: imageData }
          }
        ]),
        timestamp: Date.now()
      }
      conversation.messages.push(userMessage)

      // Add any additional messages from parameters
      if (options.parameters?.messages) {
        conversation.messages.push(
          ...options.parameters.messages.map(m => ({
            ...m,
            timestamp: Date.now()
          }))
        )
      }

      // Call OpenAI
      const response = await openai.chat.completions.create({
        model: modelConfig.modelName,
        messages: conversation.messages.map(({ role, content }) => ({ role, content })),
        ...otherParams
      })

      // Add assistant response
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: response.choices[0]?.message?.content || '',
        timestamp: Date.now()
      }
      conversation.messages.push(assistantMessage)

      // Update conversation metadata
      conversation.metadata.updatedAt = Date.now()
      conversation.metadata.turnCount++

      // Store updated conversation
      this.conversations.set(conversationId, conversation)

      return {
        conversation,
        latestMessage: assistantMessage
      }

    } catch (error) {
      Logger.error(`Failed to run agent: ${error instanceof Error ? error.message : String(error)}`)
      return {
        conversation: this.conversations.get(options.conversationId!) || {
          id: crypto.randomUUID(),
          agentId: id,
          messages: [],
          metadata: {
            createdAt: Date.now(),
            updatedAt: Date.now(),
            turnCount: 0
          }
        },
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  // Add methods to manage conversations
  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id)
  }

  async deleteConversation(id: string): Promise<boolean> {
    return this.conversations.delete(id)
  }

  async clearConversations(): Promise<void> {
    this.conversations.clear()
  }
}
 
export const mgrAgents = new AgentsManager() 