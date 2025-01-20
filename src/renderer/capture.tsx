import React, { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import Capture from './pages/Capture'
import { debugHelper } from './utils/DebugHelper'
import './index.css'

console.log('Capture window renderer starting...')

// 用于存储截图数据的全局变量
let captureData: any = null

// 创建一个包装组件来管理状态
const CaptureWrapper: React.FC = () => {
  const [key, setKey] = useState(0)

  React.useEffect(() => {
    console.log('CaptureWrapper mounted')
    
    // 设置事件监听器
    const handleScreenCaptureData = (data: any) => {
      try {
        console.log('Received screen capture data:', {
          imageSize: data?.imageData?.length,
          bounds: data?.displayInfo?.bounds,
          scaleFactor: data?.displayInfo?.scaleFactor
        })
        
        if (!data || !data.imageData || !data.displayInfo) {
          console.error('Invalid capture data received:', data)
          return
        }

        captureData = data
        debugHelper.logEvent('Received capture data')
        debugHelper.updateDebugInfo({
          imageSize: data.imageData.length,
          bounds: data.displayInfo.bounds,
          scaleFactor: data.displayInfo.scaleFactor
        })

        // 强制重新渲染 Capture 组件
        setKey(prev => prev + 1)
      } catch (error) {
        console.error('Error handling screen capture data:', error)
      }
    }

    const handleStartCapture = () => {
      try {
        console.log('Received START_CAPTURE event')
        debugHelper.logEvent('Received START_CAPTURE')
      } catch (error) {
        console.error('Error handling start capture:', error)
      }
    }

    try {
      window.shunshotCoreAPI.onScreenCaptureData(handleScreenCaptureData)
      window.shunshotCoreAPI.onStartCapture(handleStartCapture)
    } catch (error) {
      console.error('Error setting up event listeners:', error)
    }

    return () => {
      console.log('CaptureWrapper unmounting')
      try {
        // 如果 API 提供了移除监听器的方法，在这里调用
      } catch (error) {
        console.error('Error cleaning up event listeners:', error)
      }
    }
  }, [])

  return <Capture key={key} captureData={captureData} />
}

// 更新窗口尺寸信息
function updateSize() {
  try {
    const sizeSpan = document.getElementById('size')
    if (sizeSpan) {
      sizeSpan.textContent = `${window.innerWidth} x ${window.innerHeight}`
    }
  } catch (error) {
    console.error('Error updating size:', error)
  }
}

// 更新鼠标位置信息
document.addEventListener('mousemove', (e) => {
  try {
    const mouseSpan = document.getElementById('mouse')
    if (mouseSpan) {
      mouseSpan.textContent = `${e.clientX}, ${e.clientY}`
    }
  } catch (error) {
    console.error('Error updating mouse position:', error)
  }
})

window.addEventListener('resize', updateSize)
updateSize()

// 添加键盘事件监听
document.addEventListener('keydown', (e) => {
  try {
    debugHelper.logEvent(`Key pressed: ${e.key}`)
    console.log('Key pressed:', e.key)

    // 添加调试模式切换快捷键
    if (e.key === 'F12') {
      if (debugHelper.isEnabled) {
        debugHelper.disable()
      } else {
        debugHelper.enable()
      }
    }
  } catch (error) {
    console.error('Error handling keydown:', error)
  }
})

// 只创建一次 React Root
const root = document.getElementById('root')
if (!root) {
  console.error('Root element not found')
} else {
  console.log('Root element found, mounting CaptureWrapper component')
  debugHelper.logEvent('Mounting CaptureWrapper component')
  ReactDOM.createRoot(root as HTMLElement).render(
    <React.StrictMode>
      <HashRouter>
        <CaptureWrapper />
      </HashRouter>
    </React.StrictMode>
  )
} 