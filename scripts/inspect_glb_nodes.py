import json
import struct
import sys
from pathlib import Path

path = Path(sys.argv[1])
data = path.read_bytes()
cl = struct.unpack("<I", data[12:16])[0]
g = json.loads(data[20 : 20 + cl])

print("size_mb:", round(len(data) / 1024 / 1024, 2))
print("meshes:", len(g.get("meshes", [])))
print("nodes:", len(g.get("nodes", [])))
print("materials:", len(g.get("materials", [])))

nodes = g.get("nodes", [])
meshes = g.get("meshes", [])
accessors = g.get("accessors", [])

print("\n--- nodes ---")
for i, n in enumerate(nodes):
    mesh_idx = n.get("mesh")
    mesh_name = meshes[mesh_idx].get("name") if mesh_idx is not None else None
    print(
        f"  [{i}] {n.get('name')!r} mesh={mesh_idx} ({mesh_name!r}) "
        f"children={n.get('children')} tr={n.get('translation')}"
    )

if len(sys.argv) > 2:
    target = sys.argv[2]
    for i, n in enumerate(nodes):
        if n.get("name") == target and "mesh" in n:
            pos_idx = meshes[n["mesh"]]["primitives"][0]["attributes"]["POSITION"]
            acc = accessors[pos_idx]
            print(f"\n{target} bbox min={acc.get('min')} max={acc.get('max')}")
