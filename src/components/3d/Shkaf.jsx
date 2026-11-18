import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { armFirstRender, holdFirstRender, markFirstFrame, markStage } from '../../utils/loadTiming'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useShkafStore } from '../../store/shkafStore'
import { useAppStore } from '../../store/appStore'
import {
  SHKAF_MODEL_PATH,
  SHKAF_ROOT_NAME,
  findDoorPivotNode,
} from '../../constants/shkafNodes'
import {
  DOOR_LEFT_OPEN_ANGLE,
  DOOR_OPEN_DURATION,
  DOOR_RIGHT_OPEN_ANGLE,
  DOOR_ROTATION_AXIS,
  DRAWER_OPEN_DURATION,
  DRAWER_PULL_DISTANCE,
  NAVIGATE_DELAY_MS,
} from '../../constants/shkaf'
import { findDrawerFromIntersections } from '../../utils/drawerHit'
import { applyHingeLegMaterial, hideCabinetHinges } from '../../utils/bronzeTextures'
import { applyAgedCopperToCorpus, loadAgedCopperTextures } from '../../utils/agedCopperTextures'
import { applyAgedCopperToJewelry } from '../../utils/jewelryCoffeeMaterial'
import { applyBookCovers, loadBookCoverTextures } from '../../utils/bookCovers'
import { addDoorHandleShadows, applyDrawerLeatherRims, loadLeatherTextures } from '../../utils/leatherTextures'
import DoorMirrors from './DoorMirrors'
import { applyWalnutBake, finishCabinetWood, loadWalnutBake } from '../../utils/cabinetWoodFinish'
import { applyCabinetLightmaps, loadCabinetLightmaps } from '../../utils/cabinetLightmaps'
import { applyCabinetEnv } from '../../utils/cabinetEnv'
import { loadDoorShadowBake, prepareDoorShadowTargets, syncDoorShadow } from '../../utils/doorShadowBake'
import {
  collectInteriorShadowTargets,
  loadInteriorShadowBake,
  syncInteriorShadow,
} from '../../utils/interiorShadowBake'
import { applyCabinetTune, useCabinetTune } from '../../utils/cabinetTune'
import { seatDrawerPlaques } from '../../utils/seatDrawerPlaques'
import { CABINET_LOOK } from '../../constants/cabinetStudio'
import { cabinetFlags } from '../../utils/cabinetQuery'
import { russoLog } from '../../utils/russoLog'

const DRAG_THRESHOLD_DESKTOP_PX = 8
const DRAG_THRESHOLD_MOBILE_PX = 36
const TAP_MAX_MS = 450

const _pullDir = new THREE.Vector3()
const _parentMatrix = new THREE.Matrix4()

function getPullDirection(node) {
  node.updateWorldMatrix(true, false)
  _pullDir.set(0, 0, 1)
  if (node.parent) {
    _parentMatrix.copy(node.parent.matrixWorld).invert()
    _pullDir.transformDirection(_parentMatrix)
  }
  if (_pullDir.lengthSq() < 1e-8) _pullDir.set(0, 0, 1)
  else _pullDir.normalize()
  return _pullDir.clone()
}

const _hingeWorld = new THREE.Vector3()
const _parentInv = new THREE.Matrix4()
const _fitP = new THREE.Vector3()
const _fitWorld = new THREE.Vector3()

function forEachWorldVertex(obj, fn) {
  obj.updateWorldMatrix(true, true)
  obj.traverse((mesh) => {
    if (!mesh.isMesh) return
    const pos = mesh.geometry?.getAttribute('position')
    if (!pos) return
    for (let i = 0; i < pos.count; i += 1) {
      _fitP.fromBufferAttribute(pos, i)
      mesh.localToWorld(_fitP)
      fn(_fitP)
    }
  })
}

/** Пивот door_* сидит впереди петли корпуса — при открытии створка уезжает. */
function snapDoorPivotToHinge(door, hinge) {
  if (!door?.parent || !hinge) return
  door.parent.updateWorldMatrix(true, false)
  hinge.updateWorldMatrix(true, false)
  hinge.getWorldPosition(_hingeWorld)
  _parentInv.copy(door.parent.matrixWorld).invert()
  _hingeWorld.applyMatrix4(_parentInv)
  const dx = _hingeWorld.x - door.position.x
  const dz = _hingeWorld.z - door.position.z
  if (Math.hypot(dx, dz) < 1e-5) return
  door.position.x += dx
  door.position.z += dz
  door.children.forEach((child) => {
    child.position.x -= dx
    child.position.z -= dz
  })
}

const DOOR_FACE_PAIRS = [
  ['door_left_panel_authored', 'door_right_panel_authored'],
  ['door_left_panel_authored_1', 'door_right_panel_authored_1'],
]

/** Правая лицевая панель в GLB на ~1.4 см впереди левой. Сдвигаем только её, не берёзу и не декор. */
function alignRightDoorFace(model) {
  const box = new THREE.Box3()
  const world = new THREE.Vector3()
  for (const [leftName, rightName] of DOOR_FACE_PAIRS) {
    const left = model.getObjectByName(leftName)
    const right = model.getObjectByName(rightName)
    if (!left?.isMesh || !right?.isMesh || !right.parent) continue
    left.updateWorldMatrix(true, true)
    right.updateWorldMatrix(true, true)
    const leftMax = box.setFromObject(left).max.z
    right.updateWorldMatrix(true, true)
    const rightMax = box.setFromObject(right).max.z
    const dz = leftMax - rightMax
    if (Math.abs(dz) < 1e-4) continue
    right.getWorldPosition(world)
    world.z += dz
    right.parent.updateWorldMatrix(true, false)
    right.parent.worldToLocal(world)
    right.position.copy(world)
  }
}

const NO_CAST_NAME = /glass|mirror|stitch|decanter|liquid|whisky|bottle|foil|_inner$/i
const NO_CAST_MAT = /glass|mirror|decanter|liquid|whisky|transparent/i
const LABEL_MAT = /label/i
const PRINTED_BOTTLE_MAT = /^Material\.005$|^M_Glengoyne_Glass_PBR$/
const INTERIOR_GLASS_MAT =
  /^(M_Crystal_Glass|M_Glass_Tumbler|M_Wine_Glass|Glass Transparent Principled|glass-top|Glass|Decanter|Johnnie Walker Whiskey)$/i
const CLAY_BOTTLE_MAT = /^M_Bottle_Short_Glass$/i
const STRAY_HIDE = /^(botella-glengoyne-aro|dried_flowers(_root)?|vase_brass(_root)?)$/i
const RIGHT_TOP_BOTTLE = 'tapa-gleygoyne'
const RIGHT_TOP_BOTTLE_SCALE = 0.9
const RIGHT_TOP_SHELF = 'door_right_detail_a'

/** 0.9 scale, затем центр AABB бутылки в глубину ниши (вершины, не bound_box). */
function fitRightTopBottle(root) {
  const bottle = root.getObjectByName(RIGHT_TOP_BOTTLE)
  const shelf = root.getObjectByName(RIGHT_TOP_SHELF)
  if (!bottle?.parent || !shelf) return
  bottle.scale.multiplyScalar(RIGHT_TOP_BOTTLE_SCALE)

  let cavZ0 = Infinity
  let cavZ1 = -Infinity
  forEachWorldVertex(shelf, (v) => {
    if (v.z < cavZ0) cavZ0 = v.z
    if (v.z > cavZ1) cavZ1 = v.z
  })
  let bz0 = Infinity
  let bz1 = -Infinity
  let bx0 = Infinity
  let bx1 = -Infinity
  forEachWorldVertex(bottle, (v) => {
    if (v.z < bz0) bz0 = v.z
    if (v.z > bz1) bz1 = v.z
    if (v.x < bx0) bx0 = v.x
    if (v.x > bx1) bx1 = v.x
  })
  const dz = 0.5 * (cavZ0 + cavZ1) - 0.5 * (bz0 + bz1)
  bottle.getWorldPosition(_fitWorld)
  _fitWorld.z += dz
  bottle.parent.updateWorldMatrix(true, false)
  bottle.parent.worldToLocal(_fitWorld)
  bottle.position.copy(_fitWorld)
  russoLog('info', 'shkaf', 'right top bottle fit', {
    dz,
    cavityZ: [+cavZ0.toFixed(4), +cavZ1.toFixed(4)],
    bottleZ: [+bz0.toFixed(4), +bz1.toFixed(4)],
    bottleX: [+bx0.toFixed(4), +bx1.toFixed(4)],
  })
}

function isUnderDoorRight(obj) {
  let node = obj
  while (node) {
    if (node.name === 'door_right') return true
    node = node.parent
  }
  return false
}

function asPhysical(mat) {
  if (!mat || mat.isMeshPhysicalMaterial) return mat
  if (!mat.isMeshStandardMaterial) return mat
  const phys = new THREE.MeshPhysicalMaterial()
  THREE.MeshStandardMaterial.prototype.copy.call(phys, mat)
  phys.name = mat.name
  return phys
}

function hideCabinetStrays(root) {
  let hidden = 0
  root.traverse((obj) => {
    if (!STRAY_HIDE.test(obj.name || '')) return
    obj.visible = false
    hidden += 1
  })
  return hidden
}

/** Стекло и тонкая прошивка в карту теней не идут — иначе дырки и acne. */
function meshCastsShadow(mesh) {
  if (NO_CAST_NAME.test(mesh.name || '')) return false
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
  for (const mat of mats) {
    if (!mat) continue
    if (NO_CAST_MAT.test(mat.name || '')) return false
    if ((mat.transmission ?? 0) > 0.05) return false
  }
  return true
}

function prepareMaterials(root) {
  let walnut = 0
  let leather = 0
  let stitch = 0
  root.traverse((obj) => {
    if (!obj.isMesh) return
    const casts = meshCastsShadow(obj)
    obj.castShadow = casts
    obj.receiveShadow = casts || !/glass|mirror|_inner$|bottle|wine|crystal|tumbler|decanter|^cup$/i.test(obj.name || '')
    const kind = finishCabinetWood(obj)
    if (kind === 'walnut') walnut += 1
    else if (kind === 'leather') leather += 1
    else if (kind === 'stitch') stitch += 1
    if (kind) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    const next = mats.map((mat) => {
      if (!mat) return mat
      let use = mat
      const onRightDoor = isUnderDoorRight(obj)
      // GLB: transmission 0.85 на глиняном альбедо. В браузере это розовое стекло.
      if (CLAY_BOTTLE_MAT.test(mat.name || '') || /^bottle_short/i.test(obj.name || '')) {
        use = asPhysical(mat)
        use.transmission = 0
        use.transparent = false
        use.opacity = 1
        use.metalness = 0
        use.roughness = 0.42
        use.color.set('#6e4534')
        use.thickness = 0
        use.envMapIntensity = 0.3
        use.needsUpdate = true
        return use
      }
      if (INTERIOR_GLASS_MAT.test(mat.name || '') && !onRightDoor) {
        use = asPhysical(mat)
        const liquid = /whiskey/i.test(use.name || '')
        const shortBottle = /bottle_short/i.test(use.name || '')
        use.transmission = liquid || shortBottle ? Math.max(use.transmission ?? 1, 0.85) : 1
        use.thickness = liquid ? 0.08 : 0.02
        use.ior = liquid ? 1.33 : 1.5
        use.roughness = Math.min(use.roughness ?? 0.02, 0.03)
        use.metalness = 0
        use.transparent = true
        use.opacity = 1
        if (!liquid && !shortBottle) use.color.set('#ffffff')
        if ('attenuationColor' in use) use.attenuationColor.set('#ffffff')
        if ('attenuationDistance' in use) use.attenuationDistance = Infinity
        use.envMapIntensity = 1
      }
      if (onRightDoor && INTERIOR_GLASS_MAT.test(mat.name || '')) {
        // Blender: белый trans + EEVEE = чёрное стекло. Не осветлять в clear glass.
        use = asPhysical(mat)
        use.transmission = 0
        use.transparent = false
        use.opacity = 1
        use.metalness = 0
        use.roughness = 0.06
        use.color.set('#101010')
        use.emissive.set('#000000')
        use.emissiveIntensity = 0
        use.envMapIntensity = 0.5
      } else if ('envMapIntensity' in use) {
        use.envMapIntensity = Math.max(use.envMapIntensity ?? 0, 0.45)
      }
      // Этикетка в текстуре: внутри нет прямого света, а metalness 1 из GLB гасит
      // диффуз целиком — надпись не видна.
      if (LABEL_MAT.test(use.name || '') && use.map && 'emissive' in use) {
        use.emissive.set('#ffffff')
        use.emissiveMap = use.map
        use.emissiveIntensity = onRightDoor ? 0.08 : 0.32
        use.metalness = 0
        use.roughness = Math.max(use.roughness ?? 0.5, 0.55)
      } else if (!onRightDoor && PRINTED_BOTTLE_MAT.test(use.name || '') && use.map && 'emissive' in use) {
        use.emissive.set('#ffffff')
        use.emissiveMap = use.map
        use.emissiveIntensity = 0.28
        use.metalness = 0
        use.roughness = Math.max(use.roughness ?? 0.2, 0.35)
      }
      if (onRightDoor && PRINTED_BOTTLE_MAT.test(use.name || '')) {
        // Material.005 — чёрный парфюм с золотой этикеткой. Glengoyne bake светлый — гасим в чёрное стекло.
        use.emissive.set('#000000')
        use.emissiveIntensity = 0
        use.transparent = false
        use.transmission = 0
        if (/glengoyne/i.test(use.name || '')) {
          use.color.set('#141414')
          use.metalnessMap = null
          use.metalness = 0
          use.roughness = 0.08
        } else if (use.map) {
          use.color.set('#ffffff')
        }
      }
      if (!onRightDoor && 'transmission' in use && use.transmission > 0.01) {
        use = asPhysical(use)
        use.thickness = use.thickness > 0 ? use.thickness : 0.02
        use.ior = use.ior || 1.5
        use.metalness = 0
        use.transparent = true
        use.opacity = 1
        if ('attenuationDistance' in use && !(use.attenuationDistance > 0)) {
          use.attenuationDistance = Infinity
        }
      }
      use.needsUpdate = true
      return use
    })
    obj.material = Array.isArray(obj.material) ? next : next[0]
    const transmissive = (Array.isArray(obj.material) ? obj.material : [obj.material]).some(
      (m) => (m?.transmission ?? 0) > 0.01,
    )
    if (transmissive) {
      obj.castShadow = false
      obj.receiveShadow = false
    }
  })
  return { walnut, leather, stitch }
}

export default function Shkaf() {
  const navigate = useNavigate()
  const gltf = useGLTF(SHKAF_MODEL_PATH, true, true)
  const model = useMemo(() => {
    markStage('clone-start')
    const cloned = gltf.scene.clone(true)
    markStage('model-cloned')
    return cloned
  }, [gltf.scene])
  const { gl, camera, scene } = useThree()
  const environment = useThree((s) => s.scene.environment)
  const [agedCopper, setAgedCopper] = useState(null)

  const doorsOpen = useShkafStore((s) => s.doorsOpen)
  const setDoorsOpen = useShkafStore((s) => s.setDoorsOpen)
  const setAnimating = useShkafStore((s) => s.setAnimating)
  const setActiveDrawerId = useShkafStore((s) => s.setActiveDrawerId)
  const setHoveredSectionId = useShkafStore((s) => s.setHoveredSectionId)

  const leftDoorRef = useRef(null)
  const rightDoorRef = useRef(null)
  const closedRotations = useRef({ left: 0, right: 0 })
  const doorTimelineRef = useRef(null)
  const drawerTimelineRef = useRef(null)
  const navTimerRef = useRef(null)
  const hoveredDrawerId = useRef(null)
  const doorShadowTargets = useRef(null)
  const doorShadowTex = useRef(null)
  const interiorTargets = useMemo(() => collectInteriorShadowTargets(model), [model])
  const interiorTex = useRef(null)
  const setExtrasReady = useAppStore((s) => s.setExtrasReady)
  const extrasLeft = useRef(new Set(['books', 'leather', 'walnut', 'shadows', 'copper']))
  const markExtra = useCallback((key) => {
    const left = extrasLeft.current
    if (!left.delete(key)) return
    markStage(`extra-${key}`)
    if (left.size === 0) {
      markStage('extras-ready')
      setExtrasReady()
    }
  }, [setExtrasReady])

  const pushTune = useCallback(() => {
    if (!cabinetFlags().tune) return
    applyCabinetTune(model, scene)
  }, [model, scene])

  useEffect(() => {
    if (!cabinetFlags().tune) return undefined
    pushTune()
    return useCabinetTune.subscribe(() => pushTune())
  }, [pushTune])

  useLayoutEffect(() => {
    markStage('prepare-start')
    const wood = prepareMaterials(model)
    russoLog('info', 'shkaf', 'wood finish', wood)
    const hinges = applyHingeLegMaterial(model)
    russoLog('info', 'shkaf', 'hinge materials', { hinges })
    const left = findDoorPivotNode(model, 'left')
    const right = findDoorPivotNode(model, 'right')
    leftDoorRef.current = left
    rightDoorRef.current = right
    if (left) {
      left.rotation.set(0, 0, 0)
      snapDoorPivotToHinge(left, model.getObjectByName('hinge_left_2_body'))
      closedRotations.current.left = 0
    }
    if (right) {
      right.rotation.set(0, 0, 0)
      snapDoorPivotToHinge(right, model.getObjectByName('hinge_right_2_body'))
      closedRotations.current.right = 0
    }
    const doorShadow = prepareDoorShadowTargets(model)
    doorShadowTargets.current = doorShadow.targets
    russoLog('info', 'shkaf', 'door shadow uv', doorShadow.uvRange)
    if (cabinetFlags().compare) {
      const axis = DOOR_ROTATION_AXIS
      if (left) left.rotation[axis] = DOOR_LEFT_OPEN_ANGLE
      if (right) right.rotation[axis] = DOOR_RIGHT_OPEN_ANGLE
      setDoorsOpen(true)
    }
    hideCabinetHinges(model)
    hideCabinetStrays(model)
    const plaques = seatDrawerPlaques(model)
    russoLog('info', 'shkaf', 'drawer plaques seated', { plaques })
    fitRightTopBottle(model)
    alignRightDoorFace(model)
    addDoorHandleShadows(model)
    russoLog('info', 'shkaf', 'new cabinet loaded', {
      root: !!model.getObjectByName(SHKAF_ROOT_NAME),
      door_left: left?.name ?? null,
      door_right: right?.name ?? null,
      drawer_1: !!model.getObjectByName('drawer_1'),
      drawer_2: !!model.getObjectByName('drawer_2'),
    })
    pushTune()
    markStage('model-prepared')
    // Компиляция до первого кадра. Пока она идёт, рендер не рисует пустой кадр.
    holdFirstRender(true)
    markStage('compile-async-start')
    let cancelled = false
    gl.compileAsync(scene, camera).then(() => {
      if (!cancelled) markStage('compile-async-done')
    }).catch(() => {
      if (!cancelled) markStage('compile-async-done')
    }).finally(() => {
      if (cancelled) return
      holdFirstRender(false)
      armFirstRender()
    })
    return () => {
      cancelled = true
      holdFirstRender(false)
    }
  }, [model, pushTune, setDoorsOpen, gl, scene, camera])

  useEffect(() => {
    let cancelled = false
    let leatherTex = null
    loadBookCoverTextures()
      .then((tex) => {
        if (cancelled) return
        const books = applyBookCovers(model, tex)
        applyCabinetEnv(model, scene.environment)
        russoLog('info', 'shkaf', 'book covers', { books })
        markExtra('books')
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'book covers failed', { err: String(err) })
        if (!cancelled) markExtra('books')
      })
    Promise.all([loadLeatherTextures(), loadCabinetLightmaps(gl)])
      .then(([tex]) => {
        if (cancelled) return null
        leatherTex = tex
        return applyCabinetLightmaps(model, gl)
      })
      .then((lightmaps) => {
        if (cancelled) return
        if (!lightmaps) {
          markExtra('leather')
          return
        }
        // Кожа после lightmaps: иначе bake с ободка мог остаться / перезаписать материал.
        if (leatherTex) {
          const rims = applyDrawerLeatherRims(model, leatherTex)
          russoLog('info', 'shkaf', 'drawer leather', { rims })
        }
        scene.environmentIntensity = CABINET_LOOK.environmentIntensity
        const env = applyCabinetEnv(model, scene.environment)
        pushTune()
        russoLog('info', 'shkaf', 'lightmaps', { ...lightmaps, env })
        markExtra('leather')
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'leather/lightmaps failed', { err: String(err) })
        if (!cancelled) markExtra('leather')
      })
    return () => {
      cancelled = true
    }
  }, [gl, model, scene, pushTune, markExtra])

  useLayoutEffect(() => {
    scene.environmentIntensity = CABINET_LOOK.environmentIntensity
    if (!environment) return
    applyCabinetEnv(model, environment)
    pushTune()
  }, [environment, model, scene, pushTune])

  useEffect(() => {
    let cancelled = false
    loadWalnutBake()
      .then((textures) => {
        if (cancelled) return
        if (textures) {
          const walnut = applyWalnutBake(model, textures)
          applyCabinetEnv(model, scene.environment)
          pushTune()
          russoLog('info', 'shkaf', 'walnut bake', { walnut })
        }
        markExtra('walnut')
      })
      .catch((err) => {
        console.warn('[walnut] не удалось прочитать PNG', err)
        if (!cancelled) markExtra('walnut')
      })
    return () => {
      cancelled = true
    }
  }, [model, scene, pushTune, markExtra])

  useEffect(() => {
    let cancelled = false
    const door = loadDoorShadowBake()
      .then((tex) => {
        if (!cancelled) doorShadowTex.current = tex
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'door shadow bake load failed', { err: String(err) })
      })
    const interior = loadInteriorShadowBake().then((textures) => {
      if (cancelled) return
      interiorTex.current = textures
      russoLog('info', 'shkaf', 'interior shadow', { maps: [...textures.keys()] })
    })
    Promise.allSettled([door, interior]).then(() => {
      if (!cancelled) markExtra('shadows')
    })
    return () => {
      cancelled = true
    }
  }, [markExtra])

  useFrame(() => {
    syncInteriorShadow(interiorTargets, interiorTex.current)
    if (!doorShadowTargets.current) return
    syncDoorShadow(
      doorShadowTargets.current,
      doorShadowTex.current,
      { left: leftDoorRef.current, right: rightDoorRef.current },
      { left: DOOR_LEFT_OPEN_ANGLE, right: DOOR_RIGHT_OPEN_ANGLE },
      DOOR_ROTATION_AXIS,
    )
  })

  useEffect(() => {
    let cancelled = false
    loadAgedCopperTextures()
      .then((tex) => {
        if (cancelled) return
        if (!tex) {
          markExtra('copper')
          return
        }
        setAgedCopper(tex)
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'aged copper load failed', { err: String(err) })
        if (!cancelled) markExtra('copper')
      })
    return () => {
      cancelled = true
    }
  }, [markExtra])

  useLayoutEffect(() => {
    if (!agedCopper) return
    const corpus = applyAgedCopperToCorpus(model, agedCopper)
    const jewelry = applyAgedCopperToJewelry(model)
    applyCabinetEnv(model, scene.environment)
    pushTune()
    russoLog('info', 'shkaf', 'corpus aged copper', { corpus, jewelry })
    markExtra('copper')
  }, [agedCopper, model, scene, pushTune, markExtra])

  const animateDoors = useCallback(
    (open) => {
      if (useShkafStore.getState().animating) return
      const left = leftDoorRef.current
      const right = rightDoorRef.current
      if (!left && !right) {
        setDoorsOpen(open)
        return
      }
      setAnimating(true)
      setDoorsOpen(open)
      doorTimelineRef.current?.kill()
      const axis = DOOR_ROTATION_AXIS
      const tl = gsap.timeline({
        onComplete: () => {
          doorTimelineRef.current = null
          setAnimating(false)
        },
      })
      doorTimelineRef.current = tl
      if (left) {
      tl.to(
        left.rotation,
        {
          [axis]: open
            ? closedRotations.current.left + DOOR_LEFT_OPEN_ANGLE
            : closedRotations.current.left,
          duration: DOOR_OPEN_DURATION,
          ease: 'power2.out',
        },
        0,
      )
      }
      if (right) {
      tl.to(
        right.rotation,
        {
          [axis]: open
            ? closedRotations.current.right + DOOR_RIGHT_OPEN_ANGLE
            : closedRotations.current.right,
          duration: DOOR_OPEN_DURATION,
          ease: 'power2.out',
        },
        0,
      )
      }
    },
    [setAnimating, setDoorsOpen],
  )

  const toggleDoors = useCallback(() => {
    animateDoors(!useShkafStore.getState().doorsOpen)
  }, [animateDoors])

  const handleDrawerClick = useCallback(
    (section, target) => {
      setAnimating(true)
      setActiveDrawerId(section.id)
      setHoveredSectionId(section.id)
      const pull = getPullDirection(target)
      drawerTimelineRef.current?.kill()
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      const tl = gsap.timeline({
        onComplete: () => {
          drawerTimelineRef.current = null
          navTimerRef.current = setTimeout(() => {
            navTimerRef.current = null
            setAnimating(false)
            navigate(section.route)
          }, NAVIGATE_DELAY_MS)
        },
      })
      drawerTimelineRef.current = tl
      tl.to(
        target.position,
        {
          x: target.position.x + pull.x * DRAWER_PULL_DISTANCE,
          y: target.position.y + pull.y * DRAWER_PULL_DISTANCE,
          z: target.position.z + pull.z * DRAWER_PULL_DISTANCE,
          duration: DRAWER_OPEN_DURATION,
          ease: 'power2.out',
        },
        0,
      )
    },
    [navigate, setActiveDrawerId, setAnimating, setHoveredSectionId],
  )

  const processTapFromHits = useCallback(
    (intersections) => {
      const { animating: busy, activeDrawerId, doorsOpen: open } = useShkafStore.getState()
      if (busy || activeDrawerId) return
      const firstObject = intersections[0]?.object ?? null

      if (open) {
        const drawerHit = findDrawerFromIntersections(intersections, model)
        if (drawerHit) {
          handleDrawerClick(drawerHit.section, drawerHit.node)
          return
        }
        if (!firstObject) return
        toggleDoors()
        return
      }

      if (!firstObject) return
      toggleDoors()
    },
    [handleDrawerClick, model, toggleDoors],
  )

  useEffect(() => {
    const el = gl.domElement
    let down = null

    const onPointerDown = (e) => {
      if (e.pointerType !== 'touch' && e.button !== 0) return
      if (typeof e.isPrimary === 'boolean' && !e.isPrimary) return
      down = { x: e.clientX, y: e.clientY, t: performance.now(), pointerType: e.pointerType }
    }

    const onPointerUp = (e) => {
      if (!down) return
      const start = down
      down = null
      const dt = performance.now() - start.t
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      const drag = Math.hypot(dx, dy)
      const threshold =
        start.pointerType === 'touch' ? DRAG_THRESHOLD_MOBILE_PX : DRAG_THRESHOLD_DESKTOP_PX
      if (drag > threshold || dt > TAP_MAX_MS) return

      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObject(model, true)
      processTapFromHits(hits)
    }

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointerup', onPointerUp)
    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, [camera, gl, model, processTapFromHits])

  useEffect(() => {
    const el = gl.domElement
    const onMove = (e) => {
      if (!useShkafStore.getState().doorsOpen) {
        if (hoveredDrawerId.current) {
          hoveredDrawerId.current = null
          setHoveredSectionId(null)
          document.body.style.cursor = 'auto'
        }
        return
      }
      const rect = el.getBoundingClientRect()
      const ndc = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      )
      const raycaster = new THREE.Raycaster()
      raycaster.setFromCamera(ndc, camera)
      const hits = raycaster.intersectObject(model, true)
      const drawerHit = findDrawerFromIntersections(hits, model)
      if (drawerHit) {
        if (hoveredDrawerId.current === drawerHit.section.id) return
        hoveredDrawerId.current = drawerHit.section.id
        setHoveredSectionId(drawerHit.section.id)
        document.body.style.cursor = 'pointer'
        return
      }
      if (hoveredDrawerId.current) {
        hoveredDrawerId.current = null
        setHoveredSectionId(null)
        document.body.style.cursor = 'auto'
      }
    }
    el.addEventListener('pointermove', onMove)
    return () => el.removeEventListener('pointermove', onMove)
  }, [camera, gl, model, setHoveredSectionId])

  useEffect(
    () => () => {
      doorTimelineRef.current?.kill()
      drawerTimelineRef.current?.kill()
      if (navTimerRef.current) clearTimeout(navTimerRef.current)
      setHoveredSectionId(null)
      document.body.style.cursor = 'auto'
    },
    [setHoveredSectionId],
  )

  useEffect(() => {
    if (!doorsOpen && hoveredDrawerId.current) {
      hoveredDrawerId.current = null
      setHoveredSectionId(null)
    }
  }, [doorsOpen, setHoveredSectionId])

    return (
    <>
      <primitive object={model} />
      <DoorMirrors root={model} />
      <FirstFrameMark />
    </>
  )
}

function FirstFrameMark() {
  const marked = useRef(false)
  useFrame(() => {
    if (marked.current) return
    marked.current = true
    markFirstFrame()
  })
  return null
}

useGLTF.preload(SHKAF_MODEL_PATH, true, true)
