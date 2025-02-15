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

// 创建一个包装组件来管理状态
const CaptureWrapper: React.FC = () => {
  const [captureData, setCaptureData] = useState<CaptureData | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [isDebugMode, setIsDebugMode] = useState(false)
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  

  // 记录组件挂载
  useEffect(() => {
    translog.debug('CaptureWrapper component mounted', {
      timestamp: Date.now()
    })

    return () => {
      translog.debug('CaptureWrapper component unmounting', {
        timestamp: Date.now()
      })
    }
  }, [])

  // 初始化调试模式
  useEffect(() => {
    const handleDebugModeChange = (enabled: boolean) => {
      setIsDebugMode(enabled)
      translog.debug('Debug mode changed', {
        enabled,
        timestamp: Date.now()
      })
    }

    debugHelper.onDebugModeChange(handleDebugModeChange)
    setIsDebugMode(debugHelper.isEnabled)

    return () => {
      debugHelper.offDebugModeChange(handleDebugModeChange)
    }
  }, [])

  // 设置事件监听器
  useEffect(() => {
    translog.debug('Setting up event listeners', {
      timestamp: Date.now()
    })

    const startTime = performance.now()

    // 设置键盘事件监听器
    const keyboardCleanup = eventHelper.setupKeyboardListeners({
      onEscape: () => {
        translog.debug('Escape key pressed, canceling capture')
        window.shunshotCoreAPI.hideWindow()
      }
    })

    // 设置截图开始事件监听器
    const startCaptureCleanup = eventHelper.setupCaptureStartListener(() => {
      setCaptureData(null)
      setDisplayInfo(null)
      setError(null)
    })

    // 设置截图数据事件监听器
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
    translog.debug('Event listeners setup complete', {
      duration: endTime - startTime,
      timestamp: Date.now()
    })

    return () => {
      translog.debug('Cleaning up event listeners', {
        timestamp: Date.now()
      })
      keyboardCleanup()
      startCaptureCleanup()
      captureDataCleanup()
    }
  }, []) // 空依赖数组,只在组件挂载时设置一次

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
const updateMousePosition = performanceHelper.debounce((e: MouseEvent) => {
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
}, 16) // 约60fps

// 处理键盘事件
const handleKeyDown = (e: KeyboardEvent) => {
  try {
    debugHelper.startOperation('handleKeyDown')
    debugHelper.logEvent(`Key pressed: ${e.key}`)
    translog.debug('Key pressed:', e.key)

    // 添加调试模式切换快捷键
    if (e.key === 'F12') {
      if (debugHelper.isEnabled) {
        debugHelper.disable()
      } else {
        debugHelper.enable()
      }
    }
  } catch (error) {
    translog.error('Error handling keydown:', error)
  } finally {
    debugHelper.endOperation('handleKeyDown')
  }
}

// 设置事件监听器
document.addEventListener('mousemove', updateMousePosition)
window.addEventListener('resize', updateSize)
document.addEventListener('keydown', handleKeyDown)
updateSize()

// 只创建一次 React Root
const root = document.getElementById('root')
if (!root) {
  translog.error('Root element not found')
} else {
  translog.debug('Root element found, mounting CaptureWrapper component')
  debugHelper.logEvent('Mounting CaptureWrapper component')
  ReactDOM.createRoot(root as HTMLElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <MemoizedCaptureWrapper />
        </HashRouter>
      </ErrorBoundary>
    </React.StrictMode>
  )
} 