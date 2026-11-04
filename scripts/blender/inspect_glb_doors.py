import bpy, json, math
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"D:\Temp\shkaf-decomp.glb")

names = [
  "Cube","Cube.001","node_0.003","node_0.004","node_0.012","node_0.013",
  "node_0.006","node_0.007","door_left","door_right","node_0001","closed_doors_facade",
  "node_0","shkaf"
]

out = {"objects": [], "door_like": []}
for name in names:
    o = bpy.data.objects.get(name)
    if not o:
        out["objects"].append({"name": name, "missing": True})
        continue
    mw = o.matrix_world
    loc = mw.to_translation()
    rot = mw.to_euler("XYZ")
    bb = [mw @ Vector(c) for c in o.bound_box] if o.type == "MESH" else []
    xs = [v.x for v in bb]; ys = [v.y for v in bb]; zs = [v.z for v in bb]
    out["objects"].append({
        "name": name,
        "type": o.type,
        "parent": o.parent.name if o.parent else None,
        "loc": [round(v,4) for v in loc],
        "rot_deg": [round(math.degrees(a),2) for a in rot],
        "bb": {
            "xmin": round(min(xs),4), "xmax": round(max(xs),4),
            "ymin": round(min(ys),4), "ymax": round(max(ys),4),
            "zmin": round(min(zs),4), "zmax": round(max(zs),4),
            "cx": round(sum(xs)/8,4), "cy": round(sum(ys)/8,4),
        } if xs else None,
        "mats": [s.material.name if s.material else None for s in o.material_slots] if o.type=="MESH" else [],
    })

for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs=[v.x for v in bb]; ys=[v.y for v in bb]; zs=[v.z for v in bb]
    dx=max(xs)-min(xs); dy=max(ys)-min(ys); dz=max(zs)-min(zs)
    cx=sum(xs)/8; cy=sum(ys)/8
    if dz>1.5 and (dx<0.25 or dy<0.25) and abs(cx)>0.25:
        mats=[s.material.name if s.material else None for s in o.material_slots]
        out["door_like"].append({
            "name": o.name, "parent": o.parent.name if o.parent else None,
            "cx": round(cx,3), "cy": round(cy,3),
            "dx": round(dx,3), "dy": round(dy,3), "dz": round(dz,3),
            "ymin": round(min(ys),3), "ymax": round(max(ys),3),
            "mats": mats[:2],
        })

# also list materials with node names containing beresta / Material.001 / 006
by_mat = {}
for o in bpy.data.objects:
    if o.type != "MESH": continue
    for s in o.material_slots:
        mn = s.material.name if s.material else "None"
        by_mat.setdefault(mn, []).append(o.name)
out["mats_of_interest"] = {k:v for k,v in by_mat.items() if any(x in k for x in ["002","006","010","001","Beresta","бер","Material"])}

path=r"D:\Temp\glb_door_state.json"
open(path,"w",encoding="utf-8").write(json.dumps(out, indent=2, ensure_ascii=False))
print("WROTE", path, "door_like", len(out["door_like"]))
