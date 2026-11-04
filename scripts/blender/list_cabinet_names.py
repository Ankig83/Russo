"""List object names relevant to Russo interactivity."""
import bpy
import json

OUT = r"D:\Temp\cabinet_names.json"
keys = (
    "door", "drawer", "tabl", "shkaf", "beresta", "leg", "ручка", "ruchka",
    "Beck", "letter", "medal", "node_0", "box_d", "closed",
)
names = sorted(o.name for o in bpy.data.objects if o.type == "MESH")
matched = [n for n in names if any(k.lower() in n.lower() for k in keys)]
report = {
    "total_mesh": len(names),
    "matched": matched,
    "all": names,
}
with open(OUT, "w", encoding="utf-8") as f:
    json.dump(report, f, ensure_ascii=False, indent=2)
print("WROTE", OUT, "matched", len(matched), "total", len(names))
