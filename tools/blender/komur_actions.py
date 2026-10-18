# Komur action library v2 — exec()'d inside build_komur.py (shares its helpers/namespace).
#
# Rig conventions (armature space): +Y = forward (head), +Z = up, -X = cat's left.  Feet (Foot.L/R = hind,
# Paw.L/R = front) are IK targets moved in armature space; SpineRoot moves/rotates the whole torso.
# Units: rig units (Komur is ~3.3u nose-to-rump; the game scales the model by 0.15 -> 1u = 0.15m).
# Signs: body(pitch>0) = nose up; head(pitch>0) = chin up; spine(flex>0) = arched / gathered.
#
# Cat motion notes that drive these clips:
#  * walk = 4-beat lateral sequence (LH, LF, RH, RF), 3 feet down most of the time, head steady
#  * trot = diagonal pairs, light bounce
#  * gallop = rotary: hinds push almost together, spine EXTENDS and the forelegs reach, the fores land,
#    then the spine FLEXES and the hinds swing far forward under the belly (two flight phases)
#  * jumping up: gauge the target, crouch on the haunches, explode off the hind legs, forelegs reach for
#    the edge, fores land first and the hinds are tucked up after them; too high -> hook + scramble
#  * jumping down: lean over the edge, stretch the forelegs down, drop, fores land first and absorb
#  * every action leads with the head and is followed through by the tail

FPS = 24
GAIT_INFO = {}  # name -> {"frames", "cycle_s"} (stride speeds are measured after authoring)


def oneshot(name, keys, scale_bones=()):
    """keys: list of (frame, pose)."""
    act = new_action(name)
    SCALE_BONES.update(scale_bones)
    for f, pose in keys:
        key_pose(f, pose)
    return act


def tail_side(side):
    """Additive swish overlay for merging onto a pose that already has a tail."""
    return {s: {"lrot": [((0, 0, 1), side * (0.6 + 0.2 * i))]}
            for i, s in enumerate(("TailBase", "TailBaseMiddle", "TailTipMiddle", "TailTip"))}


def puff(s):
    return {"TailBase": {"scale": s}}


def bump(v, peak=0.45):
    """0 -> 1 -> 0 hump over v in [0,1], peaking at `peak` (asymmetric swing lift)."""
    if v <= 0.0 or v >= 1.0:
        return 0.0
    if v < peak:
        return math.sin(0.5 * math.pi * v / peak)
    return math.cos(0.5 * math.pi * (v - peak) / (1.0 - peak))


def ease(v):
    v = max(0.0, min(1.0, v))
    return v * v * (3 - 2 * v)


HIPS = (0.0, -1.1, -0.2)        # pivot for rearing up / pitching about the haunches
SHOULDERS = (0.0, 0.9, -0.2)    # pivot for pitching about the forelegs
STAND = merge(head(), tail_pose(), ears())


def cycle(name, frames, offsets, duty, stride, lift, *, fore_scale=1.0, fore_reach=1.0, hind_reach=1.0,
          swing_peak=0.42, flick=35.0, fore_lift=None, bob=0.05, bob_n=2, bob_phase=0.0,
          pitch=0.0, pitch_phase=0.0, roll=0.0, roll_phase=0.0, lateral=0.0, lateral_phase=0.0, flex=0.0, flex_phase=0.0,
          crouch=0.0, body_dy=0.0, body_pitch0=0.0, head_pitch=0.0, head_stab=0.85, neck=0.0,
          tail_lift=30.0, tail_curl=12.0, tail_wave=6.0, tail_bob=4.0, tail_side=0.0, ear_back=0.0,
          dx_sway=0.0, sway_phase=0.0, track=0.0):
    """Cyclic gait.  offsets: leg -> phase offset; a leg touches down when (t + off) % 1 == 0.
    track > 0 places every paw that much closer to the midline (single-tracking, the catwalk line)."""
    act = new_action(name)
    for f in range(frames + 1):
        t = (f % frames) / frames
        ph = 2 * math.pi * t
        pose = {}
        for leg, off in offsets.items():
            u = (t + off) % 1.0
            front = leg.startswith("Paw")
            s = stride * (fore_scale if front else 1.0)
            reach = fore_reach if front else hind_reach
            front_y, back_y = 0.5 * s * reach, -0.5 * s
            lf = (fore_lift if (front and fore_lift is not None) else lift)
            if u < duty:            # stance: planted, sliding back under the moving body
                v = u / duty
                dy = front_y + (back_y - front_y) * v
                dz = 0.0
                fp = 0.0
            else:                   # swing: lift early, carry forward, reach and plant
                v = (u - duty) / (1.0 - duty)
                dy = back_y + (front_y - back_y) * ease(v)
                dz = lf * bump(v, swing_peak)
                fp = -flick * bump(v, 0.3) + 0.35 * flick * bump(v, 0.85)
            pose = merge(pose, foot(leg, dy=dy, dz=dz, dx=-SIDE[leg] * track, pitch=fp))
        bz = -crouch + bob * math.cos(bob_n * (ph - bob_phase))
        pt = body_pitch0 + pitch * math.sin(ph - pitch_phase)
        rl = roll * math.sin(ph - roll_phase)
        lt = lateral * math.sin(ph - lateral_phase)
        fl = flex * math.cos(ph - flex_phase)
        dx = dx_sway * math.sin(ph - sway_phase)
        pose = merge(pose,
                     {"SpineRoot": {"loc": (dx, 0, 0)}},
                     body(dz=bz, dy=body_dy, pitch=pt, roll=rl),
                     spine(flex=fl, lateral=lt),
                     head(pitch=head_pitch - head_stab * (pt - body_pitch0) - 0.35 * fl, yaw=-0.6 * lt, neck=neck - crouch * 16),
                     tail_pose(lift=tail_lift + tail_bob * math.sin(ph), curl=tail_curl, side=tail_side, phase=ph, wave=tail_wave),
                     ears(back=ear_back))
        key_pose(f + 1, pose)
    GAIT_INFO[name] = {"frames": frames, "cycle_s": frames / FPS}
    return act


# ============================================================== locomotion cycles (24f = 1s at timeScale 1)
# Trot: diagonal pairs (LF+RH, RF+LH), hind lands a hair before its fore partner, light bounce.
cycle("Trot", 24, {"Paw.L": 0.0, "Foot.R": 0.02, "Paw.R": 0.5, "Foot.L": 0.52},
      duty=0.5, stride=3.0, lift=0.5, fore_lift=0.58, swing_peak=0.4, flick=40,
      bob=0.07, bob_n=2, bob_phase=0.15, pitch=1.5, roll=2.5, lateral=3.0, lateral_phase=0.4,
      head_pitch=-16, tail_lift=34, tail_curl=16, tail_wave=7, ear_back=4)

# Gallop: rotary (LH, RH, RF, LF).  Spine extends after the hind push and flexes while the fores are down;
# hinds swing far forward under the belly (hind_reach), fores reach long (fore_reach).
cycle("Gallop", 24, {"Foot.L": 0.0, "Foot.R": 0.93, "Paw.R": 0.5, "Paw.L": 0.41},
      duty=0.3, stride=2.7, lift=0.7, fore_lift=0.75, swing_peak=0.38, flick=50,
      fore_scale=1.1, fore_reach=1.45, hind_reach=1.5,
      bob=0.2, bob_n=1, bob_phase=0.4 * 2 * math.pi, pitch=6.0, pitch_phase=0.15 * 2 * math.pi,
      flex=17.0, flex_phase=0.85 * 2 * math.pi, roll=2.0,
      head_pitch=-14, head_stab=0.9, neck=-6, tail_lift=8, tail_curl=-3, tail_wave=5, tail_bob=8, ear_back=30)

# Sneak: low stalking lateral walk, belly near the floor, head level and forward, tail low with a twitching tip.
cycle("Sneak", 24, {"Foot.L": 0.0, "Paw.L": 0.75, "Foot.R": 0.5, "Paw.R": 0.25},
      duty=0.72, stride=2.6, lift=0.3, fore_lift=0.36, swing_peak=0.45, flick=25,
      bob=0.025, bob_n=2, crouch=0.62, lateral=4.0, roll=1.5, head_pitch=6, neck=-6,
      tail_lift=-12, tail_curl=14, tail_wave=10, ear_back=20)

# Scrabble: Tom-and-Jerry wind-up — legs a blur, body low and leaning in, going nowhere (yet).
cycle("Scrabble", 12, {"Foot.L": 0.0, "Foot.R": 0.5, "Paw.R": 0.25, "Paw.L": 0.75},
      duty=0.3, stride=1.9, lift=0.6, fore_lift=0.65, swing_peak=0.35, flick=45,
      bob=0.05, bob_n=2, body_pitch0=-8.0, crouch=0.28, roll=4.0, lateral=6.0,
      head_pitch=-4, head_stab=0.0, neck=-8, tail_lift=6, tail_curl=-6, tail_wave=12, ear_back=38)

# Catwalk (exported as "Walk", the default gait): a graceful, deliberate 4-beat lateral walk (LH, LF, RH, RF)
# with a long stride so the legs swing at an unhurried cadence at game speed (~1.9 strides/s at 1.45 m/s).
# Paws are placed toward the midline (single-tracking: the hind paw steps into the fore paw's print), the
# shoulder blades roll, the hips sway over the supporting hind leg, the head floats level and the tail rides
# up with a soft hook.  Lateral-sequence supports: LH stance t[0,.6), RH t[.5,1.1): sway left peaks ~t=.375.
cycle("Catwalk", 24, {"Foot.L": 0.0, "Paw.L": 0.75, "Foot.R": 0.5, "Paw.R": 0.25},
      duty=0.6, stride=3.1, lift=0.42, fore_lift=0.55, swing_peak=0.42, flick=32, track=0.16,
      bob=0.03, bob_n=2, bob_phase=0.3, roll=2.4, roll_phase=0.785, lateral=3.0, lateral_phase=0.6,
      dx_sway=0.045, sway_phase=0.785, head_pitch=-20, head_stab=0.92, neck=2,
      tail_lift=36, tail_curl=26, tail_wave=7, tail_bob=4, ear_back=-3)

# ============================================================== idle life
# Lie down into a "loaf" (front paws tucked, tail wrapped round), then breathe.
# (head angles are relative to the source Idle, which holds the head ~30 deg up: -24 looks level)
LOAF = merge(body(dz=-1.0, dy=-0.05, pitch=-2), spine(flex=4), head(pitch=-24, neck=-12),
             foot("Paw.L", dy=-0.42, dz=0.02, dx=0.06), foot("Paw.R", dy=-0.42, dz=0.02, dx=-0.06),
             foot("Foot.L", dy=0.3, dx=-0.12), foot("Foot.R", dy=0.3, dx=0.12),
             tail_pose(lift=-18, curl=8, side=42), ears(back=4))
oneshot("LieDown", [
    (1, STAND),
    (6, merge(body(dz=-0.45, dy=-0.15, pitch=8, pivot=HIPS), head(pitch=-18), tail_pose(lift=20, curl=20, side=10))),
    (12, merge(body(dz=-0.8, dy=-0.1, pitch=2), spine(flex=4), head(pitch=-24, neck=-8),
               foot("Paw.L", dy=-0.2), foot("Paw.R", dy=-0.2), tail_pose(lift=-5, curl=10, side=30))),
    (18, LOAF),
])
oneshot("Loaf", [
    (1, LOAF),
    (13, merge(LOAF, body(dz=0.035), tail_pose(lift=-16, curl=10, side=46))),
    (25, merge(LOAF, head(pitch=-20, yaw=10), ears(flick=8))),
    (37, merge(LOAF, body(dz=0.035), head(pitch=-22, yaw=4), tail_pose(lift=-16, curl=10, side=46))),
    (49, LOAF),
])
# Nose to the floorboards: sniff, sniff, follow the trail, look up.
SN = merge(body(dz=-0.22, dy=0.1, pitch=-12, pivot=HIPS), spine(flex=-4), tail_pose(lift=30, curl=24), ears(back=-4))
oneshot("Sniff", [
    (1, STAND),
    (7, merge(SN, head(pitch=-64, neck=-24, yaw=8))),
    (10, merge(SN, head(pitch=-58, neck=-22, yaw=6))),
    (13, merge(SN, head(pitch=-66, neck=-25, yaw=4))),
    (16, merge(SN, head(pitch=-58, neck=-22, yaw=-12), tail_pose(lift=32, curl=26, side=8))),
    (19, merge(SN, head(pitch=-67, neck=-25, yaw=-16))),
    (22, merge(SN, head(pitch=-60, neck=-23, yaw=-14))),
    (28, merge(head(pitch=-14, yaw=6), tail_pose(lift=45, curl=40, side=-6), ears(flick=10))),
    (36, STAND),
])
# Chasing its own tail (loop).  Head turned to the cat's RIGHT (negative yaw), the spine in a C-curve to the
# right and the tail swung round to the right to meet it; the game spins him clockwise (toward the head).
CT = merge(body(dz=-0.2, roll=5), {"LowerSpine": {"rot": [(X, 6), (Z, -14)]}, "UpperSpine": {"rot": [(X, -6), (Z, -18)]}},
           head(yaw=-42, pitch=-26, neck=-8), tail_pose(lift=10, curl=4, side=55), ears(back=12))
act = new_action("ChaseTail")
for f in range(13):
    t = f / 12.0
    pose = merge(CT, {"SpineRoot": {"loc": (0, 0, 0.04 * math.cos(4 * math.pi * t))}})
    for leg, off in (("Paw.L", 0.0), ("Foot.R", 0.0), ("Paw.R", 0.5), ("Foot.L", 0.5)):
        u = (t + off) % 1.0
        up = 0.32 * bump(u * 2.0, 0.5) if u < 0.5 else 0.0
        # quick side-steps carrying the body round (fronts step out, hinds step in)
        sx = (0.18 if leg.startswith("Paw") else -0.12) * math.sin(2 * math.pi * u)
        pose = merge(pose, foot(leg, dz=up, dx=sx))
    key_pose(f + 1, pose)

# ============================================================== holds
oneshot("CrouchIdle", [
    (1, merge(body(dz=-0.68, dy=-0.05), head(pitch=6, neck=-14), tail_pose(lift=-10, curl=16, side=-10), ears(back=18))),
    (13, merge(body(dz=-0.70, dy=-0.05), head(pitch=8, yaw=6, neck=-14), tail_pose(lift=-10, curl=16, side=10), ears(back=14))),
    (25, merge(body(dz=-0.68, dy=-0.05), head(pitch=6, neck=-14), tail_pose(lift=-10, curl=16, side=-10), ears(back=18))),
])

# ============================================================== jumping
# Prep: settle onto the haunches, eyes on the target, one butt-wiggle (the game time-scales this clip so
# that its last frame lands exactly on the take-off).
PREP = merge(body(dz=-0.52, dy=-0.12, pitch=6, pivot=HIPS), spine(flex=6), head(pitch=16, neck=6),
             foot("Foot.L", dy=0.35), foot("Foot.R", dy=0.35), foot("Paw.L", dy=-0.1), foot("Paw.R", dy=-0.1),
             tail_pose(lift=8, curl=18), ears(back=-6))
oneshot("JumpPrep", [
    (1, STAND),
    (4, merge(PREP, body(dz=0.1))),
    (7, merge(PREP, {"SpineRoot": {"loc": (0.07, 0, 0)}}, body(roll=5), tail_side(14))),
    (10, merge(PREP, {"SpineRoot": {"loc": (-0.07, 0, 0)}}, body(roll=-5), tail_side(-14))),
    (12, merge(PREP, body(dz=-0.06), tail_side(4))),
])

# Leap up onto a higher surface (time-scaled to the flight).  f1 = take-off, f12 = forepaws touch down.
oneshot("JumpUp", [
    (1, merge(body(dz=0.3, pitch=24, pivot=HIPS), spine(flex=-10), head(pitch=14),
              foot("Foot.L", dy=-0.65), foot("Foot.R", dy=-0.6),
              foot("Paw.L", dy=0.55, dz=1.1, pitch=-40), foot("Paw.R", dy=0.6, dz=1.15, pitch=-40),
              tail_pose(lift=-6, curl=6), ears(back=8))),
    (3, merge(body(dz=0.15, pitch=28, pivot=HIPS), spine(flex=-15), head(pitch=12),
              foot("Foot.L", dy=-1.05, dz=0.25, pitch=-30), foot("Foot.R", dy=-1.0, dz=0.3, pitch=-30),
              foot("Paw.L", dy=0.95, dz=1.6, pitch=-55), foot("Paw.R", dy=1.0, dz=1.55, pitch=-55),
              tail_pose(lift=-12, curl=4), ears(back=12))),
    (6, merge(body(dz=0.1, pitch=10, pivot=HIPS), spine(flex=-4), head(pitch=0),
              foot("Foot.L", dy=-0.35, dz=0.85, pitch=-20), foot("Foot.R", dy=-0.3, dz=0.9, pitch=-20),
              foot("Paw.L", dy=1.05, dz=0.7, pitch=-25), foot("Paw.R", dy=1.1, dz=0.65, pitch=-25),
              tail_pose(lift=18, curl=6), ears(back=10))),
    (9, merge(body(dz=0.05, pitch=-6), spine(flex=9), head(pitch=-10),
              foot("Foot.L", dy=0.1, dz=0.95), foot("Foot.R", dy=0.15, dz=0.9),
              foot("Paw.L", dy=0.8, dz=-0.05, pitch=10), foot("Paw.R", dy=0.85, dz=-0.1, pitch=10),
              tail_pose(lift=40, curl=10), ears(back=6))),
    (12, merge(body(dz=-0.15, pitch=-10, pivot=SHOULDERS), spine(flex=10), head(pitch=-8),
               foot("Foot.L", dy=-0.2, dz=0.6), foot("Foot.R", dy=-0.15, dz=0.55),
               foot("Paw.L", dy=0.35), foot("Paw.R", dy=0.4),
               tail_pose(lift=48, curl=14), ears(back=4))),
])
# Touch down on the ledge: fores already down, hinds tucked -> hinds plant, body absorbs, tail settles.
oneshot("LandOn", [
    (1, merge(body(dz=-0.15, pitch=-10, pivot=SHOULDERS), spine(flex=10), head(pitch=-8),
              foot("Foot.L", dy=-0.2, dz=0.6), foot("Foot.R", dy=-0.15, dz=0.55),
              foot("Paw.L", dy=0.35), foot("Paw.R", dy=0.4), tail_pose(lift=48, curl=14), ears(back=4))),
    (3, merge(body(dz=-0.38, pitch=-2), spine(flex=6), head(pitch=-4), foot("Paw.L", dy=0.2), foot("Paw.R", dy=0.25),
              tail_pose(lift=55, curl=26), ears(back=6))),
    (6, merge(body(dz=-0.1), head(pitch=2), tail_pose(lift=48, curl=36, side=6))),
    (9, STAND),
])
# Generic quick hop take-off (free jumps with nothing to land on): small crouch, spring.
oneshot("JumpTakeoff", [
    (1, STAND),
    (3, merge(body(dz=-0.42, pitch=4), spine(flex=6), head(pitch=6), foot("Paw.L", dy=0.15), foot("Paw.R", dy=0.15),
              tail_pose(lift=30, curl=12), ears(back=10))),
    (6, merge(body(dz=0.25, pitch=-14), spine(flex=-10), head(pitch=10),
              foot("Foot.L", dy=-0.9, dz=0.1), foot("Foot.R", dy=-0.9, dz=0.1),
              foot("Paw.L", dy=0.7, dz=0.9, pitch=-30), foot("Paw.R", dy=0.7, dz=0.9, pitch=-30),
              tail_pose(lift=12, curl=-4), ears(back=20))),
    (8, merge(body(dz=0.2, pitch=-10), spine(flex=-12), head(pitch=6),
              foot("Foot.L", dy=-1.3, dz=0.55), foot("Foot.R", dy=-1.3, dz=0.55),
              foot("Paw.L", dy=0.9, dz=1.05, pitch=-35), foot("Paw.R", dy=0.9, dz=1.05, pitch=-35),
              tail_pose(lift=8, curl=-6), ears(back=24))),
])
AIR = merge(body(dz=0.15, pitch=-6), spine(flex=-8), head(pitch=4),
            foot("Foot.L", dy=-1.25, dz=0.6, pitch=-20), foot("Foot.R", dy=-1.15, dz=0.65, pitch=-20),
            foot("Paw.L", dy=0.75, dz=0.95, pitch=-30), foot("Paw.R", dy=0.8, dz=0.9, pitch=-30),
            tail_pose(lift=10, curl=-4), ears(back=22))
oneshot("JumpAir", [(1, AIR), (7, merge(AIR, tail_side(8))), (13, AIR)])
# Falling: forelegs reaching for the ground, back arched, tail up as a counterweight.
FALL = merge(body(dz=0.05, pitch=-6), spine(flex=10), head(pitch=-18, neck=-6),
             foot("Foot.L", dy=0.35, dz=0.25, pitch=10), foot("Foot.R", dy=0.4, dz=0.2, pitch=10),
             foot("Paw.L", dy=0.6, dz=-0.15, pitch=-10), foot("Paw.R", dy=0.55, dz=-0.1, pitch=-10),
             tail_pose(lift=60, curl=18), ears(back=12))
oneshot("Fall", [(1, FALL), (7, merge(FALL, tail_side(12), ears(flick=8))), (13, FALL)])
# Small drop: forepaws first, quick absorb.
oneshot("LandSoft", [
    (1, merge(body(dz=-0.05, pitch=-12, pivot=HIPS), head(pitch=-10), foot("Foot.L", dz=0.25), foot("Foot.R", dz=0.25),
              foot("Paw.L", dy=0.2), foot("Paw.R", dy=0.2), tail_pose(lift=58, curl=20))),
    (3, merge(body(dz=-0.3, pitch=-5), spine(flex=6), head(pitch=-6), tail_pose(lift=55, curl=28), ears(back=8))),
    (5, merge(body(dz=-0.12), head(pitch=-1), tail_pose(lift=48, curl=36, side=-6))),
    (7, STAND),
])
# Big drop: deep absorb with splayed legs, then gather.
oneshot("LandHeavy", [
    (1, merge(FALL)),
    (3, merge(body(dz=-0.72, pitch=-4), spine(flex=12), head(pitch=-14, neck=-10),
              foot("Paw.L", dy=0.3, dx=-0.15), foot("Paw.R", dy=0.3, dx=0.15), foot("Foot.L", dx=-0.12), foot("Foot.R", dx=0.12),
              tail_pose(lift=62, curl=24), ears(back=20))),
    (6, merge(body(dz=-0.5, pitch=-2), spine(flex=8), head(pitch=-6), foot("Paw.L", dy=0.2, dx=-0.1), foot("Paw.R", dy=0.2, dx=0.1),
              tail_pose(lift=55, curl=30), ears(back=12))),
    (9, merge(body(dz=-0.2), head(pitch=0, yaw=8), tail_pose(lift=48, curl=36, side=8), ears(flick=8))),
    (12, STAND),
])
# Hook + scramble: forepaws hook the edge, hind feet scrabble up the face, pull over the top.
CL = dict(pitch=48, pivot=HIPS)
oneshot("Climb", [
    (1, merge(body(dz=0.25, **CL), spine(flex=-6), head(pitch=-22, neck=4),
              foot("Paw.L", dy=0.75, dz=2.45, pitch=-20), foot("Paw.R", dy=0.8, dz=2.4, pitch=-20),
              foot("Foot.L", dy=0.35, dz=0.35), foot("Foot.R", dy=0.3, dz=0.45),
              tail_pose(lift=-20, curl=8), ears(back=14))),
    (4, merge(body(dz=0.55, pitch=40, pivot=HIPS), spine(flex=-2), head(pitch=-18),
              foot("Paw.L", dy=0.8, dz=2.3), foot("Paw.R", dy=0.85, dz=2.25),
              foot("Foot.L", dy=0.6, dz=1.05), foot("Foot.R", dy=0.25, dz=0.35),
              tail_pose(lift=-10, curl=8, side=12), ears(back=16))),
    (6, merge(body(dz=0.85, pitch=30, pivot=HIPS), spine(flex=2), head(pitch=-14),
              foot("Paw.L", dy=0.9, dz=1.95), foot("Paw.R", dy=0.95, dz=1.9),
              foot("Foot.L", dy=0.3, dz=0.5), foot("Foot.R", dy=0.65, dz=1.15),
              tail_pose(lift=0, curl=10, side=-12), ears(back=16))),
    (8, merge(body(dz=1.0, pitch=18, pivot=HIPS), spine(flex=8), head(pitch=-8),
              foot("Paw.L", dy=0.9, dz=1.4), foot("Paw.R", dy=0.95, dz=1.4),
              foot("Foot.L", dy=0.7, dz=1.3), foot("Foot.R", dy=0.55, dz=1.1),
              tail_pose(lift=15, curl=10, side=8), ears(back=12))),
    (11, merge(body(dz=0.1, pitch=6), spine(flex=8), head(pitch=-2),
               foot("Paw.L", dy=0.55), foot("Paw.R", dy=0.6), foot("Foot.L", dy=-0.15, dz=0.65), foot("Foot.R", dy=-0.1, dz=0.6),
               tail_pose(lift=38, curl=18), ears(back=6))),
    (14, STAND),
])
# Jump down: peer over the edge, lean the chest down, forelegs stretch for the floor, drop.
oneshot("JumpDown", [
    (1, merge(head(pitch=-28, neck=-10), tail_pose(lift=40, curl=30), ears(back=-4))),
    (4, merge(body(dz=-0.2, pitch=-22, pivot=HIPS), spine(flex=-4), head(pitch=-20, neck=-6),
              foot("Paw.L", dy=0.6, dz=-0.3, pitch=10), foot("Paw.R", dy=0.65, dz=-0.35, pitch=10),
              foot("Foot.L", dy=0.2), foot("Foot.R", dy=0.2),
              tail_pose(lift=62, curl=20), ears(back=6))),
    (7, merge(body(dz=0.0, pitch=-32, pivot=HIPS), spine(flex=-10), head(pitch=-10),
              foot("Paw.L", dy=0.45, dz=-0.95, pitch=20), foot("Paw.R", dy=0.5, dz=-0.9, pitch=20),
              foot("Foot.L", dy=-0.65, dz=0.45, pitch=-25), foot("Foot.R", dy=-0.6, dz=0.5, pitch=-25),
              tail_pose(lift=72, curl=10), ears(back=10))),
    (10, merge(body(dz=0.0, pitch=-18, pivot=HIPS), spine(flex=2), head(pitch=-12),
               foot("Paw.L", dy=0.35, dz=-0.5, pitch=10), foot("Paw.R", dy=0.4, dz=-0.45, pitch=10),
               foot("Foot.L", dy=-0.15, dz=0.35), foot("Foot.R", dy=-0.1, dz=0.3),
               tail_pose(lift=64, curl=16), ears(back=8))),
])

# ============================================================== turns, brakes
# Skid (loop): Tom-and-Jerry brake — leaning back on the haunches, forelegs braced far ahead and
# scrabbling, tail whipping for balance.  The game slides and spins the cat while this plays.
SK = merge(body(dz=-0.28, dy=-0.3, pitch=11, pivot=HIPS), spine(flex=5), head(pitch=-6, neck=-4),
           foot("Foot.L", dy=0.45), foot("Foot.R", dy=0.4), tail_pose(lift=42, curl=12), ears(back=28))
oneshot("Skid", [
    (1, merge(SK, foot("Paw.L", dy=1.1, dz=0.18), foot("Paw.R", dy=1.15), tail_side(-26))),
    (3, merge(SK, foot("Paw.L", dy=1.15), foot("Paw.R", dy=1.1, dz=0.18), foot("Foot.L", dz=0.12), tail_side(-8))),
    (5, merge(SK, foot("Paw.L", dy=1.1, dz=0.18), foot("Paw.R", dy=1.15), foot("Foot.R", dz=0.12), tail_side(26))),
    (7, merge(SK, foot("Paw.L", dy=1.15), foot("Paw.R", dy=1.1, dz=0.18), foot("Foot.L", dz=0.12), tail_side(8))),
    (9, merge(SK, foot("Paw.L", dy=1.1, dz=0.18), foot("Paw.R", dy=1.15), tail_side(-26))),
])
# In-place pivots (the game rotates the root over the clip): head leads, forelegs step round, hinds follow.
def turn(name, sgn):
    oneshot(name, [
        (1, STAND),
        (4, merge(head(yaw=28 * sgn, pitch=2), spine(lateral=10 * sgn), body(roll=-3 * sgn),
                  foot("Paw.L", dx=0.25 * sgn, dz=0.3), foot("Foot.R", dx=-0.15 * sgn), tail_pose(side=-14 * sgn))),
        (7, merge(head(yaw=20 * sgn), spine(lateral=12 * sgn), foot("Paw.R", dx=0.25 * sgn, dz=0.3),
                  foot("Foot.L", dx=-0.2 * sgn, dz=0.22), tail_pose(side=-20 * sgn))),
        (10, merge(head(yaw=8 * sgn), spine(lateral=5 * sgn), foot("Foot.R", dx=-0.15 * sgn, dz=0.2), tail_pose(side=-10 * sgn))),
        (12, STAND),
    ])
turn("TurnL", -1)
turn("TurnR", 1)

# ============================================================== actions
oneshot("Pounce", [
    (1, merge(body(dz=-0.55, dy=-0.1, pitch=6), spine(flex=-4), head(pitch=8, neck=-10), tail_pose(lift=-8, curl=14), ears(back=8))),
    (3, merge(body(dz=-0.62, dy=-0.12, pitch=7, roll=6), spine(flex=-4, lateral=5), head(pitch=8, neck=-10),
              tail_pose(lift=-8, curl=14, side=14), ears(back=8))),
    (5, merge(body(dz=-0.62, dy=-0.12, pitch=7, roll=-6), spine(flex=-4, lateral=-5), head(pitch=8, neck=-10),
              tail_pose(lift=-8, curl=14, side=-14), ears(back=8))),
    (7, merge(body(dz=0.3, dy=0.25, pitch=-12), spine(flex=-14), head(pitch=6, neck=4),
              foot("Foot.L", dy=-1.5, dz=0.4, pitch=-25), foot("Foot.R", dy=-1.5, dz=0.4, pitch=-25),
              foot("Paw.L", dy=1.5, dz=1.25, dx=-0.15, pitch=-50), foot("Paw.R", dy=1.5, dz=1.25, dx=0.15, pitch=-50),
              tail_pose(lift=6, curl=-6), ears(back=30))),
    (10, merge(body(dz=0.2, dy=0.3, pitch=-6), spine(flex=-12), head(pitch=-4),
               foot("Foot.L", dy=-1.3, dz=0.5), foot("Foot.R", dy=-1.3, dz=0.5),
               foot("Paw.L", dy=1.6, dz=0.65, dx=-0.25, pitch=-20), foot("Paw.R", dy=1.6, dz=0.65, dx=0.25, pitch=-20),
               tail_pose(lift=12, curl=-2), ears(back=26))),
    (13, merge(body(dz=-0.35, dy=0.15, pitch=6), spine(flex=6), head(pitch=-10, neck=-8),
               foot("Paw.L", dy=0.6, dx=-0.15), foot("Paw.R", dy=0.6, dx=0.15),
               tail_pose(lift=40, curl=20), ears(back=12))),
    (16, STAND),
])


def swipe(name, paw, sgn):
    """sgn=+1 right paw sweeping right-to-left, -1 the mirrored left paw."""
    oneshot(name, [
        (1, STAND),
        (3, merge(body(dz=-0.15, roll=-6 * sgn, yaw=4 * sgn), head(pitch=4, yaw=-6 * sgn),
                  foot(paw, dy=0.35, dz=1.1, dx=0.35 * sgn, pitch=-60),
                  tail_pose(lift=55, curl=30, side=-10 * sgn), ears(back=16))),
        (5, merge(body(dz=-0.2, roll=4 * sgn, yaw=-6 * sgn), head(pitch=-6, yaw=8 * sgn),
                  foot(paw, dy=1.25, dz=0.35, dx=-0.35 * sgn, pitch=-20),
                  tail_pose(lift=55, curl=30, side=12 * sgn), ears(back=20))),
        (7, merge(body(dz=-0.12, roll=2 * sgn), head(pitch=-2, yaw=4 * sgn), foot(paw, dy=0.7, dz=0.1, dx=-0.25 * sgn),
                  tail_pose(lift=50, curl=34, side=6 * sgn), ears(back=8))),
        (10, STAND),
    ])
swipe("Swipe", "Paw.R", 1)
swipe("SwipeL", "Paw.L", -1)

# The classic: stare at the object, slowly extend a paw, glance at the audience, push it off.
oneshot("Nudge", [
    (1, merge(head(pitch=-16), tail_pose(lift=45, curl=40))),
    (6, merge(body(dz=-0.08, roll=-3), head(pitch=-20, yaw=-4), foot("Paw.R", dy=0.85, dz=0.35, pitch=-30),
              tail_pose(lift=48, curl=42, side=-6), ears(back=-4))),
    (12, merge(body(dz=-0.08, roll=-3), head(pitch=-6, yaw=34, roll=6), foot("Paw.R", dy=0.85, dz=0.3, pitch=-25),
               tail_pose(lift=50, curl=44, side=8), ears(back=-6))),
    (16, merge(body(dz=-0.1, roll=-3), head(pitch=-20, yaw=-2), foot("Paw.R", dy=0.9, dz=0.3, pitch=-25),
               tail_pose(lift=50, curl=44, side=-4))),
    (19, merge(body(dz=-0.12, dy=0.08, roll=-4), head(pitch=-16, yaw=-6), foot("Paw.R", dy=1.4, dz=0.18, pitch=-8),
               tail_pose(lift=52, curl=40, side=10), ears(back=4))),
    (24, STAND),
])

oneshot("Meow", [
    (1, STAND),
    (5, merge(body(dz=0.08, pitch=4), head(pitch=22, neck=8, roll=-6), tail_pose(lift=70, curl=22, side=-12), ears(back=-6))),
    (12, merge(body(dz=0.12, pitch=6), head(pitch=28, neck=10, roll=8), tail_pose(lift=78, curl=26, side=14), ears(back=-8))),
    (18, merge(body(dz=0.04, pitch=2), head(pitch=8, yaw=10, roll=4), tail_pose(lift=60, curl=28, side=-6), ears(flick=10))),
    (24, STAND),
])

# Hiss: side-on Halloween arch, puffed inverted-U tail, ears pinned, two spitting jabs.
HS = merge(body(dz=0.28, yaw=18), spine(flex=20), head(pitch=-6, yaw=-20, neck=-8),
           foot("Paw.L", dy=-0.12), foot("Paw.R", dy=-0.12), foot("Foot.L", dy=0.12), foot("Foot.R", dy=0.12),
           tail_pose(lift=78, curl=-14), ears(back=48), puff(1.12))
oneshot("Hiss", [
    (1, merge(STAND, puff(1.0))),
    (4, HS),
    (8, merge(HS, head(pitch=-10, neck=-8), body(dy=0.1))),
    (11, merge(HS, head(pitch=4, neck=4))),
    (15, merge(HS, head(pitch=-10, neck=-8), body(dy=0.1))),
    (18, merge(HS, head(pitch=4, neck=4))),
    (24, merge(HS, body(dz=-0.05))),
], scale_bones=("TailBase",))

# Startle: straight-legged vertical hop with an arched back and a bottle-brush tail.
ST = merge(spine(flex=28), head(pitch=-12, neck=-10), ears(back=50), tail_pose(lift=86, curl=-4), puff(1.15))
oneshot("Startle", [
    (1, merge(STAND, puff(1.0))),
    (3, merge(ST, body(dz=0.9), foot("Paw.L", dy=-0.25, dz=0.55), foot("Paw.R", dy=-0.25, dz=0.6),
              foot("Foot.L", dy=0.25, dz=0.55), foot("Foot.R", dy=0.25, dz=0.5))),
    (6, merge(ST, body(dz=1.0, roll=4), foot("Paw.L", dy=-0.3, dz=0.7), foot("Paw.R", dy=-0.3, dz=0.7),
              foot("Foot.L", dy=0.3, dz=0.7), foot("Foot.R", dy=0.3, dz=0.7))),
    (9, merge(ST, body(dz=0.2), foot("Paw.L", dy=-0.18), foot("Paw.R", dy=-0.18), foot("Foot.L", dy=0.18), foot("Foot.R", dy=0.18))),
    (12, merge(ST, body(dz=0.28, yaw=-8), spine(flex=-4), foot("Paw.L", dy=-0.15), foot("Paw.R", dy=-0.15),
               foot("Foot.L", dy=0.15), foot("Foot.R", dy=0.15))),
    (16, merge(ST, body(dz=0.24, yaw=-10), spine(flex=-6), foot("Paw.L", dy=-0.15), foot("Paw.R", dy=-0.15),
               foot("Foot.L", dy=0.15), foot("Foot.R", dy=0.15), head(yaw=10))),
], scale_bones=("TailBase",))

# Shake-off: wet-dog style whole-body shake, decaying.
shake_keys = [(1, merge(body(dz=-0.06), head(), tail_pose(), ears()))]
for i, (a, f) in enumerate(((28, 3), (-28, 5), (24, 7), (-22, 9), (15, 11), (-9, 13))):
    shake_keys.append((f, merge(body(dz=-0.08, roll=a * 0.38), spine(lateral=a * 0.25), head(yaw=a, roll=-a * 0.3),
                                tail_pose(side=-a * 0.8, lift=50, curl=35), ears(flick=a * 0.5, back=10))))
shake_keys.append((16, STAND))
oneshot("ShakeOff", shake_keys)

oneshot("Scratch", (lambda SCR, HI, LO: [
    (1, merge(SCR, foot("Paw.L", **HI), foot("Paw.R", **LO))),
    (4, merge(SCR, foot("Paw.L", **LO), foot("Paw.R", **HI), tail_side(8))),
    (7, merge(SCR, foot("Paw.L", **HI), foot("Paw.R", **LO), tail_side(-8))),
    (10, merge(SCR, foot("Paw.L", **LO), foot("Paw.R", **HI))),
    (13, merge(SCR, foot("Paw.L", **HI), foot("Paw.R", **LO))),
])(merge(body(dz=0.15, dy=-0.15, pitch=34, pivot=HIPS), spine(flex=-6), head(pitch=-22, neck=-10),
         tail_pose(lift=35, curl=18), ears(back=6)),
   dict(dy=0.45, dz=2.35, pitch=-70), dict(dy=0.5, dz=1.45, pitch=-45)))

CAUGHT = merge(body(dz=0.6, pitch=-12), spine(flex=14), head(pitch=-6, neck=10),
               foot("Foot.L", dy=0.6, dz=0.9), foot("Foot.R", dy=0.6, dz=0.9),
               foot("Paw.L", dy=0.2, dz=0.9), foot("Paw.R", dy=0.2, dz=0.9),
               tail_pose(lift=-60, curl=-8), ears(back=30))
oneshot("Caught", [
    (1, CAUGHT),
    (4, merge(CAUGHT, foot("Foot.L", dz=0.4, dy=-0.4), foot("Paw.R", dz=0.4, dy=0.3), spine(lateral=8), tail_side(20))),
    (7, merge(CAUGHT, foot("Foot.R", dz=0.4, dy=-0.4), foot("Paw.L", dz=0.4, dy=0.3), spine(lateral=-8), tail_side(-20))),
    (10, CAUGHT),
])

oneshot("Stumble", [
    (1, STAND),
    (3, merge(body(dz=-0.4, dy=-0.25, pitch=-10, roll=14), spine(flex=10, lateral=10), head(pitch=14, yaw=-14),
              foot("Paw.L", dy=0.4, dx=-0.3), foot("Paw.R", dy=0.5, dx=0.4), tail_pose(lift=70, curl=25), ears(back=34))),
    (7, merge(body(dz=-0.3, roll=-10), spine(lateral=-8), head(pitch=-6, yaw=12, roll=10), tail_pose(lift=50, curl=20, side=16), ears(back=20))),
    (10, merge(body(dz=-0.1, roll=6), head(yaw=-8, roll=-14), tail_pose(lift=45, curl=30, side=-10), ears(flick=10))),
    (13, STAND),
])

oneshot("LookAround", [
    (1, STAND),
    (14, merge(head(yaw=38, pitch=6), tail_pose(side=8), ears(flick=-8))),
    (30, merge(head(yaw=38, pitch=10, roll=8), tail_pose(lift=48, curl=44, side=10))),
    (44, merge(head(yaw=-34, pitch=2), tail_pose(side=-10), ears(flick=6))),
    (60, merge(head(yaw=-30, pitch=-4, roll=-6), tail_pose(side=-8))),
    (72, STAND),
])

# Groom: lick the right forepaw, wipe the face, back down.
G0 = merge(body(dz=-0.12, roll=-4), tail_pose(lift=40, curl=46, side=-14))
oneshot("Groom", [
    (1, STAND),
    (6, merge(G0, head(pitch=-28, yaw=-16, neck=-6), foot("Paw.R", dy=0.75, dz=1.15, dx=-0.05, pitch=-60))),
    (10, merge(G0, head(pitch=-33, yaw=-12, neck=-6), foot("Paw.R", dy=0.75, dz=1.18, dx=-0.05, pitch=-62))),
    (14, merge(G0, head(pitch=-24, yaw=-18, neck=-6), foot("Paw.R", dy=0.75, dz=1.15, dx=-0.05, pitch=-60))),
    (18, merge(G0, head(pitch=-33, yaw=-12, neck=-6), foot("Paw.R", dy=0.75, dz=1.18, dx=-0.05, pitch=-62))),
    (22, merge(G0, head(pitch=-24, yaw=-18, neck=-6), foot("Paw.R", dy=0.75, dz=1.15, dx=-0.05, pitch=-60))),
    (27, merge(G0, head(pitch=-8, yaw=-22, roll=18), foot("Paw.R", dy=1.0, dz=1.55, dx=0.12, pitch=-70))),
    (31, merge(G0, head(pitch=-16, yaw=-16, roll=10), foot("Paw.R", dy=0.92, dz=1.2, dx=0.05, pitch=-60))),
    (35, merge(G0, head(pitch=-8, yaw=-22, roll=18), foot("Paw.R", dy=1.0, dz=1.55, dx=0.12, pitch=-70))),
    (42, STAND),
])

# Stretch: forelegs walk out, chest down, rump up (downward dog), a yawn, then shift back.
SDOG = merge(body(dz=-0.28, pitch=-16, pivot=HIPS), spine(flex=-16), foot("Paw.L", dy=0.9), foot("Paw.R", dy=0.95),
             tail_pose(lift=62, curl=12), ears(back=10))
oneshot("Stretch", [
    (1, STAND),
    (10, merge(SDOG, head(pitch=12))),
    (20, merge(SDOG, head(pitch=26, neck=4), ears(back=20))),
    (28, merge(SDOG, head(pitch=10))),
    (34, merge(body(dz=-0.05, dy=-0.12, pitch=4), spine(flex=-4), foot("Paw.L", dy=0.3), foot("Paw.R", dy=0.3), head(pitch=4),
               tail_pose(lift=50, curl=30))),
    (42, STAND),
])

# ============================================================== measure gait speeds
def measure_gait(name):
    """Average forward speed of a planted hind foot (rig units / s at timeScale 1) -> no foot sliding in game."""
    act = bpy.data.actions[name]
    assign(act)
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    ys, zs = [], []
    for fr in range(f0, f1 + 1):
        scene.frame_set(fr)
        p = pb["Foot.L"].head  # IK target, no parent -> armature space
        ys.append(p.y); zs.append(p.z)
    zmin = min(zs)
    speeds = []
    for i in range(1, len(ys)):
        if zs[i] < zmin + 0.02 and zs[i - 1] < zmin + 0.02:
            speeds.append((ys[i - 1] - ys[i]) * FPS)
    sp = sum(speeds) / max(1, len(speeds))
    info = GAIT_INFO.setdefault(name, {})
    info.pop("speed_u", None)
    info.update({"speed_u": round(sp, 4), "frames": f1 - f0, "cycle_s": round((f1 - f0) / FPS, 4)})
    GAIT_INFO.pop("Catwalk", None)  # authored as Catwalk, exported/measured as Walk
    print("GAIT", name, info)
