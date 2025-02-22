import React, { useState, useEffect, useRef, useCallback } from 'react'
import { BasePanel, BasePanelProps } from './BasePanel'
import { message as antdMessage } from 'antd'
import { motion, AnimatePresence } from 'framer-motion'
import { AgentConfig, AgentMessage } from '../../types/agents'
import { translog } from '../utils/translog'
import { PanelErrorBoundary } from './PanelErrorBoundary'
import { MessageItem } from '../components/MessageItem'
import { AgentChatInput, SendOptions } from '../components/AgentChatInput'

interface ChatPanelProps extends Omit<BasePanelProps, 'children'> {
  messages?: AgentMessage[]
  onSend?: (message: string, targetAgentId?: string) => Promise<void>
  loading?: boolean
  agent?: AgentConfig
  getAvailableAgents?: () => Promise<AgentConfig[]>
}

interface ChatState {
  availableAgents: AgentConfig[]
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages = [],
  onSend,
  loading,
  agent,
  getAvailableAgents,
  ...basePanelProps
}) => {
  translog.debug('ChatPanel render', {
    messageCount: messages.length,
    hasAgent: !!agent,
    agentId: agent?.id,
    loading
  })

  // State
  const [chatState, setChatState] = useState<ChatState>({
    availableAgents: []
  })
  const [isExpanded, setIsExpanded] = useState(true)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Load available agents
  useEffect(() => {
    if (getAvailableAgents) {
      getAvailableAgents().then(agents => {
        setChatState(prev => ({ ...prev, availableAgents: agents }))
      }).catch(error => {
        translog.error('Failed to load available agents:', error)
      })
    }
  }, [getAvailableAgents])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isExpanded && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isExpanded])

  // Keep expanded when there are messages or agent
  useEffect(() => {
    if ((messages?.length ?? 0) > 0 || agent) {
      setIsExpanded(true)
    }
  }, [messages, agent])

  // Handle message sending with new options
  const handleSend = useCallback(async (message: string, options: SendOptions) => {
    if (!onSend) return

    try {
      await onSend(message, options.agentId)
    } catch (error) {
      translog.error('Failed to send message:', error)
      antdMessage.error('发送消息失败')
    }
  }, [onSend])

  // Handle copy
  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      antdMessage.success('已复制到剪贴板')
    } catch (error) {
      console.error('[ChatPanel] Failed to copy content:', error)
      antdMessage.error('复制失败')
    }
  }, [])

  const content = (
    <div className="flex flex-col rounded-2xl h-full" onClick={e => e.stopPropagation()}>
      {/* Agent info header */}
      {agent && (
        <div className="flex items-center p-4 bg-transparent">
          <div className="text-2xl mr-3 flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50/50 text-blue-500 shadow-sm">
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-gray-700">{agent.name}</div>
            <div className="text-sm text-gray-500 truncate">{agent.description}</div>
          </div>
        </div>
      )}

      {/* Message list */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-2 space-y-4"
        style={{ minHeight: 0 }}
      >
        <AnimatePresence mode="popLayout">
          {messages.map((msg, index) => (
            <motion.div
              key={`${msg.timestamp}-${index}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            >
              <MessageItem
                msg={msg}
                agent={agent}
                onCopy={handleCopy}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Chat input */}
      {onSend && (
        <AgentChatInput
          onSend={handleSend}
          loading={loading}
          agents={chatState.availableAgents}
          disabled={loading}
        />
      )}
    </div>
  )

  return (
    <BasePanel {...basePanelProps}>
      <PanelErrorBoundary>
        <motion.div 
          className="h-full"
          initial={false}
          animate={{
            opacity: 1
          }}
          transition={{ duration: 0.3 }}
          onClick={e => e.stopPropagation()}
        >
          {content}
        </motion.div>
      </PanelErrorBoundary>
    </BasePanel>
  )
} 