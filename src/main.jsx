import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useGLTF } from '@react-three/drei'
import './index.css'
import App from './App.jsx'
import { russoBoot } from './utils/russoLog'
import { SHKAF_MODEL_PATH } from './constants/shkafNodes'

russoBoot()

useGLTF.preload(SHKAF_MODEL_PATH, true, true)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
