import { Bounds } from '../common/2d'

export interface Position {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export interface PanelConfig {
  type: string
  bounds?: Bounds
  position: Position
  size?: Size
  contentProps?: Record<string, any>
}

export interface PanelState {
  id: string
  type: string
  bounds?: Bounds
  position: Position
  size: Size
  isMinimized: boolean
  isActive: boolean
  contentProps: Record<string, any>
}

export interface PanelMessage {
  type: string
  payload: any
}

export interface AgentPanelManager {
  selectedBounds: Bounds | null
  activePanels: Map<string, PanelState>
  
  createPanel(config: PanelConfig): string
  removePanel(panelId: string): void
  updatePanel(panelId: string, updates: Partial<PanelState>): void
  
  syncBounds(bounds: Bounds): void
  getPanelState(panelId: string): PanelState | null
  
  onPanelMessage(panelId: string, message: PanelMessage): void
  onBoundsChange(bounds: Bounds): void
} 