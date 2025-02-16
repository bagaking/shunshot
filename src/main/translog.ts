import { ipcMain } from 'electron'
import { LogLevel } from '../types/translog'
import { Logger } from './logger'

// 初始化日志系统
export function initTransLog(): void {
  const levels: LogLevel[] = ['log', 'info', 'warn', 'error', 'debug']
  
  levels.forEach(level => {
    ipcMain.handle(`translog:${level}`, async (_event, ...args: any[]) => {
      const message = args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')
      // Logger[level](message)
      logWithDebounce(Logger, level, message);
    })
  })
} 


// Add a debounce mechanism for logging repeated messages
const logCache = new Map<string, {count: number, lastTime: number}>();

function logWithDebounce(logger: any, level: string, message: string, data?: any) {
  const key = `${level}:${message}`;
  const now = Date.now();
  const cached = logCache.get(key);
  
  if (cached) {
    cached.count++;
    // Only log if more than 1 second has passed
    if (now - cached.lastTime > 1000) {
      logger[level](`${message} (repeated ${cached.count} times)`, data);
      cached.lastTime = now;
      cached.count = 0;
    }
  } else {
    logCache.set(key, {count: 1, lastTime: now});
    logger[level](message, data);
  }
}
 