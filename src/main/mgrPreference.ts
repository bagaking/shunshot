import Store from 'electron-store';
import { Logger } from './logger';

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
  inference: ModelConfig;
}

export interface Preferences {
  system: SystemPreference;
  aiModel: AIModelPreference;
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
    inference: {
        apiKey: '',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        modelName: 'gpt-4'
    }
}

const DEFAULT_PREFERENCES: Preferences = {
  system: SYSTEM_PREFERENCES,
  aiModel: AI_MODEL_PREFERENCES 
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