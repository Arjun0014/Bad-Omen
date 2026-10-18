"""Render a contact sheet: rows = actions, columns = sampled frames.
Usage: blender -b -Y --factory-startup file.blend --python contact_sheet.py -- --out sheet.png
       [--import file.glb] [--actions A,B] [--cols 5] [--res 180] [--view side|tq|front] [--armature name]
"""
import bpy, sys, os, math
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d

OUT = os.path.abspath(arg("--out", "sheet.png"))
imp = arg("--import")
if imp:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    if imp.lower().endswith((".glb", ".gltf")):
        bpy.ops.import_scene.gltf(filepath=os.path.abspath(imp))
    else:
        bpy.ops.import_scene.fbx(filepath=os.path.abspath(imp))
scene = bpy.context.scene
for ob in list(scene.objects):
    if ob.type in ("CAMERA", "LIGHT"):
        bpy.data.objects.remove(ob)
arm = next(o for o in scene.objects if o.type == "ARMATURE" and (arg("--armature") in (None, o.name)))
names = arg("--actions")
acts = [bpy.data.actions[n] for n in names.split(",")] if names else sorted(bpy.data.actions, key=lambda a: a.name)
cols = int(arg("--cols", "5")); res = int(arg("--res", "180")); view = arg("--view", "side")
scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "TEXTURE"
scene.render.resolution_x = res; scene.render.resolution_y = res
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam")); scene.collection.objects.link(cam); scene.camera = cam
cam.data.type = "ORTHO"

def bbox():
    dg = bpy.context.evaluated_depsgraph_get()
    mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
    for ob in scene.objects:
        if ob.type == "MESH" and not ob.hide_render:
            ev = ob.evaluated_get(dg); me = ev.to_mesh()
            for v in me.vertices:
                w = ev.matrix_world @ v.co
                mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
            ev.to_mesh_clear()
    return mn, mx

ad = arm.animation_data or arm.animation_data_create()
for t in list(ad.nla_tracks):
    t.mute = True
ad.action = acts[0]
try:
    ad.action_slot = acts[0].slots[0]
except Exception:
    pass
scene.frame_set(int(acts[0].frame_range[0]))
mn, mx = bbox()
center = (mn + mx) / 2
size = max((mx - mn).x, (mx - mn).y, (mx - mn).z) * 1.35
fwd = arg("--fwd", "y")  # cat faces +Y in source blend; glTF imports face -Y or +Y
dirs = {"side": Vector((1, 0, 0.12)), "tq": Vector((0.75, 0.75 if fwd == "y" else -0.75, 0.45)),
        "front": Vector((0, 1 if fwd == "y" else -1, 0.1))}
d = dirs[view].normalized()
cam.location = center + d * size * 3
cam.rotation_euler = (center - cam.location).to_track_quat("-Z", "Y").to_euler()
cam.data.ortho_scale = size
tmp = os.path.join(os.path.dirname(OUT), "_cs_tmp.png")
rows = []
for act in acts:
    ad.action = act
    try:
        ad.action_slot = act.slots[0]
    except Exception:
        pass
    f0, f1 = act.frame_range
    row = []
    for i in range(cols):
        fr = f0 + (f1 - f0) * i / max(cols - 1, 1)
        scene.frame_set(int(fr), subframe=fr - int(fr))
        scene.render.filepath = tmp
        bpy.ops.render.render(write_still=True)
        img = bpy.data.images.load(tmp, check_existing=False)
        px = np.array(img.pixels[:], np.float32).reshape(res, res, 4)[::-1]
        bpy.data.images.remove(img)
        # label strip: darken top rows to mark the row start
        if i == 0:
            px[:6, :, :3] *= 0.3
        row.append(px)
    rows.append(np.concatenate(row, axis=1))
    print("ROW", act.name, (f0, f1))
sheet = np.concatenate(rows, axis=0)
h, w = sheet.shape[:2]
img = bpy.data.images.new("sheet", w, h, alpha=True)
img.pixels.foreach_set(sheet[::-1].ravel())
img.filepath_raw = OUT; img.file_format = "PNG"; img.save()
os.remove(tmp)
print("SHEET", OUT, w, h, [a.name for a in acts])
