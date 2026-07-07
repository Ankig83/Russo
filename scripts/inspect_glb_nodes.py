import json
import struct
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = p.read_bytes()
cl = struct.unpack("<I", data[12:16])[0]
g = json.loads(data[20 : 20 + cl])
nodes = g["nodes"]
scenes = g.get("scenes", [])
root_ids = scenes[0]["nodes"] if scenes else [0]

def walk(i, depth=0):
    n = nodes[i]
    name = n.get("name", "")
    mesh = n.get("mesh")
    ch = n.get("children", [])
    tag = " [MESH]" if mesh is not None else ""
    print("  " * depth + f"{i}: {name!r}{tag}")
    for c in ch:
        walk(c, depth + 1)

print("Scene roots:")
for rid in root_ids:
    walk(rid)

names = [n.get("name", "") for n in nodes]
print("\ndoor_right in nodes:", "door_right" in names)
print("door names:", [x for x in names if "door" in x.lower()])

scenes = g.get("scenes", [])
root_ids = scenes[0]["nodes"] if scenes else [0]
meshes = g.get("meshes", [])
print("\nROOT NODES:")
for rid in root_ids:
    n = nodes[rid]
    mi = n.get("mesh")
    prims = len(meshes[mi].get("primitives", [])) if mi is not None else 0
    print(f"  {n.get('name')!r} mesh={mi} primitives={prims} children={len(n.get('children', []))}")
