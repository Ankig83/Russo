"""
Parent door assemblies to Blender door_left / door_right empties (keep world),
then export cabinet GLB. Closed = empty rot 0 as authored.
"""
import bpy
import math
import os
from mathutils import Vector, Matrix

SRC = r"D:\Temp\render_2_baked_mats.blend"
# fallback to original if baked missing materials ok
SRC_FALLBACK = r"D:\Temp\render_2.blend1.blend"
OUT_RAW = r"D:\PycharmProjects\Russo\public\models\shkaf.cinematic-cabinet.glb"
DECIMATE_RATIO = 0.12
DECIMATE_MIN_VERTS = 80000

LEFT_ROOT = "node_0.007"
RIGHT_ROOT = "node_0.006"


def log(msg):
    print(msg, flush=True)


def world_aabb(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return {
        "min": Vector((min(xs), min(ys), min(zs))),
        "max": Vector((max(xs), max(ys), max(zs))),
        "size": Vector((max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs))),
    }


def reparent_keep_world(obj, new_parent):
    mw = obj.matrix_world.copy()
    obj.parent = new_parent
    obj.matrix_world = mw


def decimate(obj):
    if obj.type != "MESH" or not obj.data:
        return
    n = len(obj.data.vertices)
    if n < DECIMATE_MIN_VERTS:
        return
    log(f"decimate {obj.name} {n}")
    mod = obj.modifiers.new("ExportDecimate", "DECIMATE")
    mod.ratio = DECIMATE_RATIO
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def main():
    path = SRC if os.path.isfile(SRC) else SRC_FALLBACK
    log(f"open {path}")
    bpy.ops.wm.open_mainfile(filepath=path)

    left_empty = bpy.data.objects.get("door_left")
    right_empty = bpy.data.objects.get("door_right")
    left_root = bpy.data.objects.get(LEFT_ROOT)
    right_root = bpy.data.objects.get(RIGHT_ROOT)
    shkaf = bpy.data.objects.get("shkaf")
    if not all([left_empty, right_empty, left_root, right_root, shkaf]):
        raise RuntimeError(
            f"missing parts Lempty={left_empty} Rempty={right_empty} L={left_root} R={right_root} shkaf={shkaf}"
        )

    # Ensure empties under shkaf, identity rotation (closed)
    for empty in (left_empty, right_empty):
        empty.rotation_euler = (0, 0, 0)
        if empty.parent != shkaf:
            reparent_keep_world(empty, shkaf)

    # Place empties on outer front corners of door AABBs (Blender: front = min Y)
    la = world_aabb(left_root)
    ra = world_aabb(right_root)
    mid_zl = (la["min"].z + la["max"].z) * 0.5
    mid_zr = (ra["min"].z + ra["max"].z) * 0.5
    # outer X, front Y
    left_empty.matrix_world = Matrix.Translation(
        Vector((la["min"].x, la["min"].y, mid_zl))
    )
    right_empty.matrix_world = Matrix.Translation(
        Vector((ra["max"].x, ra["min"].y, mid_zr))
    )
    # re-bind parent without losing the world we just set
    for empty in (left_empty, right_empty):
        mw = empty.matrix_world.copy()
        empty.parent = shkaf
        empty.matrix_world = mw

    log(f"door_left @ {[round(v,3) for v in left_empty.matrix_world.to_translation()]}")
    log(f"door_right @ {[round(v,3) for v in right_empty.matrix_world.to_translation()]}")
    log(f"left AABB size {[round(v,3) for v in la['size']]}")
    log(f"right AABB size {[round(v,3) for v in ra['size']]}")

    # Parent door assemblies to empties
    reparent_keep_world(left_root, left_empty)
    reparent_keep_world(right_root, right_empty)
    log(f"{LEFT_ROOT} → door_left, {RIGHT_ROOT} → door_right")

    # Drop studio / lights / cameras
    for obj in list(bpy.data.objects):
        n = obj.name
        if obj.type in {"LIGHT", "CAMERA"}:
            bpy.data.objects.remove(obj, do_unlink=True)
            continue
        if any(k in n for k in ("PREMIUM", "REFLECTOR", "STUDIO", "CYCLORAMA")):
            bpy.data.objects.remove(obj, do_unlink=True)

    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(bpy.data.objects):
        if obj.type == "MESH" and obj.name in bpy.context.view_layer.objects:
            try:
                decimate(obj)
            except Exception as e:
                log(f"decimate fail {obj.name}: {e}")

    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.view_layer.objects:
        try:
            obj.hide_set(False)
            obj.hide_viewport = False
            obj.select_set(True)
        except Exception:
            pass

    bpy.ops.export_scene.gltf(
        filepath=OUT_RAW,
        use_selection=True,
        export_format="GLB",
        export_apply=False,  # keep hierarchy + empty pivots
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    log(f"DONE {OUT_RAW} size={os.path.getsize(OUT_RAW)}")


main()
