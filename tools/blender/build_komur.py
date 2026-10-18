"""BAD OMEN — Komur build pipeline (headless Blender 5.x).

Opens the supplied Somali cat .blend (CC-BY 4.0, DreamNoms), recolours it into
Komur (black coat, white paws/chest/tail tip, amber eyes), generates a set of
procedural quadruped actions on the existing IK rig, and exports a GLB.

Usage:
  blender -b -Y --factory-startup -t 2 <SomaliCatNewMirror3.blend> --python build_komur.py -- \
      --out public/assets/characters/komur.glb --tex work/komur_fur.png [--save work/komur_built.blend]
"""
import bpy, bmesh, sys, os, math
import numpy as np
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(n, d=None):
    return argv[argv.index(n) + 1] if n in argv else d

OUT = os.path.abspath(arg("--out", "komur.glb"))
TEX = os.path.abspath(arg("--tex", "komur_fur.png"))
SAVE = arg("--save")
FPS = 24

scene = bpy.context.scene
scene.render.fps = FPS
arm = bpy.data.objects["SomaliCatArmature"]
body = bpy.data.objects["SomaliCat"]
tail = bpy.data.objects["Tail"]
eyes = [bpy.data.objects["Eye.L"], bpy.data.objects["Eye.R"]]

# ---------------------------------------------------------------- cleanup
for name in ("Camera", "Light", "Cube"):
    ob = bpy.data.objects.get(name)
    if ob:
        bpy.data.objects.remove(ob, do_unlink=True)

# ---------------------------------------------------------------- texture
def build_fur_texture():
    src = bpy.data.images.get("SomaliCat.png")
    W = H = 1024
    if src and src.size[0] > 0:
        px = np.array(src.pixels[:], dtype=np.float32).reshape(src.size[1], src.size[0], 4)
        if src.size[0] != W:
            # nearest resample
            ys = (np.arange(H) * src.size[1] / H).astype(int)
            xs = (np.arange(W) * src.size[0] / W).astype(int)
            px = px[ys][:, xs]
        lum = px[..., 0] * 0.3 + px[..., 1] * 0.55 + px[..., 2] * 0.15
    else:
        lum = np.full((H, W), 0.5, np.float32)
    mean = float(lum.mean())
    detail = np.clip(1.0 + (lum - mean) * 1.6, 0.55, 1.45)

    mask = np.zeros((H, W), np.float32)
    cover = np.zeros((H, W), np.float32)

    def white_weight(ob, v, co):
        """Komur markings in rest space (cat faces +Y, up +Z, ground ~ -1.7)."""
        x, y, z = co
        w = 0.0
        groups = {ob.vertex_groups[g.group].name: g.weight for g in v.groups}
        if ob.name == "Tail":
            # white tail tip: last ~22% of the tail
            t = groups.get("TailTip", 0.0)
            w = max(w, smooth(0.35, 0.75, t))
            w = max(w, smooth(-4.55, -4.85, y))
            return w
        # socks: lower legs and paws
        w = max(w, smooth(-1.05, -1.32, z))
        # chest bib + throat (front of torso, near the midline)
        if y > 0.35:
            bib = (x / 0.42) ** 2 + ((z + 0.25) / 1.05) ** 2
            front = smooth(0.45, 0.95, y)
            w = max(w, front * smooth(1.15, 0.7, bib))
            # throat up to the chin
            throat = (x / 0.3) ** 2 + ((z - 0.75) / 0.45) ** 2
            if y > 1.05:
                w = max(w, smooth(1.0, 0.55, throat) * smooth(1.05, 1.35, y) * smooth(1.25, 0.95, z))
        return min(1.0, w)

    def smooth(e0, e1, x):
        t = min(1.0, max(0.0, (x - e0) / (e1 - e0)))
        return t * t * (3 - 2 * t)

    for ob in (body, tail):
        me = ob.data
        uv = me.uv_layers.active.data
        vw = [white_weight(ob, v, v.co) for v in me.vertices]
        for poly in me.polygons:
            if ob.material_slots[poly.material_index].material and \
               ob.material_slots[poly.material_index].material.name == "Whiskers":
                continue
            loops = list(poly.loop_indices)
            for i in range(1, len(loops) - 1):
                tri = (loops[0], loops[i], loops[i + 1])
                uvs = [uv[l].uv for l in tri]
                ws = [vw[me.loops[l].vertex_index] for l in tri]
                raster(uvs, ws, mask, cover, W, H)

    # dilate into uncovered texels so UV seams don't bleed black/white wrongly
    m = mask.copy(); c = cover.copy()
    for _ in range(6):
        nb_sum = np.zeros_like(m); nb_cnt = np.zeros_like(m)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nb_sum += np.roll(np.roll(m * c, dy, 0), dx, 1)
            nb_cnt += np.roll(np.roll(c, dy, 0), dx, 1)
        grow = (c == 0) & (nb_cnt > 0)
        m[grow] = nb_sum[grow] / nb_cnt[grow]
        c[grow] = 1.0
    mask = np.clip(m, 0, 1)

    black = np.array([0.075, 0.07, 0.085], np.float32)   # sRGB charcoal-black
    white = np.array([0.84, 0.82, 0.78], np.float32)  # bright enough to read as white, not to bloom
    col = black[None, None, :] * (1 - mask[..., None]) + white[None, None, :] * mask[..., None]
    col = col * detail[..., None]
    col = np.clip(col, 0, 1)
    out = np.ones((H, W, 4), np.float32)
    out[..., :3] = col
    img = bpy.data.images.new("KomurFur", W, H, alpha=False)
    img.colorspace_settings.name = "sRGB"
    img.pixels.foreach_set(out.ravel())
    img.filepath_raw = TEX
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)
    img = bpy.data.images.load(TEX, check_existing=False)
    img.name = "KomurFur"
    img.pack()
    print("FUR TEXTURE", TEX, "white texels", int((mask > 0.5).sum()))
    return img

def raster(uvs, ws, mask, cover, W, H):
    p = np.array([[u.x * W, u.y * H] for u in uvs], np.float64)
    xmin = max(int(math.floor(p[:, 0].min())) - 1, 0); xmax = min(int(math.ceil(p[:, 0].max())) + 1, W - 1)
    ymin = max(int(math.floor(p[:, 1].min())) - 1, 0); ymax = min(int(math.ceil(p[:, 1].max())) + 1, H - 1)
    if xmax < xmin or ymax < ymin:
        return
    xs, ys = np.meshgrid(np.arange(xmin, xmax + 1) + 0.5, np.arange(ymin, ymax + 1) + 0.5)
    (x0, y0), (x1, y1), (x2, y2) = p
    den = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
    if abs(den) < 1e-12:
        return
    a = ((y1 - y2) * (xs - x2) + (x2 - x1) * (ys - y2)) / den
    b = ((y2 - y0) * (xs - x2) + (x0 - x2) * (ys - y2)) / den
    c = 1 - a - b
    eps = -0.02
    inside = (a >= eps) & (b >= eps) & (c >= eps)
    val = a * ws[0] + b * ws[1] + c * ws[2]
    sub_m = mask[ymin:ymax + 1, xmin:xmax + 1]
    sub_c = cover[ymin:ymax + 1, xmin:xmax + 1]
    sub_m[inside] = np.maximum(sub_m[inside], val[inside])
    sub_c[inside] = 1.0

fur = build_fur_texture()

def principled(name, color=(1, 1, 1, 1), rough=0.6, metal=0.0, emit=None, emit_strength=0.0, image=None):
    mat = bpy.data.materials.new(name)
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Base Color"].default_value = color
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage")
        tex.image = image
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    if emit is not None:
        bsdf.inputs["Emission Color"].default_value = emit
        bsdf.inputs["Emission Strength"].default_value = emit_strength
    return mat

fur_mat = principled("KomurFur", rough=0.62, image=fur)
eye_mat = principled("KomurEyeAmber", color=(1.0, 0.52, 0.04, 1), rough=0.25,
                     emit=(1.0, 0.45, 0.02, 1), emit_strength=0.55)
pupil_mat = principled("KomurPupil", color=(0.0, 0.0, 0.0, 1), rough=0.15)
whisker_mat = principled("KomurWhisker", color=(0.85, 0.85, 0.82, 1), rough=0.5)

def replace_slots(ob, mapping):
    for slot in ob.material_slots:
        if slot.material and slot.material.name in mapping:
            slot.material = mapping[slot.material.name]

replace_slots(body, {"SomaliTexture": fur_mat, "Whiskers": whisker_mat})
replace_slots(tail, {"SomaliTexture": fur_mat})
for e in eyes:
    # delete the transparent cornea shell (mix/transparent shader can't export cleanly)
    glass_idx = [i for i, s in enumerate(e.material_slots) if s.material and s.material.name == "Glass"]
    me = e.data
    if me.users > 1:
        e.data = me = me.copy()
    bm = bmesh.new(); bm.from_mesh(me)
    kill = [f for f in bm.faces if f.material_index in glass_idx]
    bmesh.ops.delete(bm, geom=kill, context="FACES")
    bm.to_mesh(me); bm.free()
    replace_slots(e, {"Eye": eye_mat, "Pupils.001": pupil_mat})

# ---------------------------------------------------------------- actions
pb = arm.pose.bones
REST = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
REST_HEAD = {b.name: b.head_local.copy() for b in arm.data.bones}

def actions_channels(act):
    out = []
    for layer in act.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out

def assign(act):
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = act
    try:
        if act.slots:
            ad.action_slot = act.slots[0]
    except Exception:
        pass

# neutral pose = Idle frame 0
assign(bpy.data.actions["Idle"])
scene.frame_set(0)
NEUTRAL = {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in pb}
# clear NLA so only our explicit setup exports
for t in list(arm.animation_data.nla_tracks):
    arm.animation_data.nla_tracks.remove(t)

def qaxis(bone, axis, deg):
    """World-axis rotation expressed in the bone's rest frame."""
    R = REST[bone]
    q = Quaternion(Vector(axis).normalized(), math.radians(deg))
    m = R.inverted() @ q.to_matrix() @ R
    return m.to_quaternion()

def wloc(bone, delta):
    return REST[bone].inverted() @ Vector(delta)

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)
FEET = ("Foot.L", "Foot.R", "Paw.L", "Paw.R")
SIDE = {"Foot.L": -1, "Paw.L": -1, "Foot.R": 1, "Paw.R": 1}

SCALE_BONES = set()  # bones whose scale is keyed in the action being authored (tail puff)

def key_pose(frame, pose):
    """pose: {bone: {'rot': [(axis, deg), ...], 'loc': (dx,dy,dz) world delta, 'lrot': [(local_axis, deg)], 'scale': s}}"""
    for b in pb:
        loc0, q0 = NEUTRAL[b.name]
        spec = pose.get(b.name, {})
        q = Quaternion() if spec.get("abs") else q0.copy()
        for ax, deg in spec.get("rot", []):
            q = q @ qaxis(b.name, ax, deg)
        for ax, deg in spec.get("lrot", []):
            q = q @ Quaternion(Vector(ax), math.radians(deg))
        loc = loc0.copy()
        if "loc" in spec:
            loc = loc + wloc(b.name, spec["loc"])
        b.location = loc
        b.rotation_quaternion = q
        b.keyframe_insert("location", frame=frame)
        b.keyframe_insert("rotation_quaternion", frame=frame)
        if b.name in SCALE_BONES:
            s = spec.get("scale", 1.0)  # uniform: children inherit it, non-uniform would shear the curled tail
            b.scale = Vector((s, s, s))
            b.keyframe_insert("scale", frame=frame)

def new_action(name):
    old = bpy.data.actions.get(name)
    if old:
        bpy.data.actions.remove(old)
    SCALE_BONES.clear()
    for b in pb:
        b.scale = Vector((1, 1, 1))
    act = bpy.data.actions.new(name)
    act.use_fake_user = True
    assign(act)
    return act

def merge(*poses):
    out = {}
    for p in poses:
        for bone, spec in p.items():
            o = out.setdefault(bone, {})
            for k, v in spec.items():
                if k == "loc":
                    a = Vector(o.get("loc", (0, 0, 0)))
                    o["loc"] = tuple(a + Vector(v))
                elif k in ("abs", "scale"):
                    o[k] = v
                else:
                    o[k] = o.get(k, []) + list(v)
    return out

def tail_pose(lift=45.0, curl=40.0, side=0.0, phase=0.0, wave=0.0):
    """Absolute tail chain pose relative to the straight-back rest tail.
    lift: base raise in degrees (+ up); curl: extra raise per segment (+ curls up/over);
    side: swish (deg); wave: travelling side wave amplitude.  lift=45,curl=40 ~ relaxed idle curl."""
    segs = ("TailBase", "TailBaseMiddle", "TailTipMiddle", "TailTip")
    p = {}
    for i, s in enumerate(segs):
        sw = side + wave * math.sin(phase - i * 0.9)
        bend = lift if i == 0 else curl * (0.6 + 0.25 * i)
        p[s] = {"abs": True, "lrot": [((1, 0, 0), -bend), ((0, 0, 1), sw * (0.6 + 0.2 * i))]}
    return p

def ears(back=0.0, flick=0.0):
    return {"Ear.L": {"rot": [(Y, -back), (X, -back * 0.5 + flick)]},
            "Ear.R": {"rot": [(Y, back), (X, -back * 0.5 + flick)]}}

def body(dz=0.0, dy=0.0, pitch=0.0, roll=0.0, yaw=0.0, pivot=(0.0, -0.2, 0.3)):
    """Move/rotate the whole torso (SpineRoot) about a chosen pivot (armature space)."""
    p = {"SpineRoot": {"loc": (0, dy, dz)}}
    if pitch or roll or yaw:
        p["SpineRoot"]["rot"] = [(X, pitch), (Y, roll), (Z, yaw)]
        R = (Quaternion(Vector(X), math.radians(pitch)) @ Quaternion(Vector(Y), math.radians(roll))
             @ Quaternion(Vector(Z), math.radians(yaw))).to_matrix()
        H = REST_HEAD["SpineRoot"]
        PH = Vector(pivot) - H
        t = PH - R @ PH
        p["SpineRoot"]["loc"] = (t.x, dy + t.y, dz + t.z)
    return p

def spine(flex=0.0, lateral=0.0):
    """flex>0 arches (hunch); <0 extends.  Lower/upper spine pitch in opposite senses."""
    return {"LowerSpine": {"rot": [(X, flex), (Z, lateral)]},
            "UpperSpine": {"rot": [(X, -flex), (Z, -lateral)]}}

def head(pitch=0.0, yaw=0.0, roll=0.0, neck=0.0):
    return {"Neck": {"rot": [(X, neck)]}, "Head": {"rot": [(X, pitch), (Z, yaw), (Y, roll)]}}

def foot(name, dy=0.0, dz=0.0, dx=0.0, pitch=0.0):
    p = {name: {"loc": (dx, dy, dz)}}
    if pitch:
        p[name]["rot"] = [(X, pitch)]
    return p

def smoothstep(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)

def gait(name, frames, offsets, duty, stride, lift, bob, bob_freq, flex=0.0, flex_phase=0.0,
         pitch=0.0, head_counter=0.6, tail_lift=12, tail_curl=5, tail_wave=6, ear_back=0.0,
         crouch=0.0, fore_scale=1.0, body_dy=0.0, paw_flick=35):
    act = new_action(name)
    for f in range(frames + 1):
        t = (f % frames) / frames
        pose = {}
        for leg, off in offsets.items():
            u = (t + off) % 1.0
            s = stride * (fore_scale if leg.startswith("Paw") else 1.0)
            if u < duty:
                v = u / duty
                dy = s * (0.5 - v)
                dz = 0.0
                fp = 0.0
            else:
                v = (u - duty) / (1.0 - duty)
                dy = s * (-0.5 + smoothstep(v))
                dz = lift * math.sin(math.pi * v) ** 0.9
                fp = paw_flick * math.sin(math.pi * v)
            pose.update(foot(leg, dy=dy, dz=dz, pitch=fp))
        ph = 2 * math.pi * t
        bz = -crouch + bob * math.cos(bob_freq * ph)
        fl = flex * math.sin(ph + flex_phase)
        pt = pitch * math.sin(ph + flex_phase + 0.6)
        pose = merge(pose, body(dz=bz, dy=body_dy, pitch=pt), spine(flex=fl),
                     head(pitch=-pt * head_counter - fl * 0.4, neck=-crouch * 18),
                     tail_pose(lift=tail_lift + 4 * math.sin(ph), curl=tail_curl, phase=ph, wave=tail_wave),
                     ears(back=ear_back))
        key_pose(f + 1, pose)
    return act

exec(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "komur_actions.py"), encoding="utf-8").read())

# Smug victory sit (uses SitDown pose start) — loop with tail swish
assign(bpy.data.actions["SittingIdle"]); scene.frame_set(0)
SIT = {b.name: (b.location.copy(), b.rotation_quaternion.copy()) for b in pb}
assign(bpy.data.actions["Idle"]); scene.frame_set(0)
act = new_action("SmugSit")
for f, (yaw, roll, side) in ((1, (0, 0, -16)), (13, (18, 8, 14)), (25, (14, 10, -12)), (37, (-6, -4, 16)), (49, (0, 0, -16))):
    for b in pb:
        loc, q = SIT[b.name]
        b.location = loc.copy()
        b.rotation_quaternion = q.copy()
    pb["Head"].rotation_quaternion = SIT["Head"][1] @ qaxis("Head", Z, yaw) @ qaxis("Head", Y, roll) @ qaxis("Head", X, 10)
    for i, s in enumerate(("TailBase", "TailBaseMiddle", "TailTipMiddle", "TailTip")):
        pb[s].rotation_quaternion = SIT[s][1] @ Quaternion((0, 0, 1), math.radians(side * (0.4 + 0.25 * i)))
    for b in pb:
        b.keyframe_insert("location", frame=f)
        b.keyframe_insert("rotation_quaternion", frame=f)

# ---------------------------------------------------------------- tidy actions
KEEP = {"Idle", "SitDown", "SittingIdle", "StandUp",
        # locomotion ("Catwalk" replaces the source pack's short-stride WalkClean and is exported as "Walk")
        "Catwalk", "Trot", "Gallop", "Sneak", "Scrabble", "CrouchIdle", "Skid", "TurnL", "TurnR",
        # idle life
        "LieDown", "Loaf", "Sniff", "ChaseTail",
        # jumping / landing / climbing
        "JumpPrep", "JumpUp", "LandOn", "JumpTakeoff", "JumpAir", "Fall", "LandSoft", "LandHeavy", "Climb", "JumpDown",
        # actions
        "Pounce", "Swipe", "SwipeL", "Nudge", "Meow", "Hiss", "Scratch",
        # reactions / idles
        "Startle", "ShakeOff", "Stumble", "Caught", "LookAround", "Groom", "Stretch", "SmugSit"}
for a in list(bpy.data.actions):
    if a.name not in KEEP:
        bpy.data.actions.remove(a)
bpy.data.actions["Catwalk"].name = "Walk"
CYCLIC = ("Walk", "Trot", "Gallop", "Sneak", "Scrabble", "ChaseTail")
for a in bpy.data.actions:
    a.use_fake_user = True
    # linear interpolation on generated cyclic data keeps loops seamless
    for fc in actions_channels(a):
        if a.name in CYCLIC:
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"

# gait speeds (so the game can match playback rate to ground speed: no foot sliding) + clip lengths
import json
for g in ("Walk", "Trot", "Gallop", "Sneak", "Scrabble"):
    measure_gait(g)
META = {"fps": FPS, "gaits": GAIT_INFO,
        "clips": {a.name: round((a.frame_range[1] - a.frame_range[0]) / FPS, 4) for a in bpy.data.actions}}
meta_out = arg("--meta")
if meta_out:
    with open(os.path.abspath(meta_out), "w", encoding="utf-8") as fh:
        json.dump(META, fh, indent=1, sort_keys=True)
    print("META", meta_out)

assign(bpy.data.actions["Idle"])
scene.frame_set(1)
print("ACTIONS", sorted(a.name + ":" + str(tuple(int(x) for x in a.frame_range)) for a in bpy.data.actions))

if SAVE:
    bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(SAVE), copy=True)
    print("SAVED", SAVE)

# ---------------------------------------------------------------- export
os.makedirs(os.path.dirname(OUT), exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=OUT, export_format="GLB", export_animations=True, export_animation_mode="ACTIONS",
    export_force_sampling=True, export_optimize_animation_size=True, export_skins=True,
    export_morph=True, export_image_format="AUTO", export_cameras=False, export_lights=False,
    export_apply=False, export_yup=True, export_reset_pose_bones=True, export_def_bones=False,
    export_anim_single_armature=True, export_frame_step=1)
print("EXPORTED", OUT, os.path.getsize(OUT))
