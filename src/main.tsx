import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'
import './styles/app.css'

const container = document.getElementById('app')

if (!container) {
  throw new Error('Unable to find the #app root element')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
)
