# Запекание Cycles → сайт

Файл сцены: `C:\Users\KiGi\Downloads\74-free-model-drawerblend-\premium_cabinet_photorealistic3.blend`  
Движок: Cycles, GPU. Видимых сеток: 79, около 1.41 млн граней.  
Дата старта: 2026-10-26.

Сайт не может получить картинку Cycles «копированием нод». glTF / GLB забирает только Principled BSDF и растры: Base Color, Roughness, Metallic, Normal, AO, Emissive. Шум, Color Ramp, Glass BSDF, Mix Shader и area-свет в браузер не едут. Честный перенос — запечь эти каналы и подставить их в тот же свет.

## Почему сейчас не совпадает с Cycles

| | Blender, то что на экране | Сайт сейчас |
|---|---|---|
| Тон | AgX, look `AgX - Medium High Contrast`, exposure **−0.85** | ACES Filmic, exposure **0.92** |
| Мир | Нода HDRI есть, картинка **не назначена**, сила фона 0.045 | Чужой `studio_small_08_2k.hdr` |
| Свет | 6 источников: Key 540 Вт, Fill 150, Rim 120/110, потолок 32, spot 10 | Те же area переписаны в `cabinetStudio.js` (`AREA_ENERGY_SCALE = 0.025`) плюс свой spot и N8AO |
| Финальные сэмплы | **4** (превью 1024, адаптив 0.012, OIDN) | — |
| Орех / кожа | Карты в материале | `finishCabinetWood` и веб-кожа перекрашивают поверх GLB |

Пока тон, HDR и перекрас в коде не совпадают с blend, новые карты сами по себе Cycles не повторят.

## Что запекаем

Свет запекаем. Не в альбедо.

Combined со всеми пассами (так сейчас включено в сцене: diffuse, glossy, transmission, emit, direct, indirect, color) кладёт блик в текстуру. На орбите камеры блик останется нарисованным. Этот режим не используем.

Две карты света:

1. **HDR студии, линейный.** Камера-панорама из центра шкафа, сам шкаф скрыт. В кадре циклорама, флаги, отражатели и area-свет. Это вид-зависимый блик металла и стекла. Формат HDR/EXR, без AgX (Raw, exposure 0). Иначе файл уже «проявлен» и на сайте зажмётся вторым тоном.
2. **Lightmap, UV2.** Cycles → Diffuse, только Direct + Indirect, **Color выключен**. Это тень, полутень и цветной отскок, без цвета дерева. В Three.js: `material.lightMap`, второй UV-канал. Формат EXR или 16-bit PNG, Non-Color. 8-bit PNG даст полосы в тени.

Плюс карты материала, где их ещё нет или они кривые:

| Канал | Тип bake | Color space | Куда в Principled |
|---|---|---|---|
| Base Color | Diffuse, только Color | sRGB | Base Color |
| Roughness | Roughness | Non-Color | Roughness |
| Metallic | Emit-трюк: сокет Metallic → Emission, bake Emit | Non-Color | Metallic |
| Normal | Normal, tangent, +Y (OpenGL, так glTF и Three) | Non-Color | Normal, strength 1 |
| AO | AO, distance 0.15 м | Non-Color | запас, если lightmap не закроет контакт |

Metallic в Cycles отдельной кнопки не имеет. Уже готовые ORM (двери, ручки, медальон, `texture_pbr_20250901*`) заново не печём — у них цвет, G=rough, B=metal, нормаль Non-Color.

## Настройки Cycles для запекания

Не трогаем превью (1024). На время bake:

- Device: GPU
- Samples: **256**, adaptive threshold **0.01**, denoise **OpenImageDenoise**
- Margin: **16 px**, type **EXTEND**
- Normal space: **TANGENT**, normal_r **POS_X** (OpenGL)
- Target: Image Textures, Clear включён
- Cage: выключен
- Selected to Active: выключен (печём каждый объект в свою карту, не с highpoly на lowpoly)
- View при сохранении карт света: **Raw**, exposure 0, gamma 1. AgX только для проверочного PNG, не для файла, который грузит сайт

Разрешение:

| Объект | Карта | Размер |
|---|---|---|
| HDR студии | окружение | 2048×1024, затем 4096×2048 если в металле мало блика |
| Корпус, двери-дерево, фасады ящиков | lightmap | 4096 |
| Панели дверей, ножки `node_0` | lightmap | 2048 |
| Медальон ножек | lightmap | 2048 (сетка 753k, рельеф в геометрии, карту не раздуваем) |
| Ручки, петли, кожа, прошивка | lightmap | 1024 |
| Бутылки / декантер, где нет PBR | материал | 1024 |

Орех (`Diffuse.jpg` + JPEG-нормаль + Color Ramp по `SpecularMap`) для сайта перепекается отдельно: Base Color, Roughness, Normal в PNG 2048, без Ramp. JPEG-нормаль — источник белых точек, в bake её не кладём.

## UV

- UV0 остаётся как сейчас: по ней лежат альбедо и нормаль. У ореха активная UV — `automap`, шейдер читает её. Её не перезаписываем.
- Новый слой **`Lightmap`**. Smart UV Project, угол 66°, island margin 0.02, без наложений. Свет на тайловую UV дерева печь нельзя: острова лежат друг на друге, тень одной доски попадёт на другую.
- У `medallion_plate` UV0 уже 0…1 и без тайлинга. Lightmap всё равно вторым слоем, чтобы не затереть патину.
- Без UV, свет туда не ляжет, пока не развернём: шурупы шильдика, `shelf_bronze_frame`, пробки бутылок.

## Что текстурой не лечится

- Стекло и жидкость (`GLASS`, `whisky`, Glass BSDF, Volume Absorption). Честно — Principled Transmission + IOR + объём, не bake. Combined bake стекла даст серую кашу.
- Блик area-света. Его несёт HDR студии, не lightmap.
- Тон AgX Medium High Contrast. Three r184 умеет `AgXToneMapping`, но look Blender «Medium High Contrast» — отдельная кривая. Её копируем экспозицией и контрастом после того, как карты стоят. Менять тон до карт нельзя: сцена уедет в чёрное, свет сайта подобран под ACES 0.92.
- `medallion_logo` спрятан и висит на z = 2.36 м. На ножках его нет, в запекание не берём.
- Сетка медальона 753k и панели дверей 308k / 133k. Карты их не облегчат. Это отдельный шаг после картинки.

## Порядок работы

1. HDR студии без шкафа. Линейный файл в `public/textures/cycles-bake/`.
2. UV `Lightmap` на видимых сетках шкафа и циклорамы.
3. Diffuse lightmap (direct+indirect, без color) по группам: медальон и ножки, корпус и двери, ящики и кожа, реквизит.
4. Перепечь орех: color / roughness / normal, PNG.
5. Процедурные металлы, у которых нет карт (`coffee_pot` на корпусе, петли плоским цветом, GOLD, PLASTIC): color, rough, metal, normal.
6. В коде, только когда файлы лежат на диске:
   - HDR студии вместо `studio_small_08_2k.hdr`
   - `lightMap` на UV2, realtime area выключить (иначе свет дважды)
   - N8AO снять или оставить едва: контакт уже в lightmap
   - `finishCabinetWood` не перекрашивает то, что запечено
   - тон ближе к AgX, exposure под линейный HDR
   - vite больше не выкидывает `textures/cycles-bake/`
7. Сверка: один и тот же кадр, камера `STUDIO_Camera` (58 мм, мир [1.37, −6.39, 2.44]) против скрина сайта.

Проверочный рендер Cycles для сверки: samples 256, не 4. Четвёрка сэмплов — это не та картинка.

## Лог

### 2026-10-26 — старт

Сцена не сохранялась. Материалы и UV не перетирались. Combined-пассы в настройках bake не использовались.

### 2026-10-26 — HDR студии, прогон 1

Запущен рендер панорамы: шкаф скрыт, камера `EQUIRECTANGULAR` в центре корпуса `(0, -0.16, 1.15)`, 2048×1024, 256 сэмплов, OIDN, файл HDR, цвет Raw / exposure 0. Выход: `public/textures/cycles-bake/studio_cycles_2k.hdr`.

Соединение с Blender оборвалось по таймауту, пока Cycles считал. Файл всё же записался, сцена вернулась: samples 4, камера `STUDIO_Camera`, шкаф снова в рендере.

`public/textures/cycles-bake/studio_cycles_2k.hdr` — 2 532 964 байт, 2048×1024. Это **не** линейный свет. По файлу max ≈ 0.33, mean ≈ 0.13, ни одного пикселя ярче 1. Софтбоксы 540 Вт в кадр не попали как источники. В файл ушла проявленная картинка (AgX, exposure −0.85), а не Raw. Для IBL на сайте её не подключать: металл станет серой дырой.

Повтор: на время рендера выставить `view_transform = Raw`, look None, exposure 0, потом вернуть AgX. Проверка — max по файлу должен быть сильно больше 1 (сами панели света).

Сразу после замера яркости связь с Blender оборвалась (`Not connected`). Линейный повтор и lightmap UV2 не запускались. Сцену этот замер не меняет: он только читал уже записанный HDR.

### 2026-10-26 — HDR студии, линейный

Первый «Raw» прогон дал побайтово тот же файл: HDR и так пишется без AgX. Темнота была не из тона. У всех шести источников `visible_camera = False`, панели света в панораму не попадали.

Повтор: те же 2048×1024, 128 сэмплов, OIDN, шкаф скрыт, на время кадра источникам включена видимость камере, потом флаги возвращены. Сэмплы сцены снова 4, вид снова AgX −0.85, камера `STUDIO_Camera`.

`public/textures/cycles-bake/studio_cycles_2k_raw.hdr` — 2 523 522 байт, 110.8 с. Линейный: max ≈ 180, mean ≈ 5.1, тысячи пикселей ярче 2. На кадре видны панели Key, Fill и оба Rim. Это блик софтбоксов, его можно ставить в окружение сайта. Старый `studio_cycles_2k.hdr` не использовать.

### 2026-10-26 — lightmap, первый проход

Cycles Diffuse, только Direct + Indirect, Color выключен. 64 сэмпла, OIDN, margin 16. Карта 2048, EXR, Non-Color. Новая UV `Lightmap` (Smart UV Project, margin 0.03), UV дерева `automap` осталась активной для шейдера.

Файлы в `public/textures/cycles-bake/lightmap/`, по ~50 МБ:

- `door_left_wood.exr`, `door_right_wood.exr`
- `drawer_1.exr`, `drawer_2.exr`
- `corpus_main.exr`, `back_wall.exr`
- `modul_drawer.exr`, `modul_drawer_back.exr`
- `drawer_leather_rim_top.exr`, `drawer_leather_rim_bot.exr`

Проверка без проявки: дверь max ≈ 9.2, mean ≈ 1.08; ящик max ≈ 2.3. Это свет, не чёрная карта.

Сэмплы сцены снова 4, bake type снова COMBINED. Blend сохранён, слой `Lightmap` в файле. Металл (медальон, петли) этим проходом не покрыт: у него диффуз почти ноль, блик берётся из HDR.

### 2026-10-26 — на сайт

EXR пережаты в HDR (`public/textures/cycles-bake/lm/`). Дверь после конвертации max ≈ 10.9, линейность сохранилась. Исходные EXR убраны из `public/` в `bake/lightmap-exr/`.

Новый `public/models/shkaf-cabinet.glb` (153 МБ, Draco), версия `62`. Старый файл: `shkaf-cabinet.pre-lightmap.glb`. В GLB у `door_left_wood` и `corpus_main` есть `TEXCOORD_2`, у задней стенки и кожи — `TEXCOORD_1`.

Код: `src/utils/cabinetLightmaps.js`, HDR студии в `CABINET_ENV` (intensity 0.12), `AREA_ENERGY_SCALE` 0.014. Vite и локальный деплой пропускают `textures/cycles-bake/lm/` и `studio_cycles_2k_raw.hdr`.
