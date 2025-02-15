import React, { useState, useEffect, useCallback } from 'react'

interface ShortcutRecorderProps {
  value: string
  onChange: (value: string) => void
}

export const ShortcutRecorder: React.FC<ShortcutRecorderProps> = ({
  value,
  onChange
}) => {
  const [recording, setRecording] = useState(false)
  const [currentKeys, setCurrentKeys] = useState<Set<string>>(new Set())

  // 开始录制时禁用系统快捷键
  const startRecording = useCallback(() => {
    setRecording(true)
    setCurrentKeys(new Set())
    // 通知主进程禁用系统快捷键
    window.shunshotCoreAPI.setIgnoreSystemShortcuts(true)
  }, [])

  // 结束录制时恢复系统快捷键
  const stopRecording = useCallback((shortcut?: string) => {
    setRecording(false)
    setCurrentKeys(new Set())
    // 通知主进程恢复系统快捷键
    window.shunshotCoreAPI.setIgnoreSystemShortcuts(false)
    if (shortcut) {
      onChange(shortcut)
    }
  }, [onChange])

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return

      e.preventDefault()
      
      const key = e.key === ' ' ? 'Space' : e.key
      setCurrentKeys(prev => {
        const next = new Set(prev || new Set())
        if (e.metaKey) next.add('Command')
        if (e.ctrlKey) next.add('Control')
        if (e.altKey) next.add('Alt')
        if (e.shiftKey) next.add('Shift')
        
        // 添加主键，但不添加修饰键本身
        if (key !== 'Meta' && key !== 'Control' && 
            key !== 'Alt' && key !== 'Shift') {
          next.add(key.toUpperCase())
        }
        
        return next
      })
    },
    [recording]
  )

  const handleKeyUp = useCallback(
    (e: KeyboardEvent) => {
      if (!recording) return

      // 当所有键都松开时，结束录制
      if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        const shortcut = Array.from(currentKeys).join('+')
        if (shortcut) {
          stopRecording(shortcut)
        }
      }
    },
    [recording, currentKeys, stopRecording]
  )

  // 按 Escape 键取消录制
  const handleKeyPress = useCallback(
    (e: KeyboardEvent) => {
      if (recording && e.key === 'Escape') {
        e.preventDefault()
        stopRecording()
      }
    },
    [recording, stopRecording]
  )

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('keypress', handleKeyPress)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('keypress', handleKeyPress)
      // 确保在组件卸载时恢复系统快捷键
      if (recording) {
        window.shunshotCoreAPI.setIgnoreSystemShortcuts(false)
      }
    }
  }, [handleKeyDown, handleKeyUp, handleKeyPress, recording])

  const displayValue = recording 
    ? (currentKeys ? Array.from(currentKeys).join('+') : '') || '按下快捷键...'
    : value

  return (
    <div className="relative">
      <input
        type="text"
        value={displayValue}
        readOnly
        placeholder="点击此处录制快捷键"
        className={`
          w-full px-4 py-2 text-sm
          border border-gray-300 rounded-md
          focus:outline-none focus:ring-2 focus:ring-blue-500
          ${recording ? 'bg-blue-50' : 'bg-white'}
        `}
        onClick={startRecording}
      />
      {recording && (!currentKeys || currentKeys.size === 0) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-blue-600 font-medium">
            请按下快捷键... (按 ESC 取消)
          </span>
        </div>
      )}
    </div>
  )
} 