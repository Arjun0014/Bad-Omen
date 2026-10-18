"""Quick preview render of an imported model (or opened .blend) from several angles.
Usage: blender -b -Y --factory-startup [file.blend] --python render_preview.py -- --out prefix [--import path] [--action name --frame N] [--engine WORKBENCH|EEVEE]
"""
import bpy, sys, os, math
from mathutils import Vector
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d
out = arg("--out", "preview")
imp = arg("--import")
engine = arg("--engine", "WORKBENCH")
res = int(arg("--res", "480"))
if imp:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(imp)[1].lower()
    if ext in ('.glb', '.gltf'):
        bpy.ops.import_scene.gltf(filepath=imp)
    else:
        bpy.ops.import_scene.fbx(filepath=imp)
scene = bpy.context.scene
for ob in list(scene.objects):
    if ob.type in ('CAMERA', 'LIGHT'):
        bpy.data.objects.remove(ob)
hide = (arg("--hide", "") or "").split(",")
for ob in scene.objects:
    if ob.name in hide:
        ob.hide_render = True
act = arg("--action")
frame = float(arg("--frame", "0"))
if act:
    for ob in scene.objects:
        if ob.type == 'ARMATURE':
            ob.animation_data_create()
            ob.animation_data.action = bpy.data.actions[act]
            try:
                ob.animation_data.action_slot = bpy.data.actions[act].slots[0]
            except Exception:
                pass
scene.frame_set(int(frame), subframe=frame - int(frame))
dg = bpy.context.evaluated_depsgraph_get()
mn = Vector((1e9,) * 3); mx = Vector((-1e9,) * 3)
for ob in scene.objects:
    if ob.type == 'MESH' and not ob.hide_render:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        for v in me.vertices:
            w = ev.matrix_world @ v.co
            mn = Vector(map(min, mn, w)); mx = Vector(map(max, mx, w))
        ev.to_mesh_clear()
center = (mn + mx) / 2; size = (mx - mn).length
print("BBOX min", tuple(round(x, 3) for x in mn), "max", tuple(round(x, 3) for x in mx))
cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam); scene.camera = cam
cam_data.lens = 50
light = bpy.data.objects.new("sun", bpy.data.lights.new("sun", 'SUN')); scene.collection.objects.link(light)
light.rotation_euler = (0.8, 0.2, 0.6); light.data.energy = 3
scene.render.engine = 'BLENDER_WORKBENCH' if engine == 'WORKBENCH' else 'BLENDER_EEVEE'
if engine == 'WORKBENCH':
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = arg("--color", 'TEXTURE')
scene.render.resolution_x = res; scene.render.resolution_y = res
scene.render.film_transparent = False
views = arg("--views", "front,side,threequarter").split(",")
dirs = {"front": Vector((0, -1, 0.15)), "side": Vector((1, 0, 0.1)), "threequarter": Vector((0.8, -0.8, 0.4)),
        "back": Vector((0, 1, 0.2)), "top": Vector((0.01, -0.2, 1)), "frontcat": Vector((0, 1, 0.15)),
        "tq2": Vector((-0.8, 0.8, 0.4))}
for v in views:
    d = dirs[v].normalized()
    cam.location = center + d * size * 1.25
    cam.rotation_euler = (center - cam.location).to_track_quat('-Z', 'Y').to_euler()
    scene.render.filepath = f"{out}_{v}.png"
    bpy.ops.render.render(write_still=True)
    print("RENDERED", scene.render.filepath)
