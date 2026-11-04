"""Detail Cube / Куб* door-frame meshes: world AABB, alignment."""
import bpy
import json
from mathutils import Vector

OUT = r"D:\Temp\inner_door_frames_detail.json"

NAMES = [
    "Cube", "Cube.001",
    "Куб004", "Куб006", "Куб008", "Куб009", "Куб010", "Куб011",
    "Куб012", "Куб013", "Куб028", "Куб043", "Куб059",
    "Куб117", "glasses_V",
]


def aabb(obj):
    corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
    xs = [c.x for c in corners]
    ys = [c.y for c in corners]
    zs = [c.z for c in corners]
    return {
        "min": [round(min(xs), 4), round(min(ys), 4), round(min(zs), 4)],
        "max": [round(max(xs), 4), round(max(ys), 4), round(max(zs), 4)],
        "size": [round(max(xs) - min(xs), 4), round(max(ys) - min(ys), 4), round(max(zs) - min(zs), 4)],
        "center": [
            round((min(xs) + max(xs)) * 0.5, 4),
            round((min(ys) + max(ys)) * 0.5, 4),
            round((min(zs) + max(zs)) * 0.5, 4),
        ],
    }


def main():
    items = []
    for name in NAMES:
        obj = bpy.data.objects.get(name)
        if not obj:
            items.append({"name": name, "missing": True})
            continue
        items.append({
            "name": name,
            "verts": len(obj.data.vertices),
            "edges": len(obj.data.edges),
            "faces": len(obj.data.polygons),
            "materials": [m.name for m in obj.data.materials if m],
            "location": [round(v, 4) for v in obj.location],
            "scale": [round(v, 4) for v in obj.scale],
            "rotation_euler": [round(v, 4) for v in obj.rotation_euler],
            "dimensions": [round(v, 4) for v in obj.dimensions],
            "aabb": aabb(obj),
            "modifiers": [{"type": m.type, "name": m.name} for m in obj.modifiers],
            "use_auto_smooth": getattr(obj.data, "use_auto_smooth", None),
        })

    # Group by approximate X (left/right door)
    left = [i for i in items if not i.get("missing") and i["aabb"]["center"][0] < -0.05]
    right = [i for i in items if not i.get("missing") and i["aabb"]["center"][0] > 0.05]
    mid = [i for i in items if not i.get("missing") and abs(i["aabb"]["center"][0]) <= 0.05]

    report = {"items": items, "left_door": [i["name"] for i in left], "right_door": [i["name"] for i in right], "center": [i["name"] for i in mid]}
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print("WROTE", OUT)
    print("LEFT", report["left_door"])
    print("RIGHT", report["right_door"])
    print("MID", report["center"])


main()
