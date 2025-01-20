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

class DebugHelper {
  private static instance: DebugHelper;
  private events: string[] = [];
  private _isEnabled: boolean = false;
  private debugOverlay: HTMLDivElement | null = null;
  private debugInfo: HTMLDivElement | null = null;

  private constructor() {
    // 私有构造函数
  }

  static getInstance(): DebugHelper {
    if (!DebugHelper.instance) {
      DebugHelper.instance = new DebugHelper();
    }
    return DebugHelper.instance;
  }

  get isEnabled(): boolean {
    return this._isEnabled;
  }

  enable() {
    this._isEnabled = true;
    this.createDebugElements();
    this.setupEventListeners();
  }

  disable() {
    this._isEnabled = false;
    this.removeDebugElements();
    this.removeEventListeners();
  }

  private createDebugElements() {
    if (!this._isEnabled) return;

    // 创建调试覆盖层
    this.debugOverlay = document.createElement('div');
    this.debugOverlay.className = 'test-overlay';
    this.debugOverlay.style.display = 'block';
    this.debugOverlay.innerHTML = `
      <h2>调试模式</h2>
      <p>调试信息面板已启用</p>
      <button onclick="window.debugHelper.disable()">关闭调试模式</button>
    `;

    // 创建信息面板
    this.debugInfo = document.createElement('div');
    this.debugInfo.className = 'test-info';
    this.debugInfo.style.display = 'block';
    this.debugInfo.innerHTML = `
      Window Size: <span id="size"></span><br>
      Mouse Position: <span id="mouse"></span><br>
      <hr>
      Events: <span id="events"></span>
    `;

    document.body.appendChild(this.debugOverlay);
    document.body.appendChild(this.debugInfo);
  }

  private removeDebugElements() {
    this.debugOverlay?.remove();
    this.debugInfo?.remove();
    this.debugOverlay = null;
    this.debugInfo = null;
  }

  private handleMouseMove = (e: MouseEvent) => {
    if (!this._isEnabled) return;
    const mouseSpan = document.getElementById('mouse');
    if (mouseSpan) {
      mouseSpan.textContent = `${e.clientX}, ${e.clientY}`;
    }
  };

  private handleResize = () => {
    if (!this._isEnabled) return;
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
    console.info(event)

    if (!this._isEnabled) return;
    
    this.events.push(`${new Date().toISOString().split('T')[1]}: ${event}`);
    if (this.events.length > 5) this.events.shift();
    
    const eventsSpan = document.getElementById('events');
    if (eventsSpan) {
      eventsSpan.innerHTML = this.events.join('<br>');
    }
  }

  updateDebugInfo(info: DebugInfo) {
    if (!this._isEnabled || !this.debugInfo) return;

    const debugContent = `
      Window Size: <span id="size">${window.innerWidth} x ${window.innerHeight}</span><br>
      Mouse Position: <span id="mouse"></span><br>
      <hr>
      Image Size: ${info.imageSize || 0}<br>
      Bounds: ${JSON.stringify(info.bounds || {})}<br>
      Scale Factor: ${info.scaleFactor || 1}<br>
      Events: <span id="events">${this.events.join('<br>')}</span>
    `;

    this.debugInfo.innerHTML = debugContent;
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