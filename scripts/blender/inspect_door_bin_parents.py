"""Who parents Cube / Material.010 door bins in the blend?"""
import bpy
import json

OUT = r"D:\Temp\door_bin_parents.json"

def info(obj):
    mats = [m.name for m in obj.data.materials if m] if obj.type == "MESH" else []
    return {
        "name": obj.name,
        "type": obj.type,
        "parent": obj.parent.name if obj.parent else None,
        "parent_type": obj.parent_type if obj.parent else None,
        "mats": mats,
        "loc": [round(v, 4) for v in obj.matrix_world.translation],
        "verts": len(obj.data.vertices) if obj.type == "MESH" else None,
    }

names = [
    "Cube", "Cube.001",
    "node_0.003", "node_0.004", "node_0.006", "node_0.007",
    "node_0.010", "node_0.011", "node_0.012", "node_0.013",
    "door_left", "door_right", "node_0",
]
items = []
for n in names:
    o = bpy.data.objects.get(n)
    items.append(info(o) if o else {"name": n, "missing": True})

# any object with Material.010
m010 = []
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    mats = [m.name for m in o.data.materials if m]
    if any("Material.010" in m or "Material.006" in m or m == "Material.002" for m in mats):
        if o.name.startswith("node_0") or o.name.startswith("Cube"):
            m010.append(info(o))

report = {"named": items, "door_related": m010}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("WROTE", OUT)
for i in items:
    print(i.get("name"), "parent=", i.get("parent"), "mats=", i.get("mats"), "loc=", i.get("loc"))
