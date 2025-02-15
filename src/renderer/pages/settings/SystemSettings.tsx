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

  useEffect(() => {
    // 加载初始配置
    window.shunshotCoreAPI.getPreference<string>('system.trayIcon').then(setTrayIcon)
    window.shunshotCoreAPI.getPreference<string>('system.captureShortcut').then(setShortcut)
  }, [])

  const handleTrayIconChange = async (value: string) => {
    setTrayIcon(value)
    await window.shunshotCoreAPI.setPreference('system.trayIcon', value)
  }

  const handleShortcutChange = async (value: string) => {
    setShortcut(value)
    await window.shunshotCoreAPI.setPreference('system.captureShortcut', value)
  }

  return (
    <div className="space-y-8">
      {/* 托盘图标设置 */}
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
    </div>
  )
} 