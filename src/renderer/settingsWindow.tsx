import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { SettingsPage } from './pages/Settings'
import './index.css'

const root = document.getElementById('root')
if (root) {
  ReactDOM.createRoot(root).render(
    <React.StrictMode>
      <ErrorBoundary>
        <HashRouter>
          <SettingsPage />
        </HashRouter>
      </ErrorBoundary>
    </React.StrictMode>
  )
} 