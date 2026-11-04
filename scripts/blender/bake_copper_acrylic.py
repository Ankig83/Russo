"""
Bake Metal Brown Medium (aged copper) + Sage Green Venetian Plaster (acrylic)
to seamless PBR tiles, then swap materials to Principled-only for GLB export.

Out:
  public/textures/aged-copper/
  public/textures/green-acrylic/
"""
import bpy
import os
import math
from mathutils import Vector

BLEND = r"D:\Temp\render_2.blend1.blend"
OUT_COPPER = r"D:\PycharmProjects\Russo\public\textures\aged-copper"
OUT_ACRYLIC = r"D:\PycharmProjects\Russo\public\textures\green-acrylic"
RES_COPPER = 1024
RES_ACRYLIC = 1024
SAMPLES = 8


def log(msg):
    print(msg, flush=True)


def mute_heavy_nodes(mat):
    """AO makes plane bake crawl on CPU — mute it for bake only."""
    if not mat or not mat.use_nodes:
        return
    for n in mat.node_tree.nodes:
        if n.type == "AMBIENT_OCCLUSION":
            n.mute = True
            log(f"  muted {n.type} {n.name}")


def ensure_dir(path):
    os.makedirs(path, exist_ok=True)


def make_bake_image(name, res, is_data=False):
    img = bpy.data.images.new(name, width=res, height=res, alpha=False, float_buffer=False)
    img.colorspace_settings.name = "Non-Color" if is_data else "sRGB"
    return img


def ensure_image_node(mat, img):
    nodes = mat.node_tree.nodes
    # remove previous bake targets named BAKE_*
    for n in list(nodes):
        if n.name.startswith("BAKE_TARGET"):
            nodes.remove(n)
    node = nodes.new("ShaderNodeTexImage")
    node.name = "BAKE_TARGET"
    node.image = img
    nodes.active = node
    for n in nodes:
        n.select = n == node
    return node


def bake_plane(mat_name, out_dir, res, channels):
    """channels: list of (bake_type, filename, is_data)"""
    ensure_dir(out_dir)
    mat = bpy.data.materials.get(mat_name)
    if not mat:
        raise RuntimeError(f"material missing: {mat_name}")

    mute_heavy_nodes(mat)

    # isolated plane in a clean collection — hide rest of scene from bake rays
    for obj in bpy.data.objects:
        obj.hide_render = True

    bpy.ops.object.select_all(action="DESELECT")
    bpy.ops.mesh.primitive_plane_add(size=2, location=(50, 50, 50))
    plane = bpy.context.active_object
    plane.name = f"_bake_plane_{mat_name}"
    plane.hide_render = False
    if plane.data.materials:
        plane.data.materials[0] = mat
    else:
        plane.data.materials.append(mat)

    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.unwrap(method="ANGLE_BASED", margin=0.001)
    bpy.ops.object.mode_set(mode="OBJECT")

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    try:
        scene.cycles.device = "CPU"
    except Exception:
        pass
    scene.cycles.samples = SAMPLES
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 4
    scene.render.bake.use_clear = True

    results = {}
    for bake_type, filename, is_data in channels:
        img = make_bake_image(f"bake_{mat_name}_{bake_type}", res, is_data=is_data)
        ensure_image_node(mat, img)
        scene.cycles.bake_type = bake_type
        if bake_type == "DIFFUSE":
            scene.render.bake.use_pass_direct = False
            scene.render.bake.use_pass_indirect = False
            scene.render.bake.use_pass_color = True
        log(f"BAKE {mat_name} {bake_type} → {filename}")
        bpy.context.view_layer.objects.active = plane
        plane.select_set(True)
        bpy.ops.object.bake(type=bake_type)
        path = os.path.join(out_dir, filename)
        img.filepath_raw = path
        img.file_format = "PNG"
        img.save()
        results[bake_type] = path
        log(f"  saved {path}")

    bpy.data.objects.remove(plane, do_unlink=True)
    for obj in bpy.data.objects:
        obj.hide_render = False
    return results


def make_principled_from_maps(name, maps, *, metallic, roughness_fallback=0.4):
    """maps: dict with DIFFUSE, ROUGHNESS, NORMAL paths (optional EMIT/AO)."""
    # replace or create
    old = bpy.data.materials.get(name)
    if old:
        bpy.data.materials.remove(old)
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nodes = nt.nodes
    links = nt.links
    nodes.clear()

    out = nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    bsdf = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (100, 0)
    links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Metallic"].default_value = metallic

    def add_tex(path, label, colorspace, loc):
        if not path or not os.path.isfile(path):
            return None
        img = bpy.data.images.load(path)
        img.colorspace_settings.name = colorspace
        tex = nodes.new("ShaderNodeTexImage")
        tex.location = loc
        tex.image = img
        tex.label = label
        return tex

    diff = add_tex(maps.get("DIFFUSE"), "BaseColor", "sRGB", (-400, 200))
    rough = add_tex(maps.get("ROUGHNESS"), "Roughness", "Non-Color", (-400, 0))
    norm = add_tex(maps.get("NORMAL"), "Normal", "Non-Color", (-400, -200))

    if diff:
        links.new(diff.outputs["Color"], bsdf.inputs["Base Color"])
    if rough:
        links.new(rough.outputs["Color"], bsdf.inputs["Roughness"])
    else:
        bsdf.inputs["Roughness"].default_value = roughness_fallback
    if norm:
        nmap = nodes.new("ShaderNodeNormalMap")
        nmap.location = (-100, -200)
        links.new(norm.outputs["Color"], nmap.inputs["Color"])
        links.new(nmap.outputs["Normal"], bsdf.inputs["Normal"])
    return mat


def replace_material(old_name, new_mat):
    old = bpy.data.materials.get(old_name)
    if not old:
        log(f"skip replace, missing {old_name}")
        return 0
    count = 0
    for obj in bpy.data.objects:
        if obj.type != "MESH":
            continue
        for slot in obj.material_slots:
            if slot.material == old:
                slot.material = new_mat
                count += 1
    log(f"replaced {old_name} → {new_mat.name} on {count} slots")
    return count


def main():
    log(f"BLEND {BLEND}")
    # already opened via CLI arg; if empty, open
    if not bpy.data.filepath:
        bpy.ops.wm.open_mainfile(filepath=BLEND)

    # Prefer GPU if available
    prefs = bpy.context.preferences.addons.get("cycles")
    if prefs:
        cprefs = prefs.preferences
        try:
            cprefs.compute_device_type = "CUDA"
            for device in cprefs.devices:
                device.use = True
            log("Cycles CUDA devices enabled")
        except Exception as e:
            log(f"CUDA setup skip: {e}")

    copper_maps = bake_plane(
        "Metal Brown Medium",
        OUT_COPPER,
        RES_COPPER,
        [
            ("DIFFUSE", "aged_copper_baseColor.png", False),
            ("ROUGHNESS", "aged_copper_roughness.png", True),
            ("NORMAL", "aged_copper_normal.png", True),
        ],
    )
    acrylic_maps = bake_plane(
        "Sage Green Venetian Plaster",
        OUT_ACRYLIC,
        RES_ACRYLIC,
        [
            ("DIFFUSE", "green_acrylic_baseColor.png", False),
            ("ROUGHNESS", "green_acrylic_roughness.png", True),
            ("NORMAL", "green_acrylic_normal.png", True),
        ],
    )

    copper = make_principled_from_maps(
        "M_AgedCopper",
        copper_maps,
        metallic=1.0,
        roughness_fallback=0.45,
    )
    acrylic = make_principled_from_maps(
        "M_GreenAcrylic",
        acrylic_maps,
        metallic=0.0,
        roughness_fallback=0.35,
    )

    replace_material("Metal Brown Medium", copper)
    replace_material("Sage Green Venetian Plaster", acrylic)

    # Save a working blend copy (optional) — not required for export
    out_blend = r"D:\Temp\render_2_baked_mats.blend"
    bpy.ops.wm.save_as_mainfile(filepath=out_blend, copy=True)
    log(f"SAVED {out_blend}")
    log("DONE bake")


main()
