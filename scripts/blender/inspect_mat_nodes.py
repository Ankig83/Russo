import bpy, json
for name in ["Metal Brown Medium", "Sage Green Venetian Plaster"]:
    m = bpy.data.materials[name]
    print("====", name)
    for n in m.node_tree.nodes:
        print(" ", n.type, n.name, getattr(n, "label", ""))
        if n.type == "TEX_IMAGE" and n.image:
            print("   IMG", n.image.name, list(n.image.size), n.image.filepath, n.image.packed_file is not None)
        if n.type == "BSDF_PRINCIPLED":
            for inp in ["Base Color","Metallic","Roughness","Normal"]:
                links = list(n.inputs[inp].links)
                print("   in", inp, "linked" if links else "default", 
                      [l.from_node.name for l in links] if links else n.inputs[inp].default_value if inp!="Normal" else "")
# UV status for bake targets
for oname in ["shkaf","Cube","Cube.001","drawer_1","drawer_2","drawer_tl.002","drawer_tl.003"]:
    o = bpy.data.objects.get(oname)
    if not o: continue
    uvs = [uv.name for uv in o.data.uv_layers]
    print("UV", oname, uvs, "verts", len(o.data.vertices))
