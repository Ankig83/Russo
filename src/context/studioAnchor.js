import { createContext, useContext } from 'react'
import * as THREE from 'three'

const defaultAnchor = {
  position: new THREE.Vector3(0, 0, 0),
  floorY: 0,
  ready: false,
}

export const StudioAnchorContext = createContext(defaultAnchor)

export function useStudioAnchor() {
  return useContext(StudioAnchorContext)
}
