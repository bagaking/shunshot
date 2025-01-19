import React, { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'

const queryClient = new QueryClient()

const MainContent: React.FC = () => {
  console.log('MainContent rendering, location:', useLocation())
  const [isMinimized, setIsMinimized] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)
  
  const handleScreenshot = async () => {
    console.log('Screenshot button clicked')
    try {
      await window.electronAPI.hideWindow()
      await window.electronAPI.captureScreen()
      await window.electronAPI.showWindow()
    } catch (error) {
      console.error('Screenshot failed:', error)
      await window.electronAPI.showWindow()
    }
  }

  const handleMinimizeToggle = async (minimize: boolean) => {
    setIsTransitioning(true)
    
    // 先更新状态
    setIsMinimized(minimize)
    
    // 等待一帧以确保状态更新
    await new Promise(resolve => requestAnimationFrame(resolve))
    
    // 调整窗口大小
    await window.electronAPI.setWindowSize(minimize ? 40 : 280, minimize ? 40 : 380)
    
    // 等待过渡动画完成
    setTimeout(() => {
      setIsTransitioning(false)
    }, 300)
  }

  const shortcutKey = window.electronAPI.platform === 'darwin' ? '⌘⇧X' : 'Ctrl+Shift+X'

  return (
    <div className={`relative ${isMinimized ? 'w-10 h-10' : 'w-[280px]'} transition-all duration-200`}>
      {/* 最小化状态 */}
      <div 
        className={`w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 
                   hover:from-blue-400 hover:to-blue-500 shadow-lg shadow-blue-500/20 cursor-pointer 
                   flex items-center justify-center text-white transition-all duration-200 ease-out 
                   hover:scale-105 active:scale-95 [-webkit-app-region:drag]
                   ${isTransitioning ? 'pointer-events-none' : ''} 
                   ${isMinimized ? 'opacity-100 scale-100' : 'opacity-0 scale-0 absolute right-0 bottom-0'}`}
        onClick={() => !isTransitioning && handleMinimizeToggle(false)}
      >
        {/* Logo Icon */}
        <svg className="w-5 h-5 [-webkit-app-region:no-drag]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
        </svg>
        
        {/* Tooltip */}
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white 
                       text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                       whitespace-nowrap pointer-events-none">
          点击展开
        </div>
      </div>

      {/* 展开状态 */}
      <div className={`bg-white/90 backdrop-blur-lg rounded-2xl overflow-hidden
                      shadow-[0_8px_32px_rgba(0,0,0,0.08),0_2px_4px_rgba(0,0,0,0.05)]
                      w-full transition-all duration-200 ease-out origin-bottom-right
                      [&_*]:select-none ${isTransitioning ? 'pointer-events-none' : ''}
                      ${isMinimized ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}>
        {/* 标题栏 - 支持拖拽 */}
        <div className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50/50 to-white/50 [-webkit-app-region:drag]">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 
                           flex items-center justify-center shadow-inner shadow-white/20">
              <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
              </svg>
            </div>
            <h1 className="text-base font-semibold bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Shunshot
            </h1>
          </div>
          <div className="flex items-center space-x-1">
            {/* 最小化按钮 */}
            <button
              onClick={() => !isTransitioning && handleMinimizeToggle(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 
                         hover:text-gray-600 hover:bg-gray-100/80 active:bg-gray-200/80
                         transition-colors duration-150 [-webkit-app-region:no-drag] group"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 12H4" />
              </svg>
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 bg-gray-800 text-white 
                             text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 
                             whitespace-nowrap pointer-events-none">
                最小化
              </div>
            </button>
          </div>
        </div>

        {/* 快捷键提示 */}
        <div className="px-3 py-2">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-gray-50/80 to-white/80
                          border border-gray-100/80">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">截图快捷键</span>
              <kbd className="px-2 py-1 bg-white rounded-lg shadow-sm text-gray-800 font-mono text-sm
                             border border-gray-100/80">
                {shortcutKey}
              </kbd>
            </div>
          </div>
        </div>

        {/* 功能按钮 */}
        <div className="p-3 space-y-2">
          <button
            onClick={handleScreenshot}
            className="w-full flex items-center justify-between px-4 py-2.5 
                       bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500
                       text-white rounded-xl shadow-lg shadow-blue-500/20 
                       transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]
                       [-webkit-app-region:no-drag] group"
          >
            <span className="font-medium">开始截图</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
            </svg>
          </button>

          <button
            className="w-full flex items-center justify-between px-4 py-2.5
                       bg-gradient-to-br from-gray-50 to-white hover:from-gray-100 hover:to-gray-50
                       text-gray-700 rounded-xl shadow-sm border border-gray-100/80
                       transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]
                       [-webkit-app-region:no-drag] group"
          >
            <span className="font-medium">设置</span>
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
        </div>

        {/* 版本信息 */}
        <div className="px-3 pb-3 text-center">
          <p className="text-xs text-gray-400">Version 0.1.0</p>
        </div>
      </div>
    </div>
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