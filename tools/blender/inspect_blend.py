"""Headless inspection of a .blend / .glb / .fbx: prints a JSON report of
objects, armatures (bones with hierarchy + rest positions), actions (frame
ranges, channel counts, animated bones), materials/images, meshes.
Usage: blender -b -Y --factory-startup -t 2 [file.blend] --python inspect_blend.py -- [--import path] [--out report.json]
"""
import bpy, sys, json, os, math

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) else default
    return default

imp = arg("--import")
out = arg("--out")
if imp:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = os.path.splitext(imp)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=imp)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=imp)

def r3(v):
    return [round(float(x), 4) for x in v]

def action_channels(act):
    """Return list of (data_path, index) across legacy or layered actions."""
    chans = []
    try:
        for layer in act.layers:
            for strip in layer.strips:
                for bag in strip.channelbags:
                    for fc in bag.fcurves:
                        chans.append((fc.data_path, fc.array_index, len(fc.keyframe_points)))
    except AttributeError:
        pass
    if not chans:
        try:
            for fc in act.fcurves:
                chans.append((fc.data_path, fc.array_index, len(fc.keyframe_points)))
        except AttributeError:
            pass
    return chans

rep = {"blender": bpy.app.version_string, "file": bpy.data.filepath or imp,
       "scene": {"fps": bpy.context.scene.render.fps, "frame_start": bpy.context.scene.frame_start,
                 "frame_end": bpy.context.scene.frame_end, "unit_scale": bpy.context.scene.unit_settings.scale_length},
       "objects": [], "armatures": [], "actions": [], "materials": [], "images": [], "meshes": []}

for ob in bpy.data.objects:
    o = {"name": ob.name, "type": ob.type, "parent": ob.parent.name if ob.parent else None,
         "parent_type": ob.parent_type, "parent_bone": ob.parent_bone or None,
         "loc": r3(ob.location), "rot_mode": ob.rotation_mode, "rot_euler": r3(ob.rotation_euler),
         "scale": r3(ob.scale), "dims": r3(ob.dimensions), "hide_render": ob.hide_render,
         "collections": [c.name for c in ob.users_collection],
         "modifiers": [(m.name, m.type, getattr(m, 'object', None).name if getattr(m, 'object', None) else None) for m in ob.modifiers],
         "constraints": [(c.name, c.type) for c in ob.constraints]}
    if ob.animation_data:
        ad = ob.animation_data
        o["anim_action"] = ad.action.name if ad.action else None
        o["nla"] = [{"track": t.name, "strips": [(s.name, s.action.name if s.action else None, s.frame_start, s.frame_end) for s in t.strips]} for t in ad.nla_tracks]
    if ob.type == 'MESH':
        o["vertex_groups"] = [vg.name for vg in ob.vertex_groups]
        o["materials"] = [s.material.name if s.material else None for s in ob.material_slots]
        sk = ob.data.shape_keys
        o["shape_keys"] = [k.name for k in sk.key_blocks] if sk else []
    rep["objects"].append(o)

for ob in bpy.data.objects:
    if ob.type != 'ARMATURE':
        continue
    arm = ob.data
    bones = []
    for b in arm.bones:
        bones.append({"name": b.name, "parent": b.parent.name if b.parent else None,
                      "head": r3(ob.matrix_world @ b.head_local), "tail": r3(ob.matrix_world @ b.tail_local),
                      "len": round(b.length, 4), "deform": b.use_deform, "children": len(b.children)})
    pconstr = []
    for pb in ob.pose.bones:
        for c in pb.constraints:
            pconstr.append((pb.name, c.name, c.type, getattr(c, 'subtarget', '')))
    rep["armatures"].append({"object": ob.name, "data": arm.name, "bone_count": len(bones),
                             "pose_position": arm.pose_position, "bones": bones, "pose_constraints": pconstr})

for act in bpy.data.actions:
    chans = action_channels(act)
    bones = sorted({c[0].split('"')[1] for c in chans if c[0].startswith('pose.bones["')})
    paths = sorted({c[0].split('.')[-1] for c in chans})
    rep["actions"].append({"name": act.name, "frame_range": r3(act.frame_range), "users": act.users,
                           "fake_user": act.use_fake_user, "channels": len(chans), "animated_bones": len(bones),
                           "bones": bones, "props": paths,
                           "max_keys": max([c[2] for c in chans]) if chans else 0,
                           "slots": [s.identifier for s in getattr(act, 'slots', [])]})

for m in bpy.data.materials:
    info = {"name": m.name, "users": m.users, "use_nodes": m.use_nodes, "nodes": []}
    if m.use_nodes and m.node_tree:
        for n in m.node_tree.nodes:
            nd = {"type": n.type, "name": n.name}
            if n.type == 'TEX_IMAGE' and n.image:
                nd["image"] = n.image.name
            if n.type == 'BSDF_PRINCIPLED':
                bc = n.inputs.get('Base Color')
                if bc is not None and not bc.is_linked:
                    nd["base_color"] = r3(bc.default_value)
            info["nodes"].append(nd)
    rep["materials"].append(info)

for im in bpy.data.images:
    rep["images"].append({"name": im.name, "filepath": im.filepath, "size": list(im.size),
                          "packed": bool(im.packed_file), "source": im.source})

for me in bpy.data.meshes:
    rep["meshes"].append({"name": me.name, "verts": len(me.vertices), "polys": len(me.polygons),
                          "uv_layers": [u.name for u in me.uv_layers],
                          "color_attrs": [c.name for c in me.color_attributes]})

txt = json.dumps(rep, indent=1)
if out:
    with open(out, "w") as f:
        f.write(txt)
    print("WROTE", out)
else:
    print(txt)
