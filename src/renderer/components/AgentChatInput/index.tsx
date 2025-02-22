import React, { useState, useCallback, useRef, useEffect } from 'react'
import { Button, Mentions, Tooltip, Popover } from 'antd'
import { SendOutlined, LoadingOutlined, DatabaseOutlined, GlobalOutlined, PaperClipOutlined, UndoOutlined, BranchesOutlined } from '@ant-design/icons'
import type { MentionsOptionProps } from 'antd/es/mentions'
import { AgentConfig } from '../../../types/agents'
import { motion } from 'framer-motion'
import { MentionInput } from './MentionInput'

export interface AgentChatInputProps {
  onSend: (message: string, options: SendOptions) => Promise<void>
  loading?: boolean
  agents: AgentConfig[]
  disabled?: boolean
  defaultAgent?: AgentConfig
}

export interface SendOptions {
  agentId?: string
  useKnowledgeBase?: boolean
  useInternet?: boolean
  attachments?: File[]
}

interface InputState {
  message: string
  selectedAgent?: AgentConfig
  useKnowledgeBase: boolean
  useInternet: boolean
  attachments: File[]
}

// Feature toggles component
const FeatureToggles: React.FC<{
  state: InputState
  onChange: (updates: Partial<InputState>) => void
}> = ({ state, onChange }) => {
  return (
    <div className="flex items-center space-x-2">
      <Tooltip title="使用知识库">
        <Button
          type={state.useKnowledgeBase ? "primary" : "text"}
          icon={<DatabaseOutlined />}
          size="small"
          onClick={() => onChange({ useKnowledgeBase: !state.useKnowledgeBase })}
        />
      </Tooltip>
      <Tooltip title="允许联网">
        <Button
          type={state.useInternet ? "primary" : "text"}
          icon={<GlobalOutlined />}
          size="small"
          onClick={() => onChange({ useInternet: !state.useInternet })}
        />
      </Tooltip>
    </div>
  )
}

// Agent selector component
const AgentSelector: React.FC<{
  agents: AgentConfig[]
  selectedAgent?: AgentConfig
  onSelect: (agent: AgentConfig) => void
}> = ({ agents, selectedAgent, onSelect }) => {
  return (
    <Popover
      trigger="click"
      content={
        <div className="w-48 py-1">
          {agents.map(agent => (
            <button
              key={agent.id}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-100 ${
                selectedAgent?.id === agent.id ? 'bg-blue-50 text-blue-600' : 'text-gray-700'
              }`}
              onClick={() => onSelect(agent)}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{agent.icon}</span>
                <span>{agent.name}</span>
              </div>
            </button>
          ))}
        </div>
      }
    >
      <Button 
        size="small"
        className="flex items-center space-x-1"
      >
        <span className="text-lg">{selectedAgent?.icon || '🤖'}</span>
        <span>{selectedAgent?.name || '切换 Agent'}</span>
      </Button>
    </Popover>
  )
}

// Context controller component
const ContextController: React.FC<{
  onSummarize: () => void
  onReset: () => void
}> = ({ onSummarize, onReset }) => {
  return (
    <div className="flex items-center space-x-2">
      <Tooltip title="总结上下文">
        <Button
          type="text"
          icon={<BranchesOutlined />}
          size="small"
          onClick={onSummarize}
        />
      </Tooltip>
      <Tooltip title="重置上下文">
        <Button
          type="text"
          icon={<UndoOutlined />}
          size="small"
          onClick={onReset}
        />
      </Tooltip>
    </div>
  )
}

export const AgentChatInput: React.FC<AgentChatInputProps> = ({
  onSend,
  loading = false,
  agents = [],
  disabled = false,
  defaultAgent
}) => {
  // Input state with default agent
  const [state, setState] = useState<InputState>(() => ({
    message: '',
    selectedAgent: defaultAgent || (agents.length > 0 ? agents[0] : undefined),
    useKnowledgeBase: false,
    useInternet: true,
    attachments: []
  }))

  // Update selected agent when defaultAgent changes
  useEffect(() => {
    if (defaultAgent) {
      setState(prev => ({ ...prev, selectedAgent: defaultAgent }))
    }
  }, [defaultAgent])

  // Refs
  const inputRef = useRef<any>(null)

  // Handlers
  const handleStateChange = useCallback((updates: Partial<InputState>) => {
    setState(prev => ({ ...prev, ...updates }))
  }, [])

  const handleMentionSelect = useCallback((agentId: string) => {
    const selectedAgent = agents.find(agent => agent.id === agentId)
    if (selectedAgent) {
      handleStateChange({ selectedAgent })
    }
  }, [agents, handleStateChange])

  const handleSend = useCallback(async () => {
    if (!state.message.trim() || loading) return

    try {
      await onSend(state.message, {
        agentId: state.selectedAgent?.id,
        useKnowledgeBase: state.useKnowledgeBase,
        useInternet: state.useInternet,
        attachments: state.attachments
      })

      // Reset input state but keep the selected agent
      setState(prev => ({
        ...prev,
        message: '',
        attachments: []
      }))
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }, [state, loading, onSend])

  // File upload handler
  const handleFileUpload = useCallback((files: FileList) => {
    setState(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...Array.from(files)]
    }))
  }, [])

  return (
    <div className="flex flex-col space-y-2 p-4 border-t border-gray-100 bg-white">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <AgentSelector
            agents={agents}
            selectedAgent={state.selectedAgent}
            onSelect={agent => handleStateChange({ selectedAgent: agent })}
          />
          <FeatureToggles
            state={state}
            onChange={handleStateChange}
          />
        </div>
        <ContextController
          onSummarize={() => {/* TODO */}}
          onReset={() => {/* TODO */}}
        />
      </div>

      {/* Input area */}
      <div className="flex space-x-2">
        <div className="flex-1 relative">
          <MentionInput
            value={state.message}
            onChange={value => handleStateChange({ message: value })}
            onSend={handleSend}
            onMentionSelect={handleMentionSelect}
            placeholder={`输入消息继续对话... 使用 @ 切换 Agent${loading ? ' (处理中...)' : ''}`}
            disabled={disabled || loading}
            agents={agents}
            selectedAgent={state.selectedAgent}
          />

          {/* File upload button */}
          <Tooltip title="上传附件">
            <Button
              type="text"
              icon={<PaperClipOutlined />}
              size="small"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => {
                const input = document.createElement('input')
                input.type = 'file'
                input.multiple = true
                input.onchange = (e) => {
                  const files = (e.target as HTMLInputElement).files
                  if (files) handleFileUpload(files)
                }
                input.click()
              }}
            />
          </Tooltip>
        </div>

        {/* Send button */}
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`px-4 h-[34px] rounded-xl flex items-center justify-center transition-colors ${
            loading || !state.message.trim() 
              ? 'bg-gray-100 text-gray-400' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
          onClick={handleSend}
          disabled={loading || !state.message.trim()}
        >
          {loading ? <LoadingOutlined /> : <SendOutlined />}
          <span className="ml-1">发送</span>
        </motion.button>
      </div>

      {/* Attachment preview */}
      {state.attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2">
          {state.attachments.map((file, index) => (
            <div
              key={index}
              className="flex items-center space-x-1 px-2 py-1 bg-gray-100 rounded-lg text-sm"
            >
              <span className="truncate max-w-[120px]">{file.name}</span>
              <Button
                type="text"
                size="small"
                className="!px-1"
                onClick={() => {
                  setState(prev => ({
                    ...prev,
                    attachments: prev.attachments.filter((_, i) => i !== index)
                  }))
                }}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
} 