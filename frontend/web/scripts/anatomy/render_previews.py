"""Renders preview sheets (front, left side, back) from exported atlas GLBs.

The GLBs are imported into an empty scene, so the previews show exactly what the web viewer will
load (orientation, completeness, shading), not the source blend.

Run:
  blender --background --factory-startup --python render_previews.py -- \
      --dir <folder with the GLBs> --out <png folder> [--height 1100] [--cull]
      [--focus name:cx,cy,cz,size ...]   extra close ups in atlas coordinates (meters, Y up),
                                         rendered from the front, the left, the back and from below

The Blender importer has no meshopt decoder: run decode-for-preview.mjs on public/anatomy first
and point --dir at the decoded copies (build.mjs --previews does both steps).
"""
import bpy
import os
import sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
opts = {'dir': None, 'out': None, 'height': 1100, 'cull': False, 'focus': []}
i = 0
while i < len(argv):
    a = argv[i]
    if a == '--dir':
        opts['dir'] = argv[i + 1]; i += 2
    elif a == '--out':
        opts['out'] = argv[i + 1]; i += 2
    elif a == '--height':
        opts['height'] = int(argv[i + 1]); i += 2
    elif a == '--cull':
        opts['cull'] = True; i += 1
    elif a == '--focus':
        name, rest = argv[i + 1].split(':')
        opts['focus'].append((name, [float(v) for v in rest.split(',')])); i += 2
    else:
        raise SystemExit('unknown argument ' + a)
if not opts['dir'] or not opts['out']:
    raise SystemExit('--dir and --out are required')
os.makedirs(opts['out'], exist_ok=True)

SYSTEMS = ['integumentary', 'skeletal', 'muscular', 'cardiovascular', 'respiratory', 'nervous', 'digestive', 'urinary', 'other']

# empty scene
for ob in list(bpy.data.objects):
    bpy.data.objects.remove(ob)

scene = bpy.context.scene
groups = {}
for sysid in SYSTEMS:
    path = os.path.join(opts['dir'], sysid + '.glb')
    if not os.path.exists(path):
        continue
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    groups[sysid] = [o for o in bpy.data.objects if o not in before]
    print('[preview] imported', sysid, len(groups[sysid]), 'objects', flush=True)

scene.render.engine = 'BLENDER_WORKBENCH'
sh = scene.display.shading
sh.light = 'STUDIO'
sh.color_type = 'MATERIAL'
sh.show_backface_culling = opts['cull']
sh.show_cavity = True
sh.cavity_type = 'BOTH'
sh.show_shadows = False
sh.show_object_outline = False
scene.display.render_aa = '8'
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new('bg')
scene.world.color = (0.02, 0.04, 0.09)
scene.view_settings.view_transform = 'Standard'
scene.render.image_settings.file_format = 'PNG'

cam_data = bpy.data.cameras.new('cam')
cam_data.type = 'ORTHO'
cam = bpy.data.objects.new('cam', cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# Imported glTF: atlas +Y (up) is Blender +Z, atlas +Z (front) is Blender -Y, atlas +X stays +X.
VIEWS = [
    ('front', Vector((0, -1, 0))),
    ('left', Vector((1, 0, 0))),
    ('back', Vector((0, 1, 0))),
]
BELOW = ('below', Vector((0, 0, -1)))  # looking up from under the body, front of the body at the top


def render_view(direction, center, size, w, h, path, clip_start=0.01):
    cam.location = center + direction * 5.0
    cam.rotation_euler = (-direction).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = size
    cam_data.clip_start = clip_start
    cam_data.clip_end = 20
    scene.render.resolution_x = w
    scene.render.resolution_y = h
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def load(path):
    img = bpy.data.images.load(path)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px


def sheet(name, visible, center, size, aspect, views=VIEWS):
    for objs in groups.values():
        for o in objs:
            o.hide_render = o not in visible
    h = opts['height']
    w = int(h * aspect)
    tiles = []
    for vname, d in views:
        p = os.path.join(opts['out'], '_tile_' + vname + '.png')
        # the view from below starts a little under the focus point, so legs and feet do not hide it
        render_view(d, center, size, w, h, p, 5.0 - size * 0.3 if vname == 'below' else 0.01)
        tiles.append(load(p))
        os.remove(p)
    full = np.concatenate(tiles, axis=1)
    out = bpy.data.images.new(name, full.shape[1], full.shape[0])
    out.pixels = full.ravel()
    out.filepath_raw = os.path.join(opts['out'], name + '.png')
    out.file_format = 'PNG'
    out.save()
    bpy.data.images.remove(out)
    print('[preview] wrote', name + '.png', flush=True)


BODY_CENTER = Vector((0, 0, 0.9))
everything = set(o for objs in groups.values() for o in objs)
skin = set(groups.get('integumentary', []))
suffix = '-cull' if opts['cull'] else ''

if not opts['focus']:
    if skin:
        sheet('body-skin' + suffix, skin, BODY_CENTER, 1.9, 0.5)
    sheet('body-all-without-skin' + suffix, everything - skin, BODY_CENTER, 1.9, 0.5)
    for sysid, objs in groups.items():
        if sysid == 'integumentary':
            continue
        sheet('system-' + sysid + suffix, set(objs), BODY_CENTER, 1.9, 0.5)
    inner = everything - skin - set(groups.get('muscular', []))
    sheet('body-organs-and-skeleton' + suffix, inner, BODY_CENTER, 1.9, 0.5)

for name, (cx, cy, cz, size) in opts['focus']:
    # atlas (x, y, z) -> Blender (x, -z, y)
    c = Vector((cx, -cz, cy))
    parts = name.split('@')
    wanted = everything - skin
    if len(parts) > 1:
        wanted = set(o for s in parts[1].split('+') for o in groups.get(s, []))
    sheet('focus-' + parts[0] + suffix, wanted, c, size, 1.0, VIEWS + [BELOW])
