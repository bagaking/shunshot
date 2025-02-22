import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import Capture from './pages/Capture'
import { ErrorBoundary } from './components/ErrorBoundary'
import { debugHelper } from './utils/DebugHelper'
import { translog } from './utils/translog'
import { performanceHelper } from './utils/performanceHelper' 
import './index.css' 
import { CaptureProvider } from './providers/CaptureProvider'
import { PanelManagerProvider } from './panels/PanelManager'

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
  const [isDebugMode, setIsDebugMode] = useState(false)
  
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
      // translog.debug(`Mouse ${e.type} event:`, {
      //   type: e.type,
      //   button: e.button,
      //   buttons: e.buttons,
      //   clientX: e.clientX,
      //   clientY: e.clientY,
      //   hasFocus: document.hasFocus(),
      //   activeElement: document.activeElement?.tagName,
      //   timestamp: Date.now()
      // })
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
    let isComponentMounted = true;

    const handleError = (error: Error | unknown) => {
      if (isComponentMounted) {
        try {
          // Create a safe error object that can be serialized
          const safeError = {
            type: 'error',
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            timestamp: Date.now()
          };
          translog.error('[CaptureWindow] Error:', safeError);
        } catch (e) {
          // Fallback error logging with minimal data
          translog.error('[CaptureWindow] Failed to process error:', {
            type: 'error_processing_failure',
            message: 'Error object could not be processed',
            timestamp: Date.now()
          });
        }
      }
    };

    // 设置全局的未处理 Promise 错误处理器
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      event.preventDefault();
      try {
        const reason = event.reason;
        // 创建一个可序列化的错误对象，确保所有属性都是可克隆的
        const safeError = {
          type: 'unhandled_rejection',
          message: reason instanceof Error ? reason.message : 
            (reason && typeof reason === 'object' ? 
              // 只保留可序列化的属性
              JSON.stringify(Object.getOwnPropertyNames(reason).reduce((acc, key) => {
                const value = reason[key];
                if (typeof value !== 'function' && typeof value !== 'symbol') {
                  acc[key] = value;
                }
                return acc;
              }, {} as Record<string, unknown>))
            : String(reason)),
          stack: reason instanceof Error ? reason.stack : undefined,
          timestamp: Date.now()
        };
        translog.error('[CaptureWindow] Unhandled promise rejection:', safeError);
      } catch (e) {
        // 回退到最小化的错误日志
        translog.error('[CaptureWindow] Failed to process rejection:', {
          type: 'rejection_processing_failure',
          message: 'Rejection could not be processed',
          timestamp: Date.now()
        });
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    const cleanup = [
      setupMouseTracking(),
      setupWindowResizing(),
      setupDebugMode(),
      () => {
        isComponentMounted = false;
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      }
    ];

    return () => cleanup.forEach(fn => fn?.());
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

  return (
    <ErrorBoundary>
      <CaptureProvider>
        <PanelManagerProvider>
          <Capture />
        </PanelManagerProvider>
      </CaptureProvider>
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