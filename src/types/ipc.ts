// IPC 通道名称常量
export const CHANNELS = {
  SCREENSHOT_CAPTURE: 'SCREENSHOT_CAPTURE',
  START_CAPTURE: 'START_CAPTURE',
  SCREEN_CAPTURE_DATA: 'SCREEN_CAPTURE_DATA',
  COMPLETE_CAPTURE: 'COMPLETE_CAPTURE',
  CANCEL_CAPTURE: 'CANCEL_CAPTURE',
  COPY_TO_CLIPBOARD: 'COPY_TO_CLIPBOARD',
  HIDE_WINDOW: 'HIDE_WINDOW',
  PLUGIN_LOAD: 'PLUGIN_LOAD',
  LOG: 'LOG',
  OCR_REQUEST: 'OCR_REQUEST',  // 新增 OCR 请求通道
} as const

// 通道名称类型
export type ChannelName = keyof typeof CHANNELS

// 确保类型安全
export function isValidChannel(channel: string): channel is ChannelName {
  return Object.values(CHANNELS).includes(channel as ChannelName)
} 