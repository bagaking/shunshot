import React, { useRef, useCallback, useEffect } from 'react'
import { Mention, MentionsInput, SuggestionDataItem } from 'react-mentions'
import { AgentConfig } from '../../../types/agents'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  placeholder?: string
  disabled?: boolean
  agents: AgentConfig[]
  selectedAgent?: AgentConfig
  onMentionSelect?: (agentId: string) => void
}

interface AgentSuggestion extends SuggestionDataItem {
  icon?: string
}

const mentionInputStyle = {
  input: {
    overflow: 'auto',
    height: 'auto',
    outline: 'none',
    border: 'none',
  },
  highlighter: {
    overflow: 'hidden',
    height: 'auto',
    border: 'none',
  },
  control: {
    backgroundColor: 'transparent',
    fontWeight: 'normal',
    borderRadius: '0.75rem',
    overflow: 'hidden',
  },
  suggestions: {
    backgroundColor: '#ffffff',
    border: '1px solid rgba(229, 231, 235, 1)',
    borderRadius: '0.75rem',
    fontSize: '12px',
    // padding: '0',
    // margin: '0',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    marginTop: '0.5rem',
    list: {
      backgroundColor: 'transparent',
      padding: '0',
      margin: '0',
      borderRadius: '0.75rem',
    }
  },
}

export const MentionInput: React.FC<MentionInputProps> = ({
  value,
  onChange,
  onSend,
  placeholder,
  disabled,
  agents,
  selectedAgent,
  onMentionSelect
}) => {
  const inputRef = useRef<any>(null)
  const isComposing = useRef(false)
  const shouldSendOnCompositionEnd = useRef(false)

  // Set initial mention if selectedAgent exists
  useEffect(() => {
    if (selectedAgent && onMentionSelect) {
      onMentionSelect(selectedAgent.id)
    }
  }, [selectedAgent, onMentionSelect])

  const handleChange = useCallback((event: any, newValue: string, newPlainTextValue: string, mentions: any[]) => {
    onChange(newPlainTextValue)
    // If there are new mentions and onMentionSelect is provided
    if (mentions?.length > 0 && onMentionSelect) {
      const lastMention = mentions[mentions.length - 1]
      onMentionSelect(String(lastMention.id))
    }
  }, [onChange, onMentionSelect])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Always prevent event bubbling
    e.stopPropagation()

    // Handle enter key
    if (e.key === 'Enter' && !e.shiftKey) {
      if (e.nativeEvent.isComposing) {
        // If composing, mark that we should send on composition end
        shouldSendOnCompositionEnd.current = true
      } else if (!isComposing.current) {
        // If not composing at all, send immediately
        e.preventDefault()
        onSend()
      }
    }
  }, [onSend])

  const handleCompositionStart = useCallback(() => {
    isComposing.current = true
  }, [])

  const handleCompositionEnd = useCallback(() => {
    isComposing.current = false
    // If we marked to send on composition end, do it now
    if (shouldSendOnCompositionEnd.current) {
      shouldSendOnCompositionEnd.current = false
      onSend()
    }
  }, [onSend])

  return (
    <div className="relative w-full">
      <MentionsInput
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onCompositionStart={handleCompositionStart}
        onCompositionEnd={handleCompositionEnd}
        placeholder={placeholder}
        disabled={disabled}
        className="mentions-input"
        style={mentionInputStyle}
        inputRef={inputRef}
        forceSuggestionsAboveCursor
        a11ySuggestionsListLabel="切换 Agent"
      >
        <Mention
          trigger="@"
          data={agents.map(agent => ({
            id: agent.id,
            display: agent.name,
            icon: agent.icon
          }))}
          className="mention-item"
          renderSuggestion={(suggestion: AgentSuggestion, search, highlightedDisplay, index, focused) => (
            <div className={`flex items-center space-x-2 px-4 py-2 ${focused ? 'bg-gray-50' : ''}`}>
              <span className="text-lg">{suggestion.icon}</span>
              <span className="font-medium">{suggestion.display}</span>
            </div>
          )}
          displayTransform={(id, display) => `@${display}`}
          onAdd={(id) => onMentionSelect?.(String(id))}
        />
      </MentionsInput>

      <div className="[&_.mentions-input]:w-full [&_.mentions__input]:w-full [&_.mentions__input]:px-4 [&_.mentions__input]:py-2 [&_.mentions__input]:rounded-xl [&_.mentions__input]:border [&_.mentions__input]:border-gray-200 [&_.mentions__input]:bg-white [&_.mentions__input]:hover:border-gray-300 [&_.mentions__input]:focus:border-blue-400 [&_.mentions__input]:transition-colors [&_.mentions__input]:outline-none [&_.mentions__input]:focus:ring-0 [&_.mentions__input]:min-h-[34px] [&_.mentions__input]:leading-5 [&_.mentions__input:disabled]:bg-gray-50 [&_.mentions__input:disabled]:cursor-not-allowed [&_.mentions__input::placeholder]:text-gray-400 [&_.mentions__highlighter]:px-4 [&_.mentions__highlighter]:py-2 [&_.mentions__highlighter]:min-h-[34px] [&_.mentions__highlighter]:leading-5 [&_.mentions__highlighter]:rounded-xl [&_.mentions__suggestions__list]:rounded-xl [&_.mention-item]:text-blue-500 [&_.mention-item]:font-medium" />
    </div>
  )
} 