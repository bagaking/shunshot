import React from 'react'
import { CaptureData } from '../types/capture'

interface DebugPanelProps {
  backgroundImage: HTMLImageElement | null
  captureData: CaptureData | null
  displayInfo: any | null
  canvasInfo: {
    width?: number
    height?: number
    style?: {
      width?: string
      height?: string
    }
  } | null
  lastError?: Error | null
  onRetry?: () => void
  mousePosition?: { x: number, y: number }
  selectedRect?: {
    startX: number
    startY: number
    width: number
    height: number
  } | null
}

export const DebugPanel: React.FC<DebugPanelProps> = ({
  backgroundImage,
  captureData,
  displayInfo,
  canvasInfo,
  lastError,
  onRetry,
  mousePosition,
  selectedRect
}) => {
  const hasError = !backgroundImage || !displayInfo

  // 获取加载阶段
  const getLoadingPhase = () => {
    if (!captureData) return '等待截图数据'
    if (!captureData.imageData.startsWith('data:image')) return '图片数据格式错误'
    if (!backgroundImage) return '图片加载中'
    if (!backgroundImage.complete) return '图片加载未完成'
    if (backgroundImage.naturalWidth === 0) return '图片尺寸无效'
    if (!displayInfo) return '显示信息未设置'
    return '加载完成'
  }

  // 获取状态类名
  const getStatusClass = (isOk: boolean) => 
    isOk ? 'text-green-400' : 'text-red-400'

  return (
    <div className="fixed left-4 top-4 z-[9999] max-w-md space-y-2">
      {/* 主调试面板 */}
      <div className="bg-black/95 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-lg">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="font-medium">调试信息</span>
          </div>
          <div className={`text-xs px-2 py-1 rounded ${hasError ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
            {getLoadingPhase()}
          </div>
        </div>

        {/* 加载流程 */}
        <div className="space-y-4">
          {/* 截图数据 */}
          <div className="space-y-1.5">
            <div className="text-sm text-gray-400 font-medium">截图数据</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>数据可用:</span>
                <span className={getStatusClass(!!captureData)}>
                  {captureData ? '是' : '否'}
                </span>
              </div>
              {captureData && (
                <>
                  <div className="flex justify-between">
                    <span>数据格式:</span>
                    <span className={getStatusClass(captureData.imageData.startsWith('data:image'))}>
                      {captureData.imageData.startsWith('data:image') ? '正确' : '错误'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>数据长度:</span>
                    <span className="text-blue-400">
                      {(captureData.imageData.length / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 图片状态 */}
          <div className="space-y-1.5">
            <div className="text-sm text-gray-400 font-medium">图片状态</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>图片对象:</span>
                <span className={getStatusClass(!!backgroundImage)}>
                  {backgroundImage ? '已创建' : '未创建'}
                </span>
              </div>
              {backgroundImage && (
                <>
                  <div className="flex justify-between">
                    <span>加载完成:</span>
                    <span className={getStatusClass(backgroundImage.complete)}>
                      {backgroundImage.complete ? '是' : '否'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>原始尺寸:</span>
                    <span className={getStatusClass(
                      backgroundImage.naturalWidth > 0 && backgroundImage.naturalHeight > 0
                    )}>
                      {backgroundImage.naturalWidth} x {backgroundImage.naturalHeight}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>显示尺寸:</span>
                    <span className={getStatusClass(
                      backgroundImage.width > 0 && backgroundImage.height > 0
                    )}>
                      {backgroundImage.width} x {backgroundImage.height}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* 显示信息 */}
          <div className="space-y-1.5">
            <div className="text-sm text-gray-400 font-medium">显示信息</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>显示信息:</span>
                <span className={getStatusClass(!!displayInfo)}>
                  {displayInfo ? '已设置' : '未设置'}
                </span>
              </div>
              {displayInfo && (
                <>
                  <div className="flex justify-between">
                    <span>缩放比例:</span>
                    <span className="text-blue-400">{displayInfo.scaleFactor}x</span>
                  </div>
                  <div className="flex justify-between">
                    <span>显示范围:</span>
                    <span className="text-blue-400">
                      {displayInfo.bounds.width} x {displayInfo.bounds.height}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Canvas 信息 */}
          <div className="space-y-1.5">
            <div className="text-sm text-gray-400 font-medium">Canvas 信息</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>Canvas 状态:</span>
                <span className={getStatusClass(!!canvasInfo)}>
                  {canvasInfo ? '已初始化' : '未初始化'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>物理尺寸:</span>
                <span className={getStatusClass(!!canvasInfo?.width && !!canvasInfo?.height)}>
                  {canvasInfo?.width || 0} x {canvasInfo?.height || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span>显示尺寸:</span>
                <span className="text-blue-400">
                  {canvasInfo?.style?.width || '0'} x {canvasInfo?.style?.height || '0'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>缩放比例:</span>
                <span className="text-blue-400">
                  {displayInfo?.scaleFactor || 1}x
                </span>
              </div>
              <div className="flex justify-between">
                <span>渲染依赖:</span>
                <span className={getStatusClass(!!canvasInfo && !!backgroundImage && !!displayInfo)}>
                  {[
                    canvasInfo ? '画布✓' : '画布✗',
                    backgroundImage ? '图片✓' : '图片✗',
                    displayInfo ? '显示✓' : '显示✗'
                  ].join(' ')}
                </span>
              </div>
              {backgroundImage && (
                <div className="flex justify-between">
                  <span>图片状态:</span>
                  <span className={getStatusClass(backgroundImage.complete)}>
                    {backgroundImage.complete ? '加载完成' : '加载中'}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 选区信息 */}
          <div className="space-y-1.5">
            <div className="text-sm text-gray-400 font-medium">选区信息</div>
            <div className="text-xs space-y-1">
              <div className="flex justify-between">
                <span>选区状态:</span>
                <span className={getStatusClass(!!selectedRect)}>
                  {selectedRect ? '已选择' : '未选择'}
                </span>
              </div>
              {selectedRect && (
                <>
                  <div className="flex justify-between">
                    <span>起点:</span>
                    <span className="text-blue-400">
                      {selectedRect.startX.toFixed(2)}, {selectedRect.startY.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>尺寸:</span>
                    <span className="text-blue-400">
                      {Math.abs(selectedRect.width).toFixed(2)} x {Math.abs(selectedRect.height).toFixed(2)}
                    </span>
                  </div>
                </>
              )}
              {mousePosition && (
                <div className="flex justify-between">
                  <span>鼠标位置:</span>
                  <span className="text-blue-400">
                    {mousePosition.x.toFixed(2)}, {mousePosition.y.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 错误信息 */}
          {lastError && (
            <div className="space-y-1.5">
              <div className="text-sm text-red-400 font-medium">错误信息</div>
              <div className="text-xs text-red-400 bg-red-500/10 p-2 rounded">
                {lastError.message}
              </div>
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        {hasError && onRetry && (
          <button
            onClick={onRetry}
            className="mt-4 w-full px-4 py-2 bg-white/10 hover:bg-white/20 text-sm rounded-md transition-colors"
          >
            重试
          </button>
        )}
      </div>

      {/* 初始提示 */}
      {!selectedRect && !hasError && (
        <div className="bg-black/95 backdrop-blur-sm text-white px-6 py-4 rounded-lg shadow-lg">
          <p className="text-sm font-medium mb-2">操作提示</p>
          <p className="text-xs text-gray-400">点击并拖动来选择截图区域</p>
          <p className="text-xs text-gray-400">按 ESC 取消，Enter 确认</p>
        </div>
      )}
    </div>
  )
} 