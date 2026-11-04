"""Export cabinet + studio GLBs for the Russo site (Blender 5 / glTF)."""
import bpy
import os

OUT_DIR = r"d:\PycharmProjects\Russo\public\models"
CABINET_PATH = os.path.join(OUT_DIR, "shkaf-cabinet.glb")
STUDIO_PATH = os.path.join(OUT_DIR, "studio-scene.glb")

SKIP_ROOTS = {
    "Pefume",
    "Vanilla leather Perfume",
    "Crystal Shape Bottle",
    "Water Bottle",
    "ORIG_REF",
}
INCLUDE_TYPES = {"MESH", "EMPTY"}


def ancestors(obj):
    names = set()
    p = obj
    while p:
        names.add(p.name)
        p = p.parent
    return names


def is_studio(obj):
    return obj.name.startswith("STUDIO_") or any(
        n.startswith("STUDIO_") for n in ancestors(obj)
    )


def is_skipped(obj):
    if obj.hide_render:
        return True
    names = ancestors(obj)
    if names & SKIP_ROOTS:
        return True
    return False


def select_objects(objs):
    bpy.ops.object.select_all(action="DESELECT")
    count = 0
    for obj in objs:
        try:
            obj.hide_set(False)
            obj.hide_viewport = False
            obj.select_set(True)
            count += 1
        except Exception as err:
            print("select fail", obj.name, err)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]
    return count


def export_glb(path, extra=None):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    kw = dict(
        filepath=path,
        check_existing=False,
        use_selection=True,
        use_visible=False,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_image_quality=85,
        export_unused_images=False,
        export_extras=False,
        export_animations=False,
        export_skins=False,
        export_morph=False,
    )
    if extra:
        kw.update(extra)
    # Blender 5 Khronos addon: format identifier varies
    last_err = None
    for fmt in ("GLB", "glTF Binary", "GLTF_SEPARATE"):
        kw["export_format"] = fmt
        if fmt == "GLTF_SEPARATE":
            continue
        try:
            bpy.ops.export_scene.gltf(**kw)
            print("EXPORTED", path, "format", fmt, "bytes", os.path.getsize(path))
            return
        except TypeError as err:
            last_err = err
            print("format", fmt, "TypeError", err)
        except RuntimeError as err:
            last_err = err
            print("format", fmt, "RuntimeError", err)
    # last attempt: no format key
    kw.pop("export_format", None)
    try:
        bpy.ops.export_scene.gltf(**kw)
        print("EXPORTED", path, "no-format", "bytes", os.path.getsize(path))
        return
    except Exception as err:
        raise RuntimeError(f"gltf export failed: {last_err or err}") from err


def try_draco(path):
    extra = {
        "export_draco_mesh_compression_enable": True,
        "export_draco_mesh_compression_level": 7,
    }
    try:
        export_glb(path, extra)
        return True
    except Exception as err:
        print("Draco failed, retry without:", err)
        extra = {"export_draco_mesh_compression_enable": False}
        export_glb(path, extra)
        return False


if bpy.context.mode != "OBJECT":
    bpy.ops.object.mode_set(mode="OBJECT")

cabinet = [
    o
    for o in bpy.data.objects
    if o.type in INCLUDE_TYPES and not is_studio(o) and not is_skipped(o)
]
studio = [
    o
    for o in bpy.data.objects
    if o.type == "MESH" and o.name.startswith("STUDIO_") and not o.hide_render
]

print("CABINET", len(cabinet), [o.name for o in cabinet][:40], "...")
print("STUDIO", [o.name for o in studio])

n = select_objects(cabinet)
print("selected cabinet", n)
try_draco(CABINET_PATH)

n = select_objects(studio)
print("selected studio", n)
# studio is tiny — skip draco
export_glb(STUDIO_PATH, {"export_draco_mesh_compression_enable": False})

print("DONE")
print("cabinet_mb", round(os.path.getsize(CABINET_PATH) / 1024 / 1024, 1))
print("studio_mb", round(os.path.getsize(STUDIO_PATH) / 1024 / 1024, 1))
