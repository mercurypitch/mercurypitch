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
(or at the scene's own start, when the pass is already running there, so a
lab render's frame at scene time 0, which is no film frame, shows it too) and
ends half a frame after its last (or after the film frame that follows the
scene, when the pass plays on past it: that frame is the next scene's, where
this scene no longer shows, and a lab render's last frame, which can fall
between the scene's last film frame and its end, shows it too), and
media-start sits half a frame past the wanted source frame. Every value is
then half a frame from any rounding edge, three-decimal rounding cannot tip
it, and film frame n shows pass frame n - P exactly, across scene cuts too
(no repeated or skipped frame).

A chunked pass (Lesson 5: a shot with `chunks`, each {id, scene, from, to,
size}, rendered by merc-pass.mjs --chunk as assets/merc/<chunk id>-merc.webm)
keeps one `data-merc="<pass>"` in every scene; this tool picks the chunk made
for that scene (or any chunk that holds every frame the tag shows), writes
its file as the `src`, and counts `data-media-start` from the chunk's first
frame: pass frame j is chunk frame j - from. Chunks join exactly (DECISIONS
129), so film frame n still shows pass frame n - P across every cut.

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

A lab's copy of a scene with a lab's chunks (the film's own files untouched):
`--shots=<dir>` reads the shot files there instead of merc/shots/,
`--scenes=<dir>` rewrites the scene files there instead of compositions/, and
`--src=<prefix>` writes each tag's `src` as <prefix><chunk>-merc.webm instead
of assets/merc/<chunk>-merc.webm. Without them nothing changes.

No film frame on a pass-frame boundary (DECISIONS 224, 225, 234). The
half-frame rule above is what guarantees it, at any pass fps: `margins()`
models the renderer's cut (assets/lib/hosts.js, L.passFrame: cut frame k of a
render at F fps shows the last pass frame whose time, in whole ms, is at most
1000 media-start + 0.5 + 1000 k / F) for every film frame a tag shows, and
gives the smallest distance from that limit to a pass frame's time, on either
side. `--margins` prints it for every tag at the film's 60 fps (and at the
pass's own fps for a lab render); `--check` fails if any is under MARGIN_MS,
or if a film frame would show a pass frame other than n - P.
"""
import glob
import json
import math
import os
import re
import sys

FPS = 60  # the master's frame rate: a shot without `fps` is at it (this step's passes are at 30)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _opt(name, default):
    """--name=<value> from the command line (a directory is taken from where the tool is run)."""
    v = next((a[len(name) + 3:] for a in sys.argv[1:] if a.startswith(f'--{name}=')), None)
    return default if v is None else v


SHOTS_DIR = os.path.abspath(_opt('shots', os.path.join(ROOT, 'merc', 'shots')))          # the shot files
SCENES_DIR = os.path.abspath(_opt('scenes', os.path.join(ROOT, 'compositions')))        # the scenes rewritten
SRC = _opt('src', 'assets/merc/')                                                       # a tag's src, before <chunk>-merc.webm
MARGIN_MS = 4.0   # the least a film frame's sample may sit from a pass-frame boundary (half a 60 fps frame is 8.3 ms)
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
    """(data-start, data-duration, data-media-start, src) for one tag, in seconds,
    or None when the pass misses the scene. See the module docstring. Raises
    ValueError when a chunked pass has no chunk that holds the tag's frames."""
    shot = json.load(open(os.path.join(SHOTS_DIR, pass_id + '.json')))
    fps = shot.get('fps', FPS)
    sc = SCENES[scene_id]
    P = round(shot['filmStart'] * fps)              # film frame of pass frame 0
    N = round(shot['duration'] * fps)               # frames in the pass
    k = round(lead * fps)                           # lead, in pass frames
    s0 = math.ceil(sc['start'] * fps - 1e-6)        # the scene's first film frame
    s1 = math.ceil(sc['end'] * fps - 1e-6) - 1      # and its last
    last = P + N - 1 - k                             # the film frame of the pass's last frame
    n0 = max(s0, P - k)
    n1 = min(s1, last)
    if n1 - n0 + 1 < 2:
        return None
    start = sc['start'] if n0 == s0 else (n0 - 0.5) / fps   # half a frame before n0, or the scene's start
    ds = round(start - sc['start'], 3)
    vc = math.ceil((sc['start'] + ds) * fps - 1e-6)  # the film frame the renderer counts from
    assert vc == n0, (pass_id, scene_id, vc, n0)
    dur = round((min(s1 + 1, last) + 0.5) / fps - (sc['start'] + ds), 3)   # see the docstring
    src, first = f'{SRC}{pass_id}-merc.webm', 0
    if shot.get('chunks'):
        # the pass frames this tag shows: n0 to the frame after the scene (or the pass's last)
        need = (n0 - P + k, min(s1 + 1, last) - P + k)
        fits = [c for c in shot['chunks'] if c['from'] <= need[0] and need[1] <= c['to']]
        mine = [c for c in fits if c.get('scene') == scene_id]
        if not fits:
            raise ValueError(f'no chunk of {pass_id} holds pass frames {need[0]} to {need[1]}')
        ch = (mine or fits)[0]
        src, first = f"{SRC}{ch['id']}-merc.webm", ch['from']
    media = round((n0 - P + k - first + 0.5) / fps, 3)
    return ds, dur, media, src


def margins(pass_id, scene_id, render_fps, lead=0.0):
    """How far a tag's film frames sit from a pass-frame boundary in a render at `render_fps`, or None
    when the pass misses the scene: (film frames, the least distance in ms from the cut's limit to a
    pass frame's time on either side, the film frames that would show another pass frame than their
    own, the least distance in frames of the cut's index from a whole frame). The model is the kit's
    (assets/lib/hosts.js, L.passFrame; lab/integration/film-hops-fix/README.md): cut frame
    k = floor((t - data-start) x F + 1e-3) shows the last pass frame whose time, round(1000 i / fps)
    ms (a WebM's frames sit on whole ms), is at most 1000 data-media-start + 0.5 + 1000 k / F."""
    w = window(pass_id, scene_id, lead)
    if w is None:
        return None
    ds, dur, media, src = w
    shot = json.load(open(os.path.join(SHOTS_DIR, pass_id + '.json')))
    pf = shot.get('fps', FPS)
    P = round(shot['filmStart'] * pf)
    first = next((c['from'] for c in shot.get('chunks', []) if src.endswith('/' + c['id'] + '-merc.webm') or src == f"{SRC}{c['id']}-merc.webm"), 0)
    sc = SCENES[scene_id]
    F = render_fps
    least, wrong, frames, edge = 1e9, 0, 0, 1.0
    n = math.ceil((sc['start'] + ds) * F - 1e-6)
    while n / F < min(sc['end'], sc['start'] + ds + dur) - 1e-9:
        x = (n / F - sc['start'] - ds) * F
        k = math.floor(x + 1e-3)
        edge = min(edge, abs((x + 1e-3) - round(x + 1e-3)))
        lim = 1000 * media + 0.5 + 1000 * k / F
        i = math.floor(lim / 1000 * pf) + 1
        while i > 0 and math.floor(i * 1000 / pf + 0.5) > lim + 1e-6:
            i -= 1
        least = min(least, lim - math.floor(i * 1000 / pf + 0.5), math.floor((i + 1) * 1000 / pf + 0.5) - lim)
        want = math.floor(n * pf / F + 1e-9) - P - first + round(lead * pf)
        wrong += i != want
        frames += 1
        n += 1
    return frames, least, wrong, edge


def seg_window(seg, scene_id):
    """(data-start, data-duration, data-media-start) for one intro segment's tag in a scene, or None.
    The tag runs from a frame before the segment shows to a frame after it hands over, within the
    segment's video and the scene, on the same half-frame grid as window()."""
    shot = json.load(open(os.path.join(SHOTS_DIR, seg['shot'] + '.json')))
    fps = shot.get('fps', FPS)
    sc = SCENES[scene_id]
    P = round(shot['filmStart'] * fps)              # film frame of the video's frame 0
    s0 = math.ceil(sc['start'] * fps - 1e-6)
    s1 = math.ceil(sc['end'] * fps - 1e-6) - 1
    last = min(P + seg['frames'] - 1, seg['until'] + 1)
    n0 = max(s0, P, seg['from'] - 1)
    n1 = min(s1, last)
    if n1 - n0 + 1 < 2:
        return None
    start = sc['start'] if n0 == s0 else (n0 - 0.5) / fps
    ds = round(start - sc['start'], 3)
    vc = math.ceil((sc['start'] + ds) * fps - 1e-6)
    assert vc == n0, (seg['shot'], scene_id, vc, n0)
    dur = round((min(s1 + 1, last) + 0.5) / fps - (sc['start'] + ds), 3)
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
            if not os.path.exists(os.path.join(SHOTS_DIR, seg['shot'] + '.json')):
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
    report = '--margins' in sys.argv
    rows = []
    for path in sorted(glob.glob(os.path.join(SCENES_DIR, 's*.html'))):
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
                new = attr(new, 'src', f'{SRC}{seg["shot"]}{"-tall" if seg["tall"] else ""}-merc.webm')
                new = attr(new, 'data-start', f'{start:.3f}')
                new = attr(new, 'data-duration', f'{dur:.3f}')
                new = attr(new, 'data-media-start', f'{media:.3f}')
            elif 'data-merc-manual' not in tag:
                if not os.path.exists(os.path.join(SHOTS_DIR, pass_id + '.json')):
                    bad.append(f'{scene_id}: unknown pass {pass_id}')
                else:
                    lm = re.search(r'\sdata-merc-lead="([^"]+)"', tag)
                    try:
                        w = window(pass_id, scene_id, float(lm.group(1)) if lm else 0.0)
                    except ValueError as e:
                        w = False
                        bad.append(f'{scene_id}: {e}')
                    if w is None:
                        bad.append(f'{scene_id}: pass {pass_id} does not overlap the scene')
                    elif w:
                        start, dur, media, src = w
                        new = attr(new, 'src', src)
                        new = attr(new, 'data-start', f'{start:.3f}')
                        new = attr(new, 'data-duration', f'{dur:.3f}')
                        new = attr(new, 'data-media-start', f'{media:.3f}')
                        # no film frame on a pass-frame boundary: a pass at the film's fps is held to
                        # MARGIN_MS; a slower one (this step's 30 fps passes) is reported, not failed
                        pf = json.load(open(os.path.join(SHOTS_DIR, pass_id + '.json'))).get('fps', FPS)
                        if 'data-merc-refl' not in tag and (report or pf == FPS):
                            ld = float(lm.group(1)) if lm else 0.0
                            for F in sorted({FPS, pf}):
                                n, least, wrong, edge = margins(pass_id, scene_id, F, ld)
                                rows.append((scene_id, pass_id, pf, F, n, least, wrong, edge))
                                if pf == FPS and F == FPS and (least < MARGIN_MS or wrong):
                                    bad.append(f'{scene_id}: {pass_id} at {F} fps: {wrong} film frames on another pass frame, '
                                               f'the nearest boundary {least:.2f} ms away (under {MARGIN_MS})')
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
    if report:
        print('| Scene | Pass | Pass fps | Render fps | Film frames | Nearest pass-frame boundary | On another pass frame | Cut index from a whole frame |')
        print('| ----- | ---- | -------- | ---------- | ----------- | --------------------------- | --------------------- | ---------------------------- |')
        for scene_id, pass_id, pf, F, n, least, wrong, edge in rows:
            print(f'| {scene_id} | {pass_id} | {pf} | {F} | {n} | {least:.2f} ms | {wrong} | {edge:.4f} |')
        by = {}
        for r in rows:
            by.setdefault((r[2], r[3]), []).append(r)
        for (pf, F), rs in sorted(by.items()):
            print(f'{pf} fps passes in a {F} fps render: {sum(r[4] for r in rs)} film frames over {len(rs)} tags, '
                  f'the nearest boundary {min(r[5] for r in rs):.2f} ms away, {sum(r[6] for r in rs)} on another pass frame')
    verb = 'stale' if check else 'updated'
    print(f'{total} Merc tags, {len(stale)} {verb}, {len(bad)} problems')
    for s in stale:
        print(f'  {verb}: {s}')
    for b in bad:
        print(f'  PROBLEM: {b}')
    return 1 if bad or (check and stale) else 0


if __name__ == '__main__':
    sys.exit(main('--check' in sys.argv, {a for a in sys.argv[1:] if not a.startswith('--')}))
