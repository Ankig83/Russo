# РУССО — состояние кода для разработки

> Живой снимок того, **что работает, как и где**. Обновляй при изменении логики шкафа, сцены или навигации.
> Дата актуализации: 2026-07-11.
> Пайплайн Blender→GLB описан отдельно в `docs/BLENDER_R3F_PIPELINE.md`.

---

## 1. Что это

Одностраничный (по факту — многостраничный на React Router) сайт мебельной компании.
Главный экран — интерактивный 3D-шкаф: клик открывает двери, клик по ящику внутри выдвигает его и уводит на страницу раздела.

**Бэкенда сейчас нет** — только фронтенд (Vite + React). Страницы разделов — заглушки.

---

## 2. Стек (по `package.json`)

| Библиотека | Версия | Роль |
|---|---|---|
| Vite | 8 | dev-сервер + сборка |
| React | 19 | UI |
| react-router-dom | 7 | маршрутизация |
| @react-three/fiber | 9 | React-обёртка Three.js |
| @react-three/drei | 10 | `useGLTF`, `OrbitControls`, `ContactShadows`, `Environment` |
| @react-three/postprocessing | 3 | Bloom / Vignette / N8AO и т.д. |
| three | 0.184 | 3D-движок |
| gsap | 3 | анимации дверей и ящиков |
| zustand | 5 | глобальный стейт шкафа |
| tailwindcss | 4 | стили (через `@tailwindcss/vite`) |
| axios | 1 | заготовка под API (`src/api/index.js`) |

### Запуск

```bash
npm install
npm run dev        # http://localhost:5173/
npm run build      # прод-сборка
npm run lint       # eslint
```

> На этой машине Node не в системном PATH — используется portable Node из `C:\Temp\node-portable`.
> Запуск: `$env:PATH = "C:\Temp\node-portable;$env:PATH"; npm run dev`

---

## 3. Карта файлов (`src/`)

```
src/
├── App.jsx                     маршруты (BrowserRouter + Routes)
├── main.jsx                    точка входа
│
├── pages/
│   ├── Home.jsx                главная: <Scene/> + <Header/> + <LoadingOverlay/>, сброс стейта шкафа
│   ├── PrivateSpaces.jsx       /private-spaces        (заглушка)
│   ├── CommercialProjects.jsx  /commercial-projects   (заглушка)
│   ├── AuthorCollections.jsx   /author-collections    (заглушка)
│   ├── About.jsx, Contacts.jsx, Catalog.jsx, ...      (заглушки)
│   └── NotFound.jsx            404
│
├── components/
│   ├── 3d/
│   │   ├── Scene.jsx           ⭐ оркестратор Canvas: камера, свет, постобработка, perf-тиры
│   │   ├── Shkaf.jsx           ⭐ загрузка GLB, двери, ящики, клики, hover, навигация, внутренний свет
│   │   ├── FitCamera.jsx       авто-подгон камеры под габариты шкафа
│   │   ├── StudioEnvironment.jsx  IBL/Environment (drei)
│   │   ├── StudioLights.jsx    RectArea key/fill/rim, разделение слоёв света
│   │   ├── StudioShadowLight.jsx  directional-свет для тени
│   │   ├── StudioBackdrop.jsx  фон-стена (процедурный градиент)
│   │   ├── StudioHorizon.jsx   мягкая подложка-градиент (в обычном режиме)
│   │   ├── HeroBackdrop.jsx    ⭐ hero-look: лайтбокс-стена + рассеянный fill/ободок
│   │   ├── HeroLogo.jsx        ⭐ hero-look: 3D-логотип (SVGLoader + ExtrudeGeometry) на лайтбоксе
│   │   ├── HeroShadowLight.jsx тень шкафа на пол (hero-look)
│   │   ├── ReflectiveFloor.jsx ⭐ hero-look: отражающий пол (MeshReflectorMaterial)
│   │   ├── ShkafGlbLegs.jsx    @deprecated — ножки теперь attach в Shkaf через attachGlbLegs
│   │   ├── CabinetLegs.jsx     процедурные ножки (fallback, USE_PROCEDURAL_LEGS)
│   │   ├── CameraIntro.jsx     плавный въезд камеры (CAMERA_INTRO.enabled = false)
│   │   ├── Loader.jsx          прелоадер внутри Canvas (useProgress)
│   │   └── DrawerPlaque.jsx    @deprecated 2D-оверлей (таблички теперь в GLB)
│   └── ui/
│       ├── Header.jsx          подсказка «открой шкаф» снизу по центру
│       ├── LoadingOverlay.jsx  ⭐ прелоад: монограмма РУССО, shimmer, progress, улёт в угол
│       ├── CornerLogo.jsx      маленькая монограмма top-right после загрузки (на всех страницах)
│       └── StubPage.jsx        шаблон страницы-заглушки
│
├── store/
│   ├── shkafStore.js           zustand: doorsOpen, animating, activeDrawerId
│   └── appStore.js             zustand: loadingDone (после exit-анимации LoadingOverlay)
│
├── hooks/
│   ├── useStudioPerformance.js выбор perf-тира (low/medium/high)
│   └── useMediaQuery.js        useIsMobile
│
├── constants/
│   ├── sections.js             ⭐ разделы: id → label → route → тип
│   ├── shkaf.js                углы дверей, дистанции, длительности анимаций, масштабы
│   ├── shkafNodes.js           ⭐ имена нод GLB, маппинги, материалы, версия модели
│   ├── studioScene.js          ⭐ perf-тиры, свет, PBR-профили, камера
│   └── scene.js                фон, tone mapping
│
├── utils/
│   ├── drawerHit.js            ⭐ raycast-объект → section / нода ящика
│   ├── materialFixups.js       правки материалов (корпус, береста, медь, envMap)
│   ├── patinaTextures.js       загрузка/применение текстур патины на двери
│   ├── doorPatinaFixups.js     доп. правки материалов дверей
│   ├── cabinetBounds.js        габариты/центр/позиционирование шкафа (центр X/Z по pivot дверей)
│   ├── attachGlbLegs.js        ⭐ attach внешних ножек из shkaf-legs.glb (GLB_LEG_TRANSFORMS)
│   ├── gltfColorSpace.js       цветовые пространства текстур + anisotropy
│   ├── shkafLightLayers.js     назначение light-layers мешам (двери/корпус)
│   └── perf.js                 замеры загрузки
│
└── api/index.js                axios-инстанс (заготовка)
```

⭐ — файлы, которые чаще всего правят.

---

## 4. Модель шкафа (GLB)

- Путь: `public/models/shkaf.glb`
- Ножки (отдельный GLB): `public/models/shkaf-legs.glb` — attach в `Shkaf.jsx` через `attachGlbLegs.js` (`GLB_LEG_TRANSFORMS`).
- Версия кэша: `SHKAF_MODEL_VERSION` в `shkafNodes.js` (сейчас **'33'**). Поднимать после каждого ре-экспорта из Blender — иначе `useGLTF` отдаёт старую модель из кэша.

### Актуальная иерархия нод

```
shkaf
├── door_left        (pivot левой двери — вращается)
│   ├── Beresta_L    (полотно с берестой)
│   ├── ручка_левая, left_top_pocket, left_down_pocket …
├── door_right       (pivot правой двери — вращается)
│   ├── Beresta_R
│   ├── ручка_правая …
├── drawer_1         ⛔ контейнер-нутро (НЕ кликается, в INACTIVE_DRAWER_NODES)
├── drawer_2         ⛔ контейнер-нутро (НЕ кликается)
├── drawer_tl        ✅ фронт ящика (кликабелен) — верх-лево
├── drawer_tr        ✅ фронт ящика — верх-право
├── drawer_bl        ✅ фронт ящика — низ-лево
├── drawer_br        ✅ фронт ящика — низ-право
├── tabl_1..4        таблички (материалы prostranstva / avtorskie_m / project_M / about)
└── Beck_W, modul, leg_*, glases_* …  (декор/каркас)
```

> **Важно:** рабочие ящики — это 4 отдельных mesh-фронта `drawer_tl/tr/bl/br` (прямые дети `shkaf`).
> `drawer_1` / `drawer_2` — большие контейнеры-нутро; они помечены неактивными и не участвуют в кликах.

---

## 5. Разделы и навигация (`sections.js`)

| section.id | тип | нода GLB (`SHKAF_NODE_MAP`) | табличка | label | route |
|---|---|---|---|---|---|
| `door_left`  | door   | `door_left`  | — | О компании | `/about` |
| `door_right` | door   | `door_right` | — | Контакты | `/contacts` |
| `drawer_tl`  | drawer | `drawer_tl`  | `tabl_1` (prostranstva) | Частные пространства | `/private-spaces` |
| `drawer_tr`  | drawer | `drawer_tr`  | `tabl_2` (avtorskie_m)  | Коммерческие проекты | `/commercial-projects` |
| `drawer_bl`  | drawer | `drawer_bl`  | `tabl_3` (project_M)    | Авторские коллекции | `/author-collections` |
| `drawer_br`  | drawer | `drawer_br`  | `tabl_4` (about)        | О нас | `/about` |

- **Маппинг 1:1** — каждый section-ящик → своя нода GLB, анимируется сама.
- Двери (`type: 'door'`) сейчас **только открывают/закрывают шкаф**, не ведут на роут.
- Добавить раздел = строка в `sections.js` + нода в `SHKAF_NODE_MAP` + (опц.) `DRAWER_TABL_NODES`.

---

## 6. Логика взаимодействия (`Shkaf.jsx`)

Всё крутится вокруг стора `shkafStore` (`doorsOpen`, `animating`, `activeDrawerId`).

**Клик по сцене** (`handleClick`):
1. Отсекается «клик-как-перетаскивание» по порогу: **5 px** desktop / **14 px** mobile.
2. **Desktop:** на `pointerdown` (только ЛКМ) orbit блокируется (`controls.enabled = false`), чтобы клик по шкафу не крутил камеру. ПКМ/wheel не трогаем (pan/zoom).
3. **Mobile (touch):** orbit **не блокируется** — один палец крутит камеру поверх шкафа; тап с малым сдвигом открывает/закрывает двери.
4. Если **двери открыты** и нет активной анимации → пробуем распознать ящик:
   - `findDrawerNodeFromHit(event.object)` → нода `drawer_tl/tr/bl/br` для анимации.
   - `findDrawerSectionFromHit(event.object)` → section (учитывает клик по табличке/материалу плашки).
   - если найдены — `handleDrawerClick`: GSAP выдвигает ящик по локальной оси Z на `DRAWER_PULL_DISTANCE`, затем через `NAVIGATE_DELAY_MS` вызывает `navigate(route)`.
5. Иначе → `toggleDoors()` (открыть/закрыть).

**Наведение** (`handlePointerOver`): при открытых дверях — подсветка ящика (emissive) + лёгкое «покачивание» GSAP (`applyDrawerHover`). Таблички от подсветки исключены.

**Двери** (`animateDoors`): GSAP-таймлайн, поворот `door_left`/`door_right` по оси Y на `DOOR_LEFT/RIGHT_OPEN_ANGLE`.
- При загрузке `door_right` сбрасывается к закрытому положению левой двери — в GLB у неё бывает запечённый поворот ~π по Y (иначе грузится открытой).

**Подготовка сцены** (`finalizeShkafSceneGraph`):
- ноды `drawer_1`/`drawer_2` (из `INACTIVE_DRAWER_NODES`) → `raycast = () => null` (не кликаются).
- таблички `tabl_1..4` привязываются (`attach`) к своим фронтам-ящикам, кастят/принимают тени.

### Ключевые функции `drawerHit.js`

| Функция | Что делает |
|---|---|
| `findSectionIdFromHit(obj)` | идёт вверх по дереву: нода ящика → section, либо `tabl_*` → section, либо материал плашки (`PLAQUE_MATERIAL_TO_SECTION`) |
| `findDrawerNodeFromHit(obj)` | возвращает саму ноду ящика (`drawer_tl/tr/bl/br`) для GSAP-выдвижения |
| `findDrawerSectionFromHit(obj)` | возвращает объект section (id/label/route) |

---

## 7. Анимации (`constants/shkaf.js`)

| Константа | Значение | Смысл |
|---|---|---|
| `DOOR_ROTATION_AXIS` | `'y'` | ось поворота дверей |
| `DOOR_OPEN_ANGLE` | 120° | угол распахивания |
| `DOOR_LEFT_OPEN_ANGLE` / `_RIGHT_` | −120° / +120° | влево / вправо |
| `DOOR_OPEN_DURATION` | 0.8 c | длительность открытия |
| `DRAWER_PULL_DISTANCE` | 0.4 | насколько выдвигается ящик |
| `DRAWER_OPEN_DURATION` | 0.6 c | длительность выдвижения |
| `NAVIGATE_DELAY_MS` | 400 | пауза перед переходом на роут |
| `DESKTOP_SCALE` / `MOBILE_SCALE` | 1 / 0.75 | масштаб сцены |

---

## 8. Сцена и рендер (`Scene.jsx` + `studioScene.js`)

- **Canvas**: тени вкл, `dpr` из perf-тира, ACES tone mapping.
- **Камера**: `PerspectiveCamera` + `OrbitControls` с ограничениями из `STUDIO.camera`/`orbit` (desktop) или `STUDIO_MOBILE` (<768px).
- **Orbit limits**: `StudioOrbitLimits` clamp'ит pan-target и высоту камеры (`orbit.panLimits`). Max zoom out = дистанция стартового кадра (`getStudioCameraStartDistance`, ~6.55 desktop / ~7.45 mobile).
- **Pan**: desktop — `enablePan: true` (ПКМ); mobile — `enablePan: false`, touch ONE=rotate, TWO=pinch zoom.
- **`DEBUG_LOG_CAMERA_POSITION`**: `false` (лог каждый кадр лагал orbit).
- **Свет**: `StudioLights` (RectArea key/fill/rim) + `StudioShadowLight` (directional для тени). Есть разделение слоёв: двери — layer 0, корпус — layer 1 (`shkafLightLayers.js`, `getEffectiveSplitCorpusLight`).
- **Окружение**: `StudioEnvironment` (IBL), `StudioBackdrop` (стена), `StudioHorizon` (подложка).
- **Пол удалён** — компонент `StudioFloor` и плиточная модель больше не используются (был `StudioFloor.jsx`).
- **Контактная тень**: `<ContactShadows>` под шкафом.
- **Постобработка**: `EffectComposer` → N8AO / Bloom / Noise / Vignette / BrightnessContrast / HueSaturation (набор зависит от perf-тира).

### Perf-тиры (`STUDIO_PERFORMANCE`)

Выбор тира: `useStudioPerformance` → `?perf=low|medium|high` в URL > `forceTier` > авто (mobile/слабое железо → low) > `defaultTier`.

- **Сейчас `forceTier: 'medium'`** и `defaultTier: 'medium'` — сознательно, ради стабильности на слабых/AMD GPU.
- `medium`: `dpr [1, 1.75]`, antialias, `multisampling: 4`, bloom, **без** N8AO/normalPass/шума, тени 1024.
- `high`: добавляет N8AO + normalPass + noise + multisampling 2 — **вызывал `WebGL context lost`** на этом железе, поэтому не форсится.

> Если ловите «WebGL context lost» — вернитесь на `medium`/`low` или добавьте `?perf=low` к URL. Полностью перезагрузите вкладку (контекст не восстанавливается сам).

---

## 8.1. Hero-look (стиль adidas CHILE20)

Драматичная тёмная подача главного экрана. Включается флагом `USE_HERO_LOOK` в `studioScene.js`, все параметры — в объекте `HERO` там же.

| Элемент | Компонент | Что делает |
|---|---|---|
| Лайтбокс-стена | `HeroBackdrop.jsx` | широкая светящаяся молочная панель за шкафом (шейдер, `toneMapped=false` → светится через Bloom). Высота `HERO.lightbox.height`, ширина `~3 шкафа`. |
| Рассеянный свет | `HeroBackdrop.jsx` | `rectAreaLight` от лайтбокса на шкаф (мягкая диффузная заливка) + точечный ободок сверху-сзади. Оба на слоях `doors`+`corpus`. |
| Логотип 3D | `HeroLogo.jsx` | ExtrudeGeometry из SVG на лайтбоксе. Рендерится **только после** `loadingDone` (чтобы не дублировать HTML-прелоад). |
| HTML-прелоад | `LoadingOverlay.jsx` | монограмма `public/assets/russo-mark.svg`, shimmer, float, progress ≥6–7.5 с, GSAP-улёт в top-right → `setLoadingDone()`. |
| Уголок | `CornerLogo.jsx` | 36/48 px монограмма на всех страницах (`App.jsx`) после загрузки. |
| Отражающий пол | `ReflectiveFloor.jsx` | тёмный глянец на `MeshReflectorMaterial` (drei) — отражает шкаф и лайтбокс. Под hero-look заменяет `StudioHorizon`. |
| Въезд камеры | `CameraIntro.jsx` | **выключен** (`CAMERA_INTRO.enabled = false`) — старт сразу из `STUDIO.camera`. |

**Как включить/выключить:** `USE_HERO_LOOK = true/false`. При `false` возвращается обычная студия (`StudioHorizon` вместо отражающего пола, обычный фон).

> ⚠️ **Производительность:** `MeshReflectorMaterial` делает доп. проход рендера — на слабых/AMD GPU повышает риск `WebGL context lost`. Если падает — снизить `HERO.floor.resolution` (512 → 256) и упростить `blur`.

### Временный отладочный свет: `HERO_LIGHTBOX_ONLY`

Флаг в `studioScene.js` рядом с `USE_HERO_LOOK`. При `true` (сейчас **включён**) в hero-режиме остаётся **только свет лайтбокса**:

- горят: `LightboxPanel` (светящаяся стена) + `FillAreaLight` (рассеянный от неё) + `RimLight` (ободок);
- гасятся: `StudioLights` (key/rim/fill/beresta/corpus), `StudioShadowLight`, IBL (`StudioEnvironment`).

Реализация: константа `lightboxOnly = USE_HERO_LOOK && HERO_LIGHTBOX_ONLY` в `Scene.jsx` — условно снимает лишние источники. `false` — вернуть весь свет сцены.

---

## 8.3. Внутренний свет шкафа (`Shkaf.jsx`)

Загорается **только при открытых дверях** (`doorsOpen ? intensity : 0`). Все источники светят на **оба слоя** (двери + корпус) через `enableBothLightLayers` — иначе медь внутри (layer 1) оставалась тёмной, а белая береста (layer 0) пересвечивалась.

| Группа | Компонент | Тип | Куда | Intensity |
|---|---|---|---|---|
| Верхний акцент (3 шт) | `InteriorSpot` (`INTERIOR_LIGHTS`) | spotLight | с потолка вниз, широкий мягкий конус; центральный кастит тень | 0.55 |
| Заполнение (2 шт) | `InteriorFill` (`INTERIOR_FILLS`) | pointLight (омни) | у **задней стенки** (`z = center.z − size.z*0.2`), выше/ниже центра — заливает интерьер, не жжёт переднюю полку | 3.4 |
| Ящики (2 шт) | `InteriorSpot` (`DRAWER_SPOTS`) | spotLight | спереди-сверху (в плоскости открытых дверей) на **лицевые** панели: нижние 4 плашки + средние 2 ящика | 3.0 / 2.6 |

> Логика: fill стоят сзади (омни у поверхности = горячий диск, поэтому убраны от передней полки), а лицевые грани ящиков смотрят наружу — их добивают фронтальные `DRAWER_SPOTS`. Тюнинг интенсивностей — прямо в `Shkaf.jsx` рядом с массивами.

---

## 8.2. Логотип: почему SVG превратился в PNG низкого разрешения

Это важно для качества знака на лайтбоксе.

- **SVG — вектор.** Хранит не пиксели, а математику (пути, кривые, заливки). Масштабируется до любого размера **без потери чёткости** — браузер рисует его заново под нужный размер.
- **PNG — растр.** Это фиксированная сетка пикселей. Разрешение «запекается» в момент экспорта. Увеличение маленького PNG = интерполяция соседних пикселей → **размытие/лесенка**.
- **Что произошло:** исходный логотип был векторным (SVG), но в чат/на диск он попал уже как **растровый PNG 150×150** (превью-рендер). three.js грузит текстуру именно из этого PNG. Когда мы растягиваем 150 px на плоскость шириной ~4 м в сцене — пикселей не хватает, отсюда мыло.
- **Как сделать чётко (варианты):**
  1. **Дать исходный SVG** → экспортировать в PNG большого размера (напр. 2048×2048) → положить в `public/images/`. Простой и надёжный путь.
  2. **Рендерить SVG в текстуру** на лету (canvas/`Image` → `CanvasTexture`) — крипче, но сложнее.
  3. **`SVGLoader` (three.js)** — строить геометрию прямо из путей SVG: бесконечно чёткий вектор, но нужно возиться с экструзией/материалом.

**Текущее решение:** `public/images/russo-logo.png` — чёрный горизонтальный логотип (монограмма + РУССО) из брендбука, **2481×2481** (вариант «лого-03»). Исходники бренда лежат в `C:\Users\SIMPSONS\Downloads\Руссо лого` (AI/CDR/PDF/SVG/PNG/JPG, 15 вариантов: полный локап, только шрифт, только монограмма — в золоте/чёрном/белом).

Шейдер `HeroLogo.jsx` инвертирует яркость в альфу, поэтому источник — чёрные формы на белом фоне (белый → прозрачный). Знак центрирован в квадрате с запасом; плоскость квадратная (`HERO.logo.size`), лишние поля прозрачны.

Замена логотипа: положить новый файл в `public/images/`, обновить `HERO.logo.src` (и при нужде `size`/`position`).

---

## 9. Материалы (кратко)

- `USE_RAW_GLB_MATERIALS = true` → материалы берутся из GLB + `applyRawMaterialPipeline` (управляется `USE_MATERIAL_FIXUPS`).
- **Береста**: раздельные профили по имени материала (`BERESTA_MATERIAL_PROFILES`) — двери / нутро ящиков / задняя стенка не смешиваются.
  - **Рельеф берёсты дверей** (`M_Beresta_Final.001`): глубина вынесена в `BERESTA_PBR.normalScale` (сейчас **1.9**) и `bumpScale` (**0.05**). Раньше нормаль была зажата в `(1,1)` + слабый bump → «плоско vs Blender». Крутить рельеф — в `BERESTA_PBR`; `normalScale` применяется в `tuneBerestaDoorMaterial` (`materialFixups.js`).
- **Патина дверей**: текстуры грузятся в `patinaTextures.js` (при не-raw пути) либо берутся из GLB.
- **Медь/латунь/корпус**: профили в `CORPUS_PBR`, каппинг specular и envMapIntensity (`materialFixups.js`).

---

## 10. Частые задачи (где править)

| Задача | Файл(ы) |
|---|---|
| Поменять роут/лейбл раздела | `constants/sections.js` |
| Переименовали ноду в Blender | `constants/shkafNodes.js` (`SHKAF_NODE_MAP`) + поднять `SHKAF_MODEL_VERSION` |
| Другой угол/скорость дверей и ящиков | `constants/shkaf.js` |
| Проблема с кликом по ящику | `utils/drawerHit.js` + `finalizeShkafSceneGraph` в `Shkaf.jsx` |
| Качество/производительность/падения GPU | `constants/studioScene.js` (`STUDIO_PERFORMANCE`) |
| Свет / тени | `StudioLights.jsx`, `StudioShadowLight.jsx`, `STUDIO.lights` |
| Цвет/блеск материалов | `utils/materialFixups.js`, `CORPUS_PBR`, `BERESTA_*` |
| Orbit / камера / mobile | `constants/studioScene.js` (`STUDIO`, `STUDIO_MOBILE`, `getStudio*`), `Scene.jsx` |
| Прелоад / монограмма | `LoadingOverlay.jsx`, `CornerLogo.jsx`, `appStore.js` |
| Фон/подложка | `StudioBackdrop.jsx`, `StudioHorizon.jsx`, `HeroBackdrop.jsx` |
| Ножки GLB | `utils/attachGlbLegs.js`, `Shkaf.jsx` |

---

## 11. Известные нюансы

- **`README.md` устарел** (описывает несуществующий backend, старые имена `drawer_1..5`, компоненты `Door.jsx`/`Drawer.jsx`). Ориентируйтесь на этот файл.
- `door_right` в GLB может грузиться «открытой» из-за запечённого поворота — сбрасывается в `Shkaf.jsx`.
- HMR при удалении файлов иногда падает промежуточной ошибкой — помогает полная перезагрузка вкладки.
- Кэш модели: после изменения GLB **обязательно** поднимать `SHKAF_MODEL_VERSION`, иначе браузер отдаёт старую версию.
- **Safe area**: `index.html` → `viewport-fit=cover`; CSS-переменные `--safe-*` в `index.css` для notch/home indicator.
- **Ножки:** не сбрасывать `GLB_LEG_TRANSFORMS` в `[0,0,-0.0192]` — иначе ножки отъедут от корпуса.

---

## 12. Mobile (<768px, `useIsMobile`)

| Область | Что сделано |
|---|---|
| Камера / orbit | `STUDIO_MOBILE`: FOV 40°, дальше камера, уже azimuth, `enablePan: false`, `rotateSpeed`/`zoomSpeed` ниже |
| Canvas | `touch-action: none`, `100dvh`, `MOBILE_SCALE = 0.75` |
| Shkaf | touch не блокирует orbit; drag-порог 14 px |
| LoadingOverlay | лого ~240px, min show 6 с, safe-area при улёте в угол |
| CornerLogo / Header | меньше размер, отступы через `--safe-top/bottom` |

---

## 13. В планах: портфолио (gradientslider)

Разделы `/private-spaces`, `/commercial-projects`, `/author-collections` — пока **StubPage**.

**План v1** (ещё не в коде):
- React-порт [gradientslider](https://github.com/clementgrellier/gradientslider) — 3D-карусель фото + reactive gradient background.
- Data layer `portfolioProjects.js`: проекты по категориям.
- Hub-страница раздела → `/category/:slug` с каруселью.
- Первые проекты от заказчика: **Соборная мечеть** (commercial), **кухня+гостиная Симферополь** (private); author — empty state.
- Ассеты: HEIC из zip → WebP в `public/assets/portfolio/` (скрипт конвертации).
