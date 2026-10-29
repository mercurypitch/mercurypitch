#!/usr/bin/env python3
"""Keep the static Merc <video> tags in every scene in step with the cue sheet.

HyperFrames finds videos by parsing the scene HTML before any script runs
(producer `parseVideoElements`), so a Merc pass must be a static tag:

    <video id="s01-m01-blue" data-merc="m01-blue" class="clip"
           src="assets/merc/m01-blue-merc.webm" muted playsinline
           data-start="0" data-duration="0" data-media-start="0"></video>

plus, for his floor reflection, a second tag with `data-merc-refl`. L.merc()
adopts these tags and places them; it never creates a video.

For each `video[data-merc]` this tool writes `src`, `data-start`,
`data-duration` and `data-media-start` so the pass plays where it was
performed in the film: the overlap of the pass (merc/shots/<pass>.json:
filmStart, duration) with the scene (assets/scenes.js), in scene time.
Add `data-merc-manual` to a tag to leave its timing alone, or
`data-merc-lead="<seconds>"` to show the pass that much ahead of where it was
performed (s10's orange hops land between blue's).

Frame-accurate at the master's FPS. The passes render at FPS on the film's
frame grid (merc-shots.py snaps filmStart), so pass frame j belongs on film
frame P + j, P = filmStart * FPS. The renderer picks the frame for film frame
n as floor((n / FPS - start) * FPS) into frames extracted from media-start
(ffmpeg -ss, fps=FPS:round=up on millisecond timestamps). So the tags are
written in frames: the clip starts half a frame before its first film frame
and ends half a frame after its last, and media-start sits half a frame past
the wanted source frame. Every value is then half a frame from any rounding
edge, three-decimal rounding cannot tip it, and film frame n shows pass frame
n - P exactly, across scene cuts too (no repeated or skipped frame).

A drop pass has an intro (merc/intros.json, from merc-shots.py): the videos
that play before it, each from its `from` to its `until` film frame (a tall
render of the drop, then for a pass under a head the head itself). For every
scene that holds such a pass, this tool adds one tag per segment after the
pass's own tags, `<pass tag id>-seg<i>` (and `-seg<i>-refl` beside a
reflection), marked `data-merc-seg="<pass>:<i>"`, and writes their timing:
from a frame before `from` to a frame after `until`. A segment tag whose
segment no longer meets the scene is removed. L.mercGate (assets/lib/hosts.js)
shows the segments in turn and the pass from its intro's last `until`.

Run after every re-time (tools/cues.py, gen-root.py, merc-shots.py).
`--check` exits 1 if any tag is stale or a pass misses its scene. Scene ids as
arguments limit both to those scenes, so a scene builder touches only their own
files: `python3 tools/merc-tags.py s14-sing [--check]`.
"""
import glob
import json
import math
import os
import re
import sys

FPS = 60  # the master's frame rate (merc-shots.py renders the passes at it)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = json.loads(re.search(r'window\.SCENES\s*=\s*(\{.*\})', open(os.path.join(ROOT, 'assets/scenes.js')).read(), re.S).group(1))
TAG = re.compile(r'<video\b[^>]*\bdata-merc="([^"]+)"[^>]*>', re.S)
INTROS_PATH = os.path.join(ROOT, 'merc', 'intros.json')
INTROS = json.load(open(INTROS_PATH)) if os.path.exists(INTROS_PATH) else {}


def attr(tag, name, value):
    """Set one attribute on an opening tag, adding it if missing."""
    pat = re.compile(r'(\s' + re.escape(name) + r')="[^"]*"')
    if pat.search(tag):
        return pat.sub(lambda m: f'{m.group(1)}="{value}"', tag, count=1)
    return tag[:-1].rstrip() + f' {name}="{value}">' if not tag.endswith('/>') else tag[:-2].rstrip() + f' {name}="{value}" />'


def window(pass_id, scene_id, lead=0.0):
    """(data-start, data-duration, data-media-start) for one tag, in seconds,
    or None when the pass misses the scene. See the module docstring."""
    shot = json.load(open(os.path.join(ROOT, 'merc', 'shots', pass_id + '.json')))
    fps = shot.get('fps', FPS)
    sc = SCENES[scene_id]
    P = round(shot['filmStart'] * fps)              # film frame of pass frame 0
    N = round(shot['duration'] * fps)               # frames in the pass
    k = round(lead * fps)                           # lead, in pass frames
    s0 = math.ceil(sc['start'] * fps - 1e-6)        # the scene's first film frame
    s1 = math.ceil(sc['end'] * fps - 1e-6) - 1      # and its last
    n0 = max(s0, P - k)
    n1 = min(s1, P + N - 1 - k)
    if n1 - n0 + 1 < 2:
        return None
    start = max(sc['start'], (n0 - 0.5) / fps)      # half a frame before n0 (never before the scene)
    ds = round(start - sc['start'], 3)
    vc = math.ceil((sc['start'] + ds) * fps - 1e-6)  # the film frame the renderer counts from
    assert vc == n0, (pass_id, scene_id, vc, n0)
    dur = round((n1 + 0.5) / fps - (sc['start'] + ds), 3)
    media = round((n0 - P + k + 0.5) / fps, 3)
    return ds, dur, media


def seg_window(seg, scene_id):
    """(data-start, data-duration, data-media-start) for one intro segment's tag in a scene, or None.
    The tag runs from a frame before the segment shows to a frame after it hands over, within the
    segment's video and the scene, on the same half-frame grid as window()."""
    shot = json.load(open(os.path.join(ROOT, 'merc', 'shots', seg['shot'] + '.json')))
    fps = shot.get('fps', FPS)
    sc = SCENES[scene_id]
    P = round(shot['filmStart'] * fps)              # film frame of the video's frame 0
    s0 = math.ceil(sc['start'] * fps - 1e-6)
    s1 = math.ceil(sc['end'] * fps - 1e-6) - 1
    n0 = max(s0, P, seg['from'] - 1)
    n1 = min(s1, P + seg['frames'] - 1, seg['until'] + 1)
    if n1 - n0 + 1 < 2:
        return None
    start = max(sc['start'], (n0 - 0.5) / fps)
    ds = round(start - sc['start'], 3)
    vc = math.ceil((sc['start'] + ds) * fps - 1e-6)
    assert vc == n0, (seg['shot'], scene_id, vc, n0)
    dur = round((n1 + 0.5) / fps - (sc['start'] + ds), 3)
    media = round((n0 - P + 0.5) / fps, 3)
    return ds, dur, media


SEG = re.compile(r'[ \t]*<video\b[^>]*\bdata-merc-seg="[^"]*"[^>]*>\s*</video>[ \t]*\n?', re.S)


def add_segments(html, scene_id, bad):
    """The scene's HTML with exactly the intro segment tags its drop passes need."""
    html = SEG.sub('', html)
    # last tag first, so an insertion never moves a tag still to come
    for m in reversed(list(re.finditer(r'([ \t]*)<video\b[^>]*\bid="([^"]+)"[^>]*\bdata-merc="([^"]+)"[^>]*>\s*</video>', html, re.S))):
        indent, tag_id, pass_id = m.group(1), m.group(2), m.group(3)
        tag = m.group(0)
        if 'data-merc-refl' in tag or pass_id not in INTROS:
            continue
        refl = re.search(r'<video\b[^>]*\bid="' + re.escape(tag_id) + r'-refl"[^>]*>\s*</video>', html)
        lines = []
        for i, seg in enumerate(INTROS[pass_id], 1):
            if not os.path.exists(os.path.join(ROOT, 'merc', 'shots', seg['shot'] + '.json')):
                bad.append(f'{scene_id}: {pass_id} intro {i}: unknown shot {seg["shot"]}')
                continue
            if seg_window(seg, scene_id) is None:
                continue
            mark = f'data-merc="{seg["shot"]}" data-merc-seg="{pass_id}:{i}"'
            lines.append(f'{indent.lstrip(chr(10))}<video id="{tag_id}-seg{i}" {mark} class="clip" muted playsinline></video>')
            if refl:
                lines.append(f'{indent.lstrip(chr(10))}<video id="{tag_id}-seg{i}-refl" {mark} data-merc-refl class="clip" muted playsinline></video>')
        if lines:
            at = (refl or m).end() if not refl or refl.start() > m.start() else m.end()
            html = html[:at] + '\n' + '\n'.join(lines) + html[at:]
    return html


def tags(html):
    """Each Merc tag in a scene by id: (its text, its pass, whether it is an intro segment's)."""
    found = {}
    for m in TAG.finditer(html):
        im = re.search(r'\bid="([^"]+)"', m.group(0))
        if im:
            found[im.group(1)] = (m.group(0), m.group(1), 'data-merc-seg=' in m.group(0))
    return found


def main(check, only=()):
    stale, bad, total = [], [], 0
    for path in sorted(glob.glob(os.path.join(ROOT, 'compositions', 's*.html'))):
        scene_id = os.path.basename(path)[:-5]
        if scene_id not in SCENES or (only and scene_id not in only):
            continue
        orig = open(path).read()
        html = add_segments(orig, scene_id, bad)
        out, pos = [], 0
        for m in TAG.finditer(html):
            tag, pass_id = m.group(0), m.group(1)
            total += 1
            new = tag
            sm = re.search(r'\sdata-merc-seg="([^":]+):(\d+)"', tag)
            if sm:
                seg = INTROS[sm.group(1)][int(sm.group(2)) - 1]
                w = seg_window(seg, scene_id)
                start, dur, media = w
                new = attr(new, 'src', f'assets/merc/{seg["shot"]}{"-tall" if seg["tall"] else ""}-merc.webm')
                new = attr(new, 'data-start', f'{start:.3f}')
                new = attr(new, 'data-duration', f'{dur:.3f}')
                new = attr(new, 'data-media-start', f'{media:.3f}')
            elif 'data-merc-manual' not in tag:
                if not os.path.exists(os.path.join(ROOT, 'merc', 'shots', pass_id + '.json')):
                    bad.append(f'{scene_id}: unknown pass {pass_id}')
                else:
                    lm = re.search(r'\sdata-merc-lead="([^"]+)"', tag)
                    w = window(pass_id, scene_id, float(lm.group(1)) if lm else 0.0)
                    if w is None:
                        bad.append(f'{scene_id}: pass {pass_id} does not overlap the scene')
                    else:
                        start, dur, media = w
                        new = attr(new, 'src', f'assets/merc/{pass_id}-merc.webm')
                        new = attr(new, 'data-start', f'{start:.3f}')
                        new = attr(new, 'data-duration', f'{dur:.3f}')
                        new = attr(new, 'data-media-start', f'{media:.3f}')
            for need in ('id=', 'class="clip', 'muted', 'playsinline'):
                if need not in new:
                    bad.append(f'{scene_id}: {pass_id} tag lacks {need.rstrip("=")}')
            out.append(html[pos:m.start()])
            out.append(new)
            pos = m.end()
        out.append(html[pos:])
        final = ''.join(out)
        if final != orig:
            # add_segments writes the segment tags afresh, so compare the file as it would be written
            # with the file as it is, tag by tag
            was, now = tags(orig), tags(final)
            for tag_id, (text, pass_id, _) in now.items():
                if was.get(tag_id, (None,))[0] != text:
                    stale.append(f'{scene_id}: {pass_id}')
            if {k for k, v in was.items() if v[2]} != {k for k, v in now.items() if v[2]}:
                stale.append(f'{scene_id}: intro tags')
            if not check:
                open(path, 'w').write(final)
    verb = 'stale' if check else 'updated'
    print(f'{total} Merc tags, {len(stale)} {verb}, {len(bad)} problems')
    for s in stale:
        print(f'  {verb}: {s}')
    for b in bad:
        print(f'  PROBLEM: {b}')
    return 1 if bad or (check and stale) else 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv, {a for a in sys.argv[1:] if not a.startswith('--')}))
