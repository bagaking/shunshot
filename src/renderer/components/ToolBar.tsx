import React, { useState, useEffect, useRef } from 'react'
import { AgentConfig, AgentMessage, ChatCompletionContentPart } from '../../types/agents'
import { Bounds } from '../../common/2d'
import { message as antdMessage } from 'antd' 
import { usePanelManager } from '../panels/PanelManager' 
import { translog } from '../utils/translog'
import { Pencil, Grid, Type, ScanText, FileText } from 'lucide-react'
import { EditOutlined, FileSearchOutlined, VideoCameraOutlined, CameraOutlined, RobotOutlined, CloseOutlined, CheckOutlined, FontSizeOutlined, BlockOutlined, ScanOutlined } from '@ant-design/icons'
import { MessageService } from '../services/messageService'
import { ToolType, PenStyle } from '../../types/capture'

import { BrushSettings } from './BrushSettings'

interface ToolBarProps {
  onConfirm: () => void
  onCancel: () => void
  onOCR: () => Promise<{text?: string, error?: any}>
  selectedBounds: Bounds | null
  isScreenRecording?: boolean
  onModeChange?: (isScreenRecording: boolean) => void
  onToolChange?: (tool: ToolType) => void
  activeTool?: ToolType
  drawColor?: string
  onColorChange?: (color: string) => void
  lineWidth?: number
  onLineWidthChange?: (width: number) => void
  penStyle?: PenStyle
  onPenStyleChange?: (style: PenStyle, sensitivity?: number, taper?: boolean) => void
}

interface ToolButton {
  icon: JSX.Element
  tooltip: string
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
  toolType?: ToolType
  isActive?: boolean
  showSettingsOnHover?: boolean
}
 
const AgentMenu: React.FC<{
  onClose: () => void
  onSelect: (agentId: string) => void
  selectedBounds: Bounds | null
}> = ({ onClose, onSelect, selectedBounds }) => {
  const [agents, setAgents] = useState<AgentConfig[]>([])
  
  useEffect(() => {
    window.shunshotCoreAPI.getAgents().then(agents => {
      // 只显示视觉模型的 agents
      const visionAgents = agents.filter(agent => agent.modelConfig.gene === 'vision')
      setAgents(visionAgents)
    })
  }, [])

  return (
    <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg ring-1 ring-black/5">
      <div className="py-0.5">
        {agents.map(agent => (
          agent.enabled && (
            <button
              key={agent.id}
              className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1.5 transition-colors"
              onClick={() => onSelect(agent.id)}
              disabled={!selectedBounds}
            >
              <div className="text-base leading-none">{agent.icon}</div>
              <span className="truncate">{agent.name}</span>
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
  onModeChange,
  onToolChange,
  activeTool = ToolType.None,
  drawColor = '#e53e3e',
  onColorChange,
  lineWidth = 2,
  onLineWidthChange,
  penStyle = PenStyle.Normal,
  onPenStyleChange
}) => {
  const [activeTooltip, setActiveTooltip] = useState<string>('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAgentMenu, setShowAgentMenu] = useState(false)
  const [showBrushSettings, setShowBrushSettings] = useState(false)
  const panelManager = usePanelManager()
  const pencilButtonRef = useRef<HTMLDivElement>(null)
  const brushSettingsTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  
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

  // 处理工具选择
  const handleToolSelect = (toolType: ToolType) => {
    if (onToolChange) {
      translog.debug('Tool selected:', { toolType })
      onToolChange(toolType)
    }
  }

  // 处理颜色选择
  const handleColorSelect = (color: string) => {
    if (onColorChange) {
      translog.debug('Color selected:', { color })
      onColorChange(color)
      
      // 当用户选择颜色时，自动选中画笔工具
      if (activeTool !== ToolType.Pencil) {
        handleToolSelect(ToolType.Pencil)
      }
    }
  }

  // 处理线宽变化
  const handleLineWidthChange = (width: number) => {
    if (onLineWidthChange) {
      translog.debug('Line width changed:', { width })
      onLineWidthChange(width)
      
      // 当用户调整线宽时，自动选中画笔工具
      if (activeTool !== ToolType.Pencil) {
        handleToolSelect(ToolType.Pencil)
      }
    }
  }

  // 处理笔触风格变化
  const handlePenStyleChange = (style: PenStyle, sensitivity?: number, taper?: boolean) => {
    if (onPenStyleChange) {
      translog.debug('Pen style changed:', { style, sensitivity, taper })
      onPenStyleChange(style, sensitivity, taper)
      
      // 当用户调整笔触风格时，自动选中画笔工具
      if (activeTool !== ToolType.Pencil) {
        handleToolSelect(ToolType.Pencil)
      }
    }
  }

  // 处理画笔按钮悬停
  const handlePencilHover = (isHovering: boolean) => {
    if (brushSettingsTimeoutRef.current) {
      clearTimeout(brushSettingsTimeoutRef.current);
      brushSettingsTimeoutRef.current = null;
    }

    if (isHovering) {
      // 短暂延迟显示设置面板，避免意外触发
      brushSettingsTimeoutRef.current = setTimeout(() => {
        setShowBrushSettings(true);
      }, 300);
    } else {
      // 延迟隐藏，以便用户可以移动到设置面板上
      brushSettingsTimeoutRef.current = setTimeout(() => {
        setShowBrushSettings(false);
      }, 300);
    }
  };

  // 清理定时器
  useEffect(() => {
    return () => {
      if (brushSettingsTimeoutRef.current) {
        clearTimeout(brushSettingsTimeoutRef.current);
      }
    };
  }, []);

  const tools: ToolButton[] = [
    {
      tooltip: 'Agents',
      icon: <RobotOutlined spin={isProcessing} />,
      onClick: () => setShowAgentMenu(true),
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: '识别内容',
      icon: <ScanOutlined spin={isProcessing} />,
      onClick: handleOCR,
      disabled: !selectedBounds || isProcessing
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        </svg>
      ),
      tooltip: '矩形',
      toolType: ToolType.Rectangle,
      isActive: activeTool === ToolType.Rectangle,
      onClick: () => handleToolSelect(ToolType.Rectangle),
      disabled: !selectedBounds || isProcessing
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/>
        </svg>
      ),
      tooltip: '椭圆',
      toolType: ToolType.Ellipse,
      isActive: activeTool === ToolType.Ellipse,
      onClick: () => handleToolSelect(ToolType.Ellipse),
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: '画笔',
      icon: (
        <div className="relative flex items-center justify-center">
          <Pencil className={`w-3.5 h-3.5 ${activeTool === ToolType.Pencil ? '' : 'text-gray-500'}`} 
                 style={activeTool === ToolType.Pencil ? { color: drawColor } : {}} />
          {activeTool === ToolType.Pencil && (
            <div 
              className="absolute -bottom-1 -right-1 w-2 h-2 rounded-full border border-white"
              style={{ backgroundColor: drawColor }}
            />
          )}
        </div>
      ),
      toolType: ToolType.Pencil,
      isActive: activeTool === ToolType.Pencil,
      onClick: () => handleToolSelect(ToolType.Pencil),
      disabled: !selectedBounds || isProcessing,
      showSettingsOnHover: true
    },
    {
      tooltip: '马赛克',
      icon: <BlockOutlined className="text-lg" />,
      toolType: ToolType.Mosaic,
      isActive: activeTool === ToolType.Mosaic,
      onClick: () => handleToolSelect(ToolType.Mosaic),
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: '文字',
      icon: <FontSizeOutlined className="text-lg" />,
      toolType: ToolType.Text,
      isActive: activeTool === ToolType.Text,
      onClick: () => handleToolSelect(ToolType.Text),
      disabled: !selectedBounds || isProcessing
    },
    {
      tooltip: isScreenRecording ? '切换到截图' : '切换到录屏',
      icon: isScreenRecording ? <CameraOutlined /> : <VideoCameraOutlined />,
      onClick: () => onModeChange?.(!isScreenRecording)
    },
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
            <div 
              key={index} 
              className="relative group"
              ref={tool.tooltip === '画笔' ? pencilButtonRef : undefined}
              onMouseEnter={() => {
                setActiveTooltip(tool.tooltip);
                if (tool.showSettingsOnHover) {
                  handlePencilHover(true);
                }
              }}
              onMouseLeave={() => {
                setActiveTooltip('');
                if (tool.showSettingsOnHover) {
                  handlePencilHover(false);
                }
              }}
            >
              <button
                className={`w-7 h-7 rounded-md flex items-center justify-center transition-all duration-200 ${
                  tool.disabled 
                    ? 'opacity-50 cursor-not-allowed'
                    : tool.isActive
                      ? 'bg-blue-100 text-blue-600 shadow-sm transform scale-105'
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 active:text-blue-600'
                }`}
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

        {/* 画笔设置面板 */}
        {showBrushSettings && (
          <div 
            className="absolute z-50"
            style={{ 
              top: pencilButtonRef.current ? pencilButtonRef.current.offsetTop + pencilButtonRef.current.offsetHeight : 0,
              left: pencilButtonRef.current ? pencilButtonRef.current.offsetLeft : 0
            }}
            onMouseEnter={() => handlePencilHover(true)}
            onMouseLeave={() => handlePencilHover(false)}
          >
            <BrushSettings
              onClose={() => setShowBrushSettings(false)}
              onColorSelect={handleColorSelect}
              onLineWidthChange={handleLineWidthChange}
              onPenStyleChange={handlePenStyleChange}
              currentColor={drawColor}
              currentLineWidth={lineWidth}
              currentPenStyle={penStyle}
            />
          </div>
        )}

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