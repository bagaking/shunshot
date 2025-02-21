import React from 'react'
import { Button } from 'antd'
import { CopyOutlined } from '@ant-design/icons'
import { AgentConfig, AgentMessage, AgentRole, ChatCompletionContentPart } from '../../types/agents'

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

// 将消息内容转换为字符串用于复制
const getMessageString = (content: string | ChatCompletionContentPart[]): string => {
  if (typeof content === 'string') {
    return content
  }
  return content
    .filter(part => part.type === 'text')
    .map(part => (part as { text: string }).text)
    .join('\n')
}

export const MessageItem = React.memo(({ msg, agent, onCopy }: MessageItemProps) => {
  // 不显示 system 消息
  if (msg.role === 'system') {
    return null
  }

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
              {typeof msg.content === 'string' ? msg.content : getMessageString(msg.content)}
            </div>
          )}
        </div>
      )
    }

    // 处理数组格式的消息内容
    if (Array.isArray(msg.content)) {
      return (
        <div className="space-y-2">
          {msg.content.map((part, index) => {
            if (part.type === 'text') {
              return (
                <div key={index} className="whitespace-pre-wrap break-words">
                  {part.text}
                </div>
              )
            } else if (part.type === 'image_url') {
              return (
                <div key={index} className="max-w-full">
                  <img 
                    src={part.image_url.url} 
                    alt="Content image"
                    className="max-w-full h-auto rounded-lg"
                  />
                </div>
              )
            }
            return null
          })}
          {msg.role !== 'user' && (
            <Button
              type="text"
              size="small"
              icon={<CopyOutlined />}
              onClick={() => onCopy(getMessageString(msg.content))}
            >
              复制
            </Button>
          )}
        </div>
      )
    }

    // 处理字符串格式的消息
    return (
      <div className="space-y-2">
        <div className="whitespace-pre-wrap break-words">{msg.content}</div>
        {msg.role !== 'user' && (
          <Button
            type="text"
            size="small"
            icon={<CopyOutlined />}
            onClick={() => onCopy(msg.content as string)}
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