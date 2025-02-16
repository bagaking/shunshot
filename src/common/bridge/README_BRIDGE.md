# Bridge System Documentation

## Overview

The Bridge system provides a type-safe, robust IPC (Inter-Process Communication) layer for Electron applications. It facilitates seamless communication between the main process and renderer processes while maintaining type safety and providing a clean API.

## Core Concepts

### Bridge Instance
A Bridge instance represents a specific communication channel between the main process and renderer processes. Each bridge:
- Has a unique identifier
- Manages its own message handlers
- Provides type-safe API generation
- Handles request/response patterns
- Supports event emission and subscription

### Message Context
Every message in the system includes a context containing:
- `bridgeId`: Unique identifier for the bridge instance
- `messageId`: Unique identifier for the message
- `timestamp`: Time when the message was created

### Handlers
Handlers process messages for specific bridge instances. They:
- Are registered with the BridgeRegistry
- Process messages based on bridge ID
- Can implement custom logic per bridge type

## Architecture

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│  Bridge Class   │      │  BridgeRegistry  │      │  BridgeHandler  │
├─────────────────┤      ├──────────────────┤      ├─────────────────┤
│ - createAPI()   │──────│ - dispatch()     │──────│ - handle()      │
│ - emit()        │      │ - register()     │      │                 │
│ - broadcast()   │      │ - unregister()   │      │                 │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

## API Reference

### Bridge<T>

```typescript
class Bridge<T extends Record<string, any>> {
  constructor(options: IBridgeOptions)
  
  // Create preload API for renderer process
  createPreloadApi(ipcRenderer: IpcRenderer, customImpl?: Partial<T>): T
  
  // Register handlers for main process
  registerMainHandlers(ipcMain: IpcMain, handlers: {...}): void
  
  // Event handling
  on<K extends keyof T>(method: K, handler: T[K]): () => void
  emit<K extends keyof T>(window: BrowserWindow, method: K, ...args: Parameters<T[K]>): void
  broadcast<K extends keyof T>(method: K, ...args: Parameters<T[K]>): void
}
```

### BridgeHandler

```typescript
abstract class BridgeHandler<T extends Record<string, any>> {
  constructor(protected bridgeId: string)
  abstract handle(method: keyof T, args: any[]): Promise<any>
}
```

### BridgeRegistry

```typescript
class BridgeRegistry {
  registerHandler<T>(bridgeId: string, handler: BridgeHandler<T>): void
  unregisterHandler(bridgeId: string): void
  dispatch(message: IMessageWrapper): Promise<any>
}
```

## Usage Examples

下面通过一个计数器的例子来展示完整的使用流程。

### 1. 定义接口

```typescript
// src/types/counter.ts

// 主进程 API 接口
export interface ICounterMainAPI {
  increment(): Promise<number>
  getCount(): Promise<number>
  reset(): Promise<void>
}

// 预加载进程 API 接口
export interface ICounterPreloadAPI {
  // 本地状态管理方法
  getLocalCount(): number
  setLocalCount(count: number): void
}

// 完整 API 接口
export interface ICounterAPI extends ICounterMainAPI, ICounterPreloadAPI {
  // 事件处理器
  onCountChanged(callback: (count: number) => void): () => void
}
```

### 2. 实现业务逻辑

```typescript
// electron/main/services/CounterService.ts

// 事件通知接口
export interface ICounterEventDispatcher {
  dispatchCountChanged(count: number): void
}

// 主进程服务 - 实现主进程 API
export class CounterMainService implements ICounterMainAPI {
  private count = 0

  constructor(private eventDispatcher: ICounterEventDispatcher) {}

  async increment(): Promise<number> {
    this.count++
    this.eventDispatcher.dispatchCountChanged(this.count)
    return this.count
  }

  async getCount(): Promise<number> {
    return this.count
  }

  async reset(): Promise<void> {
    this.count = 0
    this.eventDispatcher.dispatchCountChanged(this.count)
  }
}

// 主进程事件分发器
export class CounterEventDispatcher implements ICounterEventDispatcher {
  private windows = new Set<BrowserWindow>()

  constructor(private bridge: Bridge<ICounterAPI>) {}

  // 窗口管理
  registerWindow(window: BrowserWindow) {
    this.windows.add(window)
    window.on('closed', () => {
      this.windows.delete(window)
    })
  }

  // 实现事件分发
  dispatchCountChanged(count: number): void {
    for (const window of this.windows) {
      if (!window.isDestroyed()) {
        this.bridge.emit(window, 'onCountChanged', count)
      }
    }
  }
}

// electron/preload/services/CounterService.ts

// 预加载进程服务 - 实现预加载进程 API
export class CounterPreloadService implements ICounterPreloadAPI {
  private localCount = 0

  getLocalCount(): number {
    return this.localCount
  }

  setLocalCount(count: number): void {
    this.localCount = count
  }
}
```

### 3. 注册服务

```typescript
// electron/main/index.ts
import { app, BrowserWindow } from 'electron'
import { Bridge } from '../../types/bridge'
import { ICounterAPI } from '../../types/counter'
import { CounterMainService, CounterEventDispatcher } from './services/CounterService'

// 创建 Bridge 实例
const counterBridge = new Bridge<ICounterAPI>({
  id: 'counter-bridge',
  prefix: 'counter',
  enableLog: true
})

// 创建事件分发器和主进程服务
const eventDispatcher = new CounterEventDispatcher(counterBridge)
const mainService = new CounterMainService(eventDispatcher)

// 注册主进程 handlers
counterBridge.registerMainHandlers(ipcMain, mainService)

// 创建窗口时注册到事件分发器
function createWindow() {
  const win = new BrowserWindow({
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js')
    }
  })
  
  eventDispatcher.registerWindow(win)
  // ... 其他窗口配置
}
```

### 4. Preload 配置

```typescript
// electron/preload/index.ts
import { contextBridge, ipcRenderer } from 'electron'
import { Bridge } from '../../types/bridge'
import { ICounterAPI } from '../../types/counter'
import { CounterPreloadService } from './services/CounterService'

// 创建 Bridge 实例
const counterBridge = new Bridge<ICounterAPI>({
  id: 'counter-bridge',
  prefix: 'counter',
  enableLog: true
})

// 创建预加载服务
const preloadService = new CounterPreloadService()

// 创建完整 API
const counterAPI = counterBridge.createPreloadApi(ipcRenderer, {
  // 本地方法直接使用预加载服务
  getLocalCount: () => preloadService.getLocalCount(),
  setLocalCount: (count) => preloadService.setLocalCount(count)
})

// 监听远程事件更新本地状态
counterAPI.onCountChanged((count) => {
  preloadService.setLocalCount(count)
})

// 暴露 API 到 window 对象
contextBridge.exposeInMainWorld('counterAPI', counterAPI)

// 声明全局类型
declare global {
  interface Window {
    counterAPI: ICounterAPI
  }
}
```

### 5. 渲染进程使用

```typescript
// src/renderer/Counter.tsx
import { useEffect, useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)
  
  useEffect(() => {
    // 初始化使用本地状态
    setCount(window.counterAPI.getLocalCount())
    
    // 监听远程更新
    const unsubscribe = window.counterAPI.onCountChanged((newCount) => {
      window.counterAPI.setLocalCount(newCount)
      setCount(newCount)
    })
    
    return () => unsubscribe()
  }, [])
  
  const handleIncrement = async () => {
    try {
      const newCount = await window.counterAPI.increment()
      console.log('Incremented to:', newCount)
    } catch (error) {
      console.error('Failed to increment:', error)
    }
  }
  
  const handleReset = async () => {
    try {
      await window.counterAPI.reset()
      console.log('Counter reset')
    } catch (error) {
      console.error('Failed to reset:', error) 
    }
  }
  
  return (
    <div>
      <h1>Count: {count}</h1>
      <button onClick={handleIncrement}>Increment</button>
      <button onClick={handleReset}>Reset</button>
    </div>
  )
}
```

这个例子展示了:

1. **类型定义**
   - 定义清晰的 API 接口
   - 包含方法和事件处理器

2. **Handler 实现**
   - 继承 `BridgeHandler`
   - 维护状态
   - 处理方法调用
   - 发送事件通知

3. **Bridge 配置**
   - 主进程和渲染进程使用相同配置
   - Handler 注册和窗口管理
   - 类型安全的 API 创建

4. **Preload 设置**
   - API 暴露到 window 对象
   - 全局类型声明

5. **渲染进程使用**
   - 异步方法调用
   - 事件监听
   - 错误处理
   - React 组件集成

## Best Practices

1. **Type Safety**
   - Always define interfaces for your API
   - Avoid using `any` types
   - Leverage TypeScript's type system

2. **Error Handling**
   - Implement proper error handling in handlers
   - Use try-catch blocks for async operations
   - Provide meaningful error messages

3. **Message Design**
   - Keep message payloads small and focused
   - Use meaningful method names
   - Document the expected arguments and return types

4. **Performance**
   - Avoid sending large amounts of data
   - Consider batching frequent updates
   - Use events for real-time updates instead of polling

5. **Security**
   - Validate all incoming messages
   - Implement proper access controls
   - Never expose sensitive information

## Contributing

When contributing to the Bridge system:
1. Maintain type safety
2. Add tests for new features
3. Update documentation
4. Follow existing code style
5. Consider backward compatibility 