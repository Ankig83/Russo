import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { russoBoot } from './utils/russoLog'
import { bootCabinetAssets } from './utils/bootPreload'
import { installCabinetLoadProbes } from './utils/loadTiming'

russoBoot()

installCabinetLoadProbes()
bootCabinetAssets()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
