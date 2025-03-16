import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Button, Input, message as antdMessage, Tooltip, Typography, Popover } from 'antd'
import { 
  CopyOutlined, EditOutlined, CheckOutlined, CloseOutlined, 
  LoadingOutlined, FileTextOutlined, ScanOutlined,
  DownloadOutlined, RobotOutlined,
  SendOutlined
} from '@ant-design/icons'
import { motion, AnimatePresence } from 'framer-motion'
import { BasePanel, BasePanelProps } from './BasePanel'
import { PanelErrorBoundary } from './PanelErrorBoundary'
import { translog } from '../utils/translog'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github-dark.css'
import { OCRProcessMode } from '../../types/shunshotapi'

// 预设的改写提示词
const REWRITE_PROMPTS = [
  { 
    key: OCRProcessMode.Formal, 
    label: '正式化',
    description: '将文本改写为正式、专业的表达风格',
    prompt: '请将以下文本改写为正式、专业的表达风格，保持原意但使用更加规范的词汇和句式：' 
  },
  { 
    key: OCRProcessMode.Simple, 
    label: '简化表达',
    description: '将复杂文本简化为简单易懂的表达',
    prompt: '请将以下文本简化，使用更简单的词汇和句式，让内容更容易理解，但保持核心含义：' 
  },
  { 
    key: OCRProcessMode.Polish, 
    label: '润色完善',
    description: '改进文本流畅度和表达准确性',
    prompt: '请帮我润色以下文本，使其更加流畅自然，表达更加准确，但不要改变原意：' 
  },
  { 
    key: OCRProcessMode.Bullets, 
    label: '要点归纳',
    description: '将文本转换为简洁的要点列表',
    prompt: '请将以下文本转换为简洁的要点列表，突出关键信息：' 
  },
  { 
    key: OCRProcessMode.Expand, 
    label: '内容扩展',
    description: '扩展并丰富原始文本内容',
    prompt: '请基于以下文本进行扩展，添加更多相关细节和信息，使内容更加丰富但保持原意：' 
  }
];

// 获取系统默认设置的理想面板大小
const DEFAULT_PANEL_SIZE = { width: 500, height: 500 };

interface OCRPanelBaseProps {
  text?: string
  error?: string
  loading?: boolean
  onTextChange?: (text: string) => void
}

type OCRPanelProps = OCRPanelBaseProps & Partial<BasePanelProps>

export const OCRPanel: React.FC<OCRPanelProps> = ({
  text = '',
  error,
  loading = false,
  onTextChange,
  ...basePanelProps
}) => {
  const [isEditing, setIsEditing] = useState(false)
  const [editableText, setEditableText] = useState(text)
  const [copied, setCopied] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showRewriteTools, setShowRewriteTools] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [activePrompt, setActivePrompt] = useState<string | null>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  // 添加OCRPanel初始化时的调试日志
  useEffect(() => {
    translog.debug('OCRPanel mounted with props', { 
      text: text?.substring(0, 50),
      error,
      loading,
      hasOnTextChange: !!onTextChange,
      hasBounds: !!basePanelProps.bounds,
      bounds: basePanelProps.bounds
    });
  }, [text, error, loading, onTextChange, basePanelProps.bounds]);

  useEffect(() => {
    // 更新可编辑文本，保持同步
    setEditableText(text)
  }, [text])

  // 处理编辑功能
  const handleEdit = useCallback(() => {
    setIsEditing(true)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (onTextChange && editableText !== text) {
      setIsSaving(true)
      // 模拟保存延迟以提供更好的用户反馈
      setTimeout(() => {
        onTextChange(editableText)
        setIsEditing(false)
        setIsSaving(false)
        antdMessage.success({
          content: '文本已更新',
          icon: <CheckOutlined style={{ color: '#52c41a' }} />
        })
      }, 500)
    } else {
      setIsEditing(false)
    }
  }, [editableText, text, onTextChange])

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false)
    setEditableText(text)
  }, [text])

  // 处理复制功能
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      antdMessage.success({
        content: '已复制到剪贴板',
        icon: <CheckOutlined style={{ color: '#52c41a' }} />
      })
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      antdMessage.error('复制失败')
      translog.error('Failed to copy OCR text:', error)
    }
  }, [text])

  // 处理下载功能
  const handleDownload = useCallback(() => {
    try {
      // 创建一个Blob对象
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      
      // 创建下载链接
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      // 设置文件名 - 使用当前日期和时间
      const date = new Date();
      const fileName = `OCR_Text_${date.toISOString().slice(0,19).replace(/[-:T]/g, '')}.txt`;
      
      link.href = url;
      link.download = fileName;
      
      // 触发下载
      document.body.appendChild(link);
      link.click();
      
      // 清理
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      antdMessage.success({
        content: '文件已下载',
        icon: <CheckOutlined style={{ color: '#52c41a' }} />
      });
    } catch (error) {
      antdMessage.error('下载失败');
      translog.error('Failed to download OCR text:', error);
    }
  }, [text]);

  // 处理AI改写功能
  const handleRewrite = useCallback((promptKey: string) => {
    // 检查是否有文本可以改写
    if (!text?.trim()) {
      antdMessage.error('没有可改写的文本');
      return;
    }
    
    setIsGenerating(true);
    setActivePrompt(promptKey);
    
    // 获取选项
    const options = {
      mode: promptKey as OCRProcessMode,
      customPrompt: promptKey === 'custom' ? customPrompt : undefined
    };
    
    // 添加调试日志
    translog.debug('OCR rewrite request', { 
      promptKey, 
      options,
      hasBounds: !!basePanelProps.bounds,
      bounds: basePanelProps.bounds,
      textLength: text.length
    });
    
    // 从当前面板中提取截图区域
    const bounds = basePanelProps.bounds;
    
    if (!bounds) {
      antdMessage.error('无法获取图像区域');
      translog.error('OCR rewrite failed: Missing bounds', { panelProps: basePanelProps });
      setIsGenerating(false);
      return;
    }
    
    // 调用OCR API进行处理，传递现有文本
    window.shunshotCoreAPI.ocrWithOptions({
      bounds,
      options,
      existingText: text
    }).then(result => {
      translog.debug('OCR rewrite response', { result });
      
      if (result.error) {
        antdMessage.error(`改写失败: ${result.error}`);
        translog.error('OCR rewrite failed', result.error);
      } else if (result.text) {
        if (onTextChange) {
          onTextChange(result.text);
          setEditableText(result.text);
          
          antdMessage.success({
            content: '文本已改写',
            icon: <CheckOutlined style={{ color: '#52c41a' }} />
          });
        }
      }
      
      setIsGenerating(false);
      setShowRewriteTools(false);  // 处理完成后关闭Popover
      setActivePrompt(null);
    }).catch(error => {
      antdMessage.error('改写过程中发生错误');
      translog.error('OCR rewrite error', error);
      setIsGenerating(false);
      setShowRewriteTools(false);  // 出错时也关闭Popover
      setActivePrompt(null);
    });
  }, [customPrompt, onTextChange, basePanelProps.bounds, text]);

  // 自动设置文本区域高度
  const adjustTextAreaHeight = useCallback(() => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto'
      textAreaRef.current.style.height = textAreaRef.current.scrollHeight + 'px'
    }
  }, [])

  useEffect(() => {
    if (isEditing) {
      adjustTextAreaHeight()
      // 聚焦并将光标移到末尾
      if (textAreaRef.current) {
        textAreaRef.current.focus()
        textAreaRef.current.setSelectionRange(editableText.length, editableText.length)
      }
    }
  }, [isEditing, adjustTextAreaHeight, editableText.length])

  // 渲染内容
  const renderContent = () => {
    if (error) {
      return (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mx-1 my-2 text-red-500 p-4 rounded-lg bg-red-50 shadow-sm border border-red-100"
        >
          <div className="font-medium mb-2 flex items-center">
            <CloseOutlined className="mr-2" /> 
            <span>识别失败</span>
          </div>
          <div className="text-sm opacity-80 pl-5">{error}</div>
        </motion.div>
      )
    }

    if (loading) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col justify-center items-center h-48 text-center"
        >
          <div className="relative mb-6">
            <LoadingOutlined style={{ fontSize: 28 }} className="text-blue-500" />
            <motion.div 
              className="absolute inset-0 rounded-full border-2 border-blue-500/30"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
          <div className="text-gray-600 font-medium">正在识别文字...</div>
          <div className="text-xs text-gray-400 mt-2">这可能需要几秒钟时间</div>
        </motion.div>
      )
    }

    if (isEditing) {
      return (
        <AnimatePresence mode="wait">
          <motion.div 
            key="edit-mode"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2 }}
            className="relative mx-1 my-2"
          >
            <div className="border border-blue-200 rounded-lg overflow-hidden shadow-md bg-white">
              <div className="bg-gradient-to-r from-blue-50 to-blue-100/50 px-4 py-2 border-b border-blue-100 flex items-center justify-between">
                <div className="flex items-center">
                  <EditOutlined className="text-blue-500 mr-2" />
                  <span className="text-sm text-blue-700 font-medium">编辑文本</span>
                </div>
                <div className="text-xs text-blue-400">
                  {editableText.length} 个字符
                </div>
              </div>
              <div className="p-1 bg-gray-50/50">
                <textarea
                  ref={textAreaRef}
                  className="w-full resize-none p-4 focus:outline-none focus:ring-0 border-0 font-mono text-sm leading-relaxed bg-white rounded"
                  value={editableText}
                  onChange={(e) => {
                    setEditableText(e.target.value)
                    adjustTextAreaHeight()
                  }}
                  rows={Math.max(5, text.split('\n').length)}
                  placeholder="输入识别后的文本..."
                  style={{ minHeight: '180px' }}
                />
              </div>
              <motion.div 
                className="flex justify-end px-4 py-3 border-t border-blue-100 bg-gradient-to-r from-gray-50 to-blue-50/30"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.2 }}
              >
                <Tooltip title="放弃修改" placement="top">
                  <Button 
                    size="middle" 
                    icon={<CloseOutlined />} 
                    onClick={handleCancelEdit}
                    className="mr-3 hover:text-red-500 hover:border-red-300 px-3"
                  >
                    取消
                  </Button>
                </Tooltip>
                <Tooltip title="保存更改" placement="top">
                  <Button 
                    size="middle" 
                    type="primary" 
                    icon={isSaving ? <LoadingOutlined /> : <CheckOutlined />}
                    onClick={handleSaveEdit}
                    disabled={isSaving}
                    className="bg-blue-500 hover:bg-blue-600 px-4"
                  >
                    {isSaving ? '保存中...' : '保存'}
                  </Button>
                </Tooltip>
              </motion.div>
            </div>
          </motion.div>
        </AnimatePresence>
      )
    }

    if (!text.trim()) {
      return (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center p-8 text-center h-48"
        >
          <div className="p-5 rounded-full bg-gray-50 mb-4">
            <FileTextOutlined className="text-3xl text-gray-300" />
          </div>
          <div className="text-gray-400 font-medium">未检测到文字</div>
          <div className="text-xs text-gray-300 mt-2">
            请尝试调整选择区域，确保图像包含清晰的文字
          </div>
        </motion.div>
      )
    }

    // 识别正常有结果的状态
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col"
      >
        <motion.div 
          className="mx-1 my-2 prose prose-sm max-w-none text-gray-800 break-words p-4 rounded-lg bg-white shadow-sm border border-gray-100"
        >
          <div className="mb-1 text-xs text-gray-400 flex justify-between items-center">
            <div className="flex items-center">
              <ScanOutlined className="mr-1 text-gray-400" />
              <span>识别结果</span>
            </div>
            <div>{text.length} 个字符</div>
          </div>
          <div className="border-t border-gray-100 pt-3">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeHighlight]}
            >
              {text}
            </ReactMarkdown>
          </div>
        </motion.div>
      </motion.div>
    )
  }

  // 操作按钮
  const renderToolbar = () => {
    if (isEditing || loading || error) return null

    return (
      <motion.div 
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
        className="flex flex-col"
      >
        <div className="flex justify-between items-center px-4 py-2 border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white">
          <div className="text-xs text-gray-400">
            {text.trim() ? `已识别 ${text.length} 个字符` : '未检测到文字'}
          </div>
          
          <div className="flex items-center">
            <Tooltip title="复制到剪贴板" placement="top">
              <Button 
                type="text"
                icon={<CopyOutlined />}
                onClick={handleCopy}
                className={`flex items-center ${copied ? 'text-green-500' : 'text-gray-500 hover:text-blue-500 hover:bg-blue-50'}`}
              >
                {copied ? '已复制' : '复制'}
              </Button>
            </Tooltip>
            
            <Tooltip title="下载文本文件" placement="top">
              <Button 
                type="text"
                icon={<DownloadOutlined />}
                onClick={handleDownload}
                className="ml-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 flex items-center"
              >
                保存
              </Button>
            </Tooltip>
            
            {onTextChange && (
              <Tooltip title="编辑识别文本" placement="top">
                <Button 
                  type="text"
                  icon={<EditOutlined />}
                  onClick={handleEdit}
                  className="ml-1 text-gray-500 hover:text-blue-500 hover:bg-blue-50 flex items-center"
                >
                  编辑
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* 直接显示改写选项区域，无需点击按钮 */}
        {text.trim() && (
          <motion.div 
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
            className="px-4 py-2 border-t border-gray-100 bg-blue-50/30"
          >
            <div className="flex flex-col space-y-2">
              <div className="flex items-center">
                <RobotOutlined className="text-blue-500 mr-2" />
                <span className="text-sm text-blue-700">AI改写文本</span>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {REWRITE_PROMPTS.map(prompt => (
                  <Tooltip key={prompt.key} title={prompt.description} placement="top">
                    <Button 
                      type={activePrompt === prompt.key ? "primary" : "default"}
                      size="small"
                      onClick={() => handleRewrite(prompt.key)}
                      className={`text-xs px-3 py-1 ${activePrompt === prompt.key ? "bg-blue-500" : ""}`}
                      loading={isGenerating && activePrompt === prompt.key}
                      disabled={isGenerating}
                    >
                      {prompt.label}
                    </Button>
                  </Tooltip>
                ))}
              </div>
              
              <div className="flex items-center space-x-2 mt-1">
                <Input.TextArea
                  placeholder="输入自定义提示词，例如：'将文本改写为...''"
                  autoSize={{ minRows: 1, maxRows: 2 }}
                  disabled={isGenerating}
                  value={customPrompt}
                  onChange={e => setCustomPrompt(e.target.value)}
                  className="text-xs flex-grow"
                />
                <Button 
                  type="primary"
                  icon={<SendOutlined />}
                  onClick={() => handleRewrite('custom')}
                  loading={isGenerating && activePrompt === 'custom'}
                  disabled={isGenerating || !customPrompt.trim()}
                  className="flex-shrink-0 bg-blue-500"
                />
              </div>
              
              {isGenerating && (
                <div className="text-xs text-gray-500 flex items-center">
                  <LoadingOutlined className="mr-1" spin /> 
                  正在处理中...请稍候
                </div>
              )}
            </div>
          </motion.div>
        )}
      </motion.div>
    )
  }

  // 自定义标题
  const headerContent = (
    <div className="flex items-center space-x-2">
      <div className="bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center">
        <ScanOutlined className="text-blue-500 text-sm" />
      </div>
      <span className="text-base font-medium">OCR 文字识别</span>
    </div>
  )

  const content = (
    <div className="flex flex-col h-full bg-gray-50 rounded-md">
      <div className="flex-1 overflow-y-auto py-1" style={{ minHeight: 0 }}>
        {renderContent()}
      </div>
      {renderToolbar()}
    </div>
  )

  // 如果没有提供完整的 BasePanelProps，直接返回内容
  if (!basePanelProps.id || !basePanelProps.position || !basePanelProps.size) {
    return (
      <PanelErrorBoundary>
        <motion.div 
          className="h-full overflow-hidden rounded-lg border border-gray-200 shadow-lg"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </PanelErrorBoundary>
    )
  }

  // 使用完整的 BasePanel 包装
  const fullBasePanelProps: BasePanelProps = {
    id: basePanelProps.id,
    position: basePanelProps.position,
    size: basePanelProps.size || DEFAULT_PANEL_SIZE,
    title: basePanelProps.title,
    onClose: basePanelProps.onClose,
    onResize: basePanelProps.onResize,
    onMove: basePanelProps.onMove,
    onMinimize: basePanelProps.onMinimize,
    isMinimized: basePanelProps.isMinimized,
    children: null // 会被覆盖
  }

  return (
    <BasePanel {...fullBasePanelProps} headerContent={headerContent}>
      <PanelErrorBoundary>
        <motion.div 
          className="h-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {content}
        </motion.div>
      </PanelErrorBoundary>
    </BasePanel>
  )
} 