import bpy, json
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r"D:\Temp\shkaf-v54-decomp.glb")

def aabb(o):
    c=[o.matrix_world@Vector(x) for x in o.bound_box]
    xs=[v.x for v in c]; ys=[v.y for v in c]; zs=[v.z for v in c]
    return {
      "min":[round(min(xs),4),round(min(ys),4),round(min(zs),4)],
      "max":[round(max(xs),4),round(max(ys),4),round(max(zs),4)],
      "cx":round((min(xs)+max(xs))/2,4),
      "cy":round((min(ys)+max(ys))/2,4),
      "cz":round((min(zs)+max(zs))/2,4),
    }

out={}
for name in ["Cube","Cube.001","node_0.006","node_0.007","node_0.003","node_0.012"]:
    o=bpy.data.objects.get(name)
    if not o:
        out[name]="missing"; continue
    out[name]={"loc":[round(v,4) for v in o.location], "aabb":aabb(o), "parent": o.parent.name if o.parent else None}

# expected from blend BEFORE
expected = {
  "Cube": {"cx": -0.8141, "cy": -0.0488, "cz": 1.3789},
  "Cube.001": {"cx": 0.8229, "cy": -0.0595, "cz": 1.3816},
}
for k,e in expected.items():
    a=out[k]["aabb"]
    out[k]["delta"]={
      "dx": round(a["cx"]-e["cx"],4),
      "dy": round(a["cy"]-e["cy"],4),
      "dz": round(a["cz"]-e["cz"],4),
    }

path=r"D:\Temp\v54_verify.json"
open(path,"w",encoding="utf-8").write(json.dumps(out,indent=2))
print("WROTE", path)
for k,v in out.items():
    print(k, v.get("aabb"), v.get("delta"))
