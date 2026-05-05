import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import AppPro from './AppPro'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppPro />
  </StrictMode>
)
