import bpy
import json
from collections import Counter

SHKAF = bpy.data.objects.get('shkaf')

def collect_under(root):
    objs = [root]
    for c in root.children:
        objs.extend(collect_under(c))
    return objs

def mat_on_obj(obj):
    mats = []
    if obj.type == 'MESH' and obj.data.materials:
        for m in obj.data.materials:
            if m:
                mats.append(m.name)
    return mats

report = {
    'file_size_hint': bpy.data.filepath,
    'beck_w_parent': bpy.data.objects['Beck_W'].parent.name if bpy.data.objects.get('Beck_W') and bpy.data.objects['Beck_W'].parent else None,
    'leg_nodes_same_position': None,
    'duplicate_leg_candidates': [],
    'drawer_hierarchy_issues': [],
    'objects_with_unapplied_scale': [],
    'materials_in_use': {},
    'lights_in_shkaf': [],
    'door_pivot_types': {},
}

if SHKAF:
    tree = collect_under(SHKAF)
    mat_counter = Counter()
    for o in tree:
        for m in mat_on_obj(o):
            mat_counter[m] += 1
        s = o.scale
        if max(abs(s.x-1), abs(s.y-1), abs(s.z-1)) > 1e-3:
            report['objects_with_unapplied_scale'].append({'name': o.name, 'scale': [round(v,4) for v in s]})
        if o.type == 'LIGHT':
            report['lights_in_shkaf'].append(o.name)

    report['materials_in_use'] = dict(mat_counter.most_common(40))

    for side in ('door_left', 'door_right'):
        o = bpy.data.objects.get(side)
        if o:
            report['door_pivot_types'][side] = o.type

    lf = bpy.data.objects.get('leg_front_o')
    lb = bpy.data.objects.get('leg_beck_o')
    if lf and lb:
        report['leg_nodes_same_position'] = [round(v,4) for v in lf.location] == [round(v,4) for v in lb.location]

    for name in ('model', 'model.001', 'leg_front_o', 'leg_beck_o'):
        o = bpy.data.objects.get(name)
        if o:
            report['duplicate_leg_candidates'].append({
                'name': name,
                'parent': o.parent.name if o.parent else None,
                'location': [round(v,4) for v in o.location],
                'verts': len(o.data.vertices) if o.type=='MESH' and o.data else 0,
                'mats': mat_on_obj(o),
            })

    for drawer in ('drawer_tl', 'drawer_tr', 'drawer_bl', 'drawer_br'):
        o = bpy.data.objects.get(drawer)
        if o:
            parent = o.parent.name if o.parent else None
            expected = 'drawer_1' if drawer in ('drawer_tl','drawer_tr') else 'drawer_2'
            if parent != expected:
                report['drawer_hierarchy_issues'].append(f'{drawer} parent={parent} expected={expected}')

    for tabl in ('tabl_1','tabl_2','tabl_3','tabl_4'):
        o = bpy.data.objects.get(tabl)
        if o and o.parent and o.parent.name != 'drawer_1' and o.parent.name != 'drawer_2' and o.parent.name != 'shkaf':
            report['drawer_hierarchy_issues'].append(f'{tabl} parent={o.parent.name}')

print('===RUSso_BLEND_EXTRA_START===')
print(json.dumps(report, ensure_ascii=False, indent=2))
print('===RUSso_BLEND_EXTRA_END===')
