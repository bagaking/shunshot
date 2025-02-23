import Store from 'electron-store';
import { Logger } from './logger';
import { AgentConfig, DEFAULT_AGENTS } from '../types/agents';

interface ModelConfig {
  apiKey: string;
  baseURL: string;
  modelName: string;
}

interface SystemPreference {
  trayIcon: 'default' | 'minimal' | 'colorful';
  captureShortcut: string;
}

interface AIModelPreference {
  vision: ModelConfig;
  reasoning: ModelConfig;
  standard: ModelConfig;
}

export interface Preferences {
  system: SystemPreference;
  aiModel: AIModelPreference;
  agents: AgentConfig[];
}

const SYSTEM_PREFERENCES: SystemPreference = {
    trayIcon: 'default',
    captureShortcut: process.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X'
}

const AI_MODEL_PREFERENCES: AIModelPreference = {
    vision: {
        apiKey: '',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        modelName: 'ep-20250119144040-f2bqg'
    },
    reasoning: {
        apiKey: '',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        modelName: 'deepseek-r1'
    },
    standard: {
        apiKey: '',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        modelName: 'gpt-4'
    }

}

const DEFAULT_PREFERENCES: Preferences = {
  system: SYSTEM_PREFERENCES,
  aiModel: AI_MODEL_PREFERENCES,
  agents: DEFAULT_AGENTS
};

export class PreferenceManager {
  private store: Store<Preferences>;
  private subscribers: Set<(key: string, value: any) => void>;

  constructor() {
    this.store = new Store<Preferences>({
      name: 'preferences',
      defaults: DEFAULT_PREFERENCES
    });
    this.subscribers = new Set();

    Logger.log('Preference manager initialized');
  }

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
    this.notifySubscribers(key, value);
  }

  private notifySubscribers(key: string, value: any): void {
    this.subscribers.forEach(callback => {
      try {
        callback(key, value);
      } catch (error) {
        Logger.error('Error in preference subscriber', error as Error);
      }
    });
  }

  subscribe(callback: (key: string, value: any) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const mgrPreference = new PreferenceManager(); 