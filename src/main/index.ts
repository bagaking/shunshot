import { app, ipcMain, screen } from 'electron'
import { join } from 'path'
import { Logger } from './logger'
import { ShunshotCoreBridge } from '../types/shunshotBridge'
import { IShunshotCoreAPI } from '../types/shunshotapi'
import { handlers } from './handlers'
import { mgrWindows } from './mgrWindows'
import { mgrShortcut } from './mgrShortcut'
import { mgrTray } from './trayMenu'
import { mgrPreference } from './mgrPreference'
import { initTransLog } from './translog' 

// 使用更符合最佳实践的方式管理路径
// 开发环境和生产环境的路径结构不同
const isDevelopment = !app.isPackaged

// 应用路径配置
const paths = {
  // 主进程目录
  main: __dirname,
  // 应用根目录
  root: join(__dirname, '..'),
  // 预加载脚本目录
  preload: join(__dirname, '..', 'preload'),
  // 渲染进程资源目录 - 在生产环境中是 dist/src/renderer 目录，在开发环境中通过 URL 访问
  renderer:  join(__dirname, '..', 'src', 'renderer'),
  // 公共资源目录
  public: isDevelopment 
    ? join(__dirname, '..', '..', 'public') 
    : join(__dirname, '..', 'public')
}

// 为了兼容现有代码，保留环境变量
process.env.DIST_MAIN = paths.main
process.env.DIST = paths.root
process.env.DIST_PRELOAD = paths.preload
process.env.DIST_RENDERER = paths.renderer
process.env.VITE_PUBLIC = paths.public

Logger.log('Application paths: ' + JSON.stringify({
  main: paths.main,
  root: paths.root,
  preload: paths.preload,
  renderer: paths.renderer,
  public: paths.public,
  isDevelopment,
  VITE_DEV_SERVER_URL: process.env.VITE_DEV_SERVER_URL,
}))

// 禁用 Windows 7 的 GPU 加速
if (process.platform === 'win32') {
  app.disableHardwareAcceleration()
}

// 安装调试工具
if (!app.isPackaged) {
  app.whenReady().then(async () => {
    try {
      Logger.log('Installing dev tools...')
      const { default: installExtension, REACT_DEVELOPER_TOOLS } = await import('electron-devtools-installer')
      await installExtension(REACT_DEVELOPER_TOOLS)
      Logger.log('React DevTools installed successfully')
    } catch (err) {
      Logger.error('Failed to install extension', err instanceof Error ? err : new Error(String(err)))
    }
  })
}

// 添加全局错误处理
process.on('uncaughtException', (error) => {
  Logger.error('Uncaught exception in main process:', error)
  
  // 在打包后的应用中，将错误写入日志文件
  if (app.isPackaged) {
    const fs = require('fs')
    const path = require('path')
    const logPath = path.join(app.getPath('userData'), 'logs')
    
    // 确保日志目录存在
    if (!fs.existsSync(logPath)) {
      fs.mkdirSync(logPath, { recursive: true })
    }
    
    const logFile = path.join(logPath, `error-${new Date().toISOString().replace(/:/g, '-')}.log`)
    fs.writeFileSync(logFile, `${new Date().toISOString()} - Uncaught exception:\n${error.stack}\n\n`)
  }
})

process.on('unhandledRejection', (reason, promise) => {
  Logger.error('Unhandled rejection in main process:', reason instanceof Error ? reason : new Error(String(reason)))
  
  // 在打包后的应用中，将错误写入日志文件
  if (app.isPackaged) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(app.getPath('userData'), 'logs');
      
      // 确保日志目录存在
      if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
      }
      
      const logFile = path.join(logPath, `error-${new Date().toISOString().replace(/:/g, '-')}.log`);
      fs.writeFileSync(logFile, `${new Date().toISOString()} - Unhandled rejection:\n${
        reason instanceof Error ? reason.stack : String(reason)
      }\n\n`);
    } catch (error) {
      Logger.error('Failed to write error to log file:', error instanceof Error ? error : new Error(String(error)));
    }
  }
})

// 创建 Bridge 实例
const bridge = new ShunshotCoreBridge()

// 注册主进程处理器
bridge.registerMainHandlers(ipcMain, handlers)

// 添加调试函数，用于诊断路径问题
function debugPaths() {
  const fs = require('fs');
  const path = require('path');
  
  Logger.log('===== DEBUG PATHS =====');
  Logger.log('Current directory: ' + process.cwd());
  Logger.log('__dirname: ' + __dirname);
  Logger.log('App path: ' + app.getAppPath());
  Logger.log('User data path: ' + app.getPath('userData'));
  Logger.log('Executable path: ' + app.getPath('exe'));
  
  // 记录环境变量
  Logger.log('Environment variables:');
  Logger.log(`- DIST_MAIN: ${process.env.DIST_MAIN}`);
  Logger.log(`- DIST: ${process.env.DIST}`);
  Logger.log(`- DIST_PRELOAD: ${process.env.DIST_PRELOAD}`);
  Logger.log(`- DIST_RENDERER: ${process.env.DIST_RENDERER}`);
  Logger.log(`- VITE_PUBLIC: ${process.env.VITE_PUBLIC}`);
  Logger.log(`- VITE_DEV_SERVER_URL: ${process.env.VITE_DEV_SERVER_URL}`);
  Logger.log(`- isDevelopment: ${isDevelopment}`);
  
  // 检查更多可能的HTML文件路径
  const possibleHtmlPaths = [
    join(paths.renderer, 'mainWindow.html'),
    join(paths.root, 'mainWindow.html'),
    join(paths.root, 'src', 'renderer', 'mainWindow.html'),
    join(paths.root, 'renderer', 'mainWindow.html'),
    join(app.getAppPath(), 'dist', 'src', 'renderer', 'mainWindow.html'),
    join(app.getAppPath(), 'src', 'renderer', 'mainWindow.html')
  ];
  
  Logger.log('Checking HTML paths:');
  possibleHtmlPaths.forEach(p => {
    Logger.log(`- ${p}: ${fs.existsSync(p) ? 'EXISTS' : 'NOT FOUND'}`);
  });
  
  // 递归列出目录内容，但限制深度
  function listDir(dir, level = 0) {
    if (level > 3) return; // 限制递归深度
    if (!fs.existsSync(dir)) {
      Logger.log(`  ${'  '.repeat(level)}Directory does not exist: ${dir}`);
      return;
    }
    
    try {
      const indent = '  '.repeat(level);
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        try {
          const fullPath = path.join(dir, file);
          const stats = fs.statSync(fullPath);
          Logger.log(`${indent}- ${file} (${stats.isDirectory() ? 'dir' : 'file'})`);
          if (stats.isDirectory()) {
            listDir(fullPath, level + 1);
          }
        } catch (err) {
          Logger.log(`${indent}- Error reading ${file}: ${err.message}`);
        }
      });
    } catch (err) {
      Logger.log(`  Error listing directory ${dir}: ${err.message}`);
    }
  }
  
  // 列出关键目录结构
  Logger.log('Directory structure:');
  Logger.log('Root directory:');
  listDir(paths.root);
  
  if (paths.root !== app.getAppPath()) {
    Logger.log('App path directory:');
    listDir(app.getAppPath());
  }
  
  Logger.log('===== END DEBUG PATHS =====');
}

/**
 * 检查模块解析问题
 */
function debugModuleResolution() {
  Logger.log('===== DEBUG MODULE RESOLUTION =====');
  
  // 检查关键模块是否可以解析
  const modules = [
    'electron',
    'react',
    'react-dom',
    'path',
    'fs',
    'electron-store'
  ];
  
  modules.forEach(moduleName => {
    try {
      require.resolve(moduleName);
      Logger.log(`Module '${moduleName}' can be resolved`);
    } catch (err) {
      Logger.log(`Module '${moduleName}' CANNOT be resolved: ${err.message}`);
    }
  });
  
  // 检查Node.js模块解析配置
  Logger.log('Module resolution paths:');
  Logger.log(`- require.main.paths: ${require.main?.paths.join('\n  ')}`);
  
  // 检查package.json
  try {
    const fs = require('fs');
    const path = require('path');
    const packageJsonPath = path.join(app.getAppPath(), 'package.json');
    
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      Logger.log('Package.json:');
      Logger.log(`- Name: ${packageJson.name}`);
      Logger.log(`- Version: ${packageJson.version}`);
      Logger.log(`- Main: ${packageJson.main}`);
      Logger.log(`- Dependencies: ${Object.keys(packageJson.dependencies || {}).length}`);
      Logger.log(`- DevDependencies: ${Object.keys(packageJson.devDependencies || {}).length}`);
    } else {
      Logger.log(`Package.json not found at: ${packageJsonPath}`);
    }
  } catch (err) {
    Logger.log(`Error reading package.json: ${err.message}`);
  }
  
  Logger.log('===== END DEBUG MODULE RESOLUTION =====');
}

// 应用程序初始化
app.whenReady().then(async () => {
  debugPaths();
  logEnvironmentInfo();
  debugModuleResolution();
  Logger.log('App ready, initializing...')
  
  // 记录应用路径信息
  Logger.log('Application paths:')
  Logger.log(`- App path: ${app.getAppPath()}`)
  Logger.log(`- User data path: ${app.getPath('userData')}`)
  Logger.log(`- Executable path: ${app.getPath('exe')}`)
  
  // 记录系统信息
  Logger.log('System information:')
  Logger.log(`- Platform: ${process.platform}`)
  Logger.log(`- Architecture: ${process.arch}`)
  Logger.log(`- Node.js version: ${process.version}`)
  Logger.log(`- Electron version: ${process.versions.electron}`)
  Logger.log(`- Chrome version: ${process.versions.chrome}`)
  
  try {
    // 初始化日志系统
    initTransLog()
    
    // 创建主窗口
    await mgrWindows.createMainWindow()
    
    // 创建系统托盘
    try {
      const tray = mgrTray.createTray()
      if (!tray) {
        throw new Error('Failed to create tray')
      }
      Logger.log('Tray created successfully')
    } catch (error) {
      Logger.error('Failed to create tray', error as Error)
      // 托盘创建失败不阻止应用继续运行
    }
    
    // 注册快捷键
    mgrShortcut.registerShortcuts()
    
    // 监听配置变更
    mgrPreference.subscribe((key, value) => {
      if (key === 'system.captureShortcut') {
        mgrShortcut.unregisterAll()
        mgrShortcut.registerShortcuts()
      }
    })
    
    Logger.log('App initialization completed')
  } catch (error) {
    Logger.error('Failed to initialize app', error as Error)
    app.quit()
  }
})

// 清理所有资源
const cleanup = () => {
  Logger.log('Cleaning up resources...')
  
  // 注销所有快捷键
  mgrShortcut.unregisterAll()
  
  // 关闭所有窗口
  const windows = [
    mgrWindows.getMainWindow(),
    mgrWindows.getCaptureWindow(),
    mgrWindows.getSettingsWindow()
  ]
  
  windows.forEach(window => {
    if (window && !window.isDestroyed()) {
      window.close()
    }
  })
  
  // 销毁托盘
  mgrTray.destroy()
  
  Logger.log('Cleanup completed')
}

// 当所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  Logger.log('All windows closed')
  cleanup()
  app.quit()
})

app.on('before-quit', () => {
  Logger.log('Application is quitting')
  cleanup()
})

app.on('activate', async () => {
  Logger.log('App activated')
  if (!mgrWindows.getMainWindow()) {
    try {
      await mgrWindows.createMainWindow()
    } catch (error) {
      Logger.error('Failed to create main window on activate', error as Error)
    }
  }
})

// 处理渲染进程错误
ipcMain.on('renderer:error', (event, errorInfo: any) => {
  Logger.error(`Renderer Error: ${errorInfo.title}`, {
    message: errorInfo.message,
    stack: errorInfo.stack,
    timestamp: errorInfo.timestamp
  });
  
  // 如果应用已打包，将错误写入日志文件
  if (app.isPackaged) {
    try {
      const fs = require('fs');
      const path = require('path');
      const logPath = path.join(app.getPath('userData'), 'logs');
      
      // 确保日志目录存在
      if (!fs.existsSync(logPath)) {
        fs.mkdirSync(logPath, { recursive: true });
      }
      
      const logFile = path.join(logPath, `renderer-error-${new Date().toISOString().replace(/:/g, '-')}.log`);
      fs.writeFileSync(logFile, JSON.stringify({
        title: errorInfo.title,
        message: errorInfo.message,
        stack: errorInfo.stack,
        timestamp: errorInfo.timestamp,
        url: errorInfo.url
      }, null, 2));
      
      Logger.log(`Renderer error logged to: ${logFile}`);
    } catch (error) {
      Logger.error('Failed to write renderer error to log file:', error instanceof Error ? error : new Error(String(error)));
    }
  }
});

/**
 * 记录详细的环境信息，用于调试
 */
function logEnvironmentInfo() {
  Logger.log('===== ENVIRONMENT INFO =====');
  
  // 系统信息
  Logger.log('System:');
  Logger.log(`- Platform: ${process.platform}`);
  Logger.log(`- Architecture: ${process.arch}`);
  Logger.log(`- Version: ${process.getSystemVersion?.() || 'unknown'}`);
  Logger.log(`- Memory: ${Math.round(process.getSystemMemoryInfo?.()?.total / 1024)} MB`);
  
  // Node.js 信息
  Logger.log('Node.js:');
  Logger.log(`- Version: ${process.version}`);
  Logger.log(`- Versions: ${JSON.stringify(process.versions)}`);
  
  // Electron 信息
  Logger.log('Electron:');
  Logger.log(`- Version: ${process.versions.electron}`);
  Logger.log(`- Chrome: ${process.versions.chrome}`);
  Logger.log(`- V8: ${process.versions.v8}`);
  
  // 应用信息
  Logger.log('Application:');
  Logger.log(`- Name: ${app.getName()}`);
  Logger.log(`- Version: ${app.getVersion()}`);
  Logger.log(`- Packaged: ${app.isPackaged}`);
  
  // 路径信息
  Logger.log('Paths:');
  Logger.log(`- App Path: ${app.getAppPath()}`);
  Logger.log(`- User Data: ${app.getPath('userData')}`);
  Logger.log(`- Executable: ${app.getPath('exe')}`);
  Logger.log(`- Temp: ${app.getPath('temp')}`);
  Logger.log(`- Desktop: ${app.getPath('desktop')}`);
  Logger.log(`- Documents: ${app.getPath('documents')}`);
  Logger.log(`- Downloads: ${app.getPath('downloads')}`);
  Logger.log(`- Logs: ${app.getPath('logs')}`);
  
  // 显示器信息
  try {
    const displays = screen.getAllDisplays();
    Logger.log('Displays:');
    displays.forEach((display, index) => {
      Logger.log(`- Display ${index + 1}:`);
      Logger.log(`  - Bounds: ${JSON.stringify(display.bounds)}`);
      Logger.log(`  - Size: ${display.size.width}x${display.size.height}`);
      Logger.log(`  - Scale Factor: ${display.scaleFactor}`);
    });
  } catch (err) {
    Logger.log(`- Error getting display info: ${err.message}`);
  }
  
  Logger.log('===== END ENVIRONMENT INFO =====');
} 