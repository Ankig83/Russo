"""Inspect + export CINEMATIC reflectors geometry/materials for R3F."""
import bpy
import json
import math
import os
from mathutils import Vector

OUT_JSON = r"D:\Temp\cinematic_reflectors.json"
OUT_GLB = r"D:\PycharmProjects\Russo\public\models\cinematic-reflectors.glb"

NAMES = [
    "REFLECTOR_BLACK_FLAG",
    "REFLECTOR_GRAY_RIGHT",
    "REFLECTOR_WHITE_LEFT",
]


def b2t(v):
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def main():
    report = {"reflectors": []}
    for name in NAMES:
        obj = bpy.data.objects.get(name)
        if not obj:
            report["reflectors"].append({"name": name, "missing": True})
            continue
        mats = []
        if obj.type == "MESH":
            for m in obj.data.materials:
                if not m:
                    continue
                info = {"name": m.name}
                if m.node_tree:
                    p = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                    if p:
                        bc = p.inputs["Base Color"].default_value
                        info["baseColor"] = [round(c, 4) for c in bc[:3]]
                        info["metallic"] = round(p.inputs["Metallic"].default_value, 4)
                        info["roughness"] = round(p.inputs["Roughness"].default_value, 4)
                mats.append(info)
        report["reflectors"].append({
            "name": name,
            "type": obj.type,
            "hide": obj.hide_get() or obj.hide_render,
            "location": b2t(obj.matrix_world.translation),
            "rotation_euler": [round(a, 4) for a in obj.matrix_world.to_euler()],
            "scale": [round(s, 4) for s in obj.matrix_world.to_scale()],
            "dimensions": [round(d, 4) for d in obj.dimensions] if obj.type == "MESH" else None,
            "verts": len(obj.data.vertices) if obj.type == "MESH" else None,
            "materials": mats,
        })

    # Export reflectors only as GLB
    bpy.ops.object.select_all(action="DESELECT")
    exported = 0
    for name in NAMES:
        obj = bpy.data.objects.get(name)
        if not obj:
            continue
        obj.hide_set(False)
        obj.hide_render = False
        obj.select_set(True)
        exported += 1
    if exported:
        bpy.ops.export_scene.gltf(
            filepath=OUT_GLB,
            use_selection=True,
            export_format="GLB",
            export_apply=True,
            export_texcoords=True,
            export_normals=True,
            export_materials="EXPORT",
            export_cameras=False,
            export_lights=False,
        )
        report["glb"] = OUT_GLB
        report["exported"] = exported

    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("WROTE", OUT_JSON, "exported", exported)


main()
