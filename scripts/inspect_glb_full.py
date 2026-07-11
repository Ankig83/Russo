import json
import math
import struct
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = p.read_bytes()
cl = struct.unpack("<I", data[12:16])[0]
g = json.loads(data[20 : 20 + cl])

print("size_mb:", round(len(data) / 1024 / 1024, 3))
print("generator:", g.get("asset", {}).get("generator"))
print("extensionsUsed:", g.get("extensionsUsed"))
print("extensionsRequired:", g.get("extensionsRequired"))

meshes = g.get("meshes", [])
accessors = g.get("accessors", [])
images = g.get("images", [])
textures = g.get("textures", [])

mins = [math.inf] * 3
maxs = [-math.inf] * 3
for mesh in meshes:
    for prim in mesh.get("primitives", []):
        pos_idx = prim.get("attributes", {}).get("POSITION")
        if pos_idx is None:
            continue
        acc = accessors[pos_idx]
        for j in range(3):
            mins[j] = min(mins[j], acc["min"][j])
            maxs[j] = max(maxs[j], acc["max"][j])

print("bounds min:", [round(x, 4) for x in mins])
print("bounds max:", [round(x, 4) for x in maxs])
print("bounds size:", [round(maxs[j] - mins[j], 4) for j in range(3)])

print("images:")
for i, img in enumerate(images):
    print(f"  [{i}] name={img.get('name')!r} mime={img.get('mimeType')} bufferView={img.get('bufferView')}")

print("textures:")
for i, t in enumerate(textures):
    print(f"  [{i}] source={t.get('source')} sampler={t.get('sampler')}")

for i, mat in enumerate(g.get("materials", [])):
    pbr = mat.get("pbrMetallicRoughness", {})
    print(f"material[{i}] name={mat.get('name')!r}")
    print("  baseColorFactor:", pbr.get("baseColorFactor"))
    print("  metallicFactor:", pbr.get("metallicFactor"))
    print("  roughnessFactor:", pbr.get("roughnessFactor"))
    print("  baseColorTexture:", pbr.get("baseColorTexture"))
    print("  metallicRoughnessTexture:", pbr.get("metallicRoughnessTexture"))
    print("  normalTexture:", mat.get("normalTexture"))
    print("  emissiveTexture:", mat.get("emissiveTexture"))
    print("  doubleSided:", mat.get("doubleSided"))
