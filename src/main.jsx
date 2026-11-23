import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './styles/modo-claro-colores.css'
import App from './App.jsx'
import AppDemo from './AppDemo.jsx'

const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDemoMode ? <AppDemo /> : <App />}
  </StrictMode>,
)

// La intro (splash) de index.html se va cuando la primera pantalla ya se pintó.
requestAnimationFrame(() => {
  window.__appReady = true
  window.dispatchEvent(new Event('app:ready'))
})
