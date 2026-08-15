"""Inspect lights, camera, world, materials for Russo transfer."""
import bpy
import json

OUT = r"D:\Temp\render_2_inspect.json"


def light_info(obj):
    data = obj.data
    info = {
        "name": obj.name,
        "type": data.type,
        "location": [round(v, 4) for v in obj.matrix_world.translation],
        "rotation_euler": [round(v, 4) for v in obj.matrix_world.to_euler()],
        "energy": getattr(data, "energy", None),
        "color": [round(c, 4) for c in getattr(data, "color", (1, 1, 1))],
        "shadow": getattr(data, "use_shadow", None),
    }
    if data.type == "AREA":
        info["shape"] = data.shape
        info["size"] = round(data.size, 4)
        info["size_y"] = round(getattr(data, "size_y", 0), 4)
    if data.type == "SPOT":
        info["spot_size"] = round(data.spot_size, 4)
        info["spot_blend"] = round(data.spot_blend, 4)
        info["radius"] = round(getattr(data, "shadow_soft_size", 0), 4)
    if data.type == "POINT":
        info["radius"] = round(getattr(data, "shadow_soft_size", 0), 4)
    if data.type == "SUN":
        info["angle"] = round(getattr(data, "angle", 0), 4)
    return info


def camera_info(obj):
    cam = obj.data
    return {
        "name": obj.name,
        "location": [round(v, 4) for v in obj.matrix_world.translation],
        "rotation_euler": [round(v, 4) for v in obj.matrix_world.to_euler()],
        "lens": round(cam.lens, 3),
        "sensor_width": round(cam.sensor_width, 3),
        "clip_start": cam.clip_start,
        "clip_end": cam.clip_end,
        "dof": cam.dof.use_dof,
    }


def world_info(world):
    if not world:
        return None
    info = {"name": world.name, "use_nodes": world.use_nodes}
    if not world.use_nodes:
        return info
    nodes = world.node_tree.nodes
    for n in nodes:
        if n.type == "TEX_ENVIRONMENT" and n.image:
            info["hdri"] = {
                "name": n.image.name,
                "filepath": n.image.filepath,
                "packed": n.image.packed_file is not None,
                "size": list(n.image.size),
            }
        if n.type == "BACKGROUND":
            info["strength"] = round(n.inputs["Strength"].default_value, 4)
            col = n.inputs["Color"].default_value
            info["color"] = [round(c, 4) for c in col[:3]]
            if n.inputs["Color"].is_linked:
                info["color_from"] = n.inputs["Color"].links[0].from_node.type
    return info


def mat_summary(mat):
    procedural = []
    images = []
    principled = False
    if mat.use_nodes and mat.node_tree:
        for n in mat.node_tree.nodes:
            if n.type == "BSDF_PRINCIPLED":
                principled = True
            if n.type in {
                "TEX_NOISE", "TEX_VORONOI", "TEX_WAVE", "MIX_SHADER",
                "BUMP", "DISPLACEMENT", "VALTORGB", "TEX_MUSGRAVE",
            }:
                procedural.append(n.type)
            if n.type == "TEX_IMAGE" and n.image:
                images.append(n.image.name)
    users = [o.name for o in bpy.data.objects if o.type == "MESH" and mat.name in [m.name for m in (o.data.materials or []) if m]]
    return {
        "name": mat.name,
        "principled": principled,
        "procedural": sorted(set(procedural)),
        "images": images[:8],
        "needs_bake": bool(procedural),
        "users": users[:12],
    }


def main():
    scene = bpy.context.scene
    lights = [light_info(o) for o in bpy.data.objects if o.type == "LIGHT"]
    cameras = [camera_info(o) for o in bpy.data.objects if o.type == "CAMERA"]
    meshes = [
        {
            "name": o.name,
            "verts": len(o.data.vertices),
            "materials": [m.name for m in o.data.materials if m],
            "location": [round(v, 4) for v in o.matrix_world.translation],
        }
        for o in bpy.data.objects
        if o.type == "MESH"
    ]
    mats = [mat_summary(m) for m in bpy.data.materials if m.users]
    needs_bake = [m for m in mats if m["needs_bake"]]

    report = {
        "blend": bpy.data.filepath,
        "blender": bpy.app.version_string,
        "engine": scene.render.engine,
        "resolution": [scene.render.resolution_x, scene.render.resolution_y],
        "samples": getattr(scene.cycles, "samples", None) if hasattr(scene, "cycles") else None,
        "view_transform": scene.view_settings.view_transform,
        "look": scene.view_settings.look,
        "exposure": scene.view_settings.exposure,
        "gamma": scene.view_settings.gamma,
        "world": world_info(scene.world),
        "active_camera": scene.camera.name if scene.camera else None,
        "lights": lights,
        "cameras": cameras,
        "mesh_count": len(meshes),
        "meshes_sample": sorted(meshes, key=lambda m: -m["verts"])[:40],
        "materials_needing_bake": needs_bake,
        "materials_ok_count": len(mats) - len(needs_bake),
        "materials_total": len(mats),
        "collections": [c.name for c in bpy.data.collections],
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("WROTE", OUT)
    print("lights", len(lights), "cameras", len(cameras), "bake_mats", len(needs_bake))


main()
