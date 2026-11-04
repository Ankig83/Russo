"""
Safe GLB size cut without geometry decimation:
1) gltf-transform dedup + meshopt (CLI)
2) PNG -> WebP for embedded images (preserve meshopt byte ranges)
"""
from __future__ import annotations

import json
import struct
import subprocess
import sys
from io import BytesIO
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'pillow', '-q'])
    from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / 'public' / 'models' / 'shkaf.source.glb'
OUT = ROOT / 'public' / 'models' / 'shkaf.glb'
WORK = ROOT / 'public' / 'models' / '_opt_work'
WEBP_QUALITY = 90


def run_gltf(*args: str) -> None:
    npx = 'npx.cmd' if sys.platform == 'win32' else 'npx'
    cmd = [npx, '--yes', '@gltf-transform/cli@4.2.1', *args]
    print('>', ' '.join(cmd), flush=True)
    subprocess.check_call(cmd, cwd=ROOT)


def read_glb(path: Path) -> tuple[dict, bytes]:
    data = path.read_bytes()
    assert data[:4] == b'glTF'
    cl = struct.unpack_from('<I', data, 12)[0]
    gltf = json.loads(data[20 : 20 + cl])
    bin_off = 20 + cl
    assert data[bin_off + 4 : bin_off + 8] == b'BIN\x00'
    bin_len = struct.unpack_from('<I', data, bin_off)[0]
    blob = data[bin_off + 8 : bin_off + 8 + bin_len]
    return gltf, blob


def write_glb(path: Path, gltf: dict, blob: bytes) -> None:
    json_bytes = json.dumps(gltf, separators=(',', ':')).encode('utf-8')
    while len(json_bytes) % 4:
        json_bytes += b' '
    blob = bytearray(blob)
    while len(blob) % 4:
        blob.append(0)
    blob = bytes(blob)
    total = 12 + 8 + len(json_bytes) + 8 + len(blob)
    out = bytearray()
    out += struct.pack('<4sII', b'glTF', 2, total)
    out += struct.pack('<I4s', len(json_bytes), b'JSON')
    out += json_bytes
    out += struct.pack('<I4s', len(blob), b'BIN\x00')
    out += blob
    path.write_bytes(out)


def view_data_range(bv: dict) -> tuple[int, int]:
    """Return (offset, length) of the actual payload for a bufferView."""
    ext = (bv.get('extensions') or {}).get('EXT_meshopt_compression')
    if ext:
        return int(ext.get('byteOffset', 0)), int(ext.get('byteLength', 0))
    return int(bv.get('byteOffset', 0)), int(bv.get('byteLength', 0))


def png_to_webp_in_glb(path: Path) -> Path:
    gltf, blob = read_glb(path)
    images = gltf.get('images', [])
    buffer_views = gltf.get('bufferViews', [])
    image_view_indices = {
        img['bufferView'] for img in images if img.get('bufferView') is not None
    }

    # Collect ordered copy plan for every bufferView payload
    ranges = []
    for i, bv in enumerate(buffer_views):
        off, ln = view_data_range(bv)
        ranges.append((i, off, ln, i in image_view_indices))

    new_blob = bytearray()
    new_offsets = {}  # old_view_index -> new payload offset
    saved = 0

    for i, off, ln, is_image in ranges:
        chunk = blob[off : off + ln]
        mime = None
        if is_image:
            for img in images:
                if img.get('bufferView') == i:
                    mime = img.get('mimeType')
                    break
            if mime == 'image/png' or (
                (not mime or mime == 'image/png') and chunk[:8] == b'\x89PNG\r\n\x1a\n'
            ):
                try:
                    im = Image.open(BytesIO(chunk))
                    if im.mode not in ('RGB', 'RGBA'):
                        im = im.convert('RGBA' if 'A' in im.getbands() else 'RGB')
                    buf = BytesIO()
                    im.save(buf, format='WEBP', quality=WEBP_QUALITY, method=4)
                    cand = buf.getvalue()
                    if len(cand) < len(chunk):
                        saved += len(chunk) - len(cand)
                        chunk = cand
                        for img in images:
                            if img.get('bufferView') == i:
                                img['mimeType'] = 'image/webp'
                except Exception as exc:  # noqa: BLE001
                    print('keep png', i, exc, flush=True)

        pad = (4 - (len(new_blob) % 4)) % 4
        new_blob.extend(b'\x00' * pad)
        new_off = len(new_blob)
        new_blob.extend(chunk)
        new_offsets[i] = (new_off, len(chunk))

    # Rewrite bufferView offsets (and meshopt extension offsets)
    for i, bv in enumerate(buffer_views):
        new_off, new_ln = new_offsets[i]
        ext = (bv.get('extensions') or {}).get('EXT_meshopt_compression')
        if ext:
            ext['byteOffset'] = new_off
            ext['byteLength'] = new_ln
            # Keep placeholder bv fields consistent
            bv['byteOffset'] = 0
            bv['byteLength'] = 0
        else:
            bv['byteOffset'] = new_off
            bv['byteLength'] = new_ln

    gltf['buffers'] = [{'byteLength': len(new_blob)}]
    exts = set(gltf.get('extensionsUsed') or [])
    exts.add('EXT_texture_webp')
    gltf['extensionsUsed'] = sorted(exts)
    req = set(gltf.get('extensionsRequired') or [])
    req.add('EXT_texture_webp')
    # meshopt may already be required
    if 'EXT_meshopt_compression' in exts:
        req.add('EXT_meshopt_compression')
    if 'KHR_mesh_quantization' in exts:
        req.add('KHR_mesh_quantization')
    gltf['extensionsRequired'] = sorted(req)

    out = path.with_name(path.stem + '.webp.glb')
    write_glb(out, gltf, bytes(new_blob))
    print(f'webp pass: saved ~{saved / 1e6:.1f} MB -> {out.stat().st_size / 1e6:.1f} MB', flush=True)
    return out


def validate_meshopt(path: Path) -> None:
    gltf, blob = read_glb(path)
    buf_len = len(blob)
    broken = 0
    for i, bv in enumerate(gltf.get('bufferViews', [])):
        ext = (bv.get('extensions') or {}).get('EXT_meshopt_compression')
        if not ext:
            continue
        off = int(ext.get('byteOffset', 0))
        ln = int(ext.get('byteLength', 0))
        if off + ln > buf_len:
            broken += 1
            if broken <= 3:
                print('BROKEN', i, off, ln, buf_len, flush=True)
    if broken:
        raise SystemExit(f'meshopt validation failed: {broken} bad views')
    print('meshopt validation OK', flush=True)


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f'missing {SRC}')

    WORK.mkdir(parents=True, exist_ok=True)
    deduped = WORK / 'dedup.glb'
    meshed = WORK / 'meshopt.glb'

    if not meshed.exists() or meshed.stat().st_size < 1_000_000:
        run_gltf('dedup', str(SRC), str(deduped))
        run_gltf('meshopt', str(deduped), str(meshed), '--level', 'medium')
    else:
        print(f'reusing {meshed} ({meshed.stat().st_size / 1e6:.1f} MB)', flush=True)

    webp = png_to_webp_in_glb(meshed)
    validate_meshopt(webp)
    OUT.write_bytes(webp.read_bytes())
    print(
        f'DONE {SRC.stat().st_size / 1e6:.1f} MB -> {OUT.stat().st_size / 1e6:.1f} MB',
        flush=True,
    )


if __name__ == '__main__':
    main()
