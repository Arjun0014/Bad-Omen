"""Music for the game: the three supplied tracks, loudness-matched (two-pass EBU R128 to -16 LUFS, linear gain only)
and encoded as 160 kbps MP3 into public/audio/music/.  The sources stay in assets_inbox/music (git-ignored).

    python tools/audio/prep_music.py
"""
import json, os, subprocess

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(ROOT, 'assets_inbox', 'music')
OUT = os.path.join(ROOT, 'public', 'audio', 'music')
TRACKS = {
    'waltz.mp3': 'bombinsound-halloween-suspense-horror-halloween-waltz-619348.mp3',  # Pixabay, menu + calm play
    'chase.mp3': 'Grandma_Has_Had_Enough_2026-10-18T033237.mp3',                       # ElevenLabs, Grandma's chase
    'berserk.mp3': 'Bad_Omen_extreme_Chase_2026-10-18T032643.mp3',                     # ElevenLabs, her MELTDOWN
}
TARGET = dict(I=-16.0, TP=-1.5, LRA=11.0)

os.makedirs(OUT, exist_ok=True)
for out, src in TRACKS.items():
    path = os.path.join(SRC, src)
    flt = f"loudnorm=I={TARGET['I']}:TP={TARGET['TP']}:LRA={TARGET['LRA']}:print_format=json"
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', flt, '-f', 'null', '-'], capture_output=True, text=True)
    m = json.loads(p.stderr[p.stderr.rindex('{'):p.stderr.rindex('}') + 1])
    flt2 = (f"loudnorm=I={TARGET['I']}:TP={TARGET['TP']}:LRA={TARGET['LRA']}:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
            f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    dst = os.path.join(OUT, out)
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', path, '-af', flt2, '-ar', '44100', '-ac', '2',
                    '-c:a', 'libmp3lame', '-b:a', '160k', dst], check=True)
    print(out, 'from', m['input_i'], 'LUFS', os.path.getsize(dst) // 1024, 'KB')
