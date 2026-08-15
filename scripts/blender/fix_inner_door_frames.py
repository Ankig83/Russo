"""
Bevel Cube / Cube.001 inside restored site hierarchy.
Export shkaf empty + both Cubes so child local TRS stays valid for merge.
"""
import bpy
import bmesh
import math
import json
from mathutils import Vector

SRC = r"D:\Temp\shkaf-v54-decomp.glb"
OUT_GLB = r"D:\PycharmProjects\Russo\public\models\inner-door-frames.glb"
OUT_META = r"D:\Temp\inner_door_frames_meta.json"
LEFT = "Cube"
RIGHT = "Cube.001"
BEVEL_WIDTH = 0.0035
BEVEL_SEGMENTS = 3


def log(msg):
    print(msg, flush=True)


def world_aabb(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        "center": [
            round((min(xs) + max(xs)) * 0.5, 4),
            round((min(ys) + max(ys)) * 0.5, 4),
            round((min(zs) + max(zs)) * 0.5, 4),
        ],
    }


def snapshot(obj):
    return {
        "name": obj.name,
        "loc": [round(v, 6) for v in obj.location],
        "rot": [round(v, 6) for v in obj.rotation_euler],
        "scale": [round(v, 6) for v in obj.scale],
        "aabb": world_aabb(obj),
        "verts": len(obj.data.vertices),
        "parent": obj.parent.name if obj.parent else None,
    }


def apply_scale_only(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.hide_set(False)
    obj.hide_viewport = False
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)


def bevel_object(obj, width=BEVEL_WIDTH, segments=BEVEL_SEGMENTS):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    for mod in list(obj.modifiers):
        if mod.type == "BEVEL":
            obj.modifiers.remove(mod)
    mod = obj.modifiers.new("DoorFrameBevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    mod.angle_limit = math.radians(30)
    mod.miter_outer = "MITER_ARC"
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.ops.object.shade_smooth()
    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    for e in bm.edges:
        e.smooth = e.calc_face_angle(True) <= math.radians(40)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    obj.select_set(False)


def main():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)

    left = bpy.data.objects.get(LEFT)
    right = bpy.data.objects.get(RIGHT)
    shkaf = bpy.data.objects.get("shkaf")
    if not left or not right or not shkaf:
        raise RuntimeError("Cube / Cube.001 / shkaf missing")

    before = {"L": snapshot(left), "R": snapshot(right)}
    log(f"BEFORE L {before['L']}")
    log(f"BEFORE R {before['R']}")

    apply_scale_only(left)
    apply_scale_only(right)
    bevel_object(left)
    bevel_object(right)

    left.name = LEFT
    right.name = RIGHT

    after = {"L": snapshot(left), "R": snapshot(right)}
    log(f"AFTER L {after['L']}")
    log(f"AFTER R {after['R']}")

    for side in ("L", "R"):
        b = before[side]["aabb"]["center"]
        a = after[side]["aabb"]["center"]
        d = [abs(a[i] - b[i]) for i in range(3)]
        log(f"delta_center {side}: {[round(x, 4) for x in d]}")
        if max(d) > 0.03:
            raise RuntimeError(f"{side} AABB center drifted — abort")

    with open(OUT_META, "w", encoding="utf-8") as f:
        json.dump({"before": before, "after": after}, f, ensure_ascii=False, indent=2)

    # Export parent empty + children so local TRS preserved
    bpy.ops.object.select_all(action="DESELECT")
    shkaf.select_set(True)
    left.select_set(True)
    right.select_set(True)
    # Clear other children selection — only export these three
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format="GLB",
        export_apply=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    log(f"DONE {OUT_GLB}")


main()
