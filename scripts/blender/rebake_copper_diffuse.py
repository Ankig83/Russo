"""Re-bake aged copper DIFFUSE with Metallic=0 (metal DIFFUSE bake is black)."""
import bpy
import os

SRC = r"D:\Temp\render_2.blend1.blend"
OUT = r"D:\PycharmProjects\Russo\public\textures\aged-copper\aged_copper_baseColor.png"
RES = 1024
SAMPLES = 8


def log(msg):
    print(msg, flush=True)


def main():
    bpy.ops.wm.open_mainfile(filepath=SRC)
    mat = bpy.data.materials.get("Metal Brown Medium")
    if not mat:
        raise RuntimeError("Metal Brown Medium missing")

    for n in mat.node_tree.nodes:
        if n.type == "AMBIENT_OCCLUSION":
            n.mute = True
        if n.type == "BSDF_PRINCIPLED":
            n.inputs["Metallic"].default_value = 0.0
            log("Metallic → 0 for diffuse bake")

    for obj in bpy.data.objects:
        obj.hide_render = True

    bpy.ops.mesh.primitive_plane_add(size=2, location=(50, 50, 50))
    plane = bpy.context.active_object
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
    scene.cycles.bake_type = "DIFFUSE"
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    scene.render.bake.use_pass_color = True
    scene.render.bake.margin = 4

    img = bpy.data.images.new("copper_diff", RES, RES, alpha=False)
    img.colorspace_settings.name = "sRGB"
    nodes = mat.node_tree.nodes
    for n in list(nodes):
        if n.name.startswith("BAKE_TARGET"):
            nodes.remove(n)
    tex = nodes.new("ShaderNodeTexImage")
    tex.name = "BAKE_TARGET"
    tex.image = img
    nodes.active = tex
    for n in nodes:
        n.select = n == tex

    bpy.context.view_layer.objects.active = plane
    plane.select_set(True)
    log("BAKE DIFFUSE")
    bpy.ops.object.bake(type="DIFFUSE")
    img.filepath_raw = OUT
    img.file_format = "PNG"
    img.save()
    log(f"saved {OUT} size={os.path.getsize(OUT)}")


main()
