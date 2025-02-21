import React, { useState, useEffect } from 'react';
import { AgentConfig } from '../../types/agents'; 
import { Button, List, Modal, Form, Input, InputNumber, Popconfirm, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

interface ModelOption {
  id: string;
  name: string;
  baseURL: string;
  modelName: string;
}

const defaultAgent: AgentConfig = {
  id: '',
  name: '',
  description: '',
  icon: '🤖',
  systemPrompt: '',
  modelConfig: {
    id: 'vision',
    name: '视觉模型'
  },
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 2000,
    maxTurns: 10,
  }
};

export const AgentList: React.FC = () => {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [modelOptions, setModelOptions] = useState<ModelOption[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [form] = Form.useForm();
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);

  useEffect(() => {
    loadAgents();
    loadModelConfigs();
  }, []);

  const loadAgents = async () => {
    const agentList = await window.shunshotCoreAPI.getAgents();
    setAgents(agentList);
  };

  const loadModelConfigs = async () => {
    try {
      const [vision, inference] = await Promise.all([
        window.shunshotCoreAPI.getPreference<{
          apiKey: string;
          baseURL: string;
          modelName: string;
        }>('aiModel.vision'),
        window.shunshotCoreAPI.getPreference<{
          apiKey: string;
          baseURL: string;
          modelName: string;
        }>('aiModel.inference')
      ]);

      setModelOptions([
        {
          id: 'vision',
          name: '视觉模型',
          baseURL: vision?.baseURL || '',
          modelName: vision?.modelName || ''
        },
        {
          id: 'inference',
          name: '推理模型',
          baseURL: inference?.baseURL || '',
          modelName: inference?.modelName || ''
        }
      ]);
    } catch (error) {
      console.error('Failed to load model configs:', error);
    }
  };

  const handleCreateOrUpdate = async (values: any) => {
    const agentData: AgentConfig = {
      id: editingAgentId || `agent-${Date.now()}`,
      name: values.name,
      description: values.description || '',
      icon: values.icon,
      systemPrompt: values.systemPrompt,
      modelConfig: {
        id: values.modelConfig.id,
        name: modelOptions.find(m => m.id === values.modelConfig.id)?.name || ''
      },
      enabled: true,
      parameters: {
        temperature: values.temperature,
        maxTokens: values.maxTokens,
        maxTurns: values.maxTurns,
      },
    };

    if (editingAgentId) {
      await window.shunshotCoreAPI.updateAgent(editingAgentId, agentData);
    } else {
      await window.shunshotCoreAPI.createAgent(agentData);
    }

    await loadAgents();
    setIsModalVisible(false);
    form.resetFields();
    setEditingAgentId(null);
  };

  const handleDelete = async (id: string) => {
    await window.shunshotCoreAPI.deleteAgent(id);
    await loadAgents();
  };

  const handleEdit = (agent: AgentConfig) => {
    console.log('Editing agent:', agent);
    console.log('System prompt:', agent.systemPrompt);
    
    const formValues = {
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      systemPrompt: agent.systemPrompt,
      modelConfig: {
        id: agent.modelConfig.id,
      },
      temperature: agent.parameters?.temperature ?? defaultAgent.parameters.temperature,
      maxTokens: agent.parameters?.maxTokens ?? defaultAgent.parameters.maxTokens,
      maxTurns: agent.parameters?.maxTurns ?? defaultAgent.parameters.maxTurns,
    };
    
    console.log('Setting form values:', formValues);
    form.setFieldsValue(formValues);
    
    // 验证表单值是否被正确设置
    setTimeout(() => {
      console.log('Form values after set:', form.getFieldsValue());
    }, 0);
    
    setEditingAgentId(agent.id);
    setIsModalVisible(true);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">AI Agents</h2>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => {
            form.resetFields();
            setEditingAgentId(null);
            setIsModalVisible(true);
          }}
        >
          Add Agent
        </Button>
      </div>

      <List
        dataSource={agents}
        renderItem={(agent) => (
          <List.Item
            actions={[
              <Button
                key="edit"
                icon={<EditOutlined />}
                onClick={() => handleEdit(agent)}
              >
                Edit
              </Button>,
              <Popconfirm
                key="delete"
                title="Are you sure you want to delete this agent?"
                onConfirm={() => handleDelete(agent.id)}
                okText="Yes"
                cancelText="No"
              >
                <Button icon={<DeleteOutlined />} danger>
                  Delete
                </Button>
              </Popconfirm>,
            ]}
          >
            <List.Item.Meta
              avatar={<span className="text-2xl">{agent.icon}</span>}
              title={
                <div className="flex items-center gap-2">
                  <span>{agent.name}</span>
                  {!agent.enabled && (
                    <span className="text-gray-500">(Disabled)</span>
                  )}
                </div>
              }
              description={
                <div className="space-y-1">
                  <div>{agent.description}</div>
                  <div className="text-gray-500">
                    Model: {agent.modelConfig.name} ({agent.modelConfig.id})
                  </div>
                  <div className="text-gray-500">
                    Temperature: {agent.parameters?.temperature ?? 'N/A'}, 
                    Max Tokens: {agent.parameters?.maxTokens ?? 'N/A'}, 
                    Max Turns: {agent.parameters?.maxTurns ?? 'N/A'}
                  </div>
                </div>
              }
            />
          </List.Item>
        )}
      />

      <Modal
        title={editingAgentId ? 'Edit Agent' : 'Create Agent'}
        open={isModalVisible}
        onOk={form.submit}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingAgentId(null);
        }}
        destroyOnClose
      >
        <Form
          form={form}
          name="agentForm"
          layout="vertical"
          onFinish={handleCreateOrUpdate}
          initialValues={defaultAgent}
          preserve={false}
        >
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: 'Please input the agent name!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="icon"
            label="Icon"
            rules={[{ required: true, message: 'Please input the agent icon!' }]}
          >
            <Input />
          </Form.Item>

          <Form.Item
            name="systemPrompt"
            label="System Prompt"
            rules={[{ required: true, message: 'Please input the system prompt!' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name={['modelConfig', 'id']}
            label="Model Type"
            rules={[{ required: true, message: 'Please select the model type!' }]}
          >
            <Select>
              {modelOptions.map(model => (
                <Select.Option key={model.id} value={model.id}>
                  {model.name} ({model.modelName || 'No model name configured'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="temperature"
            label="Temperature"
            rules={[{ required: true, type: 'number', min: 0, max: 1 }]}
          >
            <InputNumber step={0.1} />
          </Form.Item>

          <Form.Item
            name="maxTokens"
            label="Max Tokens"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber />
          </Form.Item>

          <Form.Item
            name="maxTurns"
            label="Max Turns"
            rules={[{ required: true, type: 'number', min: 1 }]}
          >
            <InputNumber />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}; 