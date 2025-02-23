import crypto from 'crypto'
import { AgentConfig, Conversation, AgentMessage } from '../types/agents'
import { Logger } from './logger'
import { NativeImage } from 'electron'
import { mgrProject } from './mgrProject'
import * as fs from 'fs/promises'

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
        this.loadConversation(id)
          .then(loaded => {
            if (loaded) {
              Logger.debug(`Loaded conversation ${id} from disk`)
            }
          })
          .catch(error => {
            Logger.error(`Failed to load conversation ${id}:`, error)
          })
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
}
  