"""List cabinet materials: procedural vs already-textured, UV status."""
import bpy
import json

OUT = r"D:\Temp\cabinet_mats_inspect.json"

PROCEDURAL = {
    "TEX_NOISE", "TEX_VORONOI", "TEX_WAVE", "TEX_MAGIC", "TEX_MUSGRAVE",
    "TEX_CHECKER", "TEX_BRICK", "TEX_GRADIENT", "TEX_WHITE_NOISE",
    "MIX_SHADER", "ADD_SHADER", "BUMP", "DISPLACEMENT", "VALTORGB",
    "MAPPING", "RGBTOBW",
}

CABINET_HINTS = (
    "shkaf", "door", "drawer", "beresta", "leg", "tabl", "ручка", "ruchka",
    "beck", "beck", "beck", "медаль", "medal", "beck", "copper", "leather",
    "node_0", "box_d", "top_rail", "beck", "beck", "mesh_",
)


def is_cabinet_obj(obj):
    if obj.type != "MESH":
        return False
    # exclude studio
    if obj.name.startswith("STUDIO_") or "REFLECTOR" in obj.name:
        return False
    n = obj.name.lower()
    return True  # all non-studio meshes — filter later by collection


def mat_detail(mat):
    if not mat or not mat.node_tree:
        return {"name": getattr(mat, "name", None), "empty": True}
    nodes = mat.node_tree.nodes
    procedural = []
    images = []
    principled_inputs = {}
    for n in nodes:
        if n.type in PROCEDURAL:
            procedural.append(n.type)
        if n.type == "TEX_IMAGE" and n.image:
            images.append({
                "name": n.image.name,
                "size": list(n.image.size),
                "packed": bool(n.image.packed_file),
                "filepath": n.image.filepath or "",
            })
        if n.type == "BSDF_PRINCIPLED":
            for key in ("Base Color", "Metallic", "Roughness", "Normal", "Alpha"):
                sock = n.inputs.get(key)
                if not sock:
                    continue
                if sock.is_linked:
                    principled_inputs[key] = f"linked:{sock.links[0].from_node.type}"
                else:
                    val = sock.default_value
                    if hasattr(val, "__iter__") and not isinstance(val, str):
                        principled_inputs[key] = [round(float(x), 4) for x in list(val)[:3]]
                    else:
                        principled_inputs[key] = round(float(val), 4)
    return {
        "name": mat.name,
        "procedural_types": sorted(set(procedural)),
        "needs_bake": any(t in PROCEDURAL for t in procedural) and not images,
        "has_images": bool(images),
        "has_procedural": bool(procedural),
        "images": images,
        "principled": principled_inputs,
        "users": mat.users,
    }


def uv_ok(obj):
    if not obj.data.uv_layers:
        return False
    return len(obj.data.uv_layers) > 0


def main():
    studio = {"STUDIO_FLOOR", "STUDIO_CYCLORAMA"}
    reflectors = [o.name for o in bpy.data.objects if "REFLECTOR" in o.name]

    mats_used = {}
    meshes = []
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        if obj.name in studio or "REFLECTOR" in obj.name:
            continue
        mats = [m.name for m in obj.data.materials if m]
        for m in obj.data.materials:
            if m:
                mats_used[m.name] = m
        meshes.append({
            "name": obj.name,
            "verts": len(obj.data.vertices),
            "materials": mats,
            "uv": uv_ok(obj),
            "uv_layers": [uv.name for uv in obj.data.uv_layers],
        })

    mat_reports = [mat_detail(m) for m in mats_used.values()]
    needs_attention = [
        m for m in mat_reports
        if m.get("has_procedural") or not m.get("has_images")
    ]

    # collections membership for shkaf-like
    report = {
        "mesh_count": len(meshes),
        "top_meshes": sorted(meshes, key=lambda x: -x["verts"])[:25],
        "materials": sorted(mat_reports, key=lambda m: m["name"]),
        "materials_needing_attention": needs_attention,
        "reflectors": reflectors,
        "note": "needs_bake true only if procedural AND no images; has_procedural+images may still need bake for Mix/Bump",
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("WROTE", OUT)
    print("meshes", len(meshes), "mats", len(mat_reports), "attention", len(needs_attention))


main()
