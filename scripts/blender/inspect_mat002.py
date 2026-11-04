"""Inspect Material.002 node graph — maybe bake not needed (compositable)."""
import bpy
import json

OUT = r"D:\Temp\material002_nodes.json"
mat = bpy.data.materials.get("Material.002")
nodes = []
links = []
if mat and mat.node_tree:
    for n in mat.node_tree.nodes:
        entry = {"name": n.name, "type": n.type, "label": n.label}
        if n.type == "TEX_IMAGE" and n.image:
            entry["image"] = n.image.name
            entry["size"] = list(n.image.size)
        if n.type == "MIX":
            entry["blend"] = getattr(n, "blend_type", None)
            entry["data_type"] = getattr(n, "data_type", None)
            if "Fac" in n.inputs:
                entry["fac"] = n.inputs["Fac"].default_value if not n.inputs["Fac"].is_linked else "linked"
        if n.type == "MATH":
            entry["op"] = n.operation
            entry["in0"] = n.inputs[0].default_value if not n.inputs[0].is_linked else "linked"
            entry["in1"] = n.inputs[1].default_value if not n.inputs[1].is_linked else "linked"
        if n.type == "BSDF_PRINCIPLED":
            for k in ("Base Color", "Metallic", "Roughness", "Normal"):
                s = n.inputs[k]
                entry[k] = (
                    f"{s.links[0].from_node.name}.{s.links[0].from_socket.name}"
                    if s.is_linked else str(s.default_value)
                )
        nodes.append(entry)
    for l in mat.node_tree.links:
        links.append({
            "from": f"{l.from_node.name}.{l.from_socket.name}",
            "to": f"{l.to_node.name}.{l.to_socket.name}",
        })

users = [o.name for o in bpy.data.objects if o.type == "MESH" and any(m and m.name == "Material.002" for m in o.data.materials)]
with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"users": users, "nodes": nodes, "links": links}, f, ensure_ascii=False, indent=2)
print("WROTE", OUT, "users", users)
