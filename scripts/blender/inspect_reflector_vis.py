"""Check reflector ray visibility flags in Blender."""
import bpy
import json

OUT = r"D:\Temp\reflector_vis.json"
names = ["REFLECTOR_BLACK_FLAG", "REFLECTOR_GRAY_RIGHT", "REFLECTOR_WHITE_LEFT"]
report = []
for name in names:
    obj = bpy.data.objects.get(name)
    if not obj:
        report.append({"name": name, "missing": True})
        continue
    report.append({
        "name": name,
        "hide_render": obj.hide_render,
        "hide_viewport": obj.hide_get(),
        "visible_camera": obj.visible_camera,
        "visible_diffuse": obj.visible_diffuse,
        "visible_glossy": obj.visible_glossy,
        "visible_transmission": obj.visible_transmission,
        "visible_volume_scatter": obj.visible_volume_scatter,
        "visible_shadow": obj.visible_shadow,
        "is_holdout": obj.is_holdout,
        "is_shadow_catcher": obj.is_shadow_catcher,
    })
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, indent=2)
print("WROTE", OUT)
for r in report:
    print(r)
