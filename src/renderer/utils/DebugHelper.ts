interface DebugInfo {
  imageSize?: number;
  bounds?: {
    width: number;
    height: number;
    x: number;
    y: number;
  };
  scaleFactor?: number;
}

interface DebugOptions {
  prefix?: string;
  enableConsoleOverride?: boolean;
  enableErrorCapture?: boolean;
  enablePerformanceMonitoring?: boolean;
}

type DebugModeChangeCallback = (enabled: boolean) => void;

class DebugHelper {
  private events: string[] = [];
  private isDebugEnabled = false;
  private static instance: DebugHelper;
  private debugOverlay: HTMLDivElement | null = null;
  private debugInfoElement: HTMLDivElement | null = null;
  private debugData: Record<string, any> = {};
  private options: DebugOptions = {};
  private debugModeListeners: Set<DebugModeChangeCallback> = new Set();
  private operationTimers: Map<string, number> = new Map();
  private performanceMetrics: Array<{
    operation: string;
    duration: number;
    timestamp: number;
  }> = [];

  private constructor() {
    this.setupErrorHandlers();
  }

  private setupErrorHandlers() {
    // 重写 console 方法以捕获所有日志
    if (this.options.enableConsoleOverride) {
      const originalConsole = {
        log: console.log,
        error: console.error,
        warn: console.warn,
        info: console.info
      };

      // 包装 console 方法
      console.log = (...args) => {
        this.persistLog('log', ...args);
        originalConsole.log.apply(console, args);
      };
      console.error = (...args) => {
        this.persistLog('error', ...args);
        originalConsole.error.apply(console, args);
      };
      console.warn = (...args) => {
        this.persistLog('warn', ...args);
        originalConsole.warn.apply(console, args);
      };
      console.info = (...args) => {
        this.persistLog('info', ...args);
        originalConsole.info.apply(console, args);
      };
    }

    if (this.options.enableErrorCapture) {
      // 捕获未处理的错误和 Promise 拒绝
      window.addEventListener('error', (event) => {
        this.persistLog('error', 'Uncaught error:', event.error);
      });
      window.addEventListener('unhandledrejection', (event) => {
        this.persistLog('error', 'Unhandled promise rejection:', event.reason);
      });
    }
  }

  setOptions(options: DebugOptions) {
    this.options = { ...this.options, ...options };
    this.setupErrorHandlers();
  }

  onDebugModeChange(callback: DebugModeChangeCallback) {
    this.debugModeListeners.add(callback);
  }

  offDebugModeChange(callback: DebugModeChangeCallback) {
    this.debugModeListeners.delete(callback);
  }

  startOperation(name: string) {
    if (!this.isDebugEnabled || !this.options.enablePerformanceMonitoring) return;
    this.operationTimers.set(name, performance.now());
  }

  endOperation(name: string) {
    if (!this.isDebugEnabled || !this.options.enablePerformanceMonitoring) return;
    const startTime = this.operationTimers.get(name);
    if (startTime) {
      const duration = performance.now() - startTime;
      this.performanceMetrics.push({
        operation: name,
        duration,
        timestamp: Date.now()
      });
      this.operationTimers.delete(name);
      console.debug(`Operation ${name} took ${duration.toFixed(2)}ms`);
    }
  }

  logPerformance(operation: string, duration: number) {
    if (!this.isDebugEnabled || !this.options.enablePerformanceMonitoring) return;
    this.performanceMetrics.push({
      operation,
      duration,
      timestamp: Date.now()
    });
    console.debug(`Performance: ${operation} took ${duration.toFixed(2)}ms`);
  }

  exportLogs() {
    const logs = {
      events: this.events,
      performanceMetrics: this.performanceMetrics,
      debugData: this.debugData
    };
    
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debug-logs-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  private async persistLog(level: string, ...args: any[]) {
    try {
      const timestamp = new Date().toISOString();
      const message = args.map(arg => {
        try {
          return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
        } catch (err) {
          return '[Unstringifiable Object]';
        }
      }).join(' ');

      const prefix = this.options.prefix || '';
      const formattedMessage = `${prefix} ${message}`;

      // 使用 translogAPI
      try {
        switch (level) {
          case 'error':
            await window.translogAPI.error(formattedMessage);
            break;
          case 'warn':
            await window.translogAPI.warn(formattedMessage);
            break;
          case 'info':
            await window.translogAPI.info(formattedMessage);
            break;
          case 'debug':
            await window.translogAPI.debug(formattedMessage);
            break;
          default:
            await window.translogAPI.log(formattedMessage);
        }
      } catch (error) {
        // 如果日志 API 调用失败，回退到 console
        console.error('Failed to use translogAPI, falling back to console:', error);
        switch (level) {
          case 'error':
            console.error(formattedMessage);
            break;
          case 'warn':
            console.warn(formattedMessage);
            break;
          case 'info':
            console.info(formattedMessage);
            break;
          case 'debug':
            console.debug(formattedMessage);
            break;
          default:
            console.log(formattedMessage);
        }
      }
    } catch (error) {
      // 确保日志系统本身的错误不会影响应用
      console.error('Error in logging system:', error);
    }
  }

  static getInstance(): DebugHelper {
    if (!DebugHelper.instance) {
      DebugHelper.instance = new DebugHelper();
    }
    return DebugHelper.instance;
  }

  get isEnabled(): boolean {
    return this.isDebugEnabled;
  }

  enable() {
    this.isDebugEnabled = true;
    this.createDebugElements();
    this.setupEventListeners();
    this.debugModeListeners.forEach(listener => listener(true));
  }

  disable() {
    this.isDebugEnabled = false;
    this.removeDebugElements();
    this.removeEventListeners();
    this.debugModeListeners.forEach(listener => listener(false));
  }

  private createDebugElements() {
    if (!this.isDebugEnabled) return;

    // 创建调试覆盖层，使用固定定位避免影响正常布局
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'test-overlay';
    Object.assign(this.debugOverlay.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      zIndex: '99999',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      pointerEvents: 'none'
    });

    this.debugOverlay.innerHTML = `
      <div>调试模式已启用</div>
      <div>按 F12 切换调试模式</div>
    `;

    // 创建信息面板
    this.debugInfoElement = document.createElement('div');
    this.debugInfoElement.className = 'test-info';
    Object.assign(this.debugInfoElement.style, {
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      zIndex: '99999',
      background: 'rgba(0, 0, 0, 0.8)',
      color: 'white',
      padding: '10px',
      borderRadius: '5px',
      fontSize: '12px',
      pointerEvents: 'none'
    });

    document.body.appendChild(this.debugOverlay);
    document.body.appendChild(this.debugInfoElement);
  }

  private removeDebugElements() {
    this.debugOverlay?.remove();
    this.debugInfoElement?.remove();
    this.debugOverlay = null;
    this.debugInfoElement = null;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this.isDebugEnabled) return;
    const mouseSpan = document.getElementById('mouse');
    if (mouseSpan) {
      mouseSpan.textContent = `${e.clientX}, ${e.clientY}`;
    }
  };

  private handleResize = () => {
    if (!this.isDebugEnabled) return;
    const sizeSpan = document.getElementById('size');
    if (sizeSpan) {
      sizeSpan.textContent = `${window.innerWidth} x ${window.innerHeight}`;
    }
  };

  private setupEventListeners() {
    document.addEventListener('mousemove', this.handleMouseMove);
    window.addEventListener('resize', this.handleResize);
    this.handleResize();
  }

  private removeEventListeners() {
    document.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('resize', this.handleResize);
  }

  logEvent(event: string) {
    if (!this.isDebugEnabled) return;
    
    const timestamp = new Date().toISOString().split('T')[1];
    const formattedEvent = `${timestamp}: ${event}`;
    this.events.push(formattedEvent);
    if (this.events.length > 5) this.events.shift();
    
    const eventsSpan = document.getElementById('events');
    if (eventsSpan) {
      eventsSpan.innerHTML = this.events.join('<br>');
    }

    this.persistLog('info', event);
  }

  updateDebugInfo(info: DebugInfo) {
    if (!this.isDebugEnabled || !this.debugInfoElement) return;

    // 更新调试数据
    this.debugData = { ...this.debugData, ...info };

    const debugContent = `
      Window Size: <span id="size">${window.innerWidth} x ${window.innerHeight}</span><br>
      Mouse Position: <span id="mouse"></span><br>
      <hr>
      Image Size: ${info.imageSize || 0}<br>
      Bounds: ${JSON.stringify(info.bounds || {})}<br>
      Scale Factor: ${info.scaleFactor || 1}<br>
      Events: <span id="events">${this.events.join('<br>')}</span>
      ${this.options.enablePerformanceMonitoring ? `
      <hr>
      Performance Metrics:<br>
      ${this.formatPerformanceMetrics()}
      ` : ''}
    `;

    this.debugInfoElement.innerHTML = debugContent;
  }

  private formatPerformanceMetrics(): string {
    return this.performanceMetrics
      .slice(-5)
      .map(metric => `${metric.operation}: ${metric.duration.toFixed(2)}ms`)
      .join('<br>');
  }
}

// 导出单例实例
export const debugHelper = DebugHelper.getInstance();

// 添加到 window 对象以便在控制台访问
declare global {
  interface Window {
    debugHelper: DebugHelper;
  }
}
window.debugHelper = debugHelper; 