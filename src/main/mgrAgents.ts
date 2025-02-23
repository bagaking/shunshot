import OpenAI from 'openai'
import { AgentConfig, AgentResult, AgentRunOptions, DEFAULT_AGENTS, AgentMessage, AgentModelGene, validGenes } from '../types/agents'
import { mgrPreference } from './mgrPreference'
import { Logger } from './logger' 
import { image } from '../common/2d'
import { NativeImage } from 'electron'
import { ConversationManager } from './mgrConversation'

interface ModelConfig {
  apiKey: string
  baseURL: string
  modelName: string
}

// Custom error classes
class AgentError extends Error {
  constructor(message: string, public code: string) {
    super(message)
    this.name = 'AgentError'
  }
}

class ConfigError extends AgentError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR')
  }
}

class ClientError extends AgentError {
  constructor(message: string) {
    super(message, 'CLIENT_ERROR')
  }
}

// Configuration manager
class AgentConfigManager {
  private agents: Map<string, AgentConfig> = new Map()

  constructor() {
    this.loadAgents()
    
    mgrPreference.subscribe((key) => {
      if (key === 'agents') {
        this.loadAgents()
      }
    })
  }

  private loadAgents() {
    try {
      const storedAgents = mgrPreference.get<AgentConfig[]>('agents')
      
      if (!storedAgents?.length) {
        this.setDefaultAgents()
        return
      }

      const validAgents = this.validateAgents(storedAgents)
      if (!validAgents.length) {
        this.setDefaultAgents()
        return
      }

      this.agents = new Map(validAgents.map(agent => [agent.id, agent]))
      Logger.log(`Loaded ${this.agents.size} agents successfully`)
      for (const agent of validAgents) {
        Logger.log(`Agent: ${agent.id}: ${JSON.stringify(agent)}`)
      }
    } catch (error) {
      Logger.error('Failed to load agents', error as Error)
      this.setDefaultAgents()
    }
  }

  private setDefaultAgents() {
    this.agents = new Map(DEFAULT_AGENTS.map(agent => [agent.id, agent]))
    try {
      mgrPreference.set('agents', DEFAULT_AGENTS)
      Logger.log('Initialized with default agents')
    } catch (error) {
      Logger.error('Failed to set default agents', error as Error)
    }
  }

  private validateAgents(agents: AgentConfig[]): AgentConfig[] {
    
    return agents.filter(agent => {
      const isValid = agent?.id && 
        agent?.modelConfig?.gene && 
        validGenes.includes(agent.modelConfig.gene)
      if (!isValid) {
        Logger.warn(`Invalid agent config: ${JSON.stringify(agent)}`)
      }
      return isValid
    })
  }

  getAgent(id: string): AgentConfig | undefined {
    return this.agents.get(id)
  }

  getAllAgents(): AgentConfig[] {
    return Array.from(this.agents.values())
  }

  async createAgent(agent: AgentConfig): Promise<boolean> {
    if (this.agents.has(agent.id)) {
      throw new ConfigError(`Agent already exists: ${agent.id}`)
    }

    // Validate before saving
    if (!agent.modelConfig?.gene || !validGenes.includes(agent.modelConfig.gene)) {
      throw new ConfigError(`Invalid agent configuration: missing or invalid modelConfig.gene`)
    }

    this.agents.set(agent.id, agent)
    await this.saveAgents()
    return true
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<boolean> {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new ConfigError(`Agent not found: ${id}`)
    }

    const updatedAgent = { ...agent, ...updates }
    this.agents.set(id, updatedAgent)
    await this.saveAgents()
    return true
  }

  async deleteAgent(id: string): Promise<boolean> {
    if (!this.agents.has(id)) {
      throw new ConfigError(`Agent not found: ${id}`)
    }

    this.agents.delete(id)
    await this.saveAgents()
    return true
  }

  private async saveAgents() {
    try {
      const allAgents = Array.from(this.agents.values())
      await mgrPreference.set('agents', allAgents)
      Logger.log(`Agents saved successfully, ${allAgents.length} agents`)
      for (const agent of allAgents) {
        Logger.log(`Agent: ${agent.id}: ${JSON.stringify(agent)}`)
      }
    } catch (error) {
      Logger.error('Failed to save agents', error as Error)
      throw new ConfigError('Failed to save agents')
    }
  }
}

// OpenAI client manager
class OpenAIClientManager {
  private clients: Map<string, OpenAI | null> = new Map()

  constructor() {
    this.initialize()
    
    mgrPreference.subscribe((key) => {
      if (key.startsWith('aiModel.')) {
        this.initialize()
      }
    })
  }

  private async initialize() {
    try {
      await this.initializeClient('vision')
      await this.initializeClient('reasoning')
      await this.initializeClient('standard')
      Logger.log('OpenAI clients initialized')
    } catch (error) {
      Logger.error('Failed to initialize OpenAI clients', error as Error)
      this.clients.clear()
    }
  }

  private async initializeClient(type: AgentModelGene) {
    const config = await mgrPreference.get<ModelConfig>(`aiModel.${type}`)
    this.clients.set(type, config?.apiKey ? new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    }) : null)
  }

  getClient(type: AgentModelGene): OpenAI {
    const client = this.clients.get(type)
    if (!client) {
      throw new ClientError(`OpenAI client not initialized: ${type}`)
    }
    return client
  }
}

// Agent runner
class AgentRunner {
  constructor(
    private configManager: AgentConfigManager,
    private clientManager: OpenAIClientManager,
    private conversationManager: ConversationManager
  ) {}

  async runAgent(id: string, croppedImage: NativeImage, options: AgentRunOptions): Promise<AgentResult> {
    try {
      const agent = this.configManager.getAgent(id)
      if (!agent) {
        throw new AgentError(`Agent not found: ${id}`, 'AGENT_NOT_FOUND')
      }

      if (!agent.enabled) {
        throw new AgentError(`Agent is disabled: ${id}`, 'AGENT_DISABLED')
      }

      const openai = this.clientManager.getClient(agent.modelConfig.gene as AgentModelGene)
      const modelConfig = await mgrPreference.get<ModelConfig>(`aiModel.${agent.modelConfig.gene}`)
      
      if (!modelConfig?.modelName) {
        throw new ConfigError(`Model name not configured: ${agent.modelConfig.gene}`)
      }

      if (!croppedImage) {
        throw new AgentError('No image provided', 'NO_IMAGE_PROVIDED')
      }

      if (!image.meetsMinimumSize(croppedImage)) {
        throw new AgentError('Image is too small', 'INVALID_IMAGE')
      }

      // Get or create conversation
      let conversation = options.conversationId ? 
        this.conversationManager.getConversation(options.conversationId) :
        this.conversationManager.createConversation(id, agent, croppedImage)

      // Add user messages from parameters
      if (options.parameters?.messages) {
        const userMessages = options.parameters.messages.map(m => ({
          role: m.role,
          content: m.content,
          timestamp: Date.now()
        }))
        conversation.messages.push(...userMessages)

        Logger.debug({
          message: 'Conversation state after adding messages',
          data: {
            conversationId: conversation.id,
            totalMessages: conversation.messages.length,
            newMessagesCount: userMessages.length,
            latestMessageRole: userMessages[userMessages.length - 1]?.role,
            timestamp: Date.now()
          }
        })
      }

      // Save conversation state with user messages
      this.conversationManager.updateConversation(conversation.id, conversation)

      // Format messages for OpenAI API - only send necessary data
      const formattedMessages = conversation.messages.map(msg => ({
        role: msg.role,
        content: Array.isArray(msg.content) ? msg.content : msg.content
      }))

      Logger.debug({
        message: 'Sending messages to OpenAI',
        data: {
          messageCount: formattedMessages.length,
          model: modelConfig.modelName,
          conversationId: conversation.id
        }
      })

      // Call OpenAI with conversation history
      const response = await openai.chat.completions.create({
        model: modelConfig.modelName,
        messages: formattedMessages as any,
        max_tokens: agent.parameters?.maxTokens || 4096,
        temperature: agent.parameters?.temperature || 0,
      })

      // Add assistant response
      const assistantMessage: AgentMessage = {
        role: 'assistant' as const,
        content: response.choices[0]?.message?.content || '',
        timestamp: Date.now()
      }
      conversation.messages.push(assistantMessage)

      Logger.debug({
        message: 'Received assistant response',
        data: {
          conversationId: conversation.id,
          totalMessages: conversation.messages.length,
          responseLength: assistantMessage.content.length,
          timestamp: Date.now()
        }
      })

      // Update conversation metadata
      conversation.metadata.updatedAt = Date.now()
      conversation.metadata.turnCount++
      this.conversationManager.updateConversation(conversation.id, conversation)

      // Return only necessary data
      return {
        conversation: {
          id: conversation.id,
          agentId: conversation.agentId,
          messages: conversation.messages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp
          })),
          metadata: {
            createdAt: conversation.metadata.createdAt,
            updatedAt: conversation.metadata.updatedAt,
            turnCount: conversation.metadata.turnCount
          }
        },
        latestMessage: assistantMessage
      }

    } catch (error) {
      Logger.error('Failed to run agent:', error)
      return {
        conversation: options.conversationId ? 
          this.conversationManager.getConversation(options.conversationId) :
          undefined,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }
}

// Main manager class
export class AgentsManager {
  private configManager: AgentConfigManager
  private clientManager: OpenAIClientManager
  private conversationManager: ConversationManager
  private runner: AgentRunner

  constructor() {
    this.configManager = new AgentConfigManager()
    this.clientManager = new OpenAIClientManager()
    this.conversationManager = new ConversationManager()
    this.runner = new AgentRunner(
      this.configManager,
      this.clientManager,
      this.conversationManager
    )
  }

  async getAgents(): Promise<AgentConfig[]> {
    return this.configManager.getAllAgents()
  }

  async createAgent(agent: AgentConfig): Promise<boolean> {
    return this.configManager.createAgent(agent)
  }

  async updateAgent(id: string, updates: Partial<AgentConfig>): Promise<boolean> {
    return this.configManager.updateAgent(id, updates)
  }

  async deleteAgent(id: string): Promise<boolean> {
    return this.configManager.deleteAgent(id)
  }

  async runAgent(id: string, croppedImage: NativeImage, options: AgentRunOptions): Promise<AgentResult> {
    return this.runner.runAgent(id, croppedImage, options)
  }
}

export const mgrAgents = new AgentsManager() 