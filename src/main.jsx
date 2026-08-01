import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { useGLTF } from '@react-three/drei'
import { useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import './index.css'
import App from './App.jsx'
import { russoBoot } from './utils/russoLog'
import {
  SHKAF_MODEL_PATH,
  SHKAF_LEGS_MODEL_PATH,
  SHKAF_BACKWALL_MODEL_PATH,
  SHKAF_CLOSED_DOORS_PATH,
  SHKAF_LEATHER_RIM_PATH,
  USE_CLOSED_DOORS_FACADE,
  USE_ATTACH_LEATHER_RIM,
  USE_BAKED_LEGS,
} from './constants/shkafNodes'
import {
  LEATHER_BASECOLOR_URL,
  LEATHER_NORMAL_URL,
  LEATHER_ROUGHNESS_URL,
} from './utils/leatherTextures'
import { ROOM_CONCRETE_URLS } from './utils/roomConcreteTextures'
import { USE_HERO_LOOK } from './constants/studioScene'

russoBoot()
useGLTF.preload(SHKAF_MODEL_PATH)
useGLTF.preload(SHKAF_BACKWALL_MODEL_PATH)
if (!USE_BAKED_LEGS) {
  useGLTF.preload(SHKAF_LEGS_MODEL_PATH)
}
if (USE_CLOSED_DOORS_FACADE) {
  useGLTF.preload(SHKAF_CLOSED_DOORS_PATH)
}
if (USE_ATTACH_LEATHER_RIM) {
  useGLTF.preload(SHKAF_LEATHER_RIM_PATH)
}
useLoader.preload(THREE.TextureLoader, [
  LEATHER_BASECOLOR_URL,
  LEATHER_ROUGHNESS_URL,
  LEATHER_NORMAL_URL,
])
if (!USE_HERO_LOOK) {
  useLoader.preload(THREE.TextureLoader, ROOM_CONCRETE_URLS)
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
