import React, { useState, useEffect } from 'react'
import { ShortcutRecorder } from '../../components/ShortcutRecorder' 

const IconOption: React.FC<{
  value: string
  label: string
  icon: string
  selected: boolean
  onClick: () => void
}> = ({ value, label, icon, selected, onClick }) => (
  <div
    className={`
      flex items-center p-3 rounded-lg cursor-pointer
      ${selected ? 'bg-blue-50 border-blue-500' : 'border-gray-200'}
      border-2 hover:border-blue-500 transition-colors
    `}
    onClick={onClick}
  >
    <img src={icon} alt={label} className="w-6 h-6 mr-2" />
    <span className="text-sm font-medium text-gray-900">{label}</span>
  </div>
)

export const SystemSettings: React.FC = () => {
  const [trayIcon, setTrayIcon] = useState('default')
  const [shortcut, setShortcut] = useState('')
  const [projectPath, setProjectPath] = useState('')

  useEffect(() => {
    // 加载初始配置
    window.shunshotCoreAPI.getPreference<string>('system.trayIcon').then(value => value && setTrayIcon(value))
    window.shunshotCoreAPI.getPreference<string>('system.captureShortcut').then(value => value && setShortcut(value))
    window.shunshotCoreAPI.getPreference<{ path: string }>('system.project').then(value => value?.path && setProjectPath(value.path))
  }, [])

  const handleTrayIconChange = async (value: string) => {
    setTrayIcon(value)
    await window.shunshotCoreAPI.setPreference('system.trayIcon', value)
  }

  const handleShortcutChange = async (value: string) => {
    setShortcut(value)
    await window.shunshotCoreAPI.setPreference('system.captureShortcut', value)
  }

  const handleProjectPathSelect = async () => {
    const result = await window.shunshotCoreAPI.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: '选择项目目录',
      buttonLabel: '选择',
      defaultPath: projectPath || undefined
    })
    
    if (!result.canceled && result.filePaths[0]) {
      const newPath = result.filePaths[0]
      setProjectPath(newPath)
      
      // Get current project config and update only the path
      const currentProject = await window.shunshotCoreAPI.getPreference<{ path: string; name: string; created: number; lastAccessed: number }>('system.project')
      await window.shunshotCoreAPI.setPreference('system.project', {
        ...currentProject,
        path: newPath,
        lastAccessed: Date.now()
      })
    }
  }

  return (
    <div className="space-y-8">
      {/* 托盘图标设置 */}
      

      {/* 快捷键设置 */}
      <div>
        <h4 className="text-base font-medium text-gray-900 mb-4">
          截图快捷键
        </h4>
        <div className="max-w-md">
          <ShortcutRecorder
            value={shortcut}
            onChange={handleShortcutChange}
          />
          <p className="mt-2 text-sm text-gray-500">
            点击输入框并按下新的快捷键组合来更改
          </p>
        </div>
      </div>

      {/* 项目路径设置 */}
      <div>
        <h4 className="text-base font-medium text-gray-900 mb-4">
          项目路径
        </h4>
        <div className="max-w-2xl flex items-center space-x-4">
          <div className="flex-1 truncate bg-gray-50 border border-gray-200 rounded-lg px-4 py-2">
            {projectPath || '未设置'}
          </div>
          <button
            onClick={handleProjectPathSelect}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            选择目录
          </button>
        </div>
        <div className="mt-2 space-y-1">
          <p className="text-sm text-gray-500">
            选择保存截图和对话记录的目录
          </p>
          <p className="text-sm text-gray-400 italic">
            注意：此配置为可选项。若不设置，自动保存等功能将被禁用，但不影响基本功能的使用。
          </p>
          {!projectPath && (
            <p className="text-sm text-amber-600">
              当前未配置项目路径，自动保存功能已禁用
            </p>
          )}
        </div>
      </div>

      <div>
        <h4 className="text-base font-medium text-gray-900 mb-4">
          托盘图标
        </h4>
        <div className="grid grid-cols-3 gap-4">
          <IconOption
            value="default"
            label="默认"
            icon="/icons/tray-default.png"
            selected={trayIcon === 'default'}
            onClick={() => handleTrayIconChange('default')}
          />
          <IconOption
            value="minimal"
            label="简约"
            icon="/icons/tray-minimal.png"
            selected={trayIcon === 'minimal'}
            onClick={() => handleTrayIconChange('minimal')}
          />
          <IconOption
            value="colorful"
            label="彩色"
            icon="/icons/tray-colorful.png"
            selected={trayIcon === 'colorful'}
            onClick={() => handleTrayIconChange('colorful')}
          />
        </div>
      </div>
    </div>
  )
} 