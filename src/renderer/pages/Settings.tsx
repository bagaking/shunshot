import React, { useState } from 'react'
import { SystemSettings } from './settings/SystemSettings'
import { AIModelSettings } from './settings/AIModelSettings'

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
  const [activeTab, setActiveTab] = useState<'system' | 'aiModel'>('system')

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          {/* 标题 */}
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              设置
            </h3>
          </div>

          {/* 标签页 */}
          <div className="border-b border-gray-200">
            <nav className="flex space-x-8 px-4" aria-label="Tabs">
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
            </nav>
          </div>

          {/* 内容区域 */}
          <div className="px-4 py-5 sm:p-6">
            {activeTab === 'system' ? (
              <SystemSettings />
            ) : (
              <AIModelSettings />
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 