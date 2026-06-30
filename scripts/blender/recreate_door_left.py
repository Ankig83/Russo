# Blender 4.x — пересоздать каркас door_left: ровный бокс + плавный bevel
#
# door_left — объект с mesh (каркас), к нему привязаны дочерние детали.
# Скрипт заменяет только геометрию каркаса, origin / parent / дети не трогает.
#
# Запуск: shkaf.glb или door_left уже в сцене → Run Script

import bpy
import bmesh
from mathutils import Vector
from pathlib import Path

TARGET = "door_left"

# 0 = авто (~4.5% от меньшей стороны)
BEVEL_RADIUS = 0.0
BEVEL_SEGMENTS = 10
BEVEL_PROFILE = 0.7


def _view3d_override():
    for win in bpy.context.window_manager.windows:
        for area in win.screen.areas:
            if area.type != "VIEW_3D":
                continue
            for region in area.regions:
                if region.type == "WINDOW":
                    return {
                        "window": win,
                        "screen": win.screen,
                        "area": area,
                        "region": region,
                        "scene": bpy.context.scene,
                        "view_layer": bpy.context.view_layer,
                    }
    return None


def _import_glb_if_needed():
    if bpy.data.objects.get(TARGET):
        return
    glb = bpy.path.abspath("//shkaf.glb")
    if not glb or not Path(glb).is_file():
        raise RuntimeError(
            f"Объект «{TARGET}» не найден. Положите shkaf.glb рядом с .blend и сохраните файл."
        )
    override = _view3d_override()
    if override is None:
        raise RuntimeError("Откройте окно 3D Viewport.")
    with bpy.context.temp_override(**override):
        if hasattr(bpy.ops.wm, "gltf_import"):
            bpy.ops.wm.gltf_import(filepath=glb)
        else:
            bpy.ops.import_scene.gltf(filepath=glb)


def _get_carcass_object(name: str):
    obj = bpy.data.objects.get(name)
    if obj is None:
        raise RuntimeError(f"Объект «{name}» не найден в сцене.")

    if obj.type == "MESH" and obj.data and len(obj.data.vertices) > 0:
        return obj

    for child in obj.children:
        if child.type == "MESH" and child.name == name and child.data and len(child.data.vertices) > 0:
            return child

    raise RuntimeError(
        f"«{name}» не содержит mesh-каркас. Ожидается MESH на объекте или дочернем «{name}»."
    )


def _local_bbox(obj):
    coords = [Vector(v.co) for v in obj.data.vertices]
    min_c = Vector((min(v.x for v in coords), min(v.y for v in coords), min(v.z for v in coords)))
    max_c = Vector((max(v.x for v in coords), max(v.y for v in coords), max(v.z for v in coords)))
    size = max_c - min_c
    center = (min_c + max_c) * 0.5
    return min_c, max_c, size, center


def _auto_bevel(size: Vector) -> float:
    return max(min(size.x, size.y, size.z) * 0.045, 0.012)


def _create_rounded_box(size: Vector, center: Vector, bevel: float) -> bpy.types.Mesh:
    sx, sy, sz = size.x, size.y, size.z
    if min(sx, sy, sz) <= 0:
        raise RuntimeError("Нулевой размер bbox — проверьте объект door_left.")

    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, verts=bm.verts, vec=(sx, sy, sz))

    max_bevel = min(sx, sy, sz) * 0.45
    bevel = min(bevel, max_bevel)

    if bevel > 1e-6:
        bmesh.ops.bevel(
            bm,
            geom=list(bm.edges),
            offset=bevel,
            segments=BEVEL_SEGMENTS,
            profile=BEVEL_PROFILE,
            affect="EDGES",
            clamp_overlap=True,
        )

    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)

    mesh = bpy.data.meshes.new(f"{TARGET}_clean")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()

    for v in mesh.vertices:
        v.co += center

    return mesh


def main():
    _import_glb_if_needed()
    obj = _get_carcass_object(TARGET)

    old_mesh = obj.data
    old_materials = [slot.material for slot in obj.material_slots]
    if not old_materials and old_mesh.materials:
        old_materials = list(old_mesh.materials)

    _, _, size, center = _local_bbox(obj)
    bevel = BEVEL_RADIUS if BEVEL_RADIUS > 0 else _auto_bevel(size)

    new_mesh = _create_rounded_box(size, center, bevel)
    obj.data = new_mesh

    if old_materials:
        obj.data.materials.clear()
        for mat in old_materials:
            obj.data.materials.append(mat)

    if old_mesh.users == 0:
        bpy.data.meshes.remove(old_mesh)

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    print(
        f"OK: «{TARGET}» — каркас {size.x:.4f} × {size.y:.4f} × {size.z:.4f} m, "
        f"bevel {bevel:.4f} m, verts {len(new_mesh.vertices)}"
    )


main()
