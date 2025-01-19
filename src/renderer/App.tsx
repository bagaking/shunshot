import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom'

const queryClient = new QueryClient()

const MainContent: React.FC = () => {
  console.log('MainContent rendering, location:', useLocation())
  
  const handleScreenshot = async () => {
    console.log('Screenshot button clicked')
    try {
      await window.electronAPI.captureScreen()
    } catch (error) {
      console.error('Screenshot failed:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Shunshot</h1>
        <p className="text-gray-600">A secure, powerful and extensible screenshot tool</p>
        <p className="text-sm text-gray-500 mt-2">
          Press {window.electronAPI.platform === 'darwin' ? 'Command+Shift+X' : 'Ctrl+Shift+X'} to take a screenshot
        </p>
      </header>

      <main>
        <button
          onClick={handleScreenshot}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Take Screenshot
        </button>
      </main>
    </div>
  )
}

const App: React.FC = () => {
  console.log('App component rendering')
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainContent />} />
        </Routes>
      </HashRouter>
    </QueryClientProvider>
  )
}

export default App 