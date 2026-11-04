import { describe, expect, it } from 'vitest'
import { applyCabinetTune, classifyCabinetMesh } from './cabinetTune'

describe('classifyCabinetMesh', () => {
  it('puts teapots, the casket and bottles into metal_inside', () => {
    expect(classifyCabinetMesh('Jewelry Case.001').env).toBe('metal_inside')
    expect(classifyCabinetMesh('Jewelry_Case001').env).toBe('metal_inside')
    expect(classifyCabinetMesh('vase_brass').env).toBe('metal_inside')
    expect(classifyCabinetMesh('wine_glass_01').env).toBe('glass_prop')
    expect(classifyCabinetMesh('tray_walnut').env).toBeNull()
    expect(classifyCabinetMesh('book_01').env).toBeNull()
    expect(classifyCabinetMesh('botella-glengoyne-aro').env).toBe('metal_inside')
    expect(classifyCabinetMesh('Cup').env).toBe('glass_prop')
    expect(classifyCabinetMesh('Johnnie Walker BR Whiskey').env).toBe('glass_prop')
    expect(classifyCabinetMesh('tapa-gleygoyne').env).toBe('glass_prop')
    expect(classifyCabinetMesh('door_left_handle').env).toBeNull()
  })

  it('splits corpus copper from corpus wood', () => {
    expect(classifyCabinetMesh('corpus_main_1', ['coffee_pot'])).toEqual({
      env: 'copper_corpus',
      light: null,
    })
    expect(classifyCabinetMesh('corpus_main', ['Dark Walnut fine wood PBR texture'])).toEqual({
      env: 'wood_lit',
      light: 'corpus',
    })
  })

  it('groups legs, medallion, wood, leather and the back wall', () => {
    expect(classifyCabinetMesh('node_0').env).toBe('base')
    expect(classifyCabinetMesh('node_0001').env).toBe('base')
    expect(classifyCabinetMesh('medallion_plate').env).toBe('medallion')
    expect(classifyCabinetMesh('door_left_wood')).toEqual({ env: null, light: null })
    expect(classifyCabinetMesh('drawer_1')).toEqual({ env: null, light: null })
    expect(classifyCabinetMesh('drawer_leather_rim_top')).toEqual({ env: 'leather_lit', light: null })
    expect(classifyCabinetMesh('back_wall_1').light).toBe('back_wall')
    expect(classifyCabinetMesh('door_left_detail_a').light).toBe('details')
    expect(classifyCabinetMesh('drawer_1_plaque_mebel_screw_L').env).toBeNull()
  })

  it('clones a shared material and writes envMapIntensity per group', () => {
    const shared = {
      uuid: 'shared',
      name: 'Shared',
      isMeshStandardMaterial: true,
      envMapIntensity: 1,
      roughness: 0.4,
      lightMap: { name: 'lm' },
      lightMapIntensity: 1,
      userData: {},
      needsUpdate: false,
      clone() {
        return {
          ...this,
          uuid: 'cloned',
          userData: { ...this.userData },
          clone: this.clone,
        }
      },
    }
    const woodMat = { ...shared, name: 'Dark Walnut fine wood PBR texture' }
    const wood = { name: 'corpus_main_2', isMesh: true, material: woodMat }
    const metal = { name: 'Jewelry Case.001', isMesh: true, material: shared }
    const root = {
      traverse(fn) {
        fn(wood)
        fn(metal)
      },
    }

    applyCabinetTune(root, { environmentIntensity: 1 }, {
      environmentIntensity: 1,
      envMapIntensity: {
        metal_inside: 0.2,
        copper_corpus: 1,
        base: 1,
        wood_lit: 0.08,
        leather_lit: 0.55,
      },
      lightMapIntensity: { wood: 2, leather: 2, back_wall: 2, corpus: 2, details: 2 },
      roughnessAdd: { copper_corpus: 0, base: 0 },
      lightmaps: true,
    })

    expect(wood.material).not.toBe(metal.material)
    expect(wood.material.envMapIntensity).toBeCloseTo(0.08)
    expect(metal.material.envMapIntensity).toBeCloseTo(0.2)
    expect(wood.material.lightMapIntensity).toBe(2)
  })
})
