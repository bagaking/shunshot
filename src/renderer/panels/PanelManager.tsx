import React, { createContext, useContext, useMemo, useState } from 'react'
import { Bounds } from '../../common/2d'
import { 
  AgentPanelManager, 
  PanelConfig, 
  PanelState, 
  PanelMessage,
} from '../../types/panel'
import { translog } from '../utils/translog'
import { ChatPanel } from './ChatPanel'

const defaultSize = { width: 800, height: 800 }

// Create context
const PanelManagerContext = createContext<AgentPanelManager | null>(null)

// Custom hook for using panel manager
export const usePanelManager = () => {
  const context = useContext(PanelManagerContext)
  if (!context) {
    throw new Error('usePanelManager must be used within a PanelManagerProvider')
  }
  return context
}

let nextId = 1
const generateId = () => `panel_${nextId++}`

interface PanelManagerProviderProps {
  children: React.ReactNode
}

export const PanelManagerProvider: React.FC<PanelManagerProviderProps> = ({ children }) => {
  const [selectedBounds, setSelectedBounds] = useState<Bounds | null>(null)
  const [panels, setPanels] = useState<Map<string, PanelState>>(new Map())

  const manager = useMemo<AgentPanelManager>(() => ({
    selectedBounds,
    activePanels: panels,

    createPanel: (config: PanelConfig) => {
      const id = generateId()
      translog.debug('Creating new panel', { id, config })
      
      const newPanel: PanelState = {
        id,
        type: config.type,
        bounds: config.bounds,
        position: config.position,
        size: config.size || defaultSize,
        isMinimized: false,
        isActive: true,
        contentProps: config.contentProps || {}
      }

      setPanels(prev => {
        const next = new Map(prev)
        next.set(id, newPanel)
        translog.debug('Panel state updated', { 
          panelCount: next.size,
          panels: Array.from(next.entries()).map(([id, panel]) => ({
            id,
            type: panel.type,
            isActive: panel.isActive
          }))
        })
        return next
      })

      return id
    },

    removePanel: (panelId: string) => {
      translog.debug('Removing panel', { panelId })
      setPanels(prev => {
        const panel = prev.get(panelId)
        translog.debug('Panel being removed', {
          panelId,
          type: panel?.type,
          isActive: panel?.isActive,
          messageCount: panel?.contentProps.messages?.length
        })
        const next = new Map(prev)
        next.delete(panelId)
        return next
      })
    },

    updatePanel: (panelId: string, updates: Partial<PanelState>) => {
      translog.debug('Updating panel', { 
        panelId, 
        updates: { 
          ...updates, 
          contentProps: updates.contentProps ? {
            loading: updates.contentProps.loading,
            hasOnSend: !!updates.contentProps.onSend,
            messageCount: updates.contentProps.messages?.length
          } : undefined
        }
      })

      setPanels(prev => {
        const next = new Map(prev)
        const panel = next.get(panelId)
        
        if (!panel) {
          translog.warn('Panel not found for update', { 
            panelId,
            availablePanels: Array.from(prev.keys())
          })
          return prev
        }

        try {
          // Merge content props carefully
          const newContentProps = updates.contentProps 
            ? { ...panel.contentProps, ...updates.contentProps }
            : panel.contentProps

          translog.debug('Panel content props update', {
            panelId,
            before: {
              messages: panel.contentProps.messages?.length,
              loading: panel.contentProps.loading,
              hasOnSend: !!panel.contentProps.onSend,
              title: panel.contentProps.title
            },
            after: {
              messages: newContentProps.messages?.length,
              loading: newContentProps.loading,
              hasOnSend: !!newContentProps.onSend,
              title: newContentProps.title
            }
          })

          // Validate required properties for chat panels
          if (panel.type === 'chat') {
            if (!newContentProps.onSend) {
              translog.error('Chat panel missing required onSend handler', { panelId })
              return prev
            }
            if (!Array.isArray(newContentProps.messages)) {
              translog.error('Chat panel missing required messages array', { panelId })
              return prev
            }
          }

          const updatedPanel = {
            ...panel,
            ...updates,
            contentProps: newContentProps
          }

          // 确保更新 Map
          next.set(panelId, updatedPanel)
      
          translog.debug('Panel updated successfully', { 
            panelId,
            type: updatedPanel.type,
            isActive: updatedPanel.isActive,
            isMinimized: updatedPanel.isMinimized,
            messageCount: updatedPanel.contentProps.messages?.length
          })

          return next
        } catch (error) {
          translog.error('Failed to update panel', { 
            panelId,
            error: error instanceof Error ? error.message : String(error),
            stackTrace: error instanceof Error ? error.stack : undefined
          })
          return prev
        }
      })
    },

    syncBounds: (bounds: Bounds) => {
      setSelectedBounds(bounds)
    },

    getPanelState: (panelId: string) => {
      const panel = panels.get(panelId)
      if (!panel) {
        translog.warn('Panel state not found', { panelId })
      }
      return panel || null
    },

    onPanelMessage: (panelId: string, message: PanelMessage) => {
      translog.debug('Panel message received', { panelId, message })
    },

    onBoundsChange: (bounds: Bounds) => {
      setSelectedBounds(bounds)
    }
  }), [selectedBounds, panels])

  // Render active panels
  const renderPanels = () => {
    return Array.from(panels.values()).map(panel => {
      if (panel.type === 'chat') {
        try {
          const {
            messages = [],
            onSend,
            title = 'Chat',
            loading = false,
            agent = null,
            getAvailableAgents = () => window.shunshotCoreAPI.getAgents()
          } = panel.contentProps

          // 确保 position 有效
          const currentPosition = panel.position || { x: 0, y: 0 }

          translog.debug('Rendering chat panel', {
            panelId: panel.id,
            messageCount: messages.length,
            hasOnSend: !!onSend,
            loading,
            isMinimized: panel.isMinimized,
            position: currentPosition
          })

          return (
            <ChatPanel
              key={panel.id}
              id={panel.id}
              position={currentPosition}
              size={panel.size || defaultSize}
              title={title}
              messages={messages}
              onSend={onSend} 
              onMinimize={(id) => {
                translog.debug('Panel minimize toggle', { 
                  id, 
                  currentState: panel.isMinimized 
                })
                manager.updatePanel(id, { isMinimized: !panel.isMinimized })
              }}
              onClose={(id) => {
                translog.debug('Panel close requested', { id })
                manager.removePanel(id)
              }}
              isMinimized={panel.isMinimized}
              loading={loading}
              agent={agent}
              getAvailableAgents={getAvailableAgents}
            />
          )
        } catch (error) {
          translog.error('Failed to render chat panel', {
            panelId: panel.id,
            error: error instanceof Error ? error.message : String(error)
          })
          return null
        }
      }
      return null
    })
  }

  return (
    <PanelManagerContext.Provider value={manager}>
      {children}
      {renderPanels()}
    </PanelManagerContext.Provider>
  )
} 