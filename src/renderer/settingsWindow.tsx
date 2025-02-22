import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SettingsPage } from './pages/Settings'
import { debugHelper } from './utils/DebugHelper'
import { translog } from './utils/translog'
import 'antd/dist/reset.css'
import './index.css'

translog.debug('Settings window renderer starting...')

// 初始化调试助手
debugHelper.setOptions({
  prefix: '[Settings]',
  enableConsoleOverride: true,
  enableErrorCapture: true,
  enablePerformanceMonitoring: true
})

// 包装设置页面组件以添加日志
const SettingsWrapper: React.FC = () => {
  translog.debug('SettingsWrapper rendering')
  
  React.useEffect(() => {
    translog.debug('SettingsWrapper mounted')
    return () => {
      translog.debug('SettingsWrapper unmounting')
    }
  }, [])

  return (
    <ErrorBoundary>
      <HashRouter>
        <SettingsPage />
      </HashRouter>
    </ErrorBoundary>
  )
}

// 初始化应用
const root = document.getElementById('root')
if (!root) {
  translog.error('Root element not found')
} else {
  translog.debug('Root element found, mounting Settings app')
  debugHelper.logEvent('Mounting SettingsWrapper component')
  
  const startTime = performance.now()
  
  ReactDOM.createRoot(root).render(
    <SettingsWrapper />
  )
  
  const endTime = performance.now()
  translog.debug('Settings app mounted', {
    duration: endTime - startTime,
    timestamp: Date.now()
  })
} 