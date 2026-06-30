import { useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  STUDIO_MODEL_PATH,
  STUDIO_ANCHOR_NODE,
  STUDIO_HIDDEN_NODES,
} from '../../constants/studioScene'
import { StudioAnchorContext } from '../../context/studioAnchor'

function isStudioFloorMesh(obj) {
  const n = obj.name.toLowerCase()
  return n === 'studio_floor' || n.includes('floor')
}

function shouldHideStudioMesh(obj) {
  if (STUDIO_HIDDEN_NODES.has(obj.name)) return true
  return obj.name.toLowerCase().includes('backdrop')
}

function prepStudioScene(scene) {
  let floorY = 0
  const floorBox = new THREE.Box3()

  scene.updateMatrixWorld(true)

  const anchor = scene.getObjectByName(STUDIO_ANCHOR_NODE)
  const anchorPos = new THREE.Vector3()
  if (anchor) {
    anchor.getWorldPosition(anchorPos)
    anchor.visible = false
  }

  scene.traverse((obj) => {
    if (obj.isLight) {
      // Свет из GLB — другие единицы; на сайте свет в Scene.jsx
      obj.visible = false
      return
    }
    if (!obj.isMesh) return
    if (shouldHideStudioMesh(obj)) {
      obj.visible = false
      return
    }
    obj.receiveShadow = true
    obj.castShadow = false
    obj.raycast = () => null
    if (isStudioFloorMesh(obj)) {
      floorBox.expandByObject(obj)
    }
  })

  if (!floorBox.isEmpty()) {
    floorY = floorBox.min.y
  }

  return { position: anchorPos, floorY, ready: true }
}

export default function StudioScene({ children }) {
  const { scene } = useGLTF(STUDIO_MODEL_PATH)
  const studio = useMemo(() => scene.clone(true), [scene])
  const anchor = useMemo(() => prepStudioScene(studio), [studio])

  return (
    <StudioAnchorContext.Provider value={anchor}>
      <primitive object={studio} />
      {children}
    </StudioAnchorContext.Provider>
  )
}

useGLTF.preload(STUDIO_MODEL_PATH)
