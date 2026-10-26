import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useGLTF } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom'
import gsap from 'gsap'
import { useShkafStore } from '../../store/shkafStore'
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
import { applyDrawerLeatherRims, loadLeatherTextures } from '../../utils/leatherTextures'
import DoorMirrors from './DoorMirrors'
import { finishCabinetWood } from '../../utils/cabinetWoodFinish'
import { applyCabinetLightmaps, loadCabinetLightmaps } from '../../utils/cabinetLightmaps'
import { applyCabinetEnv } from '../../utils/cabinetEnv'
import { CABINET_LOOK } from '../../constants/cabinetStudio'
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

/** Пивот door_* сидит впереди петли корпуса — при 120° створка уезжает. */
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

const NO_CAST_NAME = /glass|mirror|stitch|decanter|liquid|whisky|bottle|foil|_inner$/i
const NO_CAST_MAT = /glass|mirror|decanter|liquid|whisky|transparent/i

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
    obj.receiveShadow = casts || !/glass|mirror|_inner$/i.test(obj.name || '')
    const kind = finishCabinetWood(obj)
    if (kind === 'walnut') walnut += 1
    else if (kind === 'leather') leather += 1
    else if (kind === 'stitch') stitch += 1
    if (kind) return
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
    mats.forEach((mat) => {
      if (!mat) return
      if ('envMapIntensity' in mat) mat.envMapIntensity = 1
      if ('transmission' in mat && mat.transmission > 0.01) {
        mat.thickness = mat.thickness > 0 ? mat.thickness : 0.04
        mat.ior = mat.ior || 1.45
        mat.attenuationDistance = mat.attenuationDistance || 1
        mat.transparent = true
      }
      mat.needsUpdate = true
    })
  })
  return { walnut, leather, stitch }
}

export default function Shkaf() {
  const navigate = useNavigate()
  const gltf = useGLTF(SHKAF_MODEL_PATH, true, true)
  const model = useMemo(() => gltf.scene.clone(true), [gltf.scene])
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

  useLayoutEffect(() => {
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
    hideCabinetHinges(model)
    russoLog('info', 'shkaf', 'new cabinet loaded', {
      root: !!model.getObjectByName(SHKAF_ROOT_NAME),
      door_left: left?.name ?? null,
      door_right: right?.name ?? null,
      drawer_1: !!model.getObjectByName('drawer_1'),
      drawer_2: !!model.getObjectByName('drawer_2'),
    })
  }, [model])

  useEffect(() => {
    let cancelled = false
    loadLeatherTextures()
      .then((tex) => {
        if (cancelled) return
        const rims = applyDrawerLeatherRims(model, tex)
        russoLog('info', 'shkaf', 'drawer leather', { rims })
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'drawer leather failed', { err: String(err) })
      })
      .then(() => {
        if (cancelled) return null
        return loadCabinetLightmaps(gl).then(() => applyCabinetLightmaps(model, gl))
      })
      .then((lightmaps) => {
        if (cancelled || !lightmaps) return
        scene.environmentIntensity = CABINET_LOOK.environmentIntensity
        const env = applyCabinetEnv(model, scene.environment)
        russoLog('info', 'shkaf', 'lightmaps', { ...lightmaps, env })
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'lightmaps failed', { err: String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [gl, model, scene])

  useLayoutEffect(() => {
    scene.environmentIntensity = CABINET_LOOK.environmentIntensity
    if (!environment) return
    applyCabinetEnv(model, environment)
  }, [environment, model, scene])

  useEffect(() => {
    let cancelled = false
    loadAgedCopperTextures()
      .then((tex) => {
        if (!cancelled) setAgedCopper(tex)
      })
      .catch((err) => {
        russoLog('warn', 'shkaf', 'aged copper load failed', { err: String(err) })
      })
    return () => {
      cancelled = true
    }
  }, [])

  useLayoutEffect(() => {
    if (!agedCopper) return
    const corpus = applyAgedCopperToCorpus(model, agedCopper)
    russoLog('info', 'shkaf', 'corpus aged copper', { corpus })
  }, [agedCopper, model])

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
      doorTimelineRef.current?.kill()
      const axis = DOOR_ROTATION_AXIS
      const tl = gsap.timeline({
        onComplete: () => {
          doorTimelineRef.current = null
          setDoorsOpen(open)
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
    </>
  )
}

useGLTF.preload(SHKAF_MODEL_PATH, true, true)
