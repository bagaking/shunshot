import React, { useState, useEffect } from 'react';
import { AgentConfig, AgentModelGene } from '../../../types/agents'; 
import { Button, List, Modal, Form, Input, InputNumber, Popconfirm, Select } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined } from '@ant-design/icons';

interface ModelOption {
 
  name: string;
  baseURL: string;
  modelName: string;

  gene: AgentModelGene;
}

const defaultAgent: AgentConfig = {
  id: '',
  name: '',
  description: '',
  icon: '🤖',
  systemPrompt: '',
  modelConfig: {
    gene: 'vision',
    name: '视觉模型'
  },
  enabled: true,
  parameters: {
    temperature: 0.7,
    maxTokens: 2000,
    maxTurns: 10,
  }
};

const AgentList: React.FC = () => {
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
      const [vision, reasoning, standard] = await Promise.all([
        window.shunshotCoreAPI.getPreference<{
          apiKey: string;
          baseURL: string;
          modelName: string;
        }>('aiModel.vision'),
        window.shunshotCoreAPI.getPreference<{
          apiKey: string;
          baseURL: string;
          modelName: string;
        }>('aiModel.reasoning'),
        window.shunshotCoreAPI.getPreference<{
          apiKey: string;
          baseURL: string;
          modelName: string;
        }>('aiModel.standard')
      ]);

      setModelOptions([
        {
          
          name: '视觉模型',
          baseURL: vision?.baseURL || '',
          modelName: vision?.modelName || '',
          gene: 'vision' as AgentModelGene
        },
        {
          
          name: '推理模型',
          baseURL: reasoning?.baseURL || '',
          modelName: reasoning?.modelName || '',
          gene: 'reasoning' as AgentModelGene
        },
        {
          
          name: '标准模型',
          baseURL: standard?.baseURL || '',
          modelName: standard?.modelName || '',
          gene: 'standard' as AgentModelGene
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
        gene: values.modelConfig.gene,
        name: modelOptions.find(m => m.gene === values.modelConfig.gene)?.name || ''
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
    
    const formValues = {
      name: agent.name,
      description: agent.description,
      icon: agent.icon,
      systemPrompt: agent.systemPrompt,
      modelConfig: {
        gene: agent.modelConfig.gene,
      },
      // Flatten parameters to match form field structure
      temperature: agent.parameters?.temperature,
      maxTokens: agent.parameters?.maxTokens,
      maxTurns: agent.parameters?.maxTurns,
    };
    
    console.log('Setting form values:', formValues);
    form.setFieldsValue(formValues);
    
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
                    Model: {agent.modelConfig.name} ({agent.modelConfig.gene})
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
          initialValues={{
            name: defaultAgent.name,
            description: defaultAgent.description,
            icon: defaultAgent.icon,
            systemPrompt: defaultAgent.systemPrompt,
            modelConfig: defaultAgent.modelConfig,
            temperature: defaultAgent.parameters.temperature,
            maxTokens: defaultAgent.parameters.maxTokens,
            maxTurns: defaultAgent.parameters.maxTurns,
          }}
          preserve={false}
        >

        <div className="flex gap-4">
          <Form.Item
            name="icon"
            label="Icon"
            rules={[{ required: true, message: 'Please input the agent icon!' }]}
          >
            <Input />
          </Form.Item>

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
          </div>

          <Form.Item
            name="systemPrompt"
            label="System Prompt"
            rules={[{ required: true, message: 'Please input the system prompt!' }]}
          >
            <Input.TextArea rows={4} />
          </Form.Item>

          <Form.Item
            name={['modelConfig', 'gene']}
            label="Model"
            rules={[{ required: true, message: 'Please select the model type!' }]}
          >
            <Select>
              {modelOptions.map(model => (
                <Select.Option key={model.gene} value={model.gene}>
                  {model.name} ({model.modelName || 'No model name configured'})
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <div className="flex gap-4">
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
          </div>
        </Form>
      </Modal>
    </div>
  );
}; 

export const AgentSettings: React.FC = () => {
  return (
    <div className="h-full overflow-auto">
      <AgentList />
    </div>
  );
}; 