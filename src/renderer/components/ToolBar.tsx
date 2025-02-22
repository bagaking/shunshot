import React, { useState, useEffect } from 'react'
import { AgentConfig, AgentMessage, ChatCompletionContentPart } from '../../types/agents'
import { Bounds } from '../../common/2d'
import { message as antdMessage } from 'antd' 
import { usePanelManager } from '../panels/PanelManager' 
import { translog } from '../utils/translog'
import { Square, Circle, Pencil, Grid } from 'lucide-react'
import { EditOutlined, FileSearchOutlined, VideoCameraOutlined, CameraOutlined, RobotOutlined, CloseOutlined, CheckOutlined } from '@ant-design/icons'
import { MessageService } from '../services/messageService'

interface ToolBarProps {
  onConfirm: () => void
  onCancel: () => void
  onOCR: () => Promise<{text?: string, error?: any}>
  selectedBounds: Bounds | null
  isScreenRecording?: boolean
  onModeChange?: (isScreenRecording: boolean) => void
}

interface ToolButton {
  icon: JSX.Element
  tooltip: string
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
}
 
const AgentMenu: React.FC<{
  onClose: () => void
  onSelect: (agentId: string) => void
  selectedBounds: Bounds | null
}> = ({ onClose, onSelect, selectedBounds }) => {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  
  useEffect(() => {
    window.shunshotCoreAPI.getAgents().then(setAgents)
  }, [])

  return (
    <div className="absolute top-full left-0 mt-1 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5">
      <div className="py-1">
        {agents.map(agent => (
          agent.enabled && (
            <button
              key={agent.id}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => onSelect(agent.id)}
              disabled={!selectedBounds}
            >
              <div className="flex items-center space-x-2">
                <div className="text-lg">{agent.icon}</div>
                <span>{agent.name}</span>
              </div>
            </button>
          )
        ))}
      </div>
    </div>
  )
}

export const ToolBar: React.FC<ToolBarProps> = ({
  onConfirm,
  onCancel,
  onOCR,
  selectedBounds,
  isScreenRecording = false,
  onModeChange
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const panelManager = usePanelManager()
  
  const handleOCR = async () => {
    if (!selectedBounds) {
      antdMessage.error('请先选择要识别的区域')
      return
    }

    setIsProcessing(true)
    
    // Create OCR result panel immediately
    const panelId = panelManager.createPanel({
      type: 'chat',
      bounds: selectedBounds,
      position: { x: 100, y: 100 },
      contentProps: {
        title: 'OCR 识别结果',
        messages: [],
        loading: true
      }
    })
    
    translog.debug('OCR panel created', { panelId })
    
    try {
      translog.debug('Starting OCR process', { bounds: selectedBounds })
      const result = await onOCR()
      const messages: AgentMessage[] = []
      
      if (result.error) {
        messages.push({
          role: 'system',
          content: '识别文字',
          timestamp: Date.now(),
          error: result.error
        })
        translog.error('OCR error:', result.error)
      } else {
        messages.push({
          role: 'system',
          content: result.text || '',
          timestamp: Date.now()
        })
        translog.debug('OCR success:', { text: result.text })
      }

      // Update panel with results
      panelManager.updatePanel(panelId, {
        contentProps: {
          title: 'OCR 识别结果',
          messages,
          loading: false
        }
      })
      
      translog.debug('OCR panel updated with results')
    } catch (err) {
      translog.error('OCR process failed:', err)
      antdMessage.error('识别失败，请重试')
      panelManager.removePanel(panelId)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAgentSelect = async (agentId: string) => {
    if (!selectedBounds) return

    try {
      setIsProcessing(true)
      
      // 获取 agent 配置
      const agentList = await window.shunshotCoreAPI.getAgents()
      const selectedAgent = agentList.find(a => a.id === agentId)
      
      if (!selectedAgent) {
        translog.error('Selected agent not found', { agentId })
        return
      }

      const messageService = new MessageService(panelManager, selectedBounds)

      // 创建面板
      const panelId = panelManager.createPanel({
        type: 'chat',
        position: { x: 100, y: 100 },
        contentProps: {
          messages: [],
          title: selectedAgent.name,
          agent: selectedAgent,
          loading: true,
          getAvailableAgents: () => window.shunshotCoreAPI.getAgents(),
          onSend: (message: string, targetAgentId?: string) => {
            return messageService.handleMessage(
              panelId,
              message,
              selectedAgent,
              targetAgentId
            )
          }
        }
      })

      // 初始化对话
      const initialState = await messageService.initializeConversation(
        panelId,
        agentId, 
        selectedAgent, 
        agentList
      )

      if (initialState) {
        panelManager.updatePanel(panelId, {
          contentProps: initialState
        })
      }

    } catch (error) {
      translog.error('Failed to handle agent selection', error)
      antdMessage.error('启动 AI 助手失败，请重试')
    } finally {
      setIsProcessing(false)
      setShowAgentMenu(false)
    }
  }

  const tools: ToolButton[] = [
    {
      tooltip: '矩形选择',
      icon: <Square className="w-3.5 h-3.5" />,
    },
    {
      tooltip: '椭圆选择',
      icon: <Circle className="w-3.5 h-3.5" />,
    },
    {
      tooltip: '画笔',
      icon: <Pencil className="w-3.5 h-3.5" />,
    },
    {
      tooltip: '马赛克',
      icon: <Grid className="w-3.5 h-3.5" />,
    },
    {
      tooltip: '文字',
      icon: <EditOutlined />,
    },
    {
      tooltip: 'OCR 识别',
      icon: <FileSearchOutlined spin={isProcessing} />,
      onClick: handleOCR,
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: isScreenRecording ? '切换到截图' : '切换到录屏',
      icon: isScreenRecording ? <CameraOutlined /> : <VideoCameraOutlined />,
      onClick: () => onModeChange?.(!isScreenRecording)
    },
    {
      tooltip: 'AI Agents',
      icon: <RobotOutlined spin={isProcessing} />,
      onClick: () => setShowAgentMenu(true),
      disabled: !selectedBounds || isProcessing
    }
  ]

  const actions: ToolButton[] = [
    {
      tooltip: '取消',
      icon: <CloseOutlined />,
      onClick: onCancel
    },
    {
      tooltip: '确认',
      primary: true,
      icon: <CheckOutlined />,
      onClick: onConfirm
    }
  ]

  return (
    <div className="flex flex-col items-start space-y-2">
      <div className="relative flex items-center space-x-1 bg-white/90 backdrop-blur-sm shadow-md rounded-lg p-1">
        {/* 工具按钮组 */}
        <div className="flex items-center space-x-0.5">
          {tools.map((tool, index) => (
            <div key={index} className="relative group">
              <button
                className={`w-7 h-7 rounded-md flex items-center justify-center text-gray-500 transition-colors duration-150 ${
                  tool.disabled 
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:text-gray-900 active:text-blue-600'
                }`}
                onMouseEnter={() => setActiveTooltip(tool.tooltip)}
                onMouseLeave={() => setActiveTooltip('')}
                onClick={tool.onClick}
                disabled={tool.disabled}
              >
                {tool.icon}
              </button>
              {activeTooltip === tool.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] text-white bg-gray-800/90 rounded shadow-sm whitespace-nowrap">
                  {tool.tooltip}
                  {tool.disabled && !isProcessing && ' (请先选择区域)'}
                  {isProcessing && ' (处理中...)'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Agent菜单 */}
        {showAgentMenu && (
          <AgentMenu
            onClose={() => setShowAgentMenu(false)}
            onSelect={handleAgentSelect}
            selectedBounds={selectedBounds}
          />
        )}

        {/* 分隔线 */}
        <div className="w-[1px] self-stretch mx-0.5 bg-gray-200/80" />

        {/* 操作按钮组 */}
        <div className="flex items-center space-x-0.5">
          {actions.map((action, index) => (
            <div key={index} className="relative group">
              <button
                onClick={action.onClick}
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors duration-150 ${
                  action.primary
                    ? 'text-blue-500 hover:text-blue-600 active:text-blue-700'
                    : 'text-gray-500 hover:text-gray-900 active:text-red-600'
                }`}
                onMouseEnter={() => setActiveTooltip(action.tooltip)}
                onMouseLeave={() => setActiveTooltip('')}
              >
                {action.icon}
              </button>
              {activeTooltip === action.tooltip && (
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1.5 px-1.5 py-0.5 text-[10px] text-white bg-gray-800/90 rounded shadow-sm whitespace-nowrap">
                  {action.tooltip}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 