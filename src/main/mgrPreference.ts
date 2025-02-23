import Store from 'electron-store';
import { Logger } from './logger';
import { AgentConfig, DEFAULT_AGENTS } from '../types/agents';
import * as path from 'path';
import { app } from 'electron';
import { ProjectConfig } from '../types/project';

interface ModelConfig {
  apiKey: string;
  baseURL: string;
  modelName: string;
}

interface SystemPreference {
  trayIcon: 'default' | 'minimal' | 'colorful';
  captureShortcut: string;
  project: ProjectConfig;
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

const DEFAULT_PROJECT: ProjectConfig = {
  path: path.join(app.getPath('documents'), 'Shunshot'),
  name: 'default',
  created: Date.now(),
  lastAccessed: Date.now(),
};

const SYSTEM_PREFERENCES: SystemPreference = {
  trayIcon: 'default',
  captureShortcut: process.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X',
  project: DEFAULT_PROJECT,
};

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

type PathSubscriptionCallback<T = any> = (value: T) => void;

export class PreferenceManager {
  private store: Store<Preferences>;
  private subscribers: Set<(key: string, value: any) => void>;
  private pathSubscribers: Map<string, Set<PathSubscriptionCallback>>;

  constructor() {
    this.store = new Store<Preferences>({
      name: 'preferences',
      defaults: DEFAULT_PREFERENCES
    });
    this.subscribers = new Set();
    this.pathSubscribers = new Map();

    Logger.log('Preference manager initialized');
  }

  get<T>(key: string): T {
    return this.store.get(key) as T;
  }

  set<T>(key: string, value: T): void {
    this.store.set(key, value);
    this.notifySubscribers(key, value);
  }

  private getValueFromPath(path: string): any {
    return path.split('.').reduce((obj, key) => obj?.[key], this.store.store);
  }

  private isPathAffected(subscribedPath: string, changedPath: string): boolean {
    const subscribedParts = subscribedPath.split('.');
    const changedParts = changedPath.split('.');
    
    if (subscribedParts.length > changedParts.length) {
      return false;
    }
    
    return subscribedParts.every((part, index) => part === changedParts[index]);
  }

  private notifySubscribers(key: string, value: any): void {
    // Notify general subscribers
    this.subscribers.forEach(callback => {
      try {
        callback(key, value);
      } catch (error) {
        Logger.error('Error in preference subscriber', error as Error);
      }
    });

    // Notify path-specific subscribers
    this.pathSubscribers.forEach((callbacks, path) => {
      if (this.isPathAffected(path, key)) {
        const pathValue = this.getValueFromPath(path);
        callbacks.forEach(callback => {
          try {
            callback(pathValue);
          } catch (error) {
            Logger.error(`Error in path-specific subscriber for path ${path}`, error as Error);
          }
        });
      }
    });
  }

  subscribePath<T>(path: string, callback: PathSubscriptionCallback<T>): () => void {
    if (!this.pathSubscribers.has(path)) {
      this.pathSubscribers.set(path, new Set());
    }
    
    const callbacks = this.pathSubscribers.get(path)!;
    callbacks.add(callback as PathSubscriptionCallback);

    // Initialize with current value
    try {
      const currentValue = this.getValueFromPath(path);
      callback(currentValue);
    } catch (error) {
      Logger.error(`Error initializing path subscriber for path ${path}`, error as Error);
    }

    return () => {
      const callbacks = this.pathSubscribers.get(path);
      if (callbacks) {
        callbacks.delete(callback as PathSubscriptionCallback);
        if (callbacks.size === 0) {
          this.pathSubscribers.delete(path);
        }
      }
    };
  }

  subscribe(callback: (key: string, value: any) => void): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }
}

export const mgrPreference = new PreferenceManager();