import React, { useState } from 'react'
import { SystemSettings } from './settings/SystemSettings'
import { AIModelSettings } from './settings/AIModelSettings'
import { AgentSettings } from './settings/AgentSettings'

const TabButton: React.FC<{
  active: boolean
  onClick: () => void
  children: React.ReactNode
}> = ({ active, onClick, children }) => (
  <button
    className={`px-4 py-2 text-sm font-medium ${
      active
        ? 'text-blue-600 border-b-2 border-blue-600'
        : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
    }`}
    onClick={onClick}
  >
    {children}
  </button>
)

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'system' | 'aiModel' | 'agents'>('system')

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* 标题 */}
      <div className="px-6 py-5 border-b border-gray-200">
        <h3 className="text-lg leading-6 font-medium text-gray-900">
          设置
        </h3>
      </div>

      {/* 标签页 */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8 px-6" aria-label="Tabs">
          <TabButton
            active={activeTab === 'system'}
            onClick={() => setActiveTab('system')}
          >
            系统设置
          </TabButton>
          <TabButton
            active={activeTab === 'aiModel'}
            onClick={() => setActiveTab('aiModel')}
          >
            大模型设置
          </TabButton>
          <TabButton
            active={activeTab === 'agents'}
            onClick={() => setActiveTab('agents')}
          >
            AI Agents
          </TabButton>
        </nav>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {activeTab === 'system' ? (
          <SystemSettings />
        ) : activeTab === 'aiModel' ? (
          <AIModelSettings />
        ) : (
          <AgentSettings />
        )}
      </div>
    </div>
  )
} 