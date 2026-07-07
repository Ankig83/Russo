#!/usr/bin/env python3
"""
Извлекает copper_normal2 и roughness из shkaf.glb,
готовит linear PNG для Three.js (NoColorSpace).

Правая дверь: copper_normal.png
Левая (зеркальные UV): copper_normal_left.png — инверсия G-канала
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
GLB = ROOT / "public" / "models" / "shkaf.glb"
OUT = ROOT / "public" / "textures" / "patina"

# glTF images: copper_normal2=2, copper_metallic2-copper_roughness2=4
NORMAL_IMAGE_IDX = 2
ORM_IMAGE_IDX = 4


def parse_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    off = 12
    json_chunk = bin_chunk = None
    while off < len(data):
        length = struct.unpack("<I", data[off : off + 4])[0]
        kind = data[off + 4 : off + 8]
        chunk = data[off + 8 : off + 8 + length]
        if kind == b"JSON":
            json_chunk = json.loads(chunk)
        elif kind == b"BIN\x00":
            bin_chunk = chunk
        off += 8 + length + ((4 - length % 4) % 4)
    if json_chunk is None or bin_chunk is None:
        raise RuntimeError("Invalid GLB")
    return json_chunk, bin_chunk


def image_bytes(gltf: dict, blob: bytes, image_idx: int) -> bytes:
    img = gltf["images"][image_idx]
    if "bufferView" not in img:
        raise RuntimeError(f"Image {image_idx} has no bufferView")
    bv = gltf["bufferViews"][img["bufferView"]]
    start = bv.get("byteOffset", 0)
    end = start + bv["byteLength"]
    return blob[start:end]


def fix_normal_linear(rgb: np.ndarray) -> np.ndarray:
    """Blender Non-Color → байты как есть, без гамма-коррекции."""
    return rgb.astype(np.uint8)


def flip_normal_green(rgb: np.ndarray) -> np.ndarray:
    """OpenGL normal: инверсия G для зеркальных UV левой половины."""
    out = rgb.copy()
    out[..., 1] = 255 - out[..., 1]
    return out


def extract_roughness(orm_rgb: np.ndarray) -> np.ndarray:
    """Roughness = green-канал combined ORM."""
    return orm_rgb[..., 1].astype(np.uint8)


def main() -> None:
    gltf, blob = parse_glb(GLB)
    OUT.mkdir(parents=True, exist_ok=True)

    normal_raw = Image.open(__import__("io").BytesIO(image_bytes(gltf, blob, NORMAL_IMAGE_IDX))).convert("RGB")
    normal_arr = np.array(normal_raw)
    normal_fixed = fix_normal_linear(normal_arr)
    normal_left = flip_normal_green(normal_fixed)

    Image.fromarray(normal_fixed, "RGB").save(OUT / "copper_normal.png", optimize=True)
    Image.fromarray(normal_left, "RGB").save(OUT / "copper_normal_left.png", optimize=True)

    orm_raw = Image.open(__import__("io").BytesIO(image_bytes(gltf, blob, ORM_IMAGE_IDX))).convert("RGB")
    orm_arr = np.array(orm_raw)
    rough = extract_roughness(orm_arr)
    Image.fromarray(rough, "L").save(OUT / "copper_roughness.png", optimize=True)

    print("Wrote:")
    for name in ("copper_normal.png", "copper_normal_left.png", "copper_roughness.png"):
        p = OUT / name
        print(f"  {p} ({p.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
