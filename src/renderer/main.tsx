import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

console.log('Renderer process starting...')

const root = document.getElementById('root')
if (!root) {
  console.error('Root element not found')
} else {
  console.log('Root element found, mounting React app')
  ReactDOM.createRoot(root as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
} 