# Blender 4.x — референсная студия Russo (тёмный фон + светлый пол + spot сверху)
#
# Как запустить:
#   1. Blender → Scripting → Open → этот файл → Run Script
#   2. Или: blender --python build_reference_studio.py
#
# Опционально: скачай с Poly Haven (2K ZIP):
#   пол  — https://polyhaven.com/a/concrete_floor_01
#   стена — https://polyhaven.com/a/concrete_wall_001 (или оставь однотонный тёмный)
# Распакуй в scripts/blender/textures/studio/ и укажи пути ниже.

import bpy
import math
import os
from mathutils import Vector

# ── пути к текстурам (оставь None — будет однотонный PBR) ──────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
TEXTURE_ROOT = os.path.join(SCRIPT_DIR, "textures", "studio")

FLOOR_COLOR_MAP = os.path.join(TEXTURE_ROOT, "concrete_floor_01_diff_2k.jpg")
FLOOR_NORMAL_MAP = os.path.join(TEXTURE_ROOT, "concrete_floor_01_nor_gl_2k.exr")
FLOOR_ROUGH_MAP = os.path.join(TEXTURE_ROOT, "concrete_floor_01_rough_2k.exr")

BACKDROP_COLOR_MAP = None  # тёмная стена без текстуры ближе к референсу
BACKDROP_NORMAL_MAP = None
BACKDROP_ROUGH_MAP = None

# ── размеры сцены (метры) ───────────────────────────────────────────────────
FLOOR_SIZE = 12.0          # сторона квадрата пола
BACKDROP_Z = -3.5          # стена сзади шкафа
BACKDROP_HEIGHT = 9.0
CYCLORAMA_RADIUS = 2.5     # радиус скругления пол→стена

# Spot как на референсе
SPOT_ENERGY = 1000.0       # Вт (Blender physical)
SPOT_ANGLE_DEG = 30.0
SPOT_BLEND = 0.18
SPOT_POS = (0.0, 4.2, 0.35)   # чуть спереди от центра
SPOT_TARGET = (0.0, 0.0, 0.0)

FILL_ENERGY = 120.0
FILL_POS = (2.5, 2.0, -2.0)

# Камера (ориентир для R3F / FitCamera)
CAMERA_POS = (0.0, 1.65, 4.8)
CAMERA_TARGET = (0.0, 1.15, 0.0)
CAMERA_FOCAL_MM = 55.0

# Имена объектов (контракт с docs/BLENDER_R3F_PIPELINE.md)
NAMES = {
    "root": "studio_root",
    "floor": "studio_floor",
    "backdrop": "studio_backdrop",
    "anchor": "shkaf_anchor",
    "lights": "lights_rig",
    "spot": "light_spot_main",
    "fill": "light_fill",
    "camera": "camera_anchor",
}


def _clear_previous():
    """Удалить старую студию с теми же именами."""
    for name in NAMES.values():
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)


def _link_to(parent, child):
    if parent:
        child.parent = parent
        child.matrix_parent_inverse = parent.matrix_world.inverted()


def _make_empty(name, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.4
    obj.location = location
    bpy.context.collection.objects.link(obj)
    return obj


def _load_image(path, colorspace="sRGB"):
    if not path or not os.path.isfile(path):
        return None
    img = bpy.data.images.load(path, check_existing=True)
    img.colorspace_settings.name = colorspace
    return img


def _make_principled_material(name, base_color, roughness=0.7, metallic=0.0,
                              color_map=None, normal_map=None, rough_map=None):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = (*base_color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic

    last_color = bsdf.inputs["Base Color"]

    if color_map:
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = color_map
        tex.location = (-500, 200)
        mapping = nodes.new("ShaderNodeMapping")
        mapping.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
        coord = nodes.new("ShaderNodeTexCoord")
        links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
        links.new(mapping.outputs["Vector"], tex.inputs["Vector"])
        links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
        last_color = tex.outputs["Color"]

    if normal_map:
        tex_n = nodes.new("ShaderNodeTexImage")
        tex_n.image = normal_map
        tex_n.location = (-500, -100)
        tex_n.image.colorspace_settings.name = "Non-Color"
        normal = nodes.new("ShaderNodeNormalMap")
        normal.location = (-200, -100)
        if color_map:
            mapping = nodes.new("ShaderNodeMapping")
            mapping.inputs["Scale"].default_value = (2.0, 2.0, 2.0)
            coord = nodes.new("ShaderNodeTexCoord")
            links.new(coord.outputs["Generated"], mapping.inputs["Vector"])
            links.new(mapping.outputs["Vector"], tex_n.inputs["Vector"])
        links.new(tex_n.outputs["Color"], normal.inputs["Color"])
        links.new(normal.outputs["Normal"], bsdf.inputs["Normal"])

    if rough_map:
        tex_r = nodes.new("ShaderNodeTexImage")
        tex_r.image = rough_map
        tex_r.location = (-500, -300)
        tex_r.image.colorspace_settings.name = "Non-Color"
        links.new(tex_r.outputs["Color"], bsdf.inputs["Roughness"])

    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def _make_cyclorama_mesh(name, floor_half, backdrop_z, height, radius):
    """
    Пол + задняя стена со скруглением (циклорама).
    Верх пола на Y=0, стена уходит вверх по -Z.
    """
    segments_x = 48
    segments_z = 32
    verts = []
    faces = []

    x0, x1 = -floor_half, floor_half
    z_floor = backdrop_z + radius
    z_wall = backdrop_z

    for iz in range(segments_z + 1):
        t = iz / segments_z
        for ix in range(segments_x + 1):
            u = ix / segments_x
            x = x0 + (x1 - x0) * u

            if t <= 0.55:
                # пол
                floor_t = t / 0.55
                z = z_floor + (0.0 - z_floor) * floor_t
                y = 0.0
            else:
                # стена + скругление у основания
                wall_t = (t - 0.55) / 0.45
                if wall_t < 0.12:
                    # дуга циклорамы
                    arc_t = wall_t / 0.12
                    angle = arc_t * math.pi * 0.5
                    y = radius * math.sin(angle)
                    z = z_wall + radius * (1.0 - math.cos(angle))
                else:
                    h_t = (wall_t - 0.12) / 0.88
                    y = radius + (height - radius) * h_t
                    z = z_wall

            verts.append((x, y, z))

    row = segments_x + 1
    for iz in range(segments_z):
        for ix in range(segments_x):
            i0 = iz * row + ix
            i1 = i0 + 1
            i2 = i0 + row + 1
            i3 = i0 + row
            faces.append((i0, i1, i3, i2))

    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    mesh.calc_normals()

    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return obj


def _add_floor_plane(name, size):
    """Плоский пол (проще для теней в glTF). Верх на Y=0."""
    bpy.ops.mesh.primitive_plane_add(size=size, location=(0, 0, 0))
    obj = bpy.context.active_object
    obj.name = name
    obj.rotation_euler = (0, 0, 0)
    # Plane по умолчанию в XY; в Blender Z-up... wait Blender 3+ uses Z-up by default?
    # Actually Blender uses Z-up. But glTF export uses Y-up.
    # The pipeline doc says Y-up for glTF. Blender default is Z-up.
    # Plane in Blender lies on X-Y plane (Z=0). For glTF Y-up, floor should be X-Z plane Y=0.
    # Rotate plane to be horizontal in Y-up terms: rotate X 90° so normal is +Y
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(rotation=True)
    return obj


def _add_backdrop_wall(name, z, height, width):
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, height * 0.5, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (width * 0.5, height * 0.5, 1)
    obj.rotation_euler = (math.radians(90), 0, 0)
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    return obj


def _point_light_at(light_obj, target):
    direction = Vector(target) - light_obj.location
    light_obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def build_studio(use_cyclorama=False):
    _clear_previous()

    # Cycles для превью (экспорт не зависит)
    bpy.context.scene.render.engine = "CYCLES"
    if bpy.context.preferences.addons.get("cycles"):
        prefs = bpy.context.preferences.addons["cycles"].preferences
        prefs.compute_device_type = "CUDA" if "CUDA" in prefs.get_device_types(bpy.context) else "OPTIX"
        for device in prefs.devices:
            device.use = True
        bpy.context.scene.cycles.device = "GPU"

    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0

    root = _make_empty(NAMES["root"], (0, 0, 0))
    anchor = _make_empty(NAMES["anchor"], (0, 0, 0))
    lights = _make_empty(NAMES["lights"], (0, 0, 0))

    _link_to(root, anchor)
    _link_to(root, lights)

    # ── геометрия ──────────────────────────────────────────────────────────
    if use_cyclorama:
        floor = _make_cyclorama_mesh(
            NAMES["floor"],
            FLOOR_SIZE * 0.5,
            BACKDROP_Z,
            BACKDROP_HEIGHT,
            CYCLORAMA_RADIUS,
        )
    else:
        floor = _add_floor_plane(NAMES["floor"], FLOOR_SIZE)
        backdrop = _add_backdrop_wall(
            NAMES["backdrop"],
            BACKDROP_Z,
            BACKDROP_HEIGHT,
            FLOOR_SIZE,
        )
        _link_to(root, backdrop)

    _link_to(root, floor)

    # Custom property для R3F
    floor["floor_y"] = 0.0

    # ── материалы ───────────────────────────────────────────────────────────
    floor_color = _load_image(FLOOR_COLOR_MAP, "sRGB")
    floor_normal = _load_image(FLOOR_NORMAL_MAP, "Non-Color")
    floor_rough = _load_image(FLOOR_ROUGH_MAP, "Non-Color")

    mat_floor = _make_principled_material(
        "mat_studio_floor",
        base_color=(0.72, 0.72, 0.74),
        roughness=0.78,
        metallic=0.0,
        color_map=floor_color,
        normal_map=floor_normal,
        rough_map=floor_rough,
    )
    floor.data.materials.append(mat_floor)

    if not use_cyclorama:
        bd_color = _load_image(BACKDROP_COLOR_MAP, "sRGB") if BACKDROP_COLOR_MAP else None
        mat_backdrop = _make_principled_material(
            "mat_studio_backdrop",
            base_color=(0.07, 0.07, 0.09),
            roughness=0.92,
            metallic=0.0,
            color_map=bd_color,
        )
        backdrop.data.materials.append(mat_backdrop)

    # ── свет ─────────────────────────────────────────────────────────────────
    spot_data = bpy.data.lights.new(NAMES["spot"], type="SPOT")
    spot_data.energy = SPOT_ENERGY
    spot_data.spot_size = math.radians(SPOT_ANGLE_DEG)
    spot_data.spot_blend = SPOT_BLEND
    spot_data.use_shadow = True
    spot_data.shadow_soft_size = 0.05

    spot = bpy.data.objects.new(NAMES["spot"], spot_data)
    spot.location = SPOT_POS
    bpy.context.collection.objects.link(spot)
    _link_to(lights, spot)
    _point_light_at(spot, SPOT_TARGET)

    fill_data = bpy.data.lights.new(NAMES["fill"], type="AREA")
    fill_data.energy = FILL_ENERGY
    fill_data.shape = "RECTANGLE"
    fill_data.size = 2.5
    fill_data.size_y = 1.8
    fill_data.use_shadow = False

    fill = bpy.data.objects.new(NAMES["fill"], fill_data)
    fill.location = FILL_POS
    bpy.context.collection.objects.link(fill)
    _link_to(lights, fill)
    _point_light_at(fill, (0, 1.0, 0))

    # ── камера ───────────────────────────────────────────────────────────────
    cam_data = bpy.data.cameras.new(NAMES["camera"])
    cam_data.lens = CAMERA_FOCAL_MM
    cam_data.clip_start = 0.1
    cam_data.clip_end = 100.0

    cam = bpy.data.objects.new(NAMES["camera"], cam_data)
    cam.location = CAMERA_POS
    bpy.context.collection.objects.link(cam)
    _link_to(root, cam)
    _point_light_at(cam, CAMERA_TARGET)

    bpy.context.scene.camera = cam

    # World — тёмный (без HDRI, как референс)
    world = bpy.context.scene.world
    if world is None:
        world = bpy.data.worlds.new("World")
        bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.02, 0.02, 0.025, 1.0)
        bg.inputs["Strength"].default_value = 0.15

    # Выделить root для экспорта
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    bpy.context.view_layer.objects.active = root

    print("=" * 60)
    print("Russo reference studio создана.")
    print(f"  Корень: {NAMES['root']}")
    print(f"  Якорь шкафа: {NAMES['anchor']} — поставь сюда shkaf (ножки на Y=0)")
    print(f"  Камера: {NAMES['camera']} — Numpad 0 для превью")
    print()
    print("Дальше:")
    print("  1. File → Import → glTF → shkaf.glb, parent к shkaf_anchor")
    print("  2. Подкрути spot / камеру под референс")
    print("  3. File → Export → glTF 2.0 → studio.glb (Selected: studio_root)")
    print("     ✓ Lights, Cameras, Custom Properties, Apply Transform")
    if not floor_color:
        print()
        print("Текстуры пола не найдены — однотонный серый.")
        print(f"  Положи карты в: {TEXTURE_ROOT}")
        print("  https://polyhaven.com/a/concrete_floor_01 (2K JPG/EXR)")
    print("=" * 60)


if __name__ == "__main__":
    # use_cyclorama=True — циклорама; False — плоский пол + стена (лучше для web-теней)
    build_studio(use_cyclorama=False)
