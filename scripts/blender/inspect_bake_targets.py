"""Inspect materials/objects in updated cinematic blend for bake targets."""
import bpy
import json

OUT = r"D:\Temp\bake_targets.json"

# Material name hints
COPPER_KEYS = ("медь", "copper", "patina", "состар", "aged", "корпус", "corpus", "002", "006")
ACRYLIC_KEYS = ("акрил", "acrylic", "green", "зелен", "drawer", "ящик", "010", "tabl")
DOOR_KEYS = ("door", "двер", "cube", "inner", "002", "006", "010")

mats = []
for m in bpy.data.materials:
    if not m.use_nodes:
        mats.append({"name": m.name, "nodes": False, "users": m.users})
        continue
    node_types = sorted({n.type for n in m.node_tree.nodes})
    has_principled = any(n.type == "BSDF_PRINCIPLED" for n in m.node_tree.nodes)
    has_tex = any(n.type == "TEX_IMAGE" for n in m.node_tree.nodes)
    has_proc = any(
        n.type in {"TEX_NOISE", "TEX_VORONOI", "TEX_MUSGRAVE", "TEX_WAVE", "VALTORGB", "MIX_SHADER", "BUMP"}
        for n in m.node_tree.nodes
    )
    mats.append({
        "name": m.name,
        "users": m.users,
        "principled": has_principled,
        "has_tex": has_tex,
        "has_proc": has_proc,
        "node_types": node_types[:20],
    })

# Objects with interesting mats + door-ish names
objs = []
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    mat_names = [s.material.name for s in o.material_slots if s.material]
    n = o.name.lower()
    interesting = (
        any(k in n for k in ("door", "cube", "drawer", "ящик", "node_0.00", "node_0.01", "btresta"))
        or any(
            any(k in (m or "").lower() for k in (*COPPER_KEYS, *ACRYLIC_KEYS, *DOOR_KEYS))
            for m in mat_names
        )
    )
    if not interesting and o.users_collection:
        # keep high-user mats later
        pass
    if not mat_names:
        continue
    # always list meshes with Material.002 / .006 / drawer-like
    keep = any(
        any(x in mn for x in ("Material.002", "Material.006", "Material.010", "акрил", "медь", "Copper", "Acrylic", "drawer", "patina", "состар"))
        for mn in mat_names
    ) or interesting
    if not keep:
        continue
    objs.append({
        "name": o.name,
        "mats": mat_names,
        "verts": len(o.data.vertices),
        "parent": o.parent.name if o.parent else None,
        "loc": [round(v, 4) for v in o.location],
    })

# door empties
empties = []
for o in bpy.data.objects:
    if "door" in o.name.lower():
        empties.append({
            "name": o.name,
            "type": o.type,
            "loc": [round(v, 4) for v in o.location],
            "rot": [round(v, 4) for v in o.rotation_euler],
            "children": [c.name for c in o.children][:20],
        })

# All materials with users>0
mats_used = [m for m in mats if m["users"] > 0]
mats_used.sort(key=lambda m: -m["users"])

report = {
    "blend": bpy.data.filepath,
    "materials_used": mats_used,
    "objects": objs[:80],
    "door_nodes": empties,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("WROTE", OUT)
print("mats", len(mats_used), "objs", len(objs), "doors", len(empties))
for m in mats_used[:40]:
    print(f"  MAT {m['name']!r} users={m['users']} proc={m['has_proc']} tex={m['has_tex']}")
