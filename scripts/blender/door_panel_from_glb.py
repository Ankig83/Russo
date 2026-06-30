# Blender 4.x — скопировать геометрию полотна двери
# 1) shkaf.glb в папке с .blend (имя именно .glb, не .gbl)
# 2) .blend сохранён (Ctrl+S)
# 3) Run Script

import bpy
from pathlib import Path

SOURCE = "левая_дверь_полотно"  # правая: "130_"
OUTPUT = "door_panel_geo"


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


def _import_glb(path: str):
    override = _view3d_override()
    if override is None:
        raise RuntimeError("Откройте окно 3D Viewport и запустите скрипт снова.")

    with bpy.context.temp_override(**override):
        if hasattr(bpy.ops.wm, "gltf_import"):
            bpy.ops.wm.gltf_import(filepath=path)
        else:
            bpy.ops.import_scene.gltf(filepath=path)


def main():
    src = bpy.data.objects.get(SOURCE)

    if src is None:
        glb = bpy.path.abspath("//shkaf.glb")
        if not glb or not Path(glb).is_file():
            raise RuntimeError(
                f"Файл не найден:\n  {glb}\n\n"
                "Положите shkaf.glb в папку с .blend, сохраните файл (Ctrl+S), запустите снова."
            )
        _import_glb(glb)
        src = bpy.data.objects.get(SOURCE)
        if src is None:
            raise RuntimeError(f"После импорта объект «{SOURCE}» не найден.")

    deps = bpy.context.evaluated_depsgraph_get()
    mesh = bpy.data.meshes.new_from_object(
        src.evaluated_get(deps),
        preserve_all_data_layers=True,
        depsgraph=deps,
    )

    if bpy.data.objects.get(OUTPUT):
        bpy.data.objects.remove(bpy.data.objects[OUTPUT], do_unlink=True)

    obj = bpy.data.objects.new(OUTPUT, mesh)
    obj.matrix_world = src.matrix_world.copy()
    bpy.context.scene.collection.objects.link(obj)

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

    print(f"OK: «{OUTPUT}», вершин {len(mesh.vertices)}")


main()
