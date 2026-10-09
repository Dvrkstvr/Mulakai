import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './commandActivity.css'
import App from './App'
import { applyCellBackdrop } from './cellBackdrop'

applyCellBackdrop()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
