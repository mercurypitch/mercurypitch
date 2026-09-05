"""Verify every packaged Pull movie and print cropped motion review sheets.

Run from the repository root. Only derived review PNGs are written, into the
existing media-source proof folder. No source or packaged media is modified.
"""
import hashlib
import io
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / 'apps/beside-cue'
PUBLIC = APP / 'public/onboarding/pull-expansion-v1'
PROOF = APP / 'media-source/onboarding/pull-expansion-v1'
manifest = json.loads((PROOF / 'manifest.json').read_text())
plate = Image.open(APP / 'public/onboarding/corky-v2.4/stills/p02-table-ready-v0_17.webp').convert('RGB')

for entry in (PUBLIC / 'SHA256SUMS').read_text().splitlines():
    sha, name = entry.split('  ', 1)
    assert hashlib.sha256((PUBLIC / name).read_bytes()).hexdigest() == sha, name

def frame(path, index):
    result = subprocess.check_output(['ffmpeg', '-v', 'error', '-threads', '1', '-i', str(path),
        '-vf', f'select=eq(n\\,{index})', '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'])
    return Image.open(io.BytesIO(result)).convert('RGB')

results = []
sheet = None
settled = Image.new('RGB', (720, 430 * 4), '#fff5dd')
for index, (pull_id, definition) in enumerate(manifest['pulls'].items()):
    frames = []
    for beat, prefix, count in [('present', 'b03', 96), ('recede', 'b05', 102)]:
        path = PUBLIC / f'{prefix}-{pull_id}-{beat}-{manifest.get("movieVersion", "v0_1")}.mp4'
        edge = definition['edgeAudit'][beat]
        assert not edge['exposedFrames'], (pull_id, beat, 'exposed source boundary')
        assert all(edge['xByFrame'][n] <= 0 for n in edge['contactFrames']), (pull_id, beat)
        data = path.read_bytes()
        assert data.index(b'moov') < data.index(b'mdat'), path.name
        info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-of', 'json', str(path)]))
        assert len(info['streams']) == 1, path.name
        video = info['streams'][0]
        assert (video['codec_name'], video['pix_fmt'], video['width'], video['height'], video['level'], video['r_frame_rate'], int(video['nb_frames'])) == ('h264', 'yuv420p', 720, 1280, 31, '24/1', count), path.name
        # A complete decode catches corrupt frames beyond the initial poster.
        subprocess.run(['ffmpeg', '-v', 'error', '-xerror', '-threads', '1', '-i', str(path), '-f', 'null', '-'], check=True)
        frames += [frame(path, n) for n in ([0, 48, 95] if beat == 'present' else [1, 48, 95, 101])]
    # Codec differences are allowed, but the exit must actually land on P02.
    if pull_id == 'the-pillow':
        # Neither the high empty room nor the floor below the feet may retain
        # the differently graded exit backing. This fails the entrance-only
        # matte, which leaves a large magenta slab despite decoding perfectly.
        for picture in frames:
            pixels = np.asarray(picture, dtype=float)
            r, g, b = (pixels[:, :, channel] for channel in range(3))
            pink = (r > g * 1.7) & (b > g * 1.4) & (r > b * 1.13) & (r > 60)
            backing = int(pink[:700, :410].sum() + pink[1020:, :410].sum())
            assert backing < 100, ('pillow backing retained', backing)
    error = float(np.abs(np.asarray(frames[-1], dtype=float) - np.asarray(plate, dtype=float)).mean())
    assert error < 3, (pull_id, error)
    results.append({'pullId': pull_id, 'decoded': True, 'endPlateMeanError': round(error, 3)})
    hold = Image.open(PUBLIC / f'p03-{pull_id}-settled-v0_1.webp').convert('RGB')
    settled.paste(hold.resize((240, 427)), ((index % 3) * 240, (index // 3) * 430))
    ImageDraw.Draw(settled).text(((index % 3) * 240 + 6, (index // 3) * 430 + 10), pull_id, fill='#241913')
    row = index % 4
    if row == 0:
        sheet = Image.new('RGB', (7 * 180, 4 * 256), '#fff5dd')
    draw = ImageDraw.Draw(sheet)
    for column, image in enumerate(frames):
        crop = image.crop((0, 530, 410, 1060)).resize((180, 232))
        sheet.paste(crop, (column * 180, row * 256 + 24))
        draw.text((column * 180 + 3, row * 256 + 5), f'{pull_id} {column + 1}', fill='#241913')
    if row == 3 or index == len(manifest['pulls']) - 1:
        sheet.save(PROOF / f'motion-review-{index // 4 + 1}.png')
(PROOF / 'decode-audit.json').write_text(json.dumps(results, indent=2) + '\n')
settled.save(PROOF / 'settled-review.png')
print(json.dumps({'moviesVerified': len(results) * 2, 'bytes': sum(p.stat().st_size for p in PUBLIC.glob('*.mp4')), 'results': results}, indent=2))
