"""Headless inspect of shkaf .blend — run: blender --background file.blend --python inspect_blend.py"""
import bpy
import json
import sys

REQUIRED_NODES = [
    'shkaf', 'door_left', 'door_right', 'Beresta_L', 'Beresta_R',
    'drawer_1', 'drawer_2', 'drawer_tl', 'drawer_tr', 'drawer_bl', 'drawer_br',
    'tabl_1', 'tabl_2', 'tabl_3', 'tabl_4',
    'leg_front_o', 'leg_beck_o', 'Beck_W',
]

PROCEDURAL_NODE_TYPES = {
    'TEX_NOISE', 'TEX_VORONOI', 'TEX_WAVE', 'TEX_MAGIC', 'TEX_MUSGRAVE',
    'TEX_CHECKER', 'TEX_BRICK', 'TEX_GRADIENT', 'TEX_WHITE_NOISE',
    'MIX_SHADER', 'ADD_SHADER', 'BUMP', 'DISPLACEMENT', 'VALTORGB',
}


def obj_info(obj):
    scale = obj.scale
    rot = obj.rotation_euler
    return {
        'name': obj.name,
        'type': obj.type,
        'parent': obj.parent.name if obj.parent else None,
        'location': [round(v, 4) for v in obj.location],
        'scale': [round(v, 4) for v in scale],
        'rotation_y': round(rot.y, 4) if obj.type != 'MESH' or True else None,
        'scale_applied': max(abs(scale.x - 1), abs(scale.y - 1), abs(scale.z - 1)) < 1e-4,
        'children': [c.name for c in obj.children],
    }


def mat_info(mat):
    if not mat or not mat.use_nodes or not mat.node_tree:
        return {'name': mat.name if mat else None, 'nodes': 'none'}
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    principled = next((n for n in nodes if n.type == 'BSDF_PRINCIPLED'), None)
    procedural = [n.type for n in nodes if n.type in PROCEDURAL_NODE_TYPES]
    tex_images = []
    for n in nodes:
        if n.type == 'TEX_IMAGE' and n.image:
            tex_images.append({
                'name': n.image.name,
                'size': list(n.image.size),
                'filepath': n.image.filepath or n.image.name,
                'packed': n.image.packed_file is not None,
            })
    outputs = []
    if principled:
        for inp in ('Base Color', 'Roughness', 'Metallic', 'Normal'):
            sock = principled.inputs.get(inp)
            if sock and sock.is_linked:
                from_node = sock.links[0].from_node
                outputs.append(f'{inp}<-{from_node.type}')
            elif sock and not sock.is_linked and inp in ('Roughness', 'Metallic'):
                outputs.append(f'{inp}={round(sock.default_value, 3) if isinstance(sock.default_value, float) else sock.default_value}')
    return {
        'name': mat.name,
        'principled': principled is not None,
        'procedural_nodes': procedural,
        'image_textures': tex_images,
        'connections': outputs,
    }


def main():
    scene = bpy.context.scene
    all_objs = list(bpy.data.objects)
    by_name = {o.name: o for o in all_objs}

    report = {
        'blend': bpy.data.filepath,
        'blender_version': bpy.app.version_string,
        'units': scene.unit_settings.system,
        'unit_scale': scene.unit_settings.scale_length,
        'object_count': len(all_objs),
        'material_count': len(bpy.data.materials),
        'mesh_count': len(bpy.data.meshes),
        'required_nodes': {},
        'missing_required': [],
        'extra_roots': [],
        'materials': [],
        'issues': [],
    }

    for name in REQUIRED_NODES:
        if name in by_name:
            report['required_nodes'][name] = obj_info(by_name[name])
        else:
            report['missing_required'].append(name)

    # shkaf tree
    if 'shkaf' in by_name:
        shkaf = by_name['shkaf']

        def walk(obj, depth=0):
            rows = [{'depth': depth, **obj_info(obj)}]
            for c in sorted(obj.children, key=lambda x: x.name):
                rows.extend(walk(c, depth + 1))
            return rows

        report['shkaf_tree'] = walk(shkaf)
    else:
        report['issues'].append('NO_ROOT: shkaf not found')

    # door_right rotation check
    if 'door_right' in by_name:
        ry = by_name['door_right'].rotation_euler.y
        if abs(ry) > 0.01:
            report['issues'].append(f'door_right.rotation_y={round(ry, 4)} (should be ~0)')

    # unapplied scale on critical nodes
    for name in REQUIRED_NODES:
        o = by_name.get(name)
        if not o:
            continue
        s = o.scale
        if max(abs(s.x - 1), abs(s.y - 1), abs(s.z - 1)) > 1e-3:
            report['issues'].append(f'unapplied_scale: {name} scale={[round(v,4) for v in s]}')

    # materials
    for mat in sorted(bpy.data.materials, key=lambda m: m.name):
        info = mat_info(mat)
        report['materials'].append(info)
        if info.get('procedural_nodes'):
            report['issues'].append(f'procedural_material: {mat.name} nodes={info["procedural_nodes"]}')
        if not info.get('principled') and mat.use_nodes:
            report['issues'].append(f'no_principled: {mat.name}')

    # legs inside shkaf hierarchy
    for leg in ('leg_front_o', 'leg_beck_o'):
        o = by_name.get(leg)
        if not o:
            continue
        parent_chain = []
        p = o.parent
        while p:
            parent_chain.append(p.name)
            p = p.parent
        report['required_nodes'][leg]['parent_chain'] = parent_chain
        if 'shkaf' not in parent_chain and o.name != 'shkaf':
            report['issues'].append(f'leg_not_under_shkaf: {leg} chain={parent_chain}')

    print('===RUSso_BLEND_REPORT_JSON_START===')
    print(json.dumps(report, ensure_ascii=False, indent=2))
    print('===RUSso_BLEND_REPORT_JSON_END===')


if __name__ == '__main__':
    main()
