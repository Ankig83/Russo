# РУССО — состояние кода для разработки

> Живой снимок того, **что работает, как и где**. Обновляй при изменении логики шкафа, сцены или навигации.
> Дата актуализации: 2026-07-07.
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
│   ├── Home.jsx                главная: <Scene/> + <Header/>, сброс стейта шкафа
│   ├── PrivateSpaces.jsx       /private-spaces        (заглушка)
│   ├── CommercialProjects.jsx  /commercial-projects   (заглушка)
│   ├── AuthorCollections.jsx   /author-collections    (заглушка)
│   ├── About.jsx, Contacts.jsx, Catalog.jsx, ...      (заглушки)
│   └── NotFound.jsx            404
│
├── components/
│   ├── 3d/
│   │   ├── Scene.jsx           ⭐ оркестратор Canvas: камера, свет, постобработка, perf-тиры
│   │   ├── Shkaf.jsx           ⭐ загрузка GLB, двери, ящики, клики, hover, навигация
│   │   ├── FitCamera.jsx       авто-подгон камеры под габариты шкафа
│   │   ├── StudioEnvironment.jsx  IBL/Environment (drei)
│   │   ├── StudioLights.jsx    RectArea key/fill/rim, разделение слоёв света
│   │   ├── StudioShadowLight.jsx  directional-свет для тени
│   │   ├── StudioBackdrop.jsx  фон-стена (процедурный градиент)
│   │   ├── StudioHorizon.jsx   мягкая подложка-градиент (в обычном режиме)
│   │   ├── HeroBackdrop.jsx    ⭐ hero-look: лайтбокс-стена + рассеянный fill/ободок
│   │   ├── HeroLogo.jsx        ⭐ hero-look: логотип РУССО на лайтбоксе
│   │   ├── ReflectiveFloor.jsx ⭐ hero-look: отражающий пол (MeshReflectorMaterial)
│   │   ├── CameraIntro.jsx     плавный въезд камеры на старте
│   │   ├── Loader.jsx          прелоадер
│   │   └── DrawerPlaque.jsx    @deprecated 2D-оверлей (таблички теперь в GLB)
│   └── ui/
│       ├── Header.jsx          логотип «РУССО» + меню
│       └── StubPage.jsx        шаблон страницы-заглушки
│
├── store/
│   └── shkafStore.js           zustand: doorsOpen, animating, activeDrawerId
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
│   ├── cabinetBounds.js        габариты/центр/позиционирование шкафа
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
1. Отсекается «клик-как-перетаскивание» по порогу `DRAG_THRESHOLD_PX` (5 px) — чтобы вращение орбитой не считалось кликом.
2. Если **двери открыты** и нет активной анимации → пробуем распознать ящик:
   - `findDrawerNodeFromHit(event.object)` → нода `drawer_tl/tr/bl/br` для анимации.
   - `findDrawerSectionFromHit(event.object)` → section (учитывает клик по табличке/материалу плашки).
   - если найдены — `handleDrawerClick`: GSAP выдвигает ящик по локальной оси Z на `DRAWER_PULL_DISTANCE`, затем через `NAVIGATE_DELAY_MS` вызывает `navigate(route)`.
3. Иначе → `toggleDoors()` (открыть/закрыть).

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
- **Камера**: `PerspectiveCamera` + `OrbitControls` с ограничениями углов/дистанции из `STUDIO.camera`/`orbit`.
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
| Логотип | `HeroLogo.jsx` | знак РУССО на лайтбоксе выше шкафа. Сейчас — плоский чёрный (без эффектов). Инвертирует яркость исходника в альфу (чёрные формы → непрозрачные, белый фон → прозрачный). |
| Отражающий пол | `ReflectiveFloor.jsx` | тёмный глянец на `MeshReflectorMaterial` (drei) — отражает шкаф и лайтбокс. Под hero-look заменяет `StudioHorizon`. |
| Въезд камеры | `CameraIntro.jsx` | на старте камера едет из `CAMERA_INTRO.from` в рабочую позицию (GSAP). |

**Как включить/выключить:** `USE_HERO_LOOK = true/false`. При `false` возвращается обычная студия (`StudioHorizon` вместо отражающего пола, обычный фон).

> ⚠️ **Производительность:** `MeshReflectorMaterial` делает доп. проход рендера — на слабых/AMD GPU повышает риск `WebGL context lost`. Если падает — снизить `HERO.floor.resolution` (512 → 256) и упростить `blur`.

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
| Фон/подложка | `StudioBackdrop.jsx`, `StudioHorizon.jsx` |

---

## 11. Известные нюансы

- **`README.md` устарел** (описывает несуществующий backend, старые имена `drawer_1..5`, компоненты `Door.jsx`/`Drawer.jsx`). Ориентируйтесь на этот файл.
- `door_right` в GLB может грузиться «открытой» из-за запечённого поворота — сбрасывается в `Shkaf.jsx`.
- HMR при удалении файлов иногда падает промежуточной ошибкой — помогает полная перезагрузка вкладки.
- Кэш модели: после изменения GLB **обязательно** поднимать `SHKAF_MODEL_VERSION`, иначе браузер отдаёт старую версию.
