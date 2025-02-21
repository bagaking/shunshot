import React from 'react'
import { Button } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { AgentConfig, AgentMessage, AgentRole } from '../../types/agents'

interface MessageItemProps {
  msg: AgentMessage
  agent?: AgentConfig
  onCopy: (content: string) => void
}

const getMessageBubbleStyle = (type: AgentRole): string => {
  switch (type) {
    case 'user':
      return 'bg-blue-500 text-white'
    case 'system':
      return 'bg-gray-100 text-gray-600'
    case 'assistant':
      return 'bg-white border border-gray-200'
    default:
      return 'bg-white border border-gray-200'
  }
}

export const MessageItem = React.memo(({ msg, agent, onCopy }: MessageItemProps) => {
  const renderMessageContent = (msg: MessageItemProps['msg']) => {
    if (msg.error) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-red-500 text-sm">
            <span className="mr-2">⚠️</span>
            {msg.error}
          </div>
          {msg.content && (
            <div className="text-gray-500 whitespace-pre-wrap break-words">
              {msg.content}
            </div>
          )}
        </div>
      )
    }

    return (
      <div className="space-y-2">
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        {msg.role !== 'user' && msg.content && (
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => onCopy(msg.content)}
          >
            复制
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`px-4 py-2 rounded-lg max-w-[85%] ${getMessageBubbleStyle(msg.role)}`}>
        {renderMessageContent(msg)}
      </div>
    </div>
  )
})

MessageItem.displayName = 'MessageItem' 