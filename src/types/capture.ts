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

// 工具类型枚举
export enum ToolType {
  None = 'none',
  RectSelect = 'rect_select',
  EllipseSelect = 'ellipse_select',
  Pencil = 'pencil',
  Mosaic = 'mosaic',
  Text = 'text',
  Rectangle = 'rectangle',
  Ellipse = 'ellipse'
}

// 绘制元素基础接口
export interface DrawElement {
  type: ToolType;
  id: string;
  points: Point[];
  opacity?: number;
}

// 铅笔绘制元素
export interface PencilElement extends DrawElement {
  type: ToolType.Pencil;
  color?: string;
  lineWidth?: number;
  penStyle?: PenStyle;
  pressureSensitivity?: number;
  taper?: boolean;
  pressurePoints?: number[];
}

// 笔触风格枚举
export enum PenStyle {
  Normal = 'normal',     // 普通笔触
  Brush = 'brush',       // 毛笔效果
  Pencil = 'pencil',     // 铅笔效果
  Marker = 'marker',     // 马克笔效果
  Fountain = 'fountain'  // 钢笔效果
}

// 马赛克元素
export interface MosaicElement extends DrawElement {
  type: ToolType.Mosaic;
  blockSize?: number;
}

// 文字元素
export interface TextElement extends DrawElement {
  type: ToolType.Text;
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

// 矩形元素
export interface RectangleElement extends DrawElement {
  type: ToolType.Rectangle;
  strokeStyle?: string;
  strokeWidth?: number;
  fillStyle?: string;
  cornerRadius?: number;
  dashArray?: number[];
  sequence?: number;
}

// 椭圆元素
export interface EllipseElement extends DrawElement {
  type: ToolType.Ellipse;
  strokeStyle?: string;
  strokeWidth?: number;
  fillStyle?: string;
  dashArray?: number[];
  sequence?: number;
}

// 绘制元素联合类型
export type DrawElementUnion = PencilElement | MosaicElement | TextElement | RectangleElement | EllipseElement;

// Re-export common types for backward compatibility
export type { Point, Rect, Bounds, DisplayInfo } 