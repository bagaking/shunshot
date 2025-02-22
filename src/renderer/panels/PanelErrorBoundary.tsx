
import React from 'react'
import { Button } from 'antd'

// 错误边界组件
export class PanelErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ChatPanel] Error boundary caught error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center p-4">
            <div className="text-red-500 text-4xl mb-2">❌</div>
            <div className="text-gray-700 font-medium mb-2">聊天面板出现错误</div>
            <div className="text-gray-500 text-sm mb-4">
              {this.state.error?.message || '未知错误'}
            </div>
            <Button
              type="primary"
              onClick={() => this.setState({ hasError: false })}
            >
              重试
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}