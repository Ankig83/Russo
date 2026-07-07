# Russo — Blender → React Three Fiber

## Полный путь: сцена + интерактивный шкаф

> **Для Cursor:** этот файл — пошаговый контракт. Каждый шаг помечен статусом.
> Не переходи к следующему шагу пока текущий не отмечен `[x]`.
> Перед каждым действием пользователя в Blender/экспорте — сверяйся с этим файлом и обновляй чеклисты в **Приложении A**.

---

## Архитектура

```
Blender                          Сайт (React Three Fiber)
────────                         ─────────────────────────
studio.glb  ──►  <StudioScene>   пол, стена, фон, освещение
                 └── shkaf_anchor (Empty = точка монтирования)

shkaf.glb   ──►  <Shkaf>         двери, ящики, клики, анимации
                 └── parent → shkaf_anchor
```

**Почему два файла:**

- Шкаф интерактивный → клики, анимации, materialFixups — всё в одном компоненте
- Сцена статичная → можно менять независимо
- Если шкаф внутри studio.glb — сломаются raycasting и анимации дверей

---

## ЧАСТЬ 1 — BLENDER: Подготовка сцены

### Шаг 1.1 — Единицы и ориентация

- [ ] Открой **Свойства сцены** (иконка конуса) → **Единицы** → `Метры`, длина `Метрическая`
- [ ] Убедись что **+Y** смотрит вверх (стандарт glTF)
- [ ] Выдели все объекты сцены → **Ctrl+A → Применить масштаб** (Apply Scale)
  - Это критично: GLB экспортирует scale=1, иначе в R3F объекты будут неправильного размера

---

### Шаг 1.2 — Структура объектов студии

Создай следующую иерархию в Outliner:

```
studio_root  (Empty, тип Plain Axes)
├── studio_floor     (меш пола)
├── studio_backdrop  (меш стены/купола, опционально)
├── shkaf_anchor     (Empty, тип Plain Axes)
└── lights_rig       (Empty, тип Plain Axes)
    ├── light_spot_main   (Spot)
    └── light_fill        (Area, опционально)
```

**Как создать Empty:**
`Shift+A → Пустышка → Простые оси` (Plain Axes)

**Правила именования — строго без пробелов, латиницей:**

- `studio_root` — корень, origin в центре пола
- `studio_floor` — пол, Y=0
- `shkaf_anchor` — сюда встанет шкаф, выстави позицию/поворот точно
- `lights_rig` — родитель для всех источников света

---

### Шаг 1.3 — Настройка пола

- [ ] Пол (`studio_floor`): убедись что нижняя грань на **Y=0** (или Z=0 если сцена в Z-up — но мы работаем в Y-up)
- [ ] В **Custom Properties** объекта пола добавь:
  - `floor_y` = `0.0` (тип Float)
  - Это используется в JS чтобы точно посадить тень
- [ ] Материал пола: тёмный, слегка отражающий. Roughness ~0.6, Metallic 0

---

### Шаг 1.4 — Освещение под референс (драматический Spot сверху)

Референс заказчика: один направленный источник сверху, резкая тень на полу.

- [ ] Выдели `lights_rig` → `Shift+A → Свет → Прожектор` (Spot)
- [ ] Переименуй в `light_spot_main`
- [ ] Параметры Spot (Properties → Object Data → Light):
  - **Мощность:** 800–1200 Вт
  - **Угол пятна:** 25–35°
  - **Смягчение:** 0.15 (мягкий край пятна)
  - **Тени:** включены
- [ ] Позиция: примерно X=0, Y=4м, Z=0 (прямо над шкафом, чуть спереди)
- [ ] Поворот: смотрит вниз на шкаф (~-70° по X)

**Опциональный fill-light:**

- `Shift+A → Свет → Площадка` (Area)
- Переименуй в `light_fill`
- Мощность: 100–200 Вт, без теней, сзади/сбоку
- Даёт мягкую подсветку задней части шкафа

---

### Шаг 1.5 — Якорь камеры (опционально но рекомендую)

Вместо Empty лучше настоящая камера — R3F достанет параметры автоматически.

- [ ] `Shift+A → Камера`
- [ ] Переименуй в `camera_anchor`
- [ ] Выстави позицию и угол как хочешь видеть сцену на сайте
- [ ] Properties → Object Data:
  - **Фокусное расстояние:** 50–70мм (меньше = шире, больше = теснее)
  - **Clip Start:** 0.1м, **Clip End:** 100м

---

### Шаг 1.6 — Материалы студии (Bake не нужен)

Студия использует простые PBR-материалы без процедурных нод — они экспортируются напрямую в GLB.

- [ ] Каждый материал: только **Principled BSDF → Вывод материала**
- [ ] Никаких Noise Texture, MixShader и прочего — GLB не умеет это экспортировать
- [ ] Текстуры: подключай как Image Texture → Base Color / Normal / Roughness
- [ ] Разрешение текстур студии: **2K максимум** (это статичный фон)

---

### Шаг 1.7 — Экспорт studio.glb

- [ ] Выдели `studio_root` и все его потомки
- [ ] **Файл → Экспорт → glTF 2.0 (.glb/.gltf)**
- [ ] Настройки экспорта:

```
Формат:            GLB
Включить:
  ✅ Выделенные объекты
  ✅ Пользовательские свойства (Custom Properties)  ← важно для floor_y
  ✅ Камеры
  ✅ Источники света  (KHR_lights_punctual)
  ✅ Применить трансформации

Геометрия:
  ✅ Применить модификаторы
  ✅ UV-развёртка
  ✅ Нормали

Сжатие:
  ✅ Draco (уровень 6)
```

- [ ] Сохрани как `studio.glb` в папку `public/models/`

---

## ЧАСТЬ 2 — BLENDER: Подготовка шкафа

### Шаг 2.1 — Проверка структуры шкафа

- [ ] Корневой объект шкафа называется строго `shkaf`
- [ ] Ножки шкафа стоят на **Y=0** локально
- [ ] Все двери и ящики — дочерние объекты с предсказуемыми именами:

  ```
  shkaf
  ├── door_left          (Empty/pivot — вращение при открытии)
  │   └── Beresta_L      (mesh-панель с патиной)
  ├── door_right         (Empty/pivot; rotation Y = 0 в Blender!)
  │   └── Beresta_R
  ├── drawer_1           (группа верхнего ряда — анимация выдвижения)
  │   ├── drawer_tl      (mesh-фронт, верх-слева)
  │   ├── drawer_tr      (mesh-фронт, верх-справа)
  │   ├── tabl_1         (табличка, материал prostranstva)
  │   ├── tabl_2         (табличка, материал avtorskie_m)
  │   └── …              (внутренняя обивка Btresta_inside.*)
  ├── drawer_2           (группа нижнего ряда — анимация выдвижения)
  │   ├── drawer_bl      (mesh-фронт, низ-слева)
  │   ├── drawer_br      (mesh-фронт, низ-справа)
  │   ├── tabl_3         (табличка, материал project_M)
  │   ├── tabl_4         (табличка, материал about)
  │   └── …
  └── Beck_W             (задняя стенка, материал bes=resta_W_M)
  ```

- [ ] **`door_right`**: rotation Y = **0** в Blender (иначе в GLB запечётся π и дверь будет открыта на сайте)
- [ ] **`drawer_1` / `drawer_2`**: это pivot-группы для анимации — **не** отключать raycast, не переименовывать
- [ ] **`drawer_tl/tr/bl/br`**: мелкие mesh-фронты — кликабельны, маппятся на `drawer_1`/`drawer_2`
- [ ] **`tabl_1…4`**: таблички с текстом — кликабельны, цепляются к `drawer_1`/`drawer_2` в `Shkaf.jsx`
- [ ] Scale applied на всём: выдели всё → **Ctrl+A → Применить масштаб**

---

### Шаг 2.1b — Контракт навигации ящиков (Blender ↔ JS)

Сайт не анимирует `drawer_tl` напрямую — выдвигается **`drawer_1` или `drawer_2`**.

| section.id (JS) | route | Группа анимации | tabl | материал таблички |
|---------------|-------|-----------------|------|-------------------|
| `drawer_tl` | `/private-spaces` | `drawer_1` | `tabl_1` | `prostranstva` |
| `drawer_tr` | `/commercial-projects` | `drawer_1` | `tabl_2` | `avtorskie_m` |
| `drawer_bl` | `/author-collections` | `drawer_2` | `tabl_3` | `project_M` |
| `drawer_br` | `/about` | `drawer_2` | `tabl_4` | `about` |

**Логика клика** (`src/utils/drawerHit.js`):

1. Raycast попадает в `tabl_*`, `drawer_tl/tr/bl/br`, бересту внутри ящика или в сам `drawer_1`/`drawer_2`
2. Анимация всегда на **`drawer_1` / `drawer_2`**
3. Раздел (лево/право внутри группы) — по материалу таблички или по local X (< 0 = левый)

**Файлы контракта** (менять вместе с Blender):

- `src/constants/shkafNodes.js` — `SHKAF_NODE_MAP`, `DRAWER_GROUP_SECTIONS`, `DRAWER_TABL_NODES`, `PLAQUE_MATERIAL_TO_SECTION`
- `src/constants/sections.js` — `id` и `route`
- После re-export: **`SHKAF_MODEL_VERSION` +1**

> **Не добавляй** `drawer_1`/`drawer_2` в `INACTIVE_DRAWER_NODES` — это отключит всю навигацию по ящикам.

---

### Шаг 2.2 — Материал меди: Bake или процедурный?

**Проблема:** процедурный материал (Noise, MixShader) не экспортируется в GLB.
**Решение:** два варианта, выбери один.

#### Вариант A — Bake в текстуры (рекомендую для финала)

- [ ] Разверни UV для дверей: Edit Mode → **U → Развернуть** (Unwrap)
- [ ] Создай новую Image Texture ноду (не подключая): `Shift+A → Текстура → Изображение`
  - Размер: **4096×4096** для дверей, 2048 для остального
  - Цветовое пространство: sRGB для Color, Non-Color для Normal/Roughness
- [ ] Выдели ноду Image Texture (она должна быть активной)
- [ ] Properties → Рендер → **Bake**:
  - Тип: **Диффузный** (Diffuse) → только Цвет → Bake
  - Потом: тип **Нормаль** (Normal) → Bake
  - Потом: тип **Шероховатость** (Roughness) → Bake
- [ ] Сохрани каждую карту: Image Editor → Image → Save As
  - `copper_color_4k.png`
  - `copper_normal_4k.png`
  - `copper_roughness_4k.png`
- [ ] Замени процедурный материал на простой Principled BSDF с этими текстурами
- [ ] Подключи Normal через ноду **Карта нормалей** (Normal Map)

#### Вариант B — оставить процедурный, конвертировать при экспорте

Не рекомендую — результат непредсказуем в разных браузерах.

> **Russo:** материал полотна дверей в Blender называется **`youtub`**. После bake текстура должна быть **внутри слота youtub** в GLB — тогда сайт не подменяет её через fixup.

---

### Шаг 2.3 — Экспорт shkaf.glb

- [ ] Выдели `shkaf` и всех потомков (**без** studio_root / декора сцены)
- [ ] **Файл → Экспорт → glTF 2.0**
- [ ] Настройки:

```
Формат:            GLB
Включить:
  ✅ Выделенные объекты
  ✅ Применить трансформации
  ✅ Анимации (если есть)
  ✅ Пользовательские свойства

Геометрия:
  ✅ Применить модификаторы
  ✅ UV
  ✅ Нормали

Сжатие:
  ✅ Draco (уровень 6)
```

- [ ] Сохрани как `shkaf.glb` в `public/models/`
- [ ] Подними `SHKAF_MODEL_VERSION` в `src/constants/shkafNodes.js`

---

### Шаг 2.4 — Проверка GLB перед кодингом

Перед тем как писать React — проверь оба файла:

- [ ] Открой **[gltf.report](https://gltf.report)** → загрузи `studio.glb`
  - Проверь что `shkaf_anchor` присутствует в дереве
  - Проверь что Custom Properties видны
  - Размер файла < 5MB (с Draco)
- [ ] Загрузи `shkaf.glb`
  - Все двери/ящики на месте
  - Материал **`youtub`** на полотнах имеет baseColorTexture (или fixup на сайте)
  - Размер < 10MB (без Draco допустимо больше — см. Приложение A)

---

## ЧАСТЬ 3 — REACT THREE FIBER: Структура компонентов

> **Примечание для Russo (master):** код уже живёт в `src/components/3d/`, не в `src/components/scene/`.
> Туториал ниже — эталон; при реализации адаптируй под существующие `Scene.jsx`, `Shkaf.jsx`, `StudioBackdrop.jsx`.

### Шаг 3.1 — Зависимости

```bash
npm install three @react-three/fiber @react-three/drei
```

Версии в проекте (master):

- `three`: ^0.184
- `@react-three/fiber`: ^9.x
- `@react-three/drei`: ^10.x

---

### Шаг 3.2 — Оркестратор загрузки

Создай `src/components/scene/SceneOrchestrator.jsx` (в Russo — расширить `Scene.jsx`):

```jsx
import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Environment, useProgress, Html } from '@react-three/drei'
import StudioScene from './StudioScene'
import Shkaf from './Shkaf'

function Loader() {
  const { progress } = useProgress()
  return (
    <Html center>
      <div style={{ color: 'white', fontSize: 14 }}>
        {Math.round(progress)}%
      </div>
    </Html>
  )
}

export default function SceneOrchestrator() {
  return (
    <Canvas
      shadows
      camera={{ fov: 55, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
    >
      <Suspense fallback={<Loader />}>
        <Environment
          files="/hdri/studio.hdr"
          background={false}
        />
        <StudioScene />
        <Shkaf />
      </Suspense>
    </Canvas>
  )
}
```

---

### Шаг 3.3 — StudioScene.jsx

```jsx
import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'

export default function StudioScene() {
  const { scene } = useGLTF('/models/studio.glb')
  const groupRef = useRef()

  useEffect(() => {
    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.receiveShadow = true
        obj.castShadow = false
        obj.raycast = () => null
      }
    })
  }, [scene])

  return <primitive ref={groupRef} object={scene} />
}

useGLTF.preload('/models/studio.glb')
```

---

### Шаг 3.4 — Shkaf.jsx с монтированием через якорь

```jsx
import { useEffect, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { applyProceduralMaterialFixups } from '../../utils/materialFixups'

export default function Shkaf({ parentAnchor }) {
  const { scene: shkafScene } = useGLTF('/models/shkaf.glb')
  const shkafRef = useRef()

  useEffect(() => {
    applyProceduralMaterialFixups(shkafScene)
    shkafScene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true
        obj.receiveShadow = true
      }
    })
  }, [shkafScene])

  if (parentAnchor) {
    parentAnchor.add(shkafScene)
    return null
  }

  return (
    <group ref={shkafRef}>
      <primitive object={shkafScene} />
    </group>
  )
}

useGLTF.preload('/models/shkaf.glb')
```

---

### Шаг 3.5 — Освещение: гибридная схема

GLB экспортирует KHR_lights_punctual — но они часто не дают теней в браузере.
Надёжнее: свет из Blender как **ориентир позиций**, реальный свет добавляем в JSX.

```jsx
<spotLight
  position={[0, 4, 0.5]}
  angle={0.35}
  penumbra={0.15}
  intensity={800}
  castShadow
  shadow-mapSize={[2048, 2048]}
  shadow-bias={-0.001}
/>

<rectAreaLight
  position={[0, 2, -2]}
  rotation={[0, Math.PI, 0]}
  width={3}
  height={2}
  intensity={50}
/>

<ambientLight intensity={0.05} />
```

---

### Шаг 3.6 — HDRI для окружения

- [ ] Скачай с **[polyhaven.com/hdris](https://polyhaven.com/hdris)** → Studio Small или Photo Studio → 2K HDR
- [ ] Положи в `public/hdri/studio.hdr`
- [ ] `<Environment files="/hdri/studio.hdr" background={false} />`

> **Russo сейчас:** `Environment preset="studio"` из drei, без отдельного HDR файла.

---

### Шаг 3.7 — Тени: проверочный чеклист

- [ ] `<Canvas shadows>`
- [ ] `<spotLight castShadow>`
- [ ] Шкаф: `castShadow = true`
- [ ] Пол: `receiveShadow = true`
- [ ] `shadow-mapSize={[2048, 2048]}`
- [ ] `shadow-bias={-0.001}`

---

## ЧАСТЬ 4 — Финальная проверка

### Шаг 4.1 — Чеклист перед деплоем

**Blender:**

- [ ] Scale applied на всех объектах
- [ ] Ножки шкафа на Y=0
- [ ] `shkaf_anchor` присутствует в studio.glb
- [ ] Custom Property `floor_y` на полу
- [ ] Материал **`youtub`** baked (не процедурный)
- [ ] Draco сжатие включено

**GLB файлы:**

- [ ] `studio.glb` < 5MB
- [ ] `shkaf.glb` < 10MB (или оптимизирован)
- [ ] Оба проверены на gltf.report

**React:**

- [ ] `<Canvas shadows>` включён
- [ ] castShadow / receiveShadow выставлены
- [ ] HDRI / Environment подключён
- [ ] Preload на обоих GLB
- [ ] Suspense + Loader добавлен

---

## Структура файлов проекта

```
public/
├── models/
│   ├── studio.glb
│   ├── shkaf.glb
│   └── textures/          (опционально, если не embedded)
│       ├── copper_color_4k.webp
│       ├── copper_normal_4k.webp
│       └── copper_roughness_4k.webp
└── hdri/
    └── studio.hdr

src/
├── constants/
│   ├── shkafNodes.js      ← пути GLB, версии, имена нод
│   ├── scene.js           ← камера, пол, туман
│   └── studioScene.js     ← (TODO) studio.glb, якоря
├── utils/
│   ├── materialFixups.js  ← youtub, Oxidized Copper, ножки
│   ├── gltfScenePrep.js   ← (TODO) prep studio.glb
│   └── perf.js            ← замеры загрузки
└── components/3d/
    ├── Scene.jsx          ← оркестратор Canvas
    ├── StudioScene.jsx    ← (TODO) studio.glb
    ├── StudioBackdrop.jsx ← fallback (процедурная студия)
    ├── Shkaf.jsx          ← интерактивный шкаф
    └── FitCamera.jsx
```

---

## ЧАСТЬ 5 — Текстура меди: Bake и применение на сайте

### Почему процедурный материал не работает в GLB

Процедурный материал в Blender (Noise Texture, MixShader, Layer Weight и т.д.) —
это математика которая выполняется внутри Blender на GPU.
GLB формат не умеет хранить эти вычисления — он хранит только **готовые пиксели**.

Поэтому путь один: **запечь (bake) процедурный материал в PNG-текстуры**,
подключить их в простой Principled BSDF, и уже его экспортировать в GLB.

---

### Шаг 5.1 — UV-развёртка дверей

- [ ] Выдели `door_left` → Tab (Edit Mode) → выдели всё (A)
- [ ] **U → Развернуть** (Smart UV Project или Unwrap)
- [ ] Повтори для `door_right`, **`левая_дверь_полотно`** (материал `youtub`)

---

### Шаг 5.2 — Создание Image Texture для bake

- [ ] Shader Editor → материал **`youtub`**
- [ ] Image Texture ноды: `copper_bake_color`, `copper_bake_normal`, `copper_bake_roughness` (4096×4096)

---

### Шаг 5.3 — Настройки рендера для Bake

- [ ] Cycles, GPU Compute
- [ ] Bake: Diffuse (Color only) → Normal → Roughness

---

### Шаг 5.4 — Bake Color

- [ ] Bake → сохрани `copper_color_4k.png`

---

### Шаг 5.5 — Bake Normal Map

- [ ] Bake → сохрани `copper_normal_4k.png`

---

### Шаг 5.6 — Bake Roughness

- [ ] Bake → сохрани `copper_roughness_4k.png`

---

### Шаг 5.7 — Замена материала на простой PBR

- [ ] Principled BSDF + Image Textures + Normal Map
- [ ] Metallic: 1.0
- [ ] Имя материала оставь **`youtub`** (контракт с сайтом)

---

### Шаг 5.8 — Проверка перед экспортом

- [ ] Material Preview — совпадает с процедурным видом

---

### Шаг 5.9 — Экспорт и размещение текстур

- [ ] GLB с embedded текстурами **или** external + WebP
- [ ] `public/models/textures/` при external

---

### Шаг 5.10 — Применение на сайте (materialFixups)

**Если `youtub` имеет `.map` в GLB** — fixup не трогает материал.

**Если без карты** — `src/utils/materialFixups.js` подставляет baked-текстуру с `Oxidized used copper metal`.

Константа: `YOUTUB_TEXTURE_SOURCE = 'Oxidized used copper metal'`

В консоли (dev): `РУССО: материал youtub — текстура подключена`

---

### Шаг 5.11 — Чеклист текстуры меди

**Blender:**

- [ ] UV на медных мешах
- [ ] Bake Color / Normal / Roughness
- [ ] Материал **`youtub`** = Principled + карты
- [ ] Re-export `shkaf.glb`

**Файлы:**

- [ ] WebP опционально
- [ ] gltf.report — `youtub` has baseColorTexture

**R3F:**

- [ ] `SHKAF_MODEL_VERSION` +1
- [ ] Ctrl+Shift+R в браузере

---

> **Cursor:** при генерации кода строго следуй именам `shkaf_anchor`, `studio_floor`, `door_left`, `door_right`, **`youtub`**.
> Не переименовывай без обновления `shkafNodes.js` и `materialFixups.js`.

---

# Приложение A — Russo master: статус на 2026-06-24

> Cursor: обновляй этот блок после каждого шага пользователя.

## Общий прогресс

| Часть | Статус |
|-------|--------|
| 1 — studio.glb в Blender | ⬜ не начато |
| 2 — shkaf.glb | 🟡 частично (файл есть, youtub без bake) |
| 3 — R3F StudioScene | ⬜ не начато (используется StudioBackdrop) |
| 4 — финальная проверка | ⬜ |
| 5 — bake youtub | ⬜ |

## Файлы на диске

| Файл | Статус |
|------|--------|
| `public/models/shkaf.glb` | ✅ v17, ~74 MB, `shkaf_лучший_22` |
| `public/models/studio.glb` | ❌ нет |
| `public/hdri/studio.hdr` | ❌ нет |
| `docs/BLENDER_R3F_PIPELINE.md` | ✅ этот файл |

## Материалы в текущем shkaf.glb

| Материал | baseColor в GLB | На сайте |
|----------|-----------------|----------|
| `youtub` | ❌ нет | fixup → `Oxidized used copper metal` |
| `Oxidized Copper` | ❌ нет | fixup → тот же источник |
| `Oxidized used copper metal` | ✅ `metal05_diffuse` | только на декоре `6_` |

## Имена ящиков (не менять без правки JS)

См. `src/constants/shkafNodes.js`: `drawe_3`, `draver_5`, `door_left`, `door_right`.

## Blender-скрипты

| Скрипт | Назначение |
|--------|------------|
| `scripts/blender/build_reference_studio.py` | **студия под референс** (пол, стена, spot, camera_anchor, shkaf_anchor) |
| `scripts/blender/copper_patina_material.py` | процедурная медь+патина (→ bake в youtub) |
| `scripts/blender/door_panel_from_glb.py` | полотно двери |
| `scripts/blender/recreate_door_left.py` | каркас door_left |

## Следующий шаг пользователя

1. **Bake материала `youtub`** на полотнах → re-export `shkaf.glb` → version 18
2. **Запустить `build_reference_studio.py`** → экспорт `studio.glb` → `public/models/`
3. Написать Cursor: «studio.glb готов» → подключить `StudioScene.jsx`
