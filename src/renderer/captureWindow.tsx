import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import Capture from './pages/Capture'
import { ErrorBoundary } from './components/ErrorBoundary'
import { debugHelper } from './utils/DebugHelper'
import { translog } from './utils/translog'
import { performanceHelper } from './utils/performanceHelper'
import { CaptureData, DisplayInfo } from './types/capture'
import './index.css'
import { eventHelper } from './utils/eventHelper'

translog.debug('Capture window renderer starting...')

// 初始化调试助手
debugHelper.setOptions({
  prefix: '[Capture]',
  enableConsoleOverride: true,
  enableErrorCapture: true,
  enablePerformanceMonitoring: true
})

// 更新窗口尺寸信息
const updateSize = performanceHelper.debounce(() => {
  try {
    debugHelper.startOperation('updateSize')
    const sizeSpan = document.getElementById('size')
    if (sizeSpan) {
      sizeSpan.textContent = `${window.innerWidth} x ${window.innerHeight}`
    }
  } catch (error) {
    console.error('Error updating size:', error)
  } finally {
    debugHelper.endOperation('updateSize')
  }
}, 100)

// 更新鼠标位置信息
function handleMousePositionUpdate(e: MouseEvent) {
  try {
    debugHelper.startOperation('updateMousePosition')
    const mouseSpan = document.getElementById('mouse')
    if (mouseSpan) {
      mouseSpan.textContent = `${e.clientX}, ${e.clientY}`
    }
  } catch (error) {
    console.error('Error updating mouse position:', error)
  } finally {
    debugHelper.endOperation('updateMousePosition')
  }
}

const updateMousePosition = performanceHelper.debounce(handleMousePositionUpdate, 16) // 约60fps

// 创建一个包装组件来管理状态
const CaptureWrapper: React.FC = () => {
  const [captureData, setCaptureData] = useState<CaptureData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  
  // 焦点管理
  useEffect(() => {
    const logWindowState = (context: string) => {
      const api = window.shunshotCoreAPI
      translog.debug(`${context}:`, {
        hasFocus: document.hasFocus(),
        activeElement: document.activeElement?.tagName,
        platform: api?.platform || process.platform,
        windowState: {
          innerWidth: window.innerWidth,
          innerHeight: window.innerHeight,
          outerWidth: window.outerWidth,
          outerHeight: window.outerHeight,
        },
        timestamp: Date.now()
      })
    }

    const handleBlur = () => logWindowState('Window blur event')
    const handleFocus = () => logWindowState('Window focus event')
    
    const handleMouseEvent = (e: MouseEvent) => {
      translog.debug(`Mouse ${e.type} event:`, {
        type: e.type,
        button: e.button,
        buttons: e.buttons,
        clientX: e.clientX,
        clientY: e.clientY,
        hasFocus: document.hasFocus(),
        activeElement: document.activeElement?.tagName,
        timestamp: Date.now()
      })
    }
    
    // 记录初始状态
    logWindowState('Focus management initialized')
    
    // 设置事件监听器
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('mousedown', handleMouseEvent)
    window.addEventListener('mouseup', handleMouseEvent)
    window.addEventListener('mousemove', handleMouseEvent)
    
    return () => {
      window.removeEventListener('blur', handleBlur)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('mousedown', handleMouseEvent)
      window.removeEventListener('mouseup', handleMouseEvent)
      window.removeEventListener('mousemove', handleMouseEvent)
    }
  }, [])

  // 组件生命周期管理
  useEffect(() => {
    const cleanup = [
      setupMouseTracking(),
      setupWindowResizing(),
      setupDebugMode(),
      setupCaptureEvents()
    ]

    return () => cleanup.forEach(fn => fn())
  }, [])

  // 鼠标追踪设置
  const setupMouseTracking = () => {
    document.addEventListener('mousemove', updateMousePosition)
    return () => document.removeEventListener('mousemove', updateMousePosition)
  }

  // 窗口大小设置
  const setupWindowResizing = () => {
    const handleResize = performanceHelper.debounce(updateSize, 100)
    window.addEventListener('resize', handleResize)
    updateSize()
    return () => window.removeEventListener('resize', handleResize)
  }

  // 调试模式设置
  const setupDebugMode = () => {
    const handleDebugModeChange = (enabled: boolean) => {
      setIsDebugMode(enabled)
      translog.debug('Debug mode changed', { enabled, timestamp: Date.now() })
    }

    debugHelper.onDebugModeChange(handleDebugModeChange)
    setIsDebugMode(debugHelper.isEnabled)
    return () => debugHelper.offDebugModeChange(handleDebugModeChange)
  }

  // 截图事件设置
  const setupCaptureEvents = () => {
    translog.debug('Setting up capture events', {
      timestamp: Date.now(),
      componentId: Math.random().toString(36).slice(2, 9)
    })

    const startTime = performance.now()

    const startCaptureCleanup = eventHelper.setupCaptureStartListener(() => {
      setCaptureData(null)
      setDisplayInfo(null)
      setError(null)
    })

    const captureDataCleanup = eventHelper.setupCaptureDataListener(
      (data) => {
        translog.debug('Received screen capture data', {
          hasData: !!data,
          hasImageData: !!data.imageData,
          hasDisplayInfo: !!data.displayInfo,
          imageSize: data.imageData.length,
          bounds: data.displayInfo.bounds,
          scaleFactor: data.displayInfo.scaleFactor,
          timestamp: Date.now()
        })

        setCaptureData(data)
        setDisplayInfo(data.displayInfo)
      },
      (error) => {
        translog.error('Error in capture data listener:', error)
        setError(error)
      }
    )

    const endTime = performance.now()
    translog.debug('Capture events setup complete', {
      duration: endTime - startTime,
      timestamp: Date.now()
    })

    return () => {
      startCaptureCleanup()
      captureDataCleanup()
    }
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
          <h2 className="text-red-600 text-lg font-semibold mb-2">错误</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary>
      <Capture
        captureData={captureData}
        displayInfo={displayInfo}
        onDisplayInfoChange={setDisplayInfo}
      />
    </ErrorBoundary>
  )
}

// 使用 React.memo 优化组件
const MemoizedCaptureWrapper = React.memo(CaptureWrapper)

// 只创建一次 React Root
const root = document.getElementById('root')
if (!root) {
  translog.error('Root element not found')
} else {
  translog.debug('Root element found, mounting CaptureWrapper component')
  debugHelper.logEvent('Mounting CaptureWrapper component')
  ReactDOM.createRoot(root as HTMLElement).render(
    <HashRouter>
      <MemoizedCaptureWrapper />
    </HashRouter>
  )
} 