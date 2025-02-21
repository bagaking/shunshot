import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { BasePanel, BasePanelProps } from './BasePanel'
import { Button, List, message, Mentions } from 'antd'
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
  availableAgents?: AgentConfig[]
}

interface ChatState {
  input: string
  selectedAgent?: string
  error?: string
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages = [],
  onSend,
  loading,
  agent,
  availableAgents = [],
  ...basePanelProps
}) => {
  // 状态管理优化：合并相关状态
  const [chatState, setChatState] = useState<ChatState>({
    input: '',
    selectedAgent: agent?.id,
    error: undefined
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
      setIsExpanded(true)
    }
  }, [messages, agent])

  useEffect(() => {
    if (isExpanded) {
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

  // 优化：使用 useCallback 缓存事件处理函数
  const handleSend = useCallback(async (e?: React.KeyboardEvent) => {
    try {
      if (e) {
        preventEventBubbling(e)
      }
      
      const { input, selectedAgent: targetAgentId } = chatState
      if (!input.trim() || !onSend) return

      // 解析@提及
      const mentionMatch = input.match(/@(\w+)/)
      const finalTargetAgentId = mentionMatch ? mentionMatch[1] : targetAgentId

      await onSend(input.trim(), finalTargetAgentId)
      setChatState(prev => ({ ...prev, input: '', error: undefined }))
    } catch (error) {
      console.error('[ChatPanel] Failed to send message:', error)
      setChatState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : '发送消息失败'
      }))
      message.error('发送消息失败')
    }
  }, [chatState, onSend, preventEventBubbling])

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
  const agentOptions = useMemo(() => availableAgents.map(agent => ({
    value: agent.id,
    label: agent.name,
    key: agent.id
  })), [availableAgents])

  const content = (
    <div className="flex flex-col h-full" onClick={preventEventBubbling}>
      {/* Agent 信息头部 */}
      {agent && (
        <div className="flex items-center p-4 border-b border-gray-200 bg-gray-50">
          <div className="text-2xl mr-3 flex items-center justify-center w-10 h-10 rounded-lg bg-blue-50 text-blue-500">
            {agent.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-medium truncate">{agent.name}</div>
            <div className="text-sm text-gray-500 truncate">{agent.description}</div>
          </div>
        </div>
      )}

      {/* 消息列表区域 */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto p-4"
        style={{ minHeight: 0 }} // 确保 flex-1 正常工作
      >
        <AnimatePresence mode="popLayout">
          <List
            dataSource={messages}
            renderItem={(msg) => (
              <MessageItem
                msg={msg}
                agent={agent}
                onCopy={handleCopy}
              />
            )}
          />
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* 错误提示 */}
      {chatState.error && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200">
          <div className="text-red-500 text-sm">{chatState.error}</div>
        </div>
      )}

      {/* 输入区域 */}
      {onSend && (
        <div className="flex-none p-4 border-t border-gray-200 bg-white">
          <div className="flex space-x-2">
            <Mentions
              ref={inputRef}
              value={chatState.input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              placeholder="输入消息继续对话... 使用 @ 切换 Agent"
              disabled={loading}
              autoSize={{ minRows: 1, maxRows: 4 }}
              className="flex-1"
              options={agentOptions}
              onClick={preventEventBubbling}
              onFocus={preventEventBubbling}
              onBlur={preventEventBubbling}
            />
            <Button
              type="primary"
              onClick={() => handleSend()}
              icon={<SendOutlined />}
              loading={loading}
            >
              发送
            </Button>
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