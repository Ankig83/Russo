"""
Export cabinet from baked blend → raw GLB (no studio/reflectors).
Decimate heavy meshes so site stays loadable.
"""
import bpy
import bmesh
import os

SRC = r"D:\Temp\render_2_baked_mats.blend"
OUT = r"D:\PycharmProjects\Russo\public\models\shkaf.cinematic-cabinet.glb"
DECIMATE_RATIO = 0.12
DECIMATE_MIN_VERTS = 80000

KEEP_ROOTS = {
    "shkaf",
    "door_left",
    "door_right",
    "Btresta_inside.001",
    "Btresta_inside.002",
    "Top_Frame",
    "node_0",
    "node_0.002",
    "node_0.003",
    "node_0.004",
    "node_0.005",
    "node_0.006",
    "node_0.007",
    "node_0.008",
    "node_0.010",
    "node_0.011",
    "node_0.012",
    "node_0.013",
    "Cube",
    "Cube.001",
    "Beck_W",
    "drawer_1",
    "drawer_2",
    "drawer_tl",
    "drawer_tl.001",
    "drawer_tl.002",
    "drawer_tl.003",
    "drawer_tr",
    "drawer_bl",
    "drawer_br",
}


def log(msg):
    print(msg, flush=True)


def should_keep(obj):
    n = obj.name
    if n in KEEP_ROOTS:
        return True
    # keep descendants of shkaf / doors / drawers
    p = obj.parent
    while p:
        if p.name in {"shkaf", "door_left", "door_right", "node_0.006", "node_0.007", "drawer_1", "drawer_2", "drawer_tl", "drawer_tl.001", "drawer_tl.002", "drawer_tl.003", "drawer_tr", "drawer_bl", "drawer_br", "glases_n"}:
            return True
        if p.name.startswith("drawer"):
            return True
        p = p.parent
    if n.startswith("drawer") or n.startswith("Куб") or n.startswith("box_") or n.startswith("centr"):
        return True
    if n.startswith("top_rail") or n.startswith("glasses") or n.startswith("glases"):
        return True
    if "leather" in n.lower() or "ручка" in n.lower() or "medallion" in n.lower() or "Beresta" in n or "кож" in n.lower():
        return True
    if n.startswith("Mesh_"):
        return True
    return False


def decimate(obj, ratio=DECIMATE_RATIO):
    if obj.type != "MESH" or not obj.data:
        return
    n = len(obj.data.vertices)
    if n < DECIMATE_MIN_VERTS:
        return
    log(f"decimate {obj.name} {n} → ~{int(n * ratio)}")
    mod = obj.modifiers.new("ExportDecimate", "DECIMATE")
    mod.ratio = ratio
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.select_set(False)


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC)

    # delete non-cabinet
    to_delete = []
    for obj in list(bpy.data.objects):
        if obj.type in {"LIGHT", "CAMERA", "SPEAKER"}:
            to_delete.append(obj)
            continue
        n = obj.name
        if any(x in n for x in ("PREMIUM", "REFLECTOR", "STUDIO", "CYCLORAMA", "World", "Area", "Sun", "Point", "Spot", "Camera")):
            to_delete.append(obj)
            continue
        if not should_keep(obj):
            # keep empties that are parents of kept meshes
            if obj.type == "EMPTY" and any(should_keep(c) for c in obj.children_recursive):
                continue
            if obj.type == "EMPTY" and obj.name in {"shkaf", "door_left", "door_right", "Scene"}:
                continue
            to_delete.append(obj)

    for obj in to_delete:
        try:
            bpy.data.objects.remove(obj, do_unlink=True)
        except Exception:
            pass

    # decimate heavy
    bpy.ops.object.select_all(action="DESELECT")
    for obj in list(bpy.data.objects):
        if obj.type == "MESH":
            try:
                decimate(obj)
            except Exception as e:
                log(f"decimate fail {obj.name}: {e}")

    # select all remaining for export
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.data.objects:
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)

    bpy.ops.export_scene.gltf(
        filepath=OUT,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    log(f"DONE {OUT} size={os.path.getsize(OUT)}")


main()
