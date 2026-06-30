# Blender 4.x — материал «Медь с патиной» по схеме Russo
# Run Script (Text Editor, нужен 3D Viewport)
#
# Создаёт материал Copper_Patina_Russo и назначает на door_left / door_right
# (или на выделенные объекты, если ASSIGN_SELECTED = True)

import bpy

MATERIAL_NAME = "Copper_Patina_Russo"
ASSIGN_SELECTED = False
TARGET_OBJECTS = ("door_left", "door_right")

# --- параметры со схемы ---
COPPER_HEX = "#72290D"
PATINA_HEX = "#0D4033"
COPPER_METALLIC = 1.0
COPPER_ROUGHNESS = 0.35
PATINA_METALLIC = 0.0
PATINA_ROUGHNESS = 0.85

NOISE_SCALE = 6.0       # на схеме 4–8
NOISE_DETAIL = 6.0
NOISE_DISTORTION = 0.0
MUSGRAVE_SCALE = 3.0
MUSGRAVE_DETAIL = 8.0


def _musgrave_noise_node(tree, location, label):
    """Blender 4.x: ShaderNodeTexMusgrave → ShaderNodeTexNoise (fBM)."""
    node = tree.nodes.new("ShaderNodeTexNoise")
    node.location = location
    node.label = label
    node.noise_type = "FBM"
    node.inputs["Scale"].default_value = MUSGRAVE_SCALE
    # После merge Detail на 1 меньше при том же виде (см. manual Noise Texture).
    node.inputs["Detail"].default_value = max(0.0, MUSGRAVE_DETAIL - 1.0)
    node.inputs["Distortion"].default_value = 0.0
    if hasattr(node, "normalize"):
        node.normalize = False
    return node


def _hex_rgba(hex_color: str):
    h = hex_color.lstrip("#")
    return (
        int(h[0:2], 16) / 255,
        int(h[2:4], 16) / 255,
        int(h[4:6], 16) / 255,
        1.0,
    )


def _mix_node(tree, data_type="RGBA", blend_type="MULTIPLY"):
    node = tree.nodes.new("ShaderNodeMix")
    node.data_type = data_type
    node.blend_type = blend_type
    if data_type == "RGBA" and blend_type != "MIX":
        for key in ("Factor", "Factor_Float"):
            if key in node.inputs:
                node.inputs[key].default_value = 1.0
                break
    return node


def _mix_rgba_input(node, which):
    """A/B color input на ShaderNodeMix (Blender 3.4+)."""
    key = f"{which}_Color"
    if key in node.inputs:
        return node.inputs[key]
    for sock in node.inputs:
        if sock.type == "RGBA" and sock.name.startswith(which):
            return sock
    return node.inputs[6 if which == "A" else 7]


def _mix_rgba_output(node):
    if "Result_Color" in node.outputs:
        return node.outputs["Result_Color"]
    for sock in node.outputs:
        if sock.type == "RGBA":
            return sock
    return node.outputs[2]


def _color_ramp(tree, pos=(0, 0), label=""):
    ramp = tree.nodes.new("ShaderNodeValToRGB")
    ramp.location = pos
    ramp.label = label
    return ramp


def build_copper_patina_material():
    mat = bpy.data.materials.get(MATERIAL_NAME)
    if mat is None:
        mat = bpy.data.materials.new(MATERIAL_NAME)
    mat.use_nodes = True

    tree = mat.node_tree
    nodes = tree.nodes
    links = tree.links
    nodes.clear()

    # --- output ---
    output = nodes.new("ShaderNodeOutputMaterial")
    output.location = (1100, 0)

    mix_shader = nodes.new("ShaderNodeMixShader")
    mix_shader.location = (880, 0)
    mix_shader.label = "Шейдер смешения"

    # --- PATINA BSDF ---
    bsdf_patina = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf_patina.location = (580, -260)
    bsdf_patina.label = "Патина"
    bsdf_patina.inputs["Base Color"].default_value = _hex_rgba(PATINA_HEX)
    bsdf_patina.inputs["Metallic"].default_value = PATINA_METALLIC
    bsdf_patina.inputs["Roughness"].default_value = PATINA_ROUGHNESS

    # --- COPPER BSDF ---
    bsdf_copper = nodes.new("ShaderNodeBsdfPrincipled")
    bsdf_copper.location = (580, 260)
    bsdf_copper.label = "Медь"
    bsdf_copper.inputs["Metallic"].default_value = COPPER_METALLIC
    bsdf_copper.inputs["Roughness"].default_value = COPPER_ROUGHNESS

    copper_base = nodes.new("ShaderNodeRGB")
    copper_base.location = (0, 420)
    copper_base.label = "Медь #72290D"
    copper_base.outputs[0].default_value = _hex_rgba(COPPER_HEX)

    # Виньетка: Layer Weight → Color Ramp → Base Color меди
    layer_vignette = nodes.new("ShaderNodeLayerWeight")
    layer_vignette.location = (-420, 300)
    layer_vignette.label = "Projection (vignette)"
    layer_vignette.inputs["Blend"].default_value = 0.5

    ramp_vignette = _color_ramp(tree, (-180, 300), "центр светлый / края ≈ чёрный")
    ramp_vignette.color_ramp.elements[0].position = 0.0
    ramp_vignette.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp_vignette.color_ramp.elements[1].position = 1.0
    ramp_vignette.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

    mix_copper_color = _mix_node(tree, "RGBA", "MULTIPLY")
    mix_copper_color.location = (280, 360)
    mix_copper_color.label = "vignette × медь"

    # --- маска патины ---
    tex_coord = nodes.new("ShaderNodeTexCoord")
    tex_coord.location = (-820, -40)

    mapping = nodes.new("ShaderNodeMapping")
    mapping.location = (-640, -40)

    noise = nodes.new("ShaderNodeTexNoise")
    noise.location = (-420, 80)
    noise.label = "Noise 4–8 / Detail 6"
    noise.inputs["Scale"].default_value = NOISE_SCALE
    noise.inputs["Detail"].default_value = NOISE_DETAIL
    noise.inputs["Distortion"].default_value = NOISE_DISTORTION

    musgrave = _musgrave_noise_node(
        tree, (-420, -120), "Musgrave→Noise fBM 3 / Detail 8"
    )

    math_nm = nodes.new("ShaderNodeMath")
    math_nm.location = (-220, -20)
    math_nm.operation = "MULTIPLY"
    math_nm.label = "Noise × Musgrave"

    ramp_patina = _color_ramp(tree, (-20, 40), "контраст пятен патины")
    ramp_patina.color_ramp.elements[0].position = 0.42
    ramp_patina.color_ramp.elements[0].color = (0.0, 0.0, 0.0, 1.0)
    ramp_patina.color_ramp.elements[1].position = 0.58
    ramp_patina.color_ramp.elements[1].color = (1.0, 1.0, 1.0, 1.0)

    layer_edges = nodes.new("ShaderNodeLayerWeight")
    layer_edges.location = (-420, -320)
    layer_edges.label = "Projection → края темнее"
    layer_edges.inputs["Blend"].default_value = 0.5

    ramp_edges = _color_ramp(tree, (-20, -280), "края → тёмная медь")
    dark_copper = _hex_rgba("#4a1808")
    ramp_edges.color_ramp.elements[0].position = 0.0
    ramp_edges.color_ramp.elements[0].color = (1.0, 1.0, 1.0, 1.0)
    ramp_edges.color_ramp.elements[1].position = 1.0
    ramp_edges.color_ramp.elements[1].color = (*dark_copper[:3], 1.0)

    mix_mask = _mix_node(tree, "RGBA", "MULTIPLY")
    mix_mask.location = (280, -80)
    mix_mask.label = "итоговая маска"

    # --- links ---
    links.new(tex_coord.outputs["Object"], mapping.inputs["Vector"])
    links.new(mapping.outputs["Vector"], noise.inputs["Vector"])
    links.new(mapping.outputs["Vector"], musgrave.inputs["Vector"])

    links.new(noise.outputs["Fac"], math_nm.inputs[0])
    links.new(musgrave.outputs["Fac"], math_nm.inputs[1])
    links.new(math_nm.outputs["Value"], ramp_patina.inputs["Fac"])

    links.new(layer_edges.outputs["Facing"], ramp_edges.inputs["Fac"])

    links.new(ramp_patina.outputs["Color"], _mix_rgba_input(mix_mask, "A"))
    links.new(ramp_edges.outputs["Color"], _mix_rgba_input(mix_mask, "B"))

    links.new(layer_vignette.outputs["Facing"], ramp_vignette.inputs["Fac"])
    links.new(copper_base.outputs["Color"], _mix_rgba_input(mix_copper_color, "A"))
    links.new(ramp_vignette.outputs["Color"], _mix_rgba_input(mix_copper_color, "B"))
    links.new(_mix_rgba_output(mix_copper_color), bsdf_copper.inputs["Base Color"])

    links.new(_mix_rgba_output(mix_mask), mix_shader.inputs["Fac"])
    links.new(bsdf_copper.outputs["BSDF"], mix_shader.inputs[1])
    links.new(bsdf_patina.outputs["BSDF"], mix_shader.inputs[2])
    links.new(mix_shader.outputs["Shader"], output.inputs["Surface"])

    return mat


def assign_material(obj, mat):
    if obj.type != "MESH":
        return
    if not obj.data.materials:
        obj.data.materials.append(mat)
    else:
        obj.data.materials[0] = mat


def main():
    mat = build_copper_patina_material()
    assigned = []

    if ASSIGN_SELECTED:
        for obj in bpy.context.selected_objects:
            assign_material(obj, mat)
            assigned.append(obj.name)
    else:
        for name in TARGET_OBJECTS:
            obj = bpy.data.objects.get(name)
            if obj:
                assign_material(obj, mat)
                assigned.append(name)

    print(f"OK: материал «{MATERIAL_NAME}» создан.")
    if assigned:
        print("  Назначен на:", ", ".join(assigned))
    else:
        print("  Объекты не найдены — назначьте материал вручную или включите ASSIGN_SELECTED.")


main()
