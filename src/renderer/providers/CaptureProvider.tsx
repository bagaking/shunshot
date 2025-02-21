import React, { createContext, useContext, useState, useEffect } from 'react'
import { CaptureData, DisplayInfo } from '../../types/capture'
import { translog } from '../utils/translog'
import { eventHelper } from '../utils/eventHelper'

interface CaptureContextType {
  captureData: CaptureData | null
  displayInfo: DisplayInfo | null
  error: Error | null
  setDisplayInfo: (info: DisplayInfo | null) => void
}

const CaptureContext = createContext<CaptureContextType | null>(null)

export const useCaptureContext = () => {
  const context = useContext(CaptureContext)
  if (!context) {
    throw new Error('useCaptureContext must be used within a CaptureProvider')
  }
  return context
}

interface CaptureProviderProps {
  children: React.ReactNode
}

export const CaptureProvider: React.FC<CaptureProviderProps> = ({ children }) => {
  const [captureData, setCaptureData] = useState<CaptureData | null>(null)
  const [displayInfo, setDisplayInfo] = useState<DisplayInfo | null>(null)
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    translog.debug('Setting up capture events', {
      timestamp: Date.now(),
      componentId: Math.random().toString(36).slice(2, 9)
    })

    const startTime = performance.now()

    const startCaptureCleanup = eventHelper.setupCaptureStartListener(() => {
      setCaptureData(null)
      setDisplayInfo(null)
      setError(null)
    })

    const captureDataCleanup = eventHelper.setupCaptureDataListener(
      (data) => {
        translog.info('[Perf] received in renderer')
        translog.debug('Received screen capture data', {
          hasData: !!data,
          hasImageBuffer: !!data.imageBuffer,
          imageBufferLength: data.imageBuffer.length,
          imageSize: data.imageSize,
          hasDisplayInfo: !!data.displayInfo,
          bounds: data.displayInfo.bounds,
          scaleFactor: data.displayInfo.scaleFactor,
          timestamp: Date.now()
        })

        setCaptureData(data)
        setDisplayInfo(data.displayInfo)
        translog.info('[Perf] ready for selection')
      },
      (error) => {
        translog.error('Error in capture data listener:', error)
        setError(error)
      }
    )

    const endTime = performance.now()
    translog.debug('Capture events setup complete', {
      duration: endTime - startTime,
      timestamp: Date.now()
    })

    return () => {
      startCaptureCleanup()
      captureDataCleanup()
    }
  }, [])

  const value = {
    captureData,
    displayInfo,
    error,
    setDisplayInfo
  }

  if (error) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50">
        <div className="bg-white p-4 rounded-lg shadow-lg max-w-md">
          <h2 className="text-red-600 text-lg font-semibold mb-2">错误</h2>
          <p className="text-gray-700 mb-4">{error.message}</p>
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            onClick={() => setError(null)}
          >
            关闭
          </button>
        </div>
      </div>
    )
  }

  return (
    <CaptureContext.Provider value={value}>
      {children}
    </CaptureContext.Provider>
  )
} 