import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { seatDrawerPlaques } from './seatDrawerPlaques'

function mesh(name, x, y, z) {
  const obj = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.02))
  obj.name = name
  obj.position.set(x, y, z)
  return obj
}

describe('seatDrawerPlaques', () => {
  it('parents the front plates onto the drawers and leaves the leg mesh', () => {
    const root = new THREE.Group()
    const drawer1 = mesh('drawer_1', 0, 1.05, 0.25)
    const drawer2 = mesh('drawer_2', 0, 0.7, 0.25)
    const mebel = mesh('node_0001', 0, 1.05, 0.27)
    const about = mesh('node_0.002', 0, 0.7, 0.27)
    const leg = mesh('node_0', 0, 0.05, -0.05)
    root.add(drawer1, drawer2, mebel, about, leg)

    expect(seatDrawerPlaques(root)).toBe(2)
    expect(mebel.parent).toBe(drawer1)
    expect(about.parent).toBe(drawer2)
    expect(leg.parent).toBe(root)

    const before = new THREE.Vector3()
    about.getWorldPosition(before)
    drawer2.position.z += 0.12
    root.updateWorldMatrix(true, true)
    const after = new THREE.Vector3()
    about.getWorldPosition(after)
    expect(after.z - before.z).toBeCloseTo(0.12, 5)
    expect(after.y).toBeCloseTo(before.y, 5)
  })

  it('does not steal a node_0002 that sits on the floor', () => {
    const root = new THREE.Group()
    const drawer2 = mesh('drawer_2', 0, 0.7, 0.25)
    const legBand = mesh('node_0002', 0, 0.05, -0.05)
    root.add(drawer2, legBand)

    expect(seatDrawerPlaques(root)).toBe(0)
    expect(legBand.parent).toBe(root)
  })
})
