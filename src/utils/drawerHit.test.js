import { describe, expect, it } from 'vitest'
import {
  findDrawerFromIntersections,
  findDrawerSectionFromHit,
} from './drawerHit'

const cases = [
  ['drawer_tl', 'tabl_1', 'prostranstva', '/private-spaces'],
  ['drawer_tr', 'tabl_2', 'avtorskie_m', '/author-collections'],
  ['drawer_bl', 'tabl_3', 'project_M', '/commercial-projects'],
  ['drawer_br', 'tabl_4', 'about', '/about'],
]

function node(name, parent = null, materialName = null) {
  return {
    name,
    parent,
    isMesh: materialName != null,
    material: materialName ? { name: materialName } : null,
  }
}

describe('drawer navigation contract', () => {
  it.each(cases)(
    'maps %s / %s / %s to %s',
    (drawerName, tablName, materialName, route) => {
      const drawer = node(drawerName)
      const tabl = node(tablName, drawer, materialName)

      expect(findDrawerSectionFromHit(tabl)).toMatchObject({
        id: drawerName,
        route,
      })
    },
  )

  it('finds a drawer behind a non-drawer first ray hit', () => {
    const door = node('door_left')
    const drawer = node('drawer_tr')
    const tabl = node('tabl_2', drawer, 'avtorskie_m')
    const model = {
      getObjectByName: (name) => (name === drawer.name ? drawer : null),
    }

    const result = findDrawerFromIntersections(
      [
        { object: door, distance: 1 },
        { object: tabl, distance: 2 },
      ],
      model,
    )

    expect(result).toMatchObject({
      section: { id: 'drawer_tr', route: '/author-collections' },
      node: drawer,
      object: tabl,
      firstHitName: 'door_left',
    })
  })
})
