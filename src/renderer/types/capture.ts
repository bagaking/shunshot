export interface Point {
  x: number
  y: number
}

export interface Rect {
  startX: number
  startY: number
  width: number
  height: number
}

export interface DisplayInfo {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  scaleFactor: number
}

export interface CaptureData {
  imageData: string
  displayInfo: DisplayInfo
}

export interface CaptureBounds {
  x: number
  y: number
  width: number
  height: number
}

export enum CaptureMode {
  Screenshot = 'screenshot',
  ScreenRecording = 'screen_recording',
  RegionSelection = 'region_selection',
  Magnifier = 'magnifier',
  ColorPicker = 'color_picker'
} 