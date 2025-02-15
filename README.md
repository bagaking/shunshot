# sunshot

一个安全、强大、可扩展的跨平台截图工具。

## 是什么

跨桌面平台，全局监听快捷键，实现截屏功能
体验类似 QQ 截图，触发时当前桌面会被 freeze，可在其上框选区域，编辑等，有控制面板
支持 Plugin 功能

## ✨ 特性

- **跨平台支持**
  - Windows
  - macOS 
  - Linux

- **强大的编辑功能** 
  - 类 QQ 截图的交互体验, 使用 screen-saver 层级确保在菜单栏之上
  - 框选、标注、马赛克等编辑工具, 可自定义的工具面板
  - 支持截图后，进行编辑，编辑后，保存到本地

- **插件系统**
  - TypeScript 插件架构
  - 丰富的插件 API
  - 支持自定义编辑工具
  - 支持自定义输出处理

## 🛠 技术架构

### 核心框架
- **Electron** - 跨平台桌面应用框架
- **TypeScript** - 类型安全的开发体验

### 前端技术栈
- **React** - UI 框架
- **Tailwind CSS** - 原子化 CSS 框架
- **Zustand** - 状态管理
- **React Query** - 数据请求管理
- **styled-components** - CSS-in-JS 方案

### 构建工具
- **Vite** - 现代化构建工具
- **esbuild** - 快速的 TypeScript/ESNext 编译

### 底层实现
- **Native Modules** - 底层截屏实现
  - Windows: Windows API
  - macOS: CoreGraphics
  - Linux: X11/Wayland
- **Canvas/WebGL** - 图像编辑器

### 开发工具
- **ESLint** - 代码质量
- **Prettier** - 代码格式化
- **Husky** - Git Hooks
- **Jest** - 单元测试
- **Playwright** - E2E 测试
