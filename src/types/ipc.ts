// IPC 通道名称常量
export const CHANNELS = {
  SCREENSHOT_CAPTURE: 'SCREENSHOT_CAPTURE',
  START_CAPTURE: 'START_CAPTURE',
  SCREEN_CAPTURE_DATA: 'SCREEN_CAPTURE_DATA',
  COMPLETE_CAPTURE: 'COMPLETE_CAPTURE',
  CANCEL_CAPTURE: 'CANCEL_CAPTURE',
  COPY_TO_CLIPBOARD: 'COPY_TO_CLIPBOARD',
  PLUGIN_LOAD: 'PLUGIN_LOAD',
  LOG: 'LOG'
} as const

// 通道名称类型
export type ChannelName = keyof typeof CHANNELS

// 确保类型安全
export const isValidChannel = (channel: string): channel is ChannelName => {
  return channel in CHANNELS
} 