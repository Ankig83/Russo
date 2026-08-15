"""Export CINEMATIC studio rig → JSON + unpack floor/cyclorama textures."""
import bpy
import json
import math
import os
from mathutils import Vector

OUT_JSON = r"D:\Temp\cinematic_rig.json"
OUT_TEX = r"D:\PycharmProjects\Russo\public\textures\cinematic-studio"
os.makedirs(OUT_TEX, exist_ok=True)

# Blender Z-up → Three Y-up (glTF convention used in Russo)
def b2t(v):
    return [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]


def light_forward(obj):
    # Area/Spot shine along -Z local
    return (obj.matrix_world.to_quaternion() @ Vector((0, 0, -1))).normalized()


def aim_point(obj, distance=3.0):
    origin = obj.matrix_world.translation
    return origin + light_forward(obj) * distance


def color_hex(c):
    r, g, b = [max(0, min(1, x)) for x in c[:3]]
    return "#{:02x}{:02x}{:02x}".format(int(r * 255), int(g * 255), int(b * 255))


def unpack_images(mat_name, prefix):
    mat = bpy.data.materials.get(mat_name)
    if not mat or not mat.node_tree:
        return {}
    paths = {}
    for n in mat.node_tree.nodes:
        if n.type != "TEX_IMAGE" or not n.image:
            continue
        img = n.image
        # classify by name
        low = img.name.lower()
        if "color" in low or "diff" in low or "albedo" in low:
            key = "color"
        elif "rough" in low:
            key = "roughness"
        elif "metal" in low:
            key = "metalness"
        elif "normal" in low:
            key = "normal"
        elif "disp" in low or "height" in low:
            key = "displacement"
        else:
            key = img.name.replace(" ", "_")
        ext = ".png" if "normal" in low or img.file_format in {"PNG", "OPEN_EXR"} else ".jpg"
        # prefer png for all packed
        if img.packed_file:
            ext = ".png"
        out = os.path.join(OUT_TEX, f"{prefix}_{key}{ext}")
        img.filepath_raw = out
        img.file_format = "PNG" if ext == ".png" else "JPEG"
        try:
            img.save()
            paths[key] = f"textures/cinematic-studio/{prefix}_{key}{ext}"
            print("saved", out)
        except Exception as e:
            print("fail save", img.name, e)
    return paths


def main():
    cinematic = bpy.data.collections.get("CINEMATIC_STUDIO")
    cinematic_names = set()
    if cinematic:
        for o in cinematic.all_objects:
            cinematic_names.add(o.name)

    lights = []
    for obj in bpy.data.objects:
        if obj.type != "LIGHT":
            continue
        # Prefer CINEMATIC collection; fallback to classic names
        classic = obj.name in {"KEY_LIGHT", "FILL_LIGHT", "BACK_LIGHT", "TOP_RIM_LIGHT"}
        in_col = obj.name in cinematic_names
        if not (classic or in_col):
            continue
        if obj.name.startswith("PREMIUM"):
            continue

        data = obj.data
        origin = obj.matrix_world.translation
        aim = aim_point(obj, 4.0)
        # also aim toward cabinet center at light height plane intersection-ish
        cabinet = Vector((0.0, 0.0, 1.3))
        # distance along ray to closest approach to cabinet
        fwd = light_forward(obj)
        to_cab = cabinet - origin
        t = to_cab.dot(fwd)
        aim_cab = origin + fwd * max(0.5, t)

        entry = {
            "name": obj.name,
            "hide": obj.hide_get() or obj.hide_render,
            "blender": {
                "location": [round(v, 4) for v in origin],
                "energy": data.energy,
                "color": [round(c, 4) for c in data.color],
                "type": data.type,
                "shape": getattr(data, "shape", None),
                "size": round(getattr(data, "size", 0), 4),
                "size_y": round(getattr(data, "size_y", 0), 4),
            },
            "three": {
                "position": b2t(origin),
                "aimAt": b2t(aim_cab),
                "aimAlong": b2t(aim),
                "color": color_hex(data.color),
                "energy": data.energy,
            },
        }
        if data.type == "AREA":
            # RectArea: disk → square of diameter; rect → size/size_y
            if data.shape == "DISK":
                entry["three"]["width"] = round(data.size, 4)
                entry["three"]["height"] = round(data.size, 4)
            else:
                entry["three"]["width"] = round(data.size, 4)
                entry["three"]["height"] = round(data.size_y, 4)
            # heuristic: Watts → three intensity (empirical, tune later)
            area = max(0.1, entry["three"]["width"] * entry["three"]["height"])
            entry["three"]["intensity"] = round(data.energy / (80.0 * math.sqrt(area)), 4)
        lights.append(entry)

    cam = bpy.data.objects.get("CINEMATIC_CAMERA")
    camera = None
    if cam:
        # look along -Z
        fwd = cam.matrix_world.to_quaternion() @ Vector((0, 0, -1))
        # target ~ cabinet mid
        origin = cam.matrix_world.translation
        # intersect with plane z=1.4 or distance 12
        target = origin + fwd * 12.0
        # better: project toward (0,0,1.4)
        cab = Vector((0.0, 0.0, 1.4))
        t = (cab - origin).dot(fwd)
        if t > 0.5:
            target = origin + fwd * t
        camera = {
            "name": cam.name,
            "lens": cam.data.lens,
            "sensor_width": cam.data.sensor_width,
            "blender_location": [round(v, 4) for v in origin],
            "three": {
                "position": b2t(origin),
                "target": b2t(target),
                "fov": round(
                    2 * math.degrees(math.atan((cam.data.sensor_width / 2) / cam.data.lens)),
                    3,
                ),
            },
        }

    floor_tex = unpack_images("Mossy Dark Rock", "floor")
    wall_tex = unpack_images("Dark Mottled Metal", "cyclorama")

    # studio mesh transforms
    studio = {}
    for name in ("STUDIO_FLOOR", "STUDIO_CYCLORAMA"):
        o = bpy.data.objects.get(name)
        if not o:
            continue
        studio[name] = {
            "location": b2t(o.matrix_world.translation),
            "scale": [round(v, 4) for v in o.matrix_world.to_scale()],
            "dimensions": [round(v, 4) for v in o.dimensions],
        }

    world = bpy.context.scene.world
    world_strength = None
    if world and world.node_tree:
        bg = next((n for n in world.node_tree.nodes if n.type == "BACKGROUND"), None)
        if bg:
            world_strength = bg.inputs["Strength"].default_value

    report = {
        "lights": lights,
        "camera": camera,
        "world_strength": world_strength,
        "exposure": bpy.context.scene.view_settings.exposure,
        "view_transform": bpy.context.scene.view_settings.view_transform,
        "floor_textures": floor_tex,
        "cyclorama_textures": wall_tex,
        "studio_meshes": studio,
        "cinematic_collection_objects": sorted(cinematic_names),
    }
    with open(OUT_JSON, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("WROTE", OUT_JSON)


main()
