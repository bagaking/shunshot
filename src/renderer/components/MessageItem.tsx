import React from 'react'
import { Button, Avatar } from 'antd'
import { CopyOutlined, EditOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { AgentConfig, AgentMessage, AgentRole, ChatCompletionContentPart } from '../../types/agents'
import { CodeBlockRenderer, getMessageString } from './CodeBlockRenderer'

interface MessageItemProps {
  msg: AgentMessage & { id?: string }
  agent?: AgentConfig
  onCopy: (content: string) => void
  onEdit?: (messageId: string) => void
}

const getMessageBubbleStyle = (type: AgentRole): string => {
  switch (type) {
    case 'user':
      return 'bg-gradient-to-br from-blue-500 to-blue-600 text-white prose-invert prose-headings:text-white prose-strong:text-white shadow-sm'
    case 'system':
      return 'bg-gray-100 text-gray-600 prose-headings:text-gray-600 prose-strong:text-gray-600'
    case 'assistant':
      return 'bg-white border border-gray-200 prose-headings:text-gray-700 prose-strong:text-gray-700 shadow-sm'
    default:
      return 'bg-white border border-gray-200 prose-headings:text-gray-700 prose-strong:text-gray-700 shadow-sm'
  }
}

export const MessageItem: React.FC<MessageItemProps> = React.memo(({ msg, agent, onCopy, onEdit }) => {
  if (msg.role === 'system' && !msg.content && !msg.error) {
    return null
  }

  const renderMessageContent = (msg: AgentMessage): React.ReactNode => {
    if (msg.error) {
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center text-red-500 text-sm">
            <span className="mr-2">⚠️</span>
            {msg.error}
          </div>
          {msg.content && (
            <div className="prose prose-sm dark:prose-invert max-w-none text-gray-500">
              <CodeBlockRenderer content={msg.content} />
            </div>
          )}
        </div>
      )
    }

    // Handle array format message content
    if (Array.isArray(msg.content)) {
      return (
        <div className="space-y-2">
          {msg.content.map((part, index) => {
            if (part.type === 'text') {
              return (
                <div key={index} className="prose prose-sm dark:prose-invert max-w-none">
                  <CodeBlockRenderer content={part.text} />
                </div>
              )
            } else if (part.type === 'image_url') {
              return (
                <div key={index} className="max-w-full">
                  <img 
                    src={part.image_url.url} 
                    alt="Content image"
                    className="max-w-full max-h-[300px] w-auto h-auto object-contain rounded-lg"
                  />
                </div>
              )
            }
            return null
          })}
        </div>
      )
    }

    // Handle string format message
    return <CodeBlockRenderer content={msg.content} />
  }

  return (
    <div className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
      {/* Avatar section */}
      <div className="flex flex-col items-center">
        <Avatar 
          className={`w-10 h-10 flex items-center justify-center text-lg shadow-sm ${
            msg.role === 'user' 
              ? 'bg-blue-500 text-white' 
              : 'bg-white border border-gray-200'
          }`}
        >
          {msg.role === 'user' ? 'U' : msg.agent?.icon || agent?.icon}
        </Avatar>
      </div>

      {/* Message content section */}
      <div className="flex flex-col max-w-[85%] relative">
        {/* Message bubble with hover actions */}
        <div className="group">
          <div className={`px-4 py-3 rounded-2xl ${getMessageBubbleStyle(msg.role)}`}>
            {/* Name and description */}
            <div className="mb-2">
              <div className="flex items-baseline gap-2">
                {msg.role !== 'user' && (
                  <>
                    <span className="text-[15px] font-semibold text-gray-900">
                      {msg.agent?.name || agent?.name}
                    </span>
                    {(msg.agent?.description || agent?.description) && (
                      <span className="text-xs text-gray-500">
                        {msg.agent?.description || agent?.description}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Message content */}
            {renderMessageContent(msg)}
          </div>
          
          {/* Actions */}
          {msg.role !== 'user' && (
            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button 
                type="text"
                size="small"
                icon={<CopyOutlined />}
                title="复制"
                onClick={() => onCopy(typeof msg.content === 'string' ? msg.content : getMessageString(msg.content))}
              />
              {onEdit && msg.id && (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  title="编辑"
                  onClick={() => onEdit(msg.id!)}
                />
              )}
            </div>
          )}
        </div>

        {/* Timestamp */}
        <div className={`text-xs text-gray-400 mt-1 ${
          msg.role === 'user' ? 'text-right mr-1' : 'ml-1'
        }`}>
          {dayjs(msg.timestamp).format('HH:mm')}
        </div>
      </div>
    </div>
  )
})