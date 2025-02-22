import { AgentConfig, AgentMessage, AgentRole, Conversation } from '../../types/agents'
import { Bounds } from '../../common/2d'
import { translog } from '../utils/translog'
import { message as antdMessage } from 'antd'

export class MessageService {
  // 内部状态存储
  private conversations: Map<string, {
    conversation: Conversation,
    panelId: string,
    initialAgent: AgentConfig,
    currentAgent: AgentConfig
  }> = new Map()

  constructor(
    private panelManager: any,
    private selectedBounds: Bounds | null
  ) {}

  // 同步整个会话状态到 Panel
  private syncToPanel(panelId: string, loading = false) {
    const record = Array.from(this.conversations.values())
      .find(record => record.panelId === panelId)
    
    if (!record) {
      translog.warn('No conversation found for panel:', panelId)
      return
    }

    const { conversation, initialAgent } = record
    
    translog.debug('Syncing conversation to panel', {
      panelId,
      conversationId: conversation.id,
      messageCount: conversation.messages.length
    })

    this.panelManager.updatePanel(panelId, {
      contentProps: {
        messages: conversation.messages,
        title: initialAgent.name,
        agent: initialAgent,
        loading,
        conversationId: conversation.id
      }
    })
  }

  // 处理消息发送
  async handleMessage(
    panelId: string,
    message: string,
    agent: AgentConfig,
    targetAgentId?: string
  ) {
    if (!this.selectedBounds) {
      translog.warn('No bounds selected')
      return
    }

    const record = Array.from(this.conversations.values())
      .find(record => record.panelId === panelId)
    
    if (!record) {
      translog.warn('No conversation found for panel:', panelId)
      return
    }

    try {
      // 设置加载状态
      this.syncToPanel(panelId, true)

      // 更新当前 agent
      record.currentAgent = agent

      // 准备新消息
      const newMessage: AgentMessage = {
        role: 'user' as AgentRole,
        content: [{ type: 'text', text: message }],
        timestamp: Date.now(),
        agent: {
          id: agent.id,
          name: agent.name,
          icon: agent.icon,
          description: agent.description
        }
      }

      // 更新内部状态
      record.conversation.messages.push(newMessage)

      // 调用 Agent
      const result = await window.shunshotCoreAPI.runAgent(
        targetAgentId || agent.id,
        {
          selectedBounds: this.selectedBounds,
          conversationId: record.conversation.id,
          parameters: { 
            messages: record.conversation.messages 
          }
        }
      )

      // 处理结果
      if (result.conversation) {
        const agentList = await window.shunshotCoreAPI.getAgents()
        const nextAgent = targetAgentId ? 
          agentList.find(a => a.id === targetAgentId) : 
          agent

        // 只获取最新的回复消息
        const latestMessage = result.conversation.messages[result.conversation.messages.length - 1]
        if (latestMessage && latestMessage.role === 'assistant') {
          // Add agent info to assistant message
          latestMessage.agent = {
            id: nextAgent?.id || agent.id,
            name: nextAgent?.name || agent.name,
            icon: nextAgent?.icon || agent.icon,
            description: nextAgent?.description || agent.description
          }
          record.conversation.messages.push(latestMessage)
        }
        
        // 更新其他会话信息
        record.conversation.id = result.conversation.id

        // 同步到 Panel
        this.syncToPanel(panelId)
      }

      if (result.error) {
        translog.error('Agent error:', result.error)
        antdMessage.error(result.error)
      }

    } catch (error) {
      translog.error('Message handling failed:', error)
      antdMessage.error('消息处理失败')
    } finally {
      this.syncToPanel(panelId, false)
    }
  }

  // 初始化会话
  async initializeConversation(
    panelId: string,
    agentId: string,
    selectedAgent: AgentConfig,
    agentList: AgentConfig[]
  ) {
    if (!this.selectedBounds) return null

    try {
      const result = await window.shunshotCoreAPI.runAgent(
        agentId,
        {
          selectedBounds: this.selectedBounds,
          parameters: { messages: [] }
        }
      )

      if (result.conversation) {
        // 保存到内部状态
        this.conversations.set(result.conversation.id, {
          conversation: result.conversation,
          panelId,
          initialAgent: selectedAgent,
          currentAgent: selectedAgent
        })

        return {
          messages: result.conversation.messages,
          title: selectedAgent.name,
          agent: selectedAgent,
          loading: false,
          conversationId: result.conversation.id
        }
      }

      if (result.error) {
        translog.error('Conversation initialization failed:', result.error)
        antdMessage.error(result.error)
      }

      return null
    } catch (error) {
      translog.error('Conversation initialization failed:', error)
      throw error
    }
  }

  // 编辑消息
  async editMessage(panelId: string, messageIndex: number, newContent: string) {
    const record = Array.from(this.conversations.values())
      .find(record => record.panelId === panelId)
    
    if (!record) return

    try {
      record.conversation.messages[messageIndex].content = newContent
      this.syncToPanel(panelId)
    } catch (error) {
      translog.error('Failed to edit message:', error)
      antdMessage.error('编辑消息失败')
    }
  }

  // 删除消息
  async deleteMessage(panelId: string, messageIndex: number) {
    const record = Array.from(this.conversations.values())
      .find(record => record.panelId === panelId)
    
    if (!record) return

    try {
      record.conversation.messages.splice(messageIndex, 1)
      this.syncToPanel(panelId)
    } catch (error) {
      translog.error('Failed to delete message:', error)
      antdMessage.error('删除消息失败')
    }
  }

  // 清理会话
  cleanup(panelId: string) {
    const recordToRemove = Array.from(this.conversations.entries())
      .find(([_, record]) => record.panelId === panelId)
    
    if (recordToRemove) {
      this.conversations.delete(recordToRemove[0])
    }
  }
} 