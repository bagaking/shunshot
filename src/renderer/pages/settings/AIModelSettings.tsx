import React, { useState, useEffect } from 'react'

interface ModelConfig {
  apiKey: string
  baseURL: string
  modelName: string
}

const ModelConfigForm: React.FC<{
  title: string
  config: ModelConfig
  onChange: (config: ModelConfig) => void
}> = ({ title, config, onChange }) => {
  const [showApiKey, setShowApiKey] = useState(false)
  const [urlError, setUrlError] = useState<string | null>(null)

  const handleChange = (field: keyof ModelConfig, value: string) => {
    if (field === 'baseURL') {
      try {
        new URL(value)
        setUrlError(null)
      } catch {
        setUrlError('请输入有效的 URL')
      }
    }
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="space-y-6">
      <h4 className="text-base font-medium text-gray-900">{title}</h4>
      
      {/* API Key */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          API Key
        </label>
        <div className="flex space-x-2">
          <input
            type={showApiKey ? 'text' : 'password'}
            value={config.apiKey}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            className="
              flex-1 px-4 py-2 text-sm
              border border-gray-300 rounded-md
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
            placeholder="请输入 API Key"
          />
          <button
            type="button"
            onClick={() => setShowApiKey(!showApiKey)}
            className="
              px-4 py-2
              text-sm font-medium text-gray-700
              bg-white border border-gray-300 rounded-md
              hover:bg-gray-50
              focus:outline-none focus:ring-2 focus:ring-blue-500
            "
          >
            {showApiKey ? '隐藏' : '显示'}
          </button>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Base URL
        </label>
        <input
          type="text"
          value={config.baseURL}
          onChange={(e) => handleChange('baseURL', e.target.value)}
          className={`
            w-full px-4 py-2 text-sm
            border rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500
            ${urlError ? 'border-red-500' : 'border-gray-300'}
          `}
          placeholder="请输入 Base URL"
        />
        {urlError && (
          <p className="mt-1 text-sm text-red-600">{urlError}</p>
        )}
      </div>

      {/* Model Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Model Name
        </label>
        <input
          type="text"
          value={config.modelName}
          onChange={(e) => handleChange('modelName', e.target.value)}
          className="
            w-full px-4 py-2 text-sm
            border border-gray-300 rounded-md
            focus:outline-none focus:ring-2 focus:ring-blue-500
          "
          placeholder="请输入模型名称"
        />
      </div>
    </div>
  )
}

export const AIModelSettings: React.FC = () => {
  const [visionConfig, setVisionConfig] = useState<ModelConfig>({
    apiKey: '',
    baseURL: '',
    modelName: ''
  })

  const [inferenceConfig, setInferenceConfig] = useState<ModelConfig>({
    apiKey: '',
    baseURL: '',
    modelName: ''
  })

  useEffect(() => {
    // 加载初始配置
    window.shunshotCoreAPI.getPreference<ModelConfig>('aiModel.vision').then(setVisionConfig)
    window.shunshotCoreAPI.getPreference<ModelConfig>('aiModel.inference').then(setInferenceConfig)
  }, [])

  const handleVisionConfigChange = async (config: ModelConfig) => {
    setVisionConfig(config)
    await window.shunshotCoreAPI.setPreference('aiModel.vision', config)
  }

  const handleInferenceConfigChange = async (config: ModelConfig) => {
    setInferenceConfig(config)
    await window.shunshotCoreAPI.setPreference('aiModel.inference', config)
  }

  return (
    <div className="space-y-12">
      <ModelConfigForm
        title="视觉模型配置"
        config={visionConfig}
        onChange={handleVisionConfigChange}
      />
      
      <div className="border-t border-gray-200" />
      
      <ModelConfigForm
        title="推理模型配置"
        config={inferenceConfig}
        onChange={handleInferenceConfigChange}
      />
    </div>
  )
} 