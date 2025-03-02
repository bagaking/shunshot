import React, { useState, useEffect, useMemo } from 'react'
import { ChatPanel } from '../panels/ChatPanel'
import { AgentConfig, AgentMessage, Conversation } from '../../types/agents'
import { translog } from '../utils/translog'
import { Spin, Empty } from 'antd'
import { ConversationListItem } from '../../types/shunshotapi'

interface ProjectPanelProps {
  projectPath: string
}

export const ProjectPanel: React.FC<ProjectPanelProps> = ({ projectPath }) => {
  const [conversations, setConversations] = useState<ConversationListItem[]>([])
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentAgent, setCurrentAgent] = useState<AgentConfig | undefined>(undefined)
  const [agents, setAgents] = useState<AgentConfig[]>([])

  // Group conversations by date
  const groupedConversations = useMemo(() => {
    const filtered = conversations.filter(conv => 
      conv.preview.toLowerCase().includes(searchQuery.toLowerCase())
    )

    return filtered.reduce((groups, conv) => {
      const date = new Date(conv.timestamp)
      const dateKey = date.toLocaleDateString()
      
      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(conv)
      return groups
    }, {} as Record<string, ConversationListItem[]>)
  }, [conversations, searchQuery])

  // 加载会话列表
  useEffect(() => {
    const loadConversations = async () => {
      try {
        const list = await window.shunshotCoreAPI.getConversations()
        setConversations(list)
        setLoading(false)
      } catch (error) {
        translog.error('Failed to load conversations:', error)
        setLoading(false)
      }
    }

    loadConversations()
  }, [projectPath])

  // 加载可用的 agents
  useEffect(() => {
    window.shunshotCoreAPI.getAgents()
      .then(setAgents)
      .catch(error => {
        translog.error('Failed to load agents:', error)
      })
  }, [])

  // 处理会话选择
  const handleConversationSelect = async (conversation: ConversationListItem) => {
    try {
      setLoading(true)
      const fullConversation = await window.shunshotCoreAPI.getConversation(conversation.id)
      if (fullConversation) {
        setSelectedConversation(fullConversation)
        const agent = agents.find(a => a.id === conversation.agentId)
        setCurrentAgent(agent)
      }
      setLoading(false)
    } catch (error) {
      translog.error('Failed to load conversation:', error)
      setLoading(false)
    }
  }

  // 处理发送消息
  const handleSend = async (message: string, targetAgentId?: string) => {
    if (!selectedConversation) return

    try {
      const updatedConversation = await window.shunshotCoreAPI.updateConversation(
        selectedConversation.id,
        message,
        targetAgentId
      )
      setSelectedConversation(updatedConversation)

      // 更新会话列表中的预览
      setConversations(prev => {
        const index = prev.findIndex(c => c.id === selectedConversation.id)
        if (index === -1) return prev

        const updated = [...prev]
        updated[index] = {
          ...prev[index],
          preview: message.slice(0, 100),
          timestamp: Date.now()
        }

        return updated.sort((a, b) => b.timestamp - a.timestamp)
      })
    } catch (error) {
      translog.error('Failed to send message:', error)
      throw error
    }
  }

  return (
    <div className="absolute inset-0">
      {/* Sidebar - Fixed width */}
      <div className="absolute top-0 left-0 bottom-0 w-80 bg-white border-r border-gray-100">
        {/* Header - Absolute */}
        <div className="absolute top-0 left-0 right-0 h-[88px] border-b border-gray-100 p-4 bg-white z-10">
          <h3 className="text-lg font-medium text-gray-900 mb-3">历史记录</h3>
          <div className="relative">
            <input
              type="text"
              placeholder="搜索对话..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 pl-9 bg-gray-50 border border-gray-200 
                       rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 
                       focus:border-transparent"
            />
            <svg
              className="absolute left-3 top-2.5 w-4 h-4 text-gray-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>
        
        {/* Conversation List - Absolute positioning with specific top offset */}
        <div className="absolute top-[88px] left-0 right-0 bottom-0 overflow-y-auto">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Spin />
            </div>
          ) : Object.keys(groupedConversations).length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <Empty description={searchQuery ? "未找到相关对话" : "暂无历史记录"} />
            </div>
          ) : (
            <div className="space-y-4 p-3">
              {Object.entries(groupedConversations)
                .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime())
                .map(([date, convs]) => (
                  <div key={date} className="space-y-2">
                    <div className="text-xs font-medium text-gray-500 px-3">
                      {formatRelativeDate(date)}
                    </div>
                    <div className="space-y-1">
                      {convs.map(conv => (
                        <button
                          key={conv.id}
                          onClick={() => handleConversationSelect(conv)}
                          className={`w-full text-left px-4 py-3 rounded-lg transition-all
                                    ${selectedConversation?.id === conv.id
                                      ? 'bg-blue-50 text-blue-600 shadow-sm'
                                      : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                        >
                          <div className="flex items-start space-x-3">
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate mb-1">
                                {conv.preview}
                              </div>
                              <div className="text-xs text-gray-500 flex items-center space-x-2">
                                <span>{new Date(conv.timestamp).toLocaleTimeString()}</span>
                                {conv.agentId && (
                                  <>
                                    <span>•</span>
                                    <span>{agents.find(a => a.id === conv.agentId)?.name || 'Unknown Agent'}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area - Absolute positioning */}
      <div className="absolute top-0 left-80 right-0 bottom-0 bg-gray-50">
        {selectedConversation ? (
          <ChatPanel
            key={selectedConversation.id}
            messages={selectedConversation.messages}
            onSend={handleSend}
            loading={loading}
            agent={currentAgent || undefined}
            getAvailableAgents={() => Promise.resolve(agents)}
          />
        ) : (
          <div className="h-full flex items-center justify-center flex-col space-y-3 text-gray-500">
            <svg className="w-12 h-12 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <div className="text-center">
              <p className="text-sm">选择一个对话开始聊天</p>
              <p className="text-xs text-gray-400 mt-1">或使用截图功能创建新对话</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Helper function to format relative dates
function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  
  if (dateStr === now.toLocaleDateString()) {
    return '今天'
  } else if (dateStr === yesterday.toLocaleDateString()) {
    return '昨天'
  }
  return dateStr
} 