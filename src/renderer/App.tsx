import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import Draggable from 'react-draggable'

const queryClient = new QueryClient()

const MainContent: React.FC = () => {
  console.log('MainContent rendering, location:', useLocation())
  const [isMinimized, setIsMinimized] = useState(false)
  
  const handleScreenshot = async () => {
    console.log('Screenshot button clicked')
    try {
      // 隐藏主窗口
      if (window.electronAPI.platform === 'darwin') {
        // macOS 上使用 setVisibleOnAllWorkspaces 来隐藏窗口
        await window.electronAPI.hideWindow()
      }
      await window.electronAPI.captureScreen()
    } catch (error) {
      console.error('Screenshot failed:', error)
    }
  }

  const shortcutKey = window.electronAPI.platform === 'darwin' ? '⌘⇧X' : 'Ctrl+Shift+X'

  if (isMinimized) {
    return (
      <Draggable bounds="parent" handle=".drag-handle">
        <div 
          className="w-10 h-10 rounded-full bg-blue-500 hover:bg-blue-600 shadow-lg cursor-pointer flex items-center justify-center text-white drag-handle"
          onClick={() => setIsMinimized(false)}
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
          </svg>
        </div>
      </Draggable>
    )
  }

  return (
    <Draggable bounds="parent" handle=".drag-handle">
      <div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-4 w-[280px]">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4 drag-handle cursor-move">
          <div className="flex items-center space-x-2">
            <svg className="w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
            </svg>
            <h1 className="text-lg font-bold text-gray-800">Shunshot</h1>
          </div>
          <button
            onClick={() => setIsMinimized(true)}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {/* 快捷键提示 */}
        <div className="mb-4 p-3 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">截图快捷键</span>
            <kbd className="px-2 py-1 bg-white rounded-lg shadow text-gray-800 font-mono text-sm">
              {shortcutKey}
            </kbd>
          </div>
        </div>

        {/* 功能按钮 */}
        <div className="space-y-2">
          <button
            onClick={handleScreenshot}
            className="w-full flex items-center justify-between px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-sm transition-colors duration-150"
          >
            <span className="font-medium">开始截图</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
            </svg>
          </button>

          <button
            className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl shadow-sm transition-colors duration-150"
          >
            <span className="font-medium">设置</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
        </div>

        {/* 版本信息 */}
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">Version 0.1.0</p>
        </div>
      </div>
    </Draggable>
  )
}

const App: React.FC = () => {
  console.log('App component rendering')
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <div className="fixed inset-0 flex items-end justify-end p-4">
          <Routes>
            <Route path="/" element={<MainContent />} />
          </Routes>
        </div>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App 