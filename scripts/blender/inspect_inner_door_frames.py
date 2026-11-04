"""Find inner-door frame / cube carcass meshes in cinematic blend."""
import bpy
import json

OUT = r"D:\Temp\inner_door_frames.json"

candidates = []
for obj in bpy.data.objects:
    if obj.type != "MESH":
        continue
    n = obj.name.lower()
    mats = [m.name for m in obj.data.materials if m]
    hit = (
        "cube" in n
        or "каркас" in n
        or "frame" in n
        or "inner" in n
        or "inside" in n
        or "btresta" in n
        or "glass" in n
        or n.startswith("куб")
        or any("007" in m or "glass" in m.lower() for m in mats)
    )
    # also small-ish meshes that look like frames
    verts = len(obj.data.vertices)
    if not hit and verts <= 64 and any("Material" in m or "Материал" in m for m in mats):
        hit = True
    if not hit:
        continue
    bb = [round(v, 4) for v in obj.dimensions]
    candidates.append({
        "name": obj.name,
        "verts": verts,
        "faces": len(obj.data.polygons),
        "dimensions": bb,
        "location": [round(v, 4) for v in obj.matrix_world.translation],
        "materials": mats,
        "parent": obj.parent.name if obj.parent else None,
        "modifiers": [m.type for m in obj.modifiers],
    })

# Also list all Cube* and Куб*
named = [o.name for o in bpy.data.objects if o.type == "MESH" and ("cube" in o.name.lower() or o.name.startswith("Куб") or "frame" in o.name.lower() or "каркас" in o.name.lower())]

report = {"named_cubes": named, "candidates": sorted(candidates, key=lambda c: -c["verts"])}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("WROTE", OUT, "candidates", len(candidates), "named", named)
