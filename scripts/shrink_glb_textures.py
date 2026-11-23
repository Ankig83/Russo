"""
Уменьшает картинки внутри GLB. Геометрия (Draco/meshopt) не перекодируется: байты остаются как есть.
Оригинал не трогает.

  python scripts/shrink_glb_textures.py [in.glb] [out.glb]

По умолчанию:
  public/models/shkaf-cabinet.glb -> public/models/_opt_work/shkaf-cabinet.slim.glb

Размеры задаются таблицей RULES ниже: материал -> максимальная сторона (px) для всех карт
или для отдельных слотов (base / mr / normal). Картинки без правила не трогаются.
"""
from __future__ import annotations

import json
import re
import struct
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'public' / 'models' / 'shkaf-cabinet.glb'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else ROOT / 'public' / 'models' / '_opt_work' / 'shkaf-cabinet.slim.glb'

# (regex по имени материала, размер для всех слотов | {слот: размер})
RULES = [
    # Material.006 (береста и кожа ручек), Material.003 (ножки) и door_*_copper
    # не сжимать: на 512/1024 береста плывёт, кожа слипается, в ножках дыры от нормали.
    (r'^Material\.00[47]$', 1024),                  # таблички node_0.001, node_0.002
    (r'^Dark Walnut', {'mr': 1024}),                # орех: шероховатость не нуждается в 2048
    (r'^Glass', 512),                               # смазы на стекле
    (r'Johnnie|M_JW_Foil|^Mt\.counter$|^Decanter$|^Material\.0(08|09|11)$', 1024),  # реквизит
    (r'^M_Leather_PBR', 1024),                      # кожаные рамки ящиков
]
Q_COLOR, Q_DATA = 85, 90   # WebP: цвет можно сильнее, нормали и металл/шероховатость аккуратнее


def read_glb(path: Path):
    data = path.read_bytes()
    assert data[:4] == b'glTF', 'не GLB'
    off, js, blob = 12, None, b''
    while off < len(data):
        ln, typ = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            blob = chunk
        off += 8 + ln
    return js, blob


def write_glb(path: Path, js: dict, blob: bytes) -> None:
    jb = json.dumps(js, separators=(',', ':'), ensure_ascii=False).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    blob = bytes(blob) + b'\0' * ((4 - len(blob) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(blob)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, total))
        f.write(struct.pack('<I4s', len(jb), b'JSON') + jb)
        f.write(struct.pack('<I4s', len(blob), b'BIN\0') + blob)


def tex_source(js: dict, ti: int):
    t = js['textures'][ti]
    return t.get('extensions', {}).get('EXT_texture_webp', {}).get('source', t.get('source'))


def image_usage(js: dict) -> dict[int, list[tuple[str, str]]]:
    """image index -> [(имя материала, слот)]"""
    use: dict[int, list[tuple[str, str]]] = {}
    for mat in js.get('materials', []):
        pbr = mat.get('pbrMetallicRoughness', {})
        ext = mat.get('extensions', {})
        slots = {
            'base': pbr.get('baseColorTexture'),
            'mr': pbr.get('metallicRoughnessTexture'),
            'normal': mat.get('normalTexture'),
            'occlusion': mat.get('occlusionTexture'),
            'emissive': mat.get('emissiveTexture'),
            'transmission': ext.get('KHR_materials_transmission', {}).get('transmissionTexture'),
            'specular': ext.get('KHR_materials_specular', {}).get('specularTexture'),
            'sheen': ext.get('KHR_materials_sheen', {}).get('sheenColorTexture'),
            'clearcoat': ext.get('KHR_materials_clearcoat', {}).get('clearcoatTexture'),
        }
        for slot, info in slots.items():
            if info is not None:
                src = tex_source(js, info['index'])
                if src is not None:
                    use.setdefault(src, []).append((mat.get('name', ''), slot))
    return use


def target_size(uses: list[tuple[str, str]]) -> int | None:
    """Если картинку используют несколько материалов, берём самый большой из запрошенных (безопасно)."""
    best = None
    for mat, slot in uses:
        for pattern, rule in RULES:
            if re.search(pattern, mat):
                size = rule.get(slot) if isinstance(rule, dict) else rule
                if size:
                    best = max(best or 0, size)
                break
    return best


def main() -> None:
    js, blob = read_glb(SRC)
    assert len(js['buffers']) == 1 and 'uri' not in js['buffers'][0], 'нужен один встроенный буфер'
    use = image_usage(js)
    images = js.get('images', [])
    new_chunks: dict[int, bytes] = {}
    rows, before, after = [], 0, 0

    for i, im in enumerate(images):
        if 'bufferView' not in im:
            continue
        bv = js['bufferViews'][im['bufferView']]
        off = bv.get('byteOffset', 0)
        raw = blob[off: off + bv['byteLength']]
        before += len(raw)
        uses = use.get(i, [])
        tgt = target_size(uses)
        if tgt is None or im.get('mimeType') != 'image/webp':
            after += len(raw)
            continue
        pil = Image.open(BytesIO(raw))
        w, h = pil.size
        if max(w, h) <= tgt:
            after += len(raw)
            continue
        k = tgt / max(w, h)
        nw, nh = max(1, round(w * k)), max(1, round(h * k))
        slots = {s for _, s in uses}
        quality = Q_DATA if slots & {'normal', 'mr', 'occlusion'} else Q_COLOR
        if pil.mode not in ('RGB', 'RGBA'):
            pil = pil.convert('RGBA' if 'A' in pil.getbands() else 'RGB')
        out = pil.resize((nw, nh), Image.LANCZOS)
        buf = BytesIO()
        out.save(buf, format='WEBP', quality=quality, method=4)
        data = buf.getvalue()
        if len(data) >= len(raw):
            after += len(raw)
            continue
        new_chunks[im['bufferView']] = data
        after += len(data)
        rows.append((len(raw), len(data), f'{w}x{h}', f'{nw}x{nh}', im.get('name', '')[:34],
                     ','.join(sorted({m for m, _ in uses}))[:34]))

    # пересборка BIN: все bufferView по порядку, с выравниванием 4
    out_blob = bytearray()
    for idx, bv in enumerate(js['bufferViews']):
        off = bv.get('byteOffset', 0)
        chunk = new_chunks.get(idx, blob[off: off + bv['byteLength']])
        out_blob.extend(b'\0' * ((4 - len(out_blob) % 4) % 4))
        bv['byteOffset'] = len(out_blob)
        bv['byteLength'] = len(chunk)
        out_blob.extend(chunk)
    js['buffers'][0]['byteLength'] = len(out_blob)
    write_glb(OUT, js, bytes(out_blob))

    rows.sort(reverse=True)
    for old, new, a, b, name, mats in rows:
        print(f'{old / 1e6:5.2f} -> {new / 1e6:5.2f} MB  {a:>9} -> {b:<9} {name:34} {mats}')
    print(f'\nкартинок изменено: {len(rows)} из {len(images)}')
    print(f'картинки: {before / 1e6:.1f} -> {after / 1e6:.1f} MB')
    print(f'файл:     {SRC.stat().st_size / 1e6:.1f} -> {OUT.stat().st_size / 1e6:.1f} MB  ({OUT})')


if __name__ == '__main__':
    main()
