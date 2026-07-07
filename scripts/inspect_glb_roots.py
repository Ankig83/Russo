import json
import struct
import sys
from pathlib import Path

p = Path(sys.argv[1])
data = p.read_bytes()
cl = struct.unpack("<I", data[12:16])[0]
g = json.loads(data[20 : 20 + cl])
nodes = g["nodes"]
root_ids = g["scenes"][0]["nodes"]
meshes = g.get("meshes", [])

def safe(s):
    return repr(s)

print("ROOT NODES:")
for rid in root_ids:
    n = nodes[rid]
    mi = n.get("mesh")
    prims = len(meshes[mi].get("primitives", [])) if mi is not None else 0
    print(f"  {safe(n.get('name'))} mesh={mi} primitives={prims} children={len(n.get('children', []))}")

names = [n.get("name", "") for n in nodes]
print("door nodes:", [safe(x) for x in names if "door" in x.lower()])
