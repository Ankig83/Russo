import * as THREE from 'three'
import { useLoader } from '@react-three/fiber'

/**
 * Выставочный подвес-фриз.
 * Константы для настройки — в начале файла.
 */

// ─── Фермы зала ──────────────────────────────────────────
const TR_SPAN    = 20      // длина фермы (X)
const TR_HZ      = 0.14   // полуглубина сечения (Z)
const TR_HH      = 0.17   // полувысота сечения (Y)
const TR_Z_LIST  = [-6.0, -3.2, 0.8]  // Z три фермы

// ─── Фриз — три основных размера ───────────────────────────
const FR_W = 8.4    // ширина фасада (X)
const FR_H = 1.4    // высота (Y)
const FR_D = 2.6    // глубина к стене (Z): от передней панели до задней

const FR_Z_FRONT  = -3.1  // Z передней панели с логотипом — фасад «лицом» к залу
const FR_Z_CENTER = FR_Z_FRONT - FR_D / 2
const FR_Y_TOP    = 3.9     // Y верхней грани
const FR_WALL     = 0.028   // толщина стенок

// ─── Трек и кронштейны ───────────────────────────────────
const TK_BKT_H   = 0.20   // высота кронштейна над верхней гранью
const TK_FWD     = 0.30   // насколько передняя рейка вынесена вперёд
const TK_SIDE    = 0.048  // сечение рейки/кронштейна

// ─── Споты ───────────────────────────────────────────────
const SP_FRONT_X  = [-3.0, -1.0, 1.0, 3.0]
const SP_REAR_X   = [-2.5, 0.0, 2.5]
const SP_COLOR    = '#fff0cc'
const SP_F_INT    = 48
const SP_R_INT    = 32
const SP_ANGLE    = 0.34
const SP_PENUMBRA = 0.42
const SP_AIM_CAB  = [0, 0.4, -4.2]

// ─── Тросы ───────────────────────────────────────────────
const CABLE_X = [-3.5, -1.5, 1.5, 3.5]
const CABLE_R = 0.016

// ─── LED ─────────────────────────────────────────────────
const LED_H     = 0.020
const LED_COLOR = '#ffe0a0'
const LED_EMIT  = '#b05010'
const LED_I     = 1.8

// ─── Материалы ───────────────────────────────────────────
const M_DARK  = { color: '#0c0c0c', metalness: 0.86, roughness: 0.22 }
const M_CHORD = { color: '#0a0a0a', metalness: 0.90, roughness: 0.18 }
const M_MID   = { color: '#1a1a1a', metalness: 0.80, roughness: 0.28 }
const M_CABLE = { color: '#8a8a8a', metalness: 0.96, roughness: 0.14 }
const M_RAIL  = { color: '#111111', metalness: 0.88, roughness: 0.20 }

/** Глянцевые панели фриза — блики от спотов */
const M_FRIEZE = {
  color: '#121212',
  metalness: 0.94,
  roughness: 0.07,
  envMapIntensity: 2.4,
  clearcoat: 1,
  clearcoatRoughness: 0.04,
}
const M_FRIEZE_SIDE = {
  color: '#161616',
  metalness: 0.90,
  roughness: 0.12,
  envMapIntensity: 1.8,
  clearcoat: 0.65,
  clearcoatRoughness: 0.08,
}

const LOGO_URL = `${import.meta.env.BASE_URL}assets/brand/logo-frieze.png?v=01`
const LOGO_ASPECT = 1426 / 548 // РУССО-01.png

// ─── Ферма зала (правильная геометрия) ───────────────────
// Ферма spans по X; сечение — прямоугольник TR_HH×TR_HZ в плоскости YZ.
// Диагонали на 4 гранях используют корректные углы поворота.
function PavilionTruss({ trussY, z }) {
  const len  = TR_SPAN
  const seg  = 0.85
  const n    = Math.round(len / seg)
  const sl   = len / n

  const hz = TR_HZ
  const hh = TR_HH

  // Длины диагоналей
  const L_yf = Math.sqrt(sl * sl + 4 * hz * hz)  // top/bottom face (вращение вокруг Y)
  const L_zf = Math.sqrt(sl * sl + 4 * hh * hh)  // front/back face (вращение вокруг Z)

  // Углы (см. комментарий ниже):
  // rotation.y = α → ось +X повернётся к [cos α, 0, -sin α]
  // direction_top_A = (sl, 0, -2hz)/L → cos α = sl/L, -sin α = -2hz/L → sin α = 2hz/L
  //   → α = atan2(2hz, sl)
  // direction_top_B = (sl, 0, +2hz)/L → sin α = -2hz/L → α = atan2(-2hz, sl)
  const α_pos = Math.atan2(2 * hz, sl)   // rotation.y для диагонали к -Z
  const α_neg = -α_pos                    // rotation.y для диагонали к +Z

  // rotation.z = β → ось +X повернётся к [cos β, sin β, 0]
  // direction_side_A = (sl, -2hh, 0)/L → sin β = -2hh/L → β = atan2(-2hh, sl) < 0
  const β_pos = Math.atan2(2 * hh, sl)
  const β_neg = -β_pos

  const D = 0.020  // сечение диагонального бруска

  // Позиции хорд (Y, Z в локальном пространстве)
  const chords = [[hh, hz], [hh, -hz], [-hh, hz], [-hh, -hz]]

  return (
    <group position={[0, trussY, z]}>
      {/* 4 хорды — ящики вдоль X */}
      {chords.map(([cy, cz], i) => (
        <mesh key={i} position={[0, cy, cz]}>
          <boxGeometry args={[len, 0.028, 0.028]} />
          <meshStandardMaterial {...M_CHORD} />
        </mesh>
      ))}

      {/* Диагонали на 4 гранях */}
      {Array.from({ length: n }).flatMap((_, i) => {
        const xm   = -len / 2 + (i + 0.5) * sl
        // чередуем наклон на соседних сегментах
        const ry = i % 2 === 0 ? α_pos : α_neg
        const rz = i % 2 === 0 ? β_pos : β_neg
        return [
          // Верхняя грань (Y = +hh, середина по Z = 0)
          <mesh key={`t${i}`} position={[xm, hh, 0]} rotation={[0, ry, 0]}>
            <boxGeometry args={[L_yf, D, D]} />
            <meshStandardMaterial {...M_CHORD} />
          </mesh>,
          // Нижняя грань (Y = -hh)
          <mesh key={`b${i}`} position={[xm, -hh, 0]} rotation={[0, ry, 0]}>
            <boxGeometry args={[L_yf, D, D]} />
            <meshStandardMaterial {...M_CHORD} />
          </mesh>,
          // Передняя грань (Z = +hz)
          <mesh key={`f${i}`} position={[xm, 0, hz]} rotation={[0, 0, rz]}>
            <boxGeometry args={[L_zf, D, D]} />
            <meshStandardMaterial {...M_CHORD} />
          </mesh>,
          // Задняя грань (Z = -hz)
          <mesh key={`k${i}`} position={[xm, 0, -hz]} rotation={[0, 0, rz]}>
            <boxGeometry args={[L_zf, D, D]} />
            <meshStandardMaterial {...M_CHORD} />
          </mesh>,
        ]
      })}
    </group>
  )
}

// ─── Трос/штанга ─────────────────────────────────────────
function Cable({ topY, botY, x, z }) {
  const len = topY - botY
  return (
    <mesh position={[x, botY + len / 2, z]}>
      <cylinderGeometry args={[CABLE_R, CABLE_R, len, 6, 1]} />
      <meshStandardMaterial {...M_CABLE} />
    </mesh>
  )
}

// ─── Спот с корпусом ─────────────────────────────────────
function Spot({ worldPos, aimWorld, intensity, showBeam = false }) {
  const [wx, wy, wz] = worldPos
  const tl = [
    aimWorld[0] - wx,
    aimWorld[1] - (wy - 0.14),
    aimWorld[2] - wz,
  ]
  const lensEmit = Math.min(5, intensity * 0.1)

  return (
    <group position={worldPos}>
      <mesh position={[0, 0.026, 0]}>
        <boxGeometry args={[0.082, 0.046, 0.062]} />
        <meshStandardMaterial {...M_MID} />
      </mesh>
      <mesh position={[0, -0.075, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.040, 0.055, 0.11, 12, 1, true]} />
        <meshStandardMaterial
          color="#1a1510"
          emissive="#ffcc55"
          emissiveIntensity={lensEmit}
          metalness={0.92}
          roughness={0.12}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, -0.132, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.030, 0.005, 8, 16]} />
        <meshStandardMaterial
          color="#ffe8b0"
          emissive="#ffaa44"
          emissiveIntensity={lensEmit * 0.7}
          metalness={0.85}
          roughness={0.2}
        />
      </mesh>
      {showBeam && (
        <mesh position={[0, -0.22, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.14, 0.55, 16, 1, true]} />
          <meshBasicMaterial
            color="#fff6dd"
            transparent
            opacity={0.07}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      <spotLight
        position={[0, -0.14, 0]}
        color={SP_COLOR}
        intensity={intensity}
        angle={SP_ANGLE}
        penumbra={SP_PENUMBRA}
        distance={14}
        decay={2}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0002}
      >
        <object3D attach="target" position={tl} />
      </spotLight>
    </group>
  )
}

// ─── Трек по периметру ────────────────────────────────────
function PerimeterTrack({ topY, zCenter, w, d }) {
  const railY  = topY + TK_BKT_H
  const hw     = w / 2
  const hd     = d / 2
  const zFront = zCenter + hd + TK_FWD   // передняя рейка вынесена вперёд
  const zRear  = zCenter - hd

  // Кронштейны: наклонные к передней рейке, вертикальные к задней
  const fBktX = [-hw + 0.2, -hw / 2, 0, hw / 2, hw - 0.2]
  const rBktX = [-hw + 0.2, 0, hw - 0.2]

  return (
    <group>
      {/* Передняя продольная рейка (вынесена вперёд) */}
      <mesh position={[0, railY, zFront]}>
        <boxGeometry args={[w + 0.1, TK_SIDE, TK_SIDE]} />
        <meshStandardMaterial {...M_RAIL} />
      </mesh>
      {/* Задняя продольная рейка */}
      <mesh position={[0, railY, zRear]}>
        <boxGeometry args={[w + 0.1, TK_SIDE, TK_SIDE]} />
        <meshStandardMaterial {...M_RAIL} />
      </mesh>
      {/* Левая поперечная рейка */}
      <mesh position={[-hw, railY, zCenter + TK_FWD / 2]}>
        <boxGeometry args={[TK_SIDE, TK_SIDE, d + TK_FWD + 0.06]} />
        <meshStandardMaterial {...M_RAIL} />
      </mesh>
      {/* Правая поперечная рейка */}
      <mesh position={[hw, railY, zCenter + TK_FWD / 2]}>
        <boxGeometry args={[TK_SIDE, TK_SIDE, d + TK_FWD + 0.06]} />
        <meshStandardMaterial {...M_RAIL} />
      </mesh>

      {/* Наклонные кронштейны передней рейки */}
      {fBktX.map((bx) => {
        const dz  = TK_FWD
        const dy  = TK_BKT_H
        const bl  = Math.sqrt(dy * dy + dz * dz)
        const ang = Math.atan2(dz, dy)
        return (
          <mesh key={bx} position={[bx, topY + dy / 2, zCenter + hd + dz / 2]}
            rotation={[ang, 0, 0]}>
            <boxGeometry args={[TK_SIDE, bl, TK_SIDE]} />
            <meshStandardMaterial {...M_DARK} />
          </mesh>
        )
      })}

      {/* Вертикальные кронштейны задней рейки */}
      {rBktX.map((bx) => (
        <mesh key={bx} position={[bx, topY + TK_BKT_H / 2, zRear]}>
          <boxGeometry args={[TK_SIDE, TK_BKT_H, TK_SIDE]} />
          <meshStandardMaterial {...M_DARK} />
        </mesh>
      ))}
    </group>
  )
}

// ─── Фриз + логотип ───────────────────────────────────────
function Frieze() {
  const logoTex = useLoader(THREE.TextureLoader, LOGO_URL)
  logoTex.colorSpace = THREE.SRGBColorSpace

  const cy     = FR_Y_TOP - FR_H / 2
  const hw     = FR_W / 2
  const zc     = FR_Z_CENTER
  const zFront = FR_Z_FRONT
  const zRear  = FR_Z_FRONT - FR_D

  // Один логотип по центру передней панели (РУССО-01.png)
  let logoH = FR_H * 0.90
  let logoW = logoH * LOGO_ASPECT
  if (logoW > FR_W * 0.94) {
    logoW = FR_W * 0.94
    logoH = logoW / LOGO_ASPECT
  }

  const logoMat = {
    transparent: true,
    alphaTest: 0.01,
    toneMapped: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  }

  return (
    <group>
      {/* Пустотелый короб: только 4 боковые панели, без верха и низа */}
      {/* Передняя панель */}
      <mesh position={[0, cy, zFront]} receiveShadow>
        <boxGeometry args={[FR_W, FR_H, FR_WALL]} />
        <meshPhysicalMaterial {...M_FRIEZE} />
      </mesh>
      {/* Задняя панель */}
      <mesh position={[0, cy, zRear]} receiveShadow>
        <boxGeometry args={[FR_W, FR_H, FR_WALL]} />
        <meshPhysicalMaterial {...M_FRIEZE_SIDE} />
      </mesh>
      {/* Левая боковая */}
      <mesh position={[-hw, cy, zc]} receiveShadow>
        <boxGeometry args={[FR_WALL, FR_H, FR_D]} />
        <meshPhysicalMaterial {...M_FRIEZE_SIDE} />
      </mesh>
      {/* Правая боковая */}
      <mesh position={[hw, cy, zc]} receiveShadow>
        <boxGeometry args={[FR_WALL, FR_H, FR_D]} />
        <meshPhysicalMaterial {...M_FRIEZE_SIDE} />
      </mesh>

      {/* Один логотип по центру передней панели */}
      <mesh position={[0, cy, zFront + FR_WALL / 2 + 0.003]}>
        <planeGeometry args={[logoW, logoH]} />
        <meshBasicMaterial map={logoTex} {...logoMat} />
      </mesh>
    </group>
  )
}

// ─── Главный компонент ────────────────────────────────────
export default function ExhibitionOverhead({ floorY, wallH }) {
  const ceilingY  = floorY + wallH
  const trussY    = ceilingY - 0.85
  const cableTopY = trussY - TR_HH         // нижняя хорда фермы
  const railY     = FR_Y_TOP + TK_BKT_H   // Y реек трека

  const zFrontRail = FR_Z_CENTER + FR_D / 2 + TK_FWD
  const zRearRail  = FR_Z_CENTER - FR_D / 2
  const spY        = railY - TK_SIDE / 2
  const friezeCy   = FR_Y_TOP - FR_H / 2
  const friezeAimZ = FR_Z_FRONT + FR_WALL / 2

  return (
    <group>
      {/* Фермы зала */}
      {TR_Z_LIST.map((tz) => (
        <PavilionTruss key={tz} trussY={trussY} z={tz} />
      ))}

      {/* Тросы */}
      {CABLE_X.map((cx) => (
        <Cable key={cx} topY={cableTopY} botY={FR_Y_TOP} x={cx} z={FR_Z_CENTER} />
      ))}

      {/* Фриз */}
      <Frieze />

      {/* Трек по периметру */}
      <PerimeterTrack
        topY={FR_Y_TOP}
        zCenter={FR_Z_CENTER}
        w={FR_W}
        d={FR_D}
      />

      {/* Передние споты → фасад фриза (каждый в свою точку — видны пятна света) */}
      {SP_FRONT_X.map((sx) => (
        <Spot
          key={`f${sx}`}
          worldPos={[sx, spY, zFrontRail]}
          aimWorld={[sx, friezeCy, friezeAimZ]}
          intensity={SP_F_INT}
          showBeam
        />
      ))}

      {/* Задние споты → шкаф */}
      {SP_REAR_X.map((sx) => (
        <Spot key={`r${sx}`} worldPos={[sx, spY, zRearRail]} aimWorld={SP_AIM_CAB} intensity={SP_R_INT} />
      ))}

      {/* Контровой свет по верхнему ребру фриза */}
      {[-FR_W * 0.35, FR_W * 0.35].map((sx) => (
        <Spot
          key={`rim${sx}`}
          worldPos={[sx, spY + 0.04, zFrontRail - 0.15]}
          aimWorld={[sx * 0.6, FR_Y_TOP - 0.05, friezeAimZ]}
          intensity={SP_F_INT * 0.55}
          showBeam
        />
      ))}
    </group>
  )
}
