import json
import struct
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = p.read_bytes()
cl = struct.unpack("<I", data[12:16])[0]
g = json.loads(data[20 : 20 + cl])
print("materials:")
for m in g.get("materials", []):
    pbr = m.get("pbrMetallicRoughness", {})
    has = []
    if pbr.get("baseColorTexture"):
        has.append("color")
    if pbr.get("metallicRoughnessTexture"):
        has.append("mr")
    if m.get("normalTexture"):
        has.append("normal")
    print(
        f"  {m.get('name')}: tex={has} "
        f"metal={pbr.get('metallicFactor')} rough={pbr.get('roughnessFactor')}"
    )
print("door/drawer nodes:")
for n in g.get("nodes", []):
    nm = n.get("name", "")
    if any(x in nm for x in ["door", "drawer", "shkaf", "leg"]):
        print(f"  {nm}")
