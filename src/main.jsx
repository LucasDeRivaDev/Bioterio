import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AppDemo from './AppDemo.jsx'

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDemoMode ? <AppDemo /> : <App />}
  </StrictMode>,
)
