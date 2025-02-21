import { Point, Rect, Bounds, DisplayInfo } from '../common/2d'

export interface CaptureData {
  imageBuffer: Buffer
  imageSize: {
    width: number
    height: number
  }
  displayInfo: DisplayInfo
}

export enum CaptureMode {
  Screenshot = 'screenshot',
  ScreenRecording = 'screen_recording',
  RegionSelection = 'region_selection',
  Magnifier = 'magnifier',
  ColorPicker = 'color_picker'
}

// Re-export common types for backward compatibility
export type { Point, Rect, Bounds, DisplayInfo } 