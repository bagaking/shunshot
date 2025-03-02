import crypto from 'crypto'
import { AgentConfig, Conversation, AgentMessage } from '../types/agents'
import { Logger } from './logger'
import { NativeImage } from 'electron'
import { mgrProject } from './mgrProject'
import * as fs from 'fs/promises'
import { ConversationListItem } from '../types/shunshotapi'
import { mgrAgents } from './mgrAgents'

// Conversation manager
export class ConversationManager {
    private conversations: Map<string, Conversation> = new Map()
    private readonly MAX_CONVERSATIONS = 100
    private readonly MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
  
    constructor() {
      this.startCleanupInterval()
    }
  
    private startCleanupInterval() {
      setInterval(() => this.cleanup(), 60 * 60 * 1000) // Cleanup every hour
    }
  
    private async cleanup() {
      const now = Date.now()
      const expiredConversations: Conversation[] = []

      // Collect expired conversations
      Array.from(this.conversations.entries()).forEach(([id, conversation]) => {
        if (now - conversation.metadata.updatedAt > this.MAX_AGE_MS) {
          expiredConversations.push(conversation)
          this.conversations.delete(id)
          Logger.debug(`Cleaned up conversation from memory: ${id}`)
        }
      })

      // Dump expired conversations to disk if project is configured
      if (expiredConversations.length > 0 && mgrProject.isProjectConfigured()) {
        try {
          await this.dumpConversations(expiredConversations)
          Logger.debug(`Dumped ${expiredConversations.length} expired conversations to disk`)
        } catch (error) {
          Logger.error('Failed to dump expired conversations:', error)
        }
      } else if (expiredConversations.length > 0) {
        Logger.info(`${expiredConversations.length} expired conversations not saved: project not configured`)
      }
    }

    /**
     * Dump conversations to disk
     * @param conversations Optional specific conversations to dump, otherwise dumps all
     */
    async dumpConversations(conversations?: Conversation[]): Promise<void> {
      // Skip if project is not configured
      if (!mgrProject.isProjectConfigured()) {
        Logger.info('Skipping conversation dump: project not configured');
        return;
      }

      const toDump = conversations || Array.from(this.conversations.values())
      
      for (const conversation of toDump) {
        try {
          await mgrProject.saveConversation(conversation)
        } catch (error) {
          Logger.error(`Failed to dump conversation ${conversation.id}:`, error)
          // Continue with next conversation even if one fails
        }
      }
    }

    /**
     * Load a conversation from disk
     * @param id Conversation ID to load
     */
    async loadConversation(id: string): Promise<Conversation | undefined> {
      // Skip if project is not configured
      if (!mgrProject.isProjectConfigured()) {
        Logger.info(`Skipping conversation load (${id}): project not configured`);
        return undefined;
      }

      try {
        const conversationPath = await mgrProject.createConversationPath(id)
        if (!conversationPath) {
          return undefined;
        }

        const data = await fs.readFile(conversationPath, 'utf-8')
        const conversation = JSON.parse(data) as Conversation
        
        // Add to memory cache if not expired
        const now = Date.now()
        if (now - conversation.metadata.updatedAt <= this.MAX_AGE_MS) {
          this.conversations.set(conversation.id, conversation)
        }
        
        return conversation
      } catch (error) {
        Logger.error(`Failed to load conversation ${id}:`, error)
        return undefined
      }
    }
  
    getConversation(id: string): Conversation | undefined {
      let conversation = this.conversations.get(id)
      
      // If not in memory, try to load from disk
      if (!conversation) {
        Logger.debug(`Conversation ${id} not found in memory, attempting to load synchronously`)
        try {
          // 同步加载对话，确保在返回前已经加载完成
          const conversationPath = mgrProject.createConversationPathSync(id)
          if (conversationPath) {
            const fs = require('fs')
            const data = fs.readFileSync(conversationPath, 'utf-8')
            conversation = JSON.parse(data) as Conversation
            
            // Add to memory cache
            this.conversations.set(id, conversation)
            Logger.debug(`Loaded conversation ${id} from disk synchronously`)
          }
        } catch (error) {
          Logger.error(`Failed to load conversation ${id} synchronously:`, error)
          // 如果同步加载失败，尝试异步加载（作为备份）
          this.loadConversation(id)
            .then(loaded => {
              if (loaded) {
                Logger.debug(`Loaded conversation ${id} from disk asynchronously`)
                this.conversations.set(id, loaded)
              }
            })
            .catch(error => {
              Logger.error(`Failed to load conversation ${id} asynchronously:`, error)
            })
        }
      }
      
      return conversation
    }
  
    createConversation(agentId: string, agent: AgentConfig, croppedImage: NativeImage): Conversation {
      if (this.conversations.size >= this.MAX_CONVERSATIONS) {
        this.cleanup()
      }
  
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        agentId,
        messages: [],
        metadata: {
          createdAt: Date.now(),
          updatedAt: Date.now(),
          turnCount: 0
        }
      }
  
      // Add system prompt message
      conversation.messages.push({
        role: 'system',
        content: agent.systemPrompt,
        timestamp: Date.now()
      })
  
      try {
        // Convert image to base64 and create message
        const base64Image = croppedImage.toPNG().toString('base64')
        const imageMessage: AgentMessage = {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${base64Image}`,
              },
            },
            { 
              type: 'text', 
              text: '这张图片说了啥' 
            },
          ],
          timestamp: Date.now()
        }
        
        // Add message to conversation
        conversation.messages.push(imageMessage)
      } catch (error) {
        Logger.error('Failed to process image:', error)
        throw new Error(`Failed to process image: ${error}`)
      }
  
      this.conversations.set(conversation.id, conversation)

      // Dump new conversation to disk if project is configured
      if (mgrProject.isProjectConfigured()) {
        this.dumpConversations([conversation])
          .catch(error => {
            Logger.error(`Failed to save new conversation ${conversation.id}:`, error)
          })
      } else {
        Logger.info(`New conversation ${conversation.id} not saved: project not configured`)
      }

      return conversation
    }
  
    updateConversation(id: string, update: Partial<Conversation>) {
      const conversation = this.conversations.get(id)
      if (!conversation) {
        throw new Error(`Conversation not found: ${id}`)
      }
  
      const updated = {
        ...conversation,
        ...update,
        metadata: {
          ...conversation.metadata,
          updatedAt: Date.now()
        }
      }
  
      this.conversations.set(id, updated)

      // Dump updated conversation to disk if project is configured
      if (mgrProject.isProjectConfigured()) {
        this.dumpConversations([updated])
          .catch(error => {
            Logger.error(`Failed to save updated conversation ${id}:`, error)
          })
      } else {
        Logger.debug(`Conversation ${id} update not saved: project not configured`)
      }

      return updated
    }

    /**
     * Add a conversation to memory cache without updating it
     * @param conversation The conversation to add to memory
     */
    addToMemory(conversation: Conversation): void {
      this.conversations.set(conversation.id, conversation)
      Logger.debug(`Added conversation ${conversation.id} to memory cache`)
    }

    /**
     * Get all conversations
     */
    async getConversations(): Promise<ConversationListItem[]> {
      // 如果项目未配置，返回空列表
      if (!mgrProject.isProjectConfigured()) {
        return []
      }

      try {
        const paths = mgrProject.getPaths()
        if (!paths) return []

        // 读取会话目录
        const files = await fs.readdir(paths.conversations)
        const conversations: ConversationListItem[] = []

        // 处理每个会话文件
        for (const file of files) {
          if (!file.endsWith('.json')) continue

          try {
            const filePath = `${paths.conversations}/${file}`
            const data = await fs.readFile(filePath, 'utf-8')
            const conversation = JSON.parse(data) as Conversation

            // 提取预览文本
            const lastMessage = conversation.messages[conversation.messages.length - 1]
            let preview = ''
            if (lastMessage) {
              if (typeof lastMessage.content === 'string') {
                preview = lastMessage.content
              } else if (Array.isArray(lastMessage.content)) {
                const textContent = lastMessage.content.find(c => c.type === 'text')
                if (textContent && 'text' in textContent) {
                  preview = textContent.text
                }
              }
            }

            conversations.push({
              id: conversation.id,
              agentId: conversation.agentId,
              preview: preview.slice(0, 100), // 限制预览长度
              timestamp: conversation.metadata.updatedAt
            })
          } catch (error) {
            Logger.error(`Failed to process conversation file ${file}:`, error)
          }
        }

        // 按时间戳排序，最新的在前
        return conversations.sort((a, b) => b.timestamp - a.timestamp)
      } catch (error) {
        Logger.error('Failed to get conversations:', error)
        throw error
      }
    }

    /**
     * Update conversation with a new message
     */
    async updateConversationWithMessage(id: string, message: string, targetAgentId?: string): Promise<Conversation> {
      // First check if conversation is in memory
      let conversation = this.conversations.get(id)
      
      // If not in memory, try to load from disk
      if (!conversation) {
        Logger.debug(`Conversation ${id} not found in memory, loading from disk`)
        conversation = await this.loadConversation(id)
        
        // If still not found, throw error
        if (!conversation) {
          Logger.error(`Conversation ${id} not found in memory or on disk`)
          throw new Error(`Conversation not found: ${id}`)
        }
        
        // Ensure it's in memory cache for future operations
        this.addToMemory(conversation)
      }

      // Add user message
      const userMessage: AgentMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      }
      conversation.messages.push(userMessage)

      // Process with agent if specified
      if (targetAgentId) {
        try {
          const result = await mgrAgents.runAgent(targetAgentId, null, {
            selectedBounds: { x: 0, y: 0, width: 100, height: 100 },
            conversationId: id,
            parameters: {
              messages: conversation.messages
            }
          })

          if (result.error) {
            Logger.error(`Agent processing failed: ${result.error}`)
            throw new Error(result.error)
          }

          if (result.conversation?.messages) {
            const latestMessage = result.conversation.messages[result.conversation.messages.length - 1]
            if (latestMessage && latestMessage.role === 'assistant') {
              conversation.messages.push(latestMessage)
            }
          }
        } catch (error) {
          Logger.error('Failed to process message with agent:', error)
          throw error
        }
      }

      // Update metadata
      conversation.metadata.updatedAt = Date.now()
      conversation.metadata.turnCount++

      // Save to memory and disk
      this.conversations.set(id, conversation)
      await this.dumpConversations([conversation])

      return conversation
    }
}
  
// 创建单例
const conversationManager = new ConversationManager()
export { conversationManager as mgrConversation }
  