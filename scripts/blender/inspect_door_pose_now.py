import bpy
import math
from mathutils import Vector

for name in ["node_0.006", "node_0.007", "door_left", "door_right", "Cube", "Cube.001", "shkaf"]:
    o = bpy.data.objects.get(name)
    if not o:
        print(name, "MISSING")
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    xs = [v.x for v in bb]
    ys = [v.y for v in bb]
    zs = [v.z for v in bb]
    print(
        name,
        "parent=",
        o.parent.name if o.parent else None,
        "loc=",
        [round(v, 3) for v in o.location],
        "rot_deg=",
        [round(math.degrees(a), 1) for a in o.rotation_euler],
        "x=",
        round(min(xs), 3),
        round(max(xs), 3),
        "y=",
        round(min(ys), 3),
        round(max(ys), 3),
        "z=",
        round(min(zs), 3),
        round(max(zs), 3),
    )
