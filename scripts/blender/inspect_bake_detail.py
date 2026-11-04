import bpy, json
from collections import defaultdict

by_mat = defaultdict(list)
for o in bpy.data.objects:
    if o.type != "MESH":
        continue
    for s in o.material_slots:
        if s.material:
            by_mat[s.material.name].append({
                "name": o.name,
                "verts": len(o.data.vertices),
                "parent": o.parent.name if o.parent else None,
            })

# detail Metal Brown Medium node graph / image sizes
def mat_images(mat_name):
    m = bpy.data.materials.get(mat_name)
    if not m or not m.use_nodes:
        return []
    out = []
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            out.append({
                "node": n.name,
                "image": n.image.name,
                "size": list(n.image.size),
                "colorspace": n.image.colorspace_settings.name,
                "filepath": n.image.filepath,
            })
    return out

# Principled values for Материал.011
def principled(mat_name):
    m = bpy.data.materials.get(mat_name)
    if not m or not m.use_nodes:
        return None
    for n in m.node_tree.nodes:
        if n.type == "BSDF_PRINCIPLED":
            def val(sock):
                v = sock.default_value
                if hasattr(v, "__iter__") and not isinstance(v, str):
                    return [round(float(x), 4) for x in list(v)[:4]]
                return round(float(v), 4)
            return {
                "base": val(n.inputs["Base Color"]),
                "metallic": val(n.inputs["Metallic"]),
                "roughness": val(n.inputs["Roughness"]),
            }
    return None

report = {
    "by_mat": {k: v for k, v in by_mat.items()},
    "Metal Brown Medium images": mat_images("Metal Brown Medium"),
    "Sage Green Venetian Plaster images": mat_images("Sage Green Venetian Plaster"),
    "Dark Mottled Metal images": mat_images("Dark Mottled Metal"),
    "Материал.011": principled("Материал.011"),
    "Metal Brown Medium principled": principled("Metal Brown Medium"),
    "Sage principled": principled("Sage Green Venetian Plaster"),
}
# door hierarchy
for name in ["door_left","door_right","node_0.006","node_0.007","Cube","Cube.001","shkaf"]:
    o = bpy.data.objects.get(name)
    if not o:
        continue
    report.setdefault("hierarchy", {})[name] = {
        "parent": o.parent.name if o.parent else None,
        "children": [c.name for c in o.children],
        "loc": [round(x,4) for x in o.location],
        "rot": [round(x,4) for x in o.rotation_euler],
    }

path = r"D:\Temp\bake_targets_detail.json"
open(path,"w",encoding="utf-8").write(json.dumps(report, ensure_ascii=False, indent=2))
print("WROTE", path)
for k,v in by_mat.items():
    print(f"=== {k} ({len(v)})")
    for o in v[:15]:
        print(f"  {o['name']} verts={o['verts']} parent={o['parent']}")
