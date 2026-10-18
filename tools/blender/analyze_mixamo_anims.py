"""Import each Mixamo animation FBX and report frame range + Hips world displacement.
Usage: blender -b -Y --factory-startup --python analyze_mixamo_anims.py -- out.json file1.fbx file2.fbx ...
"""
import bpy, sys, json, os
argv = sys.argv[sys.argv.index("--") + 1:]
out = argv[0]; files = argv[1:]
res = []
for f in files:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    try:
        bpy.ops.import_scene.fbx(filepath=f)
    except Exception as e:
        res.append({"file": f, "error": str(e)}); continue
    arm = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)
    if not arm or not arm.animation_data or not arm.animation_data.action:
        res.append({"file": f, "error": "no armature/action"}); continue
    act = arm.animation_data.action
    fs, fe = act.frame_range
    hips = arm.pose.bones.get("mixamorig:Hips")
    sc = bpy.context.scene
    pts = []
    for fr in (int(fs), int((fs + fe) / 2), int(fe)):
        sc.frame_set(fr)
        pts.append([round(x, 3) for x in (arm.matrix_world @ hips.head)])
    nb = len(arm.data.bones)
    res.append({"file": os.path.basename(f), "dir": os.path.basename(os.path.dirname(f)), "frames": [fs, fe],
                "bones": nb, "hips_start_mid_end": pts, "fps": sc.render.fps})
json.dump(res, open(out, "w"), indent=1)
print("DONE", len(res))
