import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BasePanel, BasePanelProps } from './BasePanel'
import { Button, message, Mentions } from 'antd'
import type { MentionsOptionProps } from 'antd/es/mentions'
import { SendOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { AgentConfig, AgentMessage } from '../../types/agents'
import { throttle } from 'lodash'
import { translog } from '../utils/translog'
import { PanelErrorBoundary } from './PanelErrorBoundary'
import { MessageItem } from '../components/MessageItem'

interface ChatPanelProps extends Omit<BasePanelProps, 'children'> {
  messages?: AgentMessage[]
  onSend?: (message: string, targetAgentId?: string) => Promise<void>
  loading?: boolean
  agent?: AgentConfig
  getAvailableAgents?: () => Promise<AgentConfig[]>
}

interface ChatState {
  input: string
  error?: string
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

  // 状态管理优化：合并相关状态
  const [chatState, setChatState] = useState<ChatState>({
    input: '',
    error: undefined,
    availableAgents: []
  })
  const [isExpanded, setIsExpanded] = useState(true)
  
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<any>(null)

  // 优化：使用 throttle 避免频繁滚动
  const scrollToBottom = useCallback(throttle(() => {
    if (!messagesEndRef.current) {
      translog.debug('Message end ref not available for scrolling')
      return
    }

    try {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
      translog.debug('Successfully scrolled chat to bottom')
    } catch (error) {
      translog.error('Failed to scroll chat to bottom', {
        error: error instanceof Error ? error.message : String(error),
        stackTrace: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString()
      })
    }
  }, 100), [])

  useEffect(() => {
    // 当有消息或 agent 信息时保持展开
    if ((messages?.length ?? 0) > 0 || agent) {
      translog.debug('Expanding chat panel', {
        messageCount: messages.length,
        hasAgent: !!agent
      })
      setIsExpanded(true)
    }
  }, [messages, agent])

  useEffect(() => {
    if (isExpanded) {
      translog.debug('Scrolling to bottom', {
        messageCount: messages.length,
        isExpanded
      })
      scrollToBottom()
    }
  }, [messages, isExpanded, scrollToBottom])

  // 优化：统一的事件阻止函数
  const preventEventBubbling = useCallback((e: React.SyntheticEvent) => {
    e.stopPropagation()
    if ('nativeEvent' in e) {
      e.nativeEvent.stopImmediatePropagation()
    }
  }, [])

  // 加载可用的 agents
  useEffect(() => {
    if (getAvailableAgents) {
      getAvailableAgents().then(agents => {
        setChatState(prev => ({ ...prev, availableAgents: agents }))
      }).catch(error => {
        translog.error('Failed to load available agents:', error)
      })
    }
  }, [getAvailableAgents])

  // 处理@提及和消息发送
  const handleSend = useCallback(async (e?: React.KeyboardEvent) => {
    try {
      if (e) {
        preventEventBubbling(e)
      }
      
      const { input, availableAgents } = chatState
      if (!input.trim() || !onSend) return

      // 解析@提及
      const mentionMatch = input.match(/@(\w+)/)
      let targetAgentId = agent?.id
      let finalMessage = input.trim()

      if (mentionMatch) {
        const mentionedAgentId = mentionMatch[1]
        const mentionedAgent = availableAgents.find(a => a.id === mentionedAgentId)
        
        if (mentionedAgent) {
          targetAgentId = mentionedAgent.id
          // 移除@提及部分
          finalMessage = input.replace(/@\w+\s*/, '').trim()
        }
      }

      if (!finalMessage) return

      await onSend(finalMessage, targetAgentId)
      setChatState(prev => ({ ...prev, input: '', error: undefined }))
      
    } catch (error) {
      console.error('[ChatPanel] Failed to send message:', error)
      setChatState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送消息失败'
      }))
      message.error('发送消息失败')
    }
  }, [chatState, onSend, preventEventBubbling, agent])

  const handleCopy = useCallback(async (content: string) => {
    try {
      await navigator.clipboard.writeText(content)
      message.success('已复制到剪贴板')
    } catch (error) {
      console.error('[ChatPanel] Failed to copy content:', error)
      message.error('复制失败')
    }
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    preventEventBubbling(e)
    if (e.key === 'Enter' && !e.shiftKey) {
      handleSend(e)
    }
  }, [handleSend, preventEventBubbling])

  const handleInputChange = useCallback((value: string) => {
    setChatState(prev => ({ ...prev, input: value }))
  }, [])

  // 优化：使用 useMemo 缓存 agent 选项
  const agentOptions = useMemo(() => chatState.availableAgents.map(agent => ({
    value: agent.id,
    label: `${agent.icon} ${agent.name}`,
    key: agent.id
  })), [chatState.availableAgents])

  const content = (
    <div className="flex flex-col h-full" onClick={preventEventBubbling}>
      {/* Agent 信息头部 */}
      {agent && (
        <div className="flex items-center p-4 bg-transparent">
          <div className="text-2xl mr-3 flex items-center justify-center w-12 h-12 rounded-2xl bg-blue-50/50 text-blue-500 backdrop-blur-sm shadow-sm">
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate text-gray-700">{agent.name}</div>
            <div className="text-sm text-gray-500 truncate">{agent.description}</div>
          </div>
        </div>
      )}

      {/* 消息列表区域 */}
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

      {/* 错误提示 */}
      {chatState.error && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="px-4 py-3 bg-red-50/50 backdrop-blur-sm border-t border-red-100"
        >
          <div className="text-red-500 text-sm">{chatState.error}</div>
        </motion.div>
      )}

      {/* 输入区域 */}
      {onSend && (
        <div className="flex-none p-4 border-t border-gray-100 bg-white/50 backdrop-blur-sm">
          <div className="flex space-x-2">
            <Mentions
              ref={inputRef}
              value={chatState.input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder={`输入消息继续对话... 使用 @ 切换 Agent${loading ? ' (处理中...)' : ''}`}
              disabled={loading}
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="flex-1 !rounded-xl !border-gray-200 hover:!border-gray-300 focus:!border-blue-400 transition-colors"
              onClick={preventEventBubbling}
              onFocus={preventEventBubbling}
              onBlur={preventEventBubbling}
              prefix="@"
              split=" "
              placement="top"
              dropdownClassName="rounded-xl shadow-lg border-gray-200/50 backdrop-blur-sm bg-white/90"
              filterOption={(input: string, option: MentionsOptionProps) => {
                if (!option) return false
                const optionValue = String(option.value || '').toLowerCase()
                const optionLabel = String(option.label || '').toLowerCase()
                const searchValue = input.toLowerCase()
                return optionValue.includes(searchValue) || optionLabel.includes(searchValue)
              }}
              notFoundContent={
                <div className="text-center py-3 text-gray-500">
                  没有找到匹配的 Agent
                </div>
              }
            >
              {chatState.availableAgents.map(agent => (
                <Mentions.Option key={agent.id} value={agent.id}>
                  <div className="flex items-center space-x-2 py-1">
                    <span className="text-lg">{agent.icon}</span>
                    <span className="font-medium">{agent.name}</span>
                  </div>
                </Mentions.Option>
              ))}
            </Mentions>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`px-4 h-[34px] rounded-xl flex items-center justify-center transition-colors ${
                loading || !chatState.input.trim() 
                  ? 'bg-gray-100 text-gray-400' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              }`}
              onClick={() => handleSend()}
              disabled={loading || !chatState.input.trim()}
            >
              {loading ? <LoadingOutlined /> : <SendOutlined />}
              <span className="ml-1">发送</span>
            </motion.button>
          </div>
        </div>
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
          onClick={preventEventBubbling}
        >
          {!isExpanded ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="text-4xl mb-2">
                  {loading ? <LoadingOutlined spin /> : agent?.icon || <RobotOutlined />}
                </div>
                <div className="text-sm text-gray-500">
                  {loading ? '正在处理...' : '准备就绪'}
                </div>
              </div>
            </div>
          ) : (
            content
          )}
        </motion.div>
      </PanelErrorBoundary>
    </BasePanel>
  )
} 