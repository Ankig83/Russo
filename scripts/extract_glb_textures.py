"""Extract embedded images from a GLB into files."""
import json
import struct
import sys
from pathlib import Path

MIME_EXT = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
}


def parse_glb(path: Path):
    data = path.read_bytes()
    if data[:4] != b'glTF':
        raise ValueError(f'Not a GLB: {path}')

    offset = 12
    json_chunk = None
    bin_chunk = b''
    while offset < len(data):
        chunk_len, chunk_type = struct.unpack_from('<I4s', data, offset)
        offset += 8
        chunk = data[offset : offset + chunk_len]
        offset += chunk_len
        if chunk_type == b'JSON':
            json_chunk = json.loads(chunk.decode('utf-8'))
        elif chunk_type == b'BIN\x00':
            bin_chunk = chunk

    if json_chunk is None:
        raise ValueError('GLB has no JSON chunk')
    return json_chunk, bin_chunk


def extract_textures(glb_path: Path, out_dir: Path):
    gltf, bin_chunk = parse_glb(glb_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    images = gltf.get('images', [])
    textures = gltf.get('textures', [])
    materials = gltf.get('materials', [])
    buffer_views = gltf.get('bufferViews', [])

    # map texture index -> role from materials
    tex_roles = {}
    for mi, mat in enumerate(materials):
        mat_name = mat.get('name') or f'material_{mi}'
        pbr = mat.get('pbrMetallicRoughness', {})
        if 'baseColorTexture' in pbr:
            tex_roles[pbr['baseColorTexture']['index']] = f'{mat_name}_baseColor'
        if 'metallicRoughnessTexture' in pbr:
            tex_roles[pbr['metallicRoughnessTexture']['index']] = f'{mat_name}_metallicRoughness'
        if 'normalTexture' in mat:
            tex_roles[mat['normalTexture']['index']] = f'{mat_name}_normal'
        if 'emissiveTexture' in mat:
            tex_roles[mat['emissiveTexture']['index']] = f'{mat_name}_emissive'
        if 'occlusionTexture' in mat:
            tex_roles[mat['occlusionTexture']['index']] = f'{mat_name}_occlusion'

    saved = []
    for ti, tex in enumerate(textures):
        src = tex.get('source')
        if src is None:
            continue
        img = images[src]
        bv_idx = img.get('bufferView')
        if bv_idx is None:
            uri = img.get('uri')
            print(f'  texture[{ti}] external uri, skip: {uri}')
            continue

        bv = buffer_views[bv_idx]
        start = bv.get('byteOffset', 0)
        end = start + bv['byteLength']
        blob = bin_chunk[start:end]

        mime = img.get('mimeType', 'application/octet-stream')
        ext = MIME_EXT.get(mime, '.bin')
        role = tex_roles.get(ti, img.get('name') or f'texture_{ti}')
        safe_role = ''.join(c if c.isalnum() or c in '-_.' else '_' for c in role)
        out_path = out_dir / f'{safe_role}{ext}'
        out_path.write_bytes(blob)
        saved.append((ti, role, out_path, len(blob), mime))
        print(f'  [{ti}] {role} -> {out_path.name} ({len(blob)/1024:.1f} KB, {mime})')

    # also dump unnamed embedded images not referenced by textures
    used_sources = {t.get('source') for t in textures if t.get('source') is not None}
    for ii, img in enumerate(images):
        if ii in used_sources:
            continue
        bv_idx = img.get('bufferView')
        if bv_idx is None:
            continue
        bv = buffer_views[bv_idx]
        start = bv.get('byteOffset', 0)
        end = start + bv['byteLength']
        blob = bin_chunk[start:end]
        mime = img.get('mimeType', 'application/octet-stream')
        ext = MIME_EXT.get(mime, '.bin')
        name = img.get('name') or f'image_{ii}'
        safe_name = ''.join(c if c.isalnum() or c in '-_.' else '_' for c in name)
        out_path = out_dir / f'{safe_name}{ext}'
        out_path.write_bytes(blob)
        saved.append((ii, name, out_path, len(blob), mime))
        print(f'  [img {ii}] {name} -> {out_path.name} ({len(blob)/1024:.1f} KB, {mime})')

    return saved


if __name__ == '__main__':
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2]) if len(sys.argv) > 2 else src.parent / f'{src.stem}_textures'
    print(f'Extract from: {src}')
    print(f'Output dir:   {dst}')
    saved = extract_textures(src, dst)
    print(f'\nDone: {len(saved)} file(s)')
