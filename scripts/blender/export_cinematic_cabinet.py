"""
Memory-safe prepare+export for cinematic blend.
1) Decimate heavy meshes ONE AT A TIME via bmesh
2) Purge orphans between
3) Export all remaining meshes to GLB (no tangents)
"""
import bpy
import bmesh
import gc
import os

OUT_GLB = r"D:\PycharmProjects\Russo\public\models\shkaf.cinematic-raw.glb"
TEX_DIR = r"D:\PycharmProjects\Russo\public\textures\cinematic-cabinet"
MAX_VERTS = 80_000
os.makedirs(TEX_DIR, exist_ok=True)
os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)


def log(msg):
    print(msg, flush=True)


def simplify_material_002():
    mat = bpy.data.materials.get("Material.002")
    if not mat or not mat.node_tree:
        return
    nt = mat.node_tree
    nodes, links = nt.nodes, nt.links
    img_color = bpy.data.images.get("Image_1")
    img_orm = bpy.data.images.get("Image_3-Image_0")
    img_normal = bpy.data.images.get("Image_2")
    nodes.clear()
    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    p = nodes.new("ShaderNodeBsdfPrincipled")
    p.location = (100, 0)
    links.new(p.outputs["BSDF"], out.inputs["Surface"])
    p.inputs["Metallic"].default_value = 0.0

    def add_tex(img, loc, non_color=False):
        n = nodes.new("ShaderNodeTexImage")
        n.image = img
        n.location = loc
        if img:
            img.colorspace_settings.name = "Non-Color" if non_color else "sRGB"
        return n

    if img_color:
        links.new(add_tex(img_color, (-500, 200)).outputs["Color"], p.inputs["Base Color"])
    if img_orm:
        tex = add_tex(img_orm, (-500, 0), True)
        sep = nodes.new("ShaderNodeSeparateColor")
        sep.location = (-250, 0)
        links.new(tex.outputs["Color"], sep.inputs["Color"])
        math = nodes.new("ShaderNodeMath")
        math.operation = "MULTIPLY"
        math.inputs[1].default_value = 0.88
        math.location = (-80, -40)
        links.new(sep.outputs["Green"], math.inputs[0])
        links.new(math.outputs["Value"], p.inputs["Roughness"])
    if img_normal:
        tex = add_tex(img_normal, (-500, -280), True)
        nm = nodes.new("ShaderNodeNormalMap")
        nm.location = (-200, -280)
        links.new(tex.outputs["Color"], nm.inputs["Color"])
        links.new(nm.outputs["Normal"], p.inputs["Normal"])
    log("Material.002 simplified")


def unpack_missing_images():
    n = 0
    for img in bpy.data.images:
        if not img.packed_file or img.size[0] == 0:
            continue
        safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in img.name)
        if not safe.lower().endswith((".png", ".jpg", ".jpeg", ".webp")):
            safe += ".png"
        path = os.path.join(TEX_DIR, safe)
        if os.path.isfile(path) and os.path.getsize(path) > 1000:
            continue
        img.filepath_raw = path
        img.file_format = "PNG"
        try:
            img.save()
            n += 1
        except Exception as e:
            log(f"unpack fail {img.name}: {e}")
    log(f"unpacked {n} images")


def decimate_object(obj, target_verts):
    mesh = obj.data
    before = len(mesh.vertices)
    if before <= target_verts:
        return False
    ratio = target_verts / float(before)
    bm = bmesh.new()
    try:
        bm.from_mesh(mesh)
        # collapse decimate
        bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
        # Prefer decimate_collapse if available
        try:
            bmesh.ops.decimate_collapse(bm, verts=bm.verts[:], faces=bm.faces[:], factor=ratio)
        except Exception:
            # fallback: delete every Nth face roughly — last resort use modifier
            bm.free()
            bm = None
            mod = obj.modifiers.new("DecimateWeb", "DECIMATE")
            mod.ratio = ratio
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            bpy.ops.object.modifier_apply(modifier=mod.name)
            obj.select_set(False)
            log(f"decimate-mod {obj.name}: {before} → {len(obj.data.vertices)}")
            return True
        bm.to_mesh(mesh)
        mesh.update()
        log(f"decimate-bmesh {obj.name}: {before} → {len(mesh.vertices)} (ratio {ratio:.3f})")
    finally:
        if bm is not None:
            bm.free()
    return True


def decimate_all_heavy():
    # Sort heaviest first
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    meshes.sort(key=lambda o: len(o.data.vertices), reverse=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        verts = len(obj.data.vertices)
        if verts <= MAX_VERTS:
            continue
        log(f"→ decimating {obj.name} ({verts} verts)")
        try:
            decimate_object(obj, MAX_VERTS)
        except Exception as e:
            log(f"FAIL decimate {obj.name}: {e}")
        # Drop unused mesh datablocks aggressively
        try:
            bpy.ops.outliner.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
        except Exception:
            for block in bpy.data.meshes:
                if block.users == 0:
                    bpy.data.meshes.remove(block)
        gc.collect()


def strip_displacement_nodes():
    """Displacement doesn't export to glTF — remove to avoid bake confusion."""
    for mat in bpy.data.materials:
        if not mat.node_tree:
            continue
        for n in list(mat.node_tree.nodes):
            if n.type == "DISPLACEMENT":
                mat.node_tree.nodes.remove(n)


def export_all_meshes():
    bpy.ops.object.select_all(action="DESELECT")
    count = 0
    total_verts = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        obj.hide_set(False)
        obj.hide_viewport = False
        obj.hide_render = False
        obj.select_set(True)
        count += 1
        total_verts += len(obj.data.vertices)
    log(f"exporting {count} meshes / {total_verts} verts → {OUT_GLB}")
    bpy.ops.export_scene.gltf(
        filepath=OUT_GLB,
        use_selection=True,
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_cameras=False,
        export_lights=False,
        export_yup=True,
    )
    log(f"DONE {OUT_GLB} bytes={os.path.getsize(OUT_GLB)}")


def main():
    simplify_material_002()
    unpack_missing_images()
    strip_displacement_nodes()
    decimate_all_heavy()
    gc.collect()
    export_all_meshes()


main()
