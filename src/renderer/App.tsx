import React from 'react'
import { HashRouter as Router, Routes, Route } from 'react-router-dom'
import { PanelManagerProvider } from './panels/PanelManager'
import { CaptureProvider } from './providers/CaptureProvider'
import Capture from './pages/Capture'

export const App: React.FC = () => {
  return (
    <Router>
      <CaptureProvider>
        <PanelManagerProvider>
          <Routes>
            <Route path="/" element={<Capture />} />
          </Routes>
        </PanelManagerProvider>
      </CaptureProvider>
    </Router>
  )
} 