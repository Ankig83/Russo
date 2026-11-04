import bpy, json, math
from mathutils import Vector, Matrix

out = []
for name in ["door_left", "door_right", "Cube", "Cube.001", "node_0.003", "node_0.004", "node_0.012", "node_0.013"]:
    o = bpy.data.objects.get(name)
    if not o:
        out.append({"name": name, "missing": True})
        continue
    mw = o.matrix_world
    loc = mw.to_translation()
    rot = mw.to_euler("XYZ")
    out.append({
        "name": name,
        "type": o.type,
        "parent": o.parent.name if o.parent else None,
        "loc": [round(v, 4) for v in loc],
        "rot_deg": [round(math.degrees(a), 2) for a in rot],
        "local_loc": [round(v, 4) for v in o.location],
        "local_rot_deg": [round(math.degrees(a), 2) for a in o.rotation_euler],
        "children": [c.name for c in o.children][:20],
        "nchildren": len(o.children),
    })

# all children of door pivots
for dn in ["door_left", "door_right"]:
    d = bpy.data.objects.get(dn)
    if d:
        out.append({"door": dn, "all_descendants": [c.name for c in d.children_recursive]})

# find meshes that look like door panels (beresta / Material.001 etc) by x extent
cands = []
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    if not o.visible_get():
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [v.x for v in bb]
    ys = [v.y for v in bb]
    zs = [v.z for v in bb]
    cx = sum(xs)/8
    cy = sum(ys)/8
    # door-like: tall, thin in Y or X
    dx = max(xs)-min(xs)
    dy = max(ys)-min(ys)
    dz = max(zs)-min(zs)
    if dz > 1.5 and (dx < 0.15 or dy < 0.15) and abs(cx) > 0.4:
        mats = [s.material.name if s.material else None for s in o.material_slots]
        cands.append({"name": o.name, "parent": o.parent.name if o.parent else None, "cx": round(cx,3), "cy": round(cy,3), "dx": round(dx,3), "dy": round(dy,3), "dz": round(dz,3), "mats": mats[:3]})

out.append({"door_like_meshes": cands[:40]})

path = r"D:\Temp\door_state.json"
open(path, "w", encoding="utf-8").write(json.dumps(out, indent=2, ensure_ascii=False))
print("WROTE", path)
