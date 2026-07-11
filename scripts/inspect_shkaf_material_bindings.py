import json
import struct
from pathlib import Path


MODEL_PATH = Path(__file__).resolve().parents[1] / "public" / "models" / "shkaf.glb"
WANTED_NODES = {
    "Beresta_L",
    "Beresta_R",
    "door_left",
    "door_right",
    "дверка_левая",
    "Дверка_правая",
    "Btresta_inside.001",
    "Btresta_inside.002",
    "Beck_W",
}


def read_glb(path):
    data = path.read_bytes()
    chunk_len = struct.unpack("<I", data[12:16])[0]
    return json.loads(data[20 : 20 + chunk_len])


def main():
    gltf = read_glb(MODEL_PATH)
    nodes = gltf.get("nodes", [])
    meshes = gltf.get("meshes", [])
    materials = gltf.get("materials", [])
    textures = gltf.get("textures", [])
    images = gltf.get("images", [])

    def texinfo(idx):
        if idx is None:
            return None
        tex = textures[idx] if idx < len(textures) else {}
        src = tex.get("source")
        image = images[src] if src is not None and src < len(images) else {}
        return {
            "tex": idx,
            "image": src,
            "name": image.get("name"),
            "mime": image.get("mimeType"),
            "uri": image.get("uri"),
            "bufferView": image.get("bufferView"),
        }

    print("asset:", gltf.get("asset"))
    print("extensionsUsed:", gltf.get("extensionsUsed"))

    for node_idx, node in enumerate(nodes):
        name = node.get("name")
        if name not in WANTED_NODES:
            continue

        mesh_idx = node.get("mesh")
        print(f"\nNODE {node_idx}: {name!r} mesh={mesh_idx} children={node.get('children')}")
        if mesh_idx is None:
            continue

        mesh = meshes[mesh_idx]
        print(f" meshName={mesh.get('name')!r} primitives={len(mesh.get('primitives', []))}")
        for prim_idx, prim in enumerate(mesh.get("primitives", [])):
            mat_idx = prim.get("material")
            mat = materials[mat_idx] if mat_idx is not None else {}
            pbr = mat.get("pbrMetallicRoughness", {})
            print(f"  prim {prim_idx}: matIdx={mat_idx} matName={mat.get('name')!r}")
            print(
                "   factors:",
                "baseColor=", pbr.get("baseColorFactor"),
                "metal=", pbr.get("metallicFactor"),
                "rough=", pbr.get("roughnessFactor"),
            )
            print("   baseTex:", texinfo(pbr.get("baseColorTexture", {}).get("index")))
            print("   mrTex:", texinfo(pbr.get("metallicRoughnessTexture", {}).get("index")))
            print(
                "   normalTex:",
                texinfo(mat.get("normalTexture", {}).get("index")),
                "scale=", mat.get("normalTexture", {}).get("scale"),
            )
            print("   emissive:", mat.get("emissiveFactor"), texinfo(mat.get("emissiveTexture", {}).get("index")))
            print("   alpha:", mat.get("alphaMode"), mat.get("alphaCutoff"), "opacity?", pbr.get("baseColorFactor", [None, None, None, None])[3])
            print("   doubleSided:", mat.get("doubleSided"))
            print("   extensions:", mat.get("extensions"))


if __name__ == "__main__":
    main()
