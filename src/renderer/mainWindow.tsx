import React, { useState, useEffect, StrictMode, Suspense, Component, ErrorInfo } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom'
import ReactDOM from 'react-dom/client'
import { ProjectPanel } from './components/ProjectPanel'
import { translog } from './utils/translog'
import { debugHelper } from './utils/DebugHelper'
import './index.css'

translog.debug('Main window renderer starting...')

// 初始化调试助手
debugHelper.setOptions({
  prefix: '[Main]',
  enableConsoleOverride: true,
  enableErrorCapture: true,
  enablePerformanceMonitoring: true
})

// 创建 Query Client 实例
const queryClient = new QueryClient()

// 主界面内容组件
const MainContent: React.FC = () => {
  translog.debug('MainContent rendering', {
    location: useLocation(),
    timestamp: Date.now()
  })

  const [projectConfig, setProjectConfig] = useState<{ path: string } | null>(null)
  const [showProjectPanel, setShowProjectPanel] = useState(false)

  // 加载项目配置
  useEffect(() => {
    window.shunshotCoreAPI.getPreference<{ path: string }>('system.project')
      .then(config => {
        if (config?.path) {
          setProjectConfig(config)
        }
      })
      .catch(error => {
        translog.error('Failed to load project config:', error)
      })
  }, [])

  const handleScreenshot = async () => {
    translog.debug('Screenshot button clicked')
    try {
      await window.shunshotCoreAPI.hideWindow()
      await window.shunshotCoreAPI.captureScreen()
      await window.shunshotCoreAPI.showWindow()
    } catch (error) {
      translog.error('Screenshot failed:', error)
      await window.shunshotCoreAPI.showWindow()
    }
  }

  const handleOpenSettings = async () => {
    translog.debug('Settings button clicked')
    try {
      await window.shunshotCoreAPI.openSettings()
    } catch (error) {
      translog.error('Failed to open settings:', error)
    }
  }

  const handleToggleProjectPanel = () => {
    setShowProjectPanel(prev => !prev)
  }

  const shortcutKey = window.shunshotCoreAPI.platform === 'darwin' ? '⌘⇧X' : 'Ctrl+Shift+X'

  return (
    <div className="fixed inset-0 bg-gray-50">
      {/* Top Bar - Fixed */}
      <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-100 px-6 flex items-center justify-between z-10">
        {/* Logo and Title */}
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 
                       flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-br from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Shunshot
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-4">
          <div className="text-sm text-gray-500 px-3 py-1.5 bg-gray-50 rounded-lg border border-gray-100">
            {shortcutKey}
          </div>
          <button
            onClick={handleScreenshot}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-blue-600 
                   hover:from-blue-400 hover:to-blue-500 text-white rounded-lg 
                   shadow-lg shadow-blue-500/20 transition-transform duration-200 
                   hover:scale-[1.02] active:scale-[0.98] flex items-center space-x-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" />
            </svg>
            <span>截图</span>
          </button>
          <button
            onClick={handleOpenSettings}
            className="p-2 text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Content Area - Fixed below header */}
      <div className="fixed top-14 left-0 right-0 bottom-0">
        {projectConfig ? (
          <ProjectPanel projectPath={projectConfig.path} />
        ) : (
          <div className="h-full flex items-center justify-center flex-col space-y-4 text-gray-500">
            <div className="text-center">
              <p className="mb-2">未配置项目路径，请在设置中配置以启用历史记录功能</p>
              <p className="text-sm text-gray-400">配置后可以自动保存截图和对话记录</p>
            </div>
            <button
              onClick={handleOpenSettings}
              className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-600 
                     rounded-lg shadow-sm border border-gray-200 transition-colors"
            >
              前往设置
            </button>
          </div>
        )}
      </div>

      {/* Version Info - Fixed */}
      <div className="fixed bottom-2 right-4 text-gray-400 text-xs">
        Version 0.1.0
      </div>
    </div>
  )
}

// 应用根组件
const MainWindow: React.FC = () => {
  translog.debug('MainWindow component rendering')
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainContent />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}

// 错误边界组件
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null, errorInfo: ErrorInfo | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('React Error Boundary caught an error:', error, errorInfo);
    
    // 将错误信息发送到主进程
    if (window.shunshotCoreAPI && window.shunshotCoreAPI.logError) {
      window.shunshotCoreAPI.logError({
        title: 'React Error',
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: Date.now(),
        url: window.location.href
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ 
          padding: '20px', 
          fontFamily: 'sans-serif', 
          color: '#333',
          backgroundColor: '#f8f9fa',
          border: '1px solid #ddd',
          borderRadius: '4px',
          margin: '20px'
        }}>
          <h2 style={{ color: '#e53e3e' }}>应用出现错误</h2>
          <p>{this.state.error?.message}</p>
          {this.state.errorInfo && (
            <details style={{ whiteSpace: 'pre-wrap', marginTop: '10px' }}>
              <summary>查看详细信息</summary>
              <p style={{ fontSize: '14px', color: '#666' }}>
                {this.state.errorInfo.componentStack}
              </p>
            </details>
          )}
          <button 
            onClick={() => window.location.reload()} 
            style={{
              marginTop: '15px',
              padding: '8px 16px',
              backgroundColor: '#3182ce',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            重新加载应用
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// 加载中组件
const LoadingFallback = () => (
  <div style={{ 
    display: 'flex', 
    justifyContent: 'center', 
    alignItems: 'center', 
    height: '100vh',
    flexDirection: 'column'
  }}>
    <div style={{ marginBottom: '20px' }}>加载中...</div>
    <div style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid #3498db', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// 初始化应用
console.debug('[MainWindow] Initializing React application');

try {
  const rootElement = document.getElementById('root');
  
  if (!rootElement) {
    throw new Error('Root element not found');
  }
  
  const root = ReactDOM.createRoot(rootElement);
  
  root.render(
    <StrictMode>
      <ErrorBoundary>
        <Suspense fallback={<LoadingFallback />}>
          <MainWindow />
        </Suspense>
      </ErrorBoundary>
    </StrictMode>
  );
  
  console.debug('[MainWindow] React application initialized successfully');
} catch (error) {
  console.error('[MainWindow] Failed to initialize React application:', error);
  
  // 显示错误信息
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: sans-serif; color: #333;">
        <h2 style="color: #e53e3e;">初始化失败</h2>
        <p>${error instanceof Error ? error.message : String(error)}</p>
        <button onclick="window.location.reload()" style="margin-top: 15px; padding: 8px 16px; background-color: #3182ce; color: white; border: none; border-radius: 4px; cursor: pointer;">
          重新加载应用
        </button>
      </div>
    `;
  }
  
  // 将错误信息发送到主进程
  if (window.shunshotCoreAPI && window.shunshotCoreAPI.logError) {
    window.shunshotCoreAPI.logError({
      title: 'Initialization Error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: Date.now(),
      url: window.location.href
    });
  }
} 