"""BAD OMEN — Grandma build pipeline (headless Blender 5.x).

Imports the Mixamo goblin character (With Skin) and a curated set of Mixamo
animation FBXs (Without Skin, same skeleton), strips root motion for in-place
AI-driven playback, detects hand 'release'/'impact' frames for attack clips,
downsizes textures and exports one GLB + an events JSON.

Usage:
  blender -b -Y --factory-startup -t 2 --python build_grandma.py -- --root <project> \
      --out public/assets/characters/grandma.glb --events src/data/grandmaEvents.json
"""
import bpy, sys, os, json, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d

ROOT = os.path.abspath(arg("--root", "."))
OUT = os.path.join(ROOT, arg("--out", "public/assets/characters/grandma.glb"))
EVENTS = os.path.join(ROOT, arg("--events", "src/data/grandmaEvents.json"))
INBOX = os.path.join(ROOT, "assets_inbox", "characters and animations")
EX = os.path.join(ROOT, "work", "extracted")

# name: (path, root-motion mode, event detection)
CLIPS = {
    "Idle":        (f"{EX}/anim_Locomotion Pack/idle.fbx", "none", None),
    "Walk":        (f"{EX}/anim_Locomotion Pack/walking.fbx", "trend", None),
    "Run":         (f"{EX}/anim_Locomotion Pack/running.fbx", "trend", None),
    "Sprint":      (f"{EX}/anim_Magic Locomotion Pack/Standing Sprint Forward.fbx", "trend", None),
    "SneakWalk":   (f"{EX}/anim_Pro Magic Pack/Crouch Walk Forward.fbx", "trend", None),
    "CrouchIdle":  (f"{EX}/anim_Pro Magic Pack/Crouch Idle.fbx", "none", None),
    "Angry":       (f"{EX}/anim_Gestures Pack Basic/angry gesture.fbx", "full", None),
    "HeadShake":   (f"{EX}/anim_Gestures Pack Basic/annoyed head shake.fbx", "full", None),
    "LookAround":  (f"{EX}/anim_Gestures Pack Basic/look away gesture.fbx", "full", None),
    "Cocky":       (f"{EX}/anim_Gestures Pack Basic/being cocky.fbx", "full", None),
    "Sigh":        (f"{EX}/anim_Gestures Pack Basic/relieved sigh.fbx", "full", None),
    "Dismiss":     (f"{EX}/anim_Gestures Pack Basic/dismissing gesture.fbx", "full", None),
    "ThrowObject": (f"{INBOX}/Throw Object.fbx", "full", "RightHand"),
    "Throwing":    (f"{INBOX}/Throwing.fbx", "full", "RightHand"),
    "PickUp":      (f"{INBOX}/Pick Up Item.fbx", "full", "RightHand"),
    "Swing":       (f"{EX}/anim_Pro Magic Pack/Standing 1H Magic Attack 01.fbx", "full", "RightHand"),
    "Swing2":      (f"{EX}/anim_Pro Magic Pack/Standing 1H Magic Attack 02.fbx", "full", "RightHand"),
    "Cast":        (f"{EX}/anim_Pro Magic Pack/standing 1H cast spell 01.fbx", "full", "RightHand"),
    "Slam":        (f"{EX}/anim_Pro Magic Pack/Standing 2H Magic Attack 01.fbx", "full", "RightHand"),
    "BigCast":     (f"{EX}/anim_Pro Magic Pack/Standing 2H Cast Spell 01.fbx", "full", "RightHand"),
    "Tantrum":     (f"{EX}/anim_Pro Magic Pack/Standing 2H Magic Area Attack 01.fbx", "full", "RightHand"),
    "Tantrum2":    (f"{EX}/anim_Pro Magic Pack/Standing 2H Magic Area Attack 02.fbx", "full", "RightHand"),
    "HitReact":    (f"{EX}/anim_Pro Magic Pack/Standing React Large From Front.fbx", "full", None),
    "Flinch":      (f"{EX}/anim_Pro Magic Pack/Standing React Small From Front.fbx", "full", None),
    "Stunned":     (f"{EX}/anim_Action Adventure Pack/hard landing.fbx", "full", None),
    "RunToStop":   (f"{EX}/anim_Action Adventure Pack/run to stop.fbx", "full", None),
    "CoverHead":   (f"{EX}/anim_Pro Magic Pack/Standing Block React Large.fbx", "full", None),
}

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30
bpy.ops.import_scene.fbx(filepath=os.path.join(INBOX, "goblin_d_shareyko.fbx"))
char_arm = next(o for o in scene.objects if o.type == "ARMATURE")
char_arm.name = "Grandma"
char_meshes = [o for o in scene.objects if o.type == "MESH"]
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)

def fcurves(act):
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out

def assign(ob, act):
    ad = ob.animation_data or ob.animation_data_create()
    ad.action = act
    try:
        if act.slots:
            ad.action_slot = act.slots[0]
    except Exception:
        pass

events = {}
hips_name = "mixamorig:Hips"
for name, (path, mode, ev_bone) in CLIPS.items():
    before = set(bpy.data.objects)
    bpy.ops.import_scene.fbx(filepath=path)
    new_objs = [o for o in bpy.data.objects if o not in before]
    src_arm = next(o for o in new_objs if o.type == "ARMATURE")
    act = src_arm.animation_data.action
    act.name = name
    act.use_fake_user = True
    for o in new_objs:
        bpy.data.objects.remove(o, do_unlink=True)
    assign(char_arm, act)
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    hips = char_arm.pose.bones[hips_name]
    # sample world hips positions
    pts = []
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        pts.append((char_arm.matrix_world @ hips.head).copy())
    drift = pts[-1] - pts[0]
    if mode != "none":
        A = (char_arm.matrix_world.to_3x3() @ char_arm.data.bones[hips_name].matrix_local.to_3x3())
        Ainv = A.inverted()
        loc_fc = {fc.array_index: fc for fc in fcurves(act) if fc.data_path == f'pose.bones["{hips_name}"].location'}
        # evaluate original local values
        vals = []
        for f in range(f0, f1 + 1):
            vals.append(Vector([loc_fc[i].evaluate(f) if i in loc_fc else 0.0 for i in range(3)]))
        new_vals = []
        n = max(f1 - f0, 1)
        for k, f in enumerate(range(f0, f1 + 1)):
            if mode == "trend":
                d = drift * (k / n)
            else:  # full: pin horizontal position to the first frame
                d = pts[k] - pts[0]
            d = Vector((d.x, d.y, 0.0))
            new_vals.append(vals[k] - Ainv @ d)
        for i in range(3):
            fc = loc_fc.get(i)
            if fc is None:
                continue
            fc.keyframe_points.clear()
            fc.keyframe_points.add(len(new_vals))
            for k, f in enumerate(range(f0, f1 + 1)):
                kp = fc.keyframe_points[k]
                kp.co = (f, new_vals[k][i]); kp.interpolation = "LINEAR"
            fc.update()
    ev = {"frames": [f0, f1], "duration": round((f1 - f0) / 30.0, 3),
          "drift": [round(drift.x, 3), round(drift.y, 3), round(drift.z, 3)], "mode": mode}
    if ev_bone:
        hand = char_arm.pose.bones[f"mixamorig:{ev_bone}"]
        hp = []
        for f in range(f0, f1 + 1):
            scene.frame_set(f)
            hp.append((char_arm.matrix_world @ hand.head).copy())
        speeds = [(hp[i + 1] - hp[i]).length * 30 for i in range(len(hp) - 1)]
        peak = max(range(len(speeds)), key=lambda i: speeds[i])
        ev["release"] = round(peak / 30.0, 3)
        ev["peakSpeed"] = round(speeds[peak], 2)
        # lowest hand point (pickups / slams)
        low = min(range(len(hp)), key=lambda i: hp[i].z)
        ev["lowest"] = round(low / 30.0, 3)
    events[name] = ev
    print("CLIP", name, ev)

# --------------------------------------------------------------- textures
for img in bpy.data.images:
    if img.size[0] > 1024:
        img.scale(1024, 1024)
for mat in bpy.data.materials:
    if not mat.node_tree:
        continue
    nt = mat.node_tree
    for n in list(nt.nodes):
        if n.type == "TEX_IMAGE" and n.image and "specular" in (n.image.filepath or "").lower():
            nt.nodes.remove(n)
    bsdf = next((n for n in nt.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if bsdf:
        bsdf.inputs["Roughness"].default_value = 0.78
        if "Specular IOR Level" in bsdf.inputs:
            bsdf.inputs["Specular IOR Level"].default_value = 0.25

assign(char_arm, bpy.data.actions["Idle"])
scene.frame_set(1)
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
    export_force_sampling=True, export_optimize_animation_size=True, export_skins=True,
    export_image_format="JPEG", export_jpeg_quality=82, export_cameras=False, export_lights=False,
    export_yup=True, export_reset_pose_bones=True, export_anim_single_armature=True, export_def_bones=False)
os.makedirs(os.path.dirname(EVENTS), exist_ok=True)
json.dump(events, open(EVENTS, "w"), indent=1)
print("EXPORTED", OUT, os.path.getsize(OUT))
