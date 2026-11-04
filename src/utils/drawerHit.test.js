import { describe, expect, it } from 'vitest'
import {
  findDrawerFromIntersections,
  findDrawerSectionFromHit,
} from './drawerHit'

const cases = [
  ['drawer_1', '/portfolio'],
  ['drawer_2', '/about'],
]

function node(name, parent = null) {
  return { name, parent, isMesh: false, material: null }
}

describe('drawer navigation contract', () => {
  it.each(cases)('maps %s to %s', (drawerName, route) => {
    const drawer = node(drawerName)
    const plaque = node(`${drawerName}_plaque`, drawer)

    expect(findDrawerSectionFromHit(plaque)).toMatchObject({
      id: drawerName,
      route,
    })
  })

  it('finds a drawer behind a non-drawer first ray hit', () => {
    const door = node('door_left')
    const drawer = node('drawer_1')
    const plaque = node('drawer_1_plaque_mebel_screw_L', drawer)
    const model = {
      getObjectByName: (name) => (name === drawer.name ? drawer : null),
    }

    const result = findDrawerFromIntersections(
      [
        { object: door, distance: 1 },
        { object: plaque, distance: 2 },
      ],
      model,
    )

    expect(result).toMatchObject({
      section: { id: 'drawer_1', route: '/portfolio' },
      node: drawer,
      object: plaque,
      firstHitName: 'door_left',
    })
  })
})
