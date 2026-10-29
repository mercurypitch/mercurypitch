#!/usr/bin/env python3
"""The storyboard's clock against the voiced one.

  python3 tools/board-clock.py                  drift by act and by scene
  python3 tools/board-clock.py 37.28 105.3      where storyboard times fall now
  python3 tools/board-clock.py --scene s08-predict   every cue and word of a scene, both clocks

STORYBOARD.md and HANDOFFS.md (v3.1) are timed to the scratch cue sheet of 29
October 2026 (Kokoro voices, 483.73 s), frozen in tools/board-cues.json. Until
the voices change the two clocks are the same, and the tool only names the
anchor for a storyboard time. After a re-voice it maps a storyboard time onto
the voiced clock (cues.json): inside a line by its words (the k-th word to the
k-th word), inside any other event by its offset from the event's start, and in
a gap by its offset from the end of the event before, since gaps and sound
lengths are the same on both clocks. Each answer names its anchor, so a scene
can key the moment off that cue or word instead of a typed second.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENE_CUT = ('act1', 'act2', 'act3', 'act4', 'recap', 'next')  # gen-root.py cuts these 0.15 s early

script = json.load(open(os.path.join(ROOT, 'script.json')))
voiced = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
ACT_MARKS = ['open', 'act1', 'act2', 'act3', 'act4', 'recap', 'next', 'end']
ACT_NAMES = {'open': 'Cold open, title, promise, recall', 'act1': 'Act 1: measure the steps', 'act2': 'Act 2: start anywhere',
             'act3': 'Act 3: name the stairs', 'act4': 'Act 4: sing it', 'recap': 'Recap', 'next': 'Next time', 'end': 'End card'}


def board():
    """The storyboard's cue sheet, frozen: {id: {start, end, type, words: [onsets], text: [words]}}."""
    b = json.load(open(os.path.join(ROOT, 'tools', 'board-cues.json')))
    cues = {}
    for cid, v in b['cues'].items():
        c = {'start': v['start'], 'end': v['end'], 'type': v['type']}
        if v['type'] == 'line':
            c['words'] = [w[1] for w in v['words']]
            c['text'] = [w[0] for w in v['words']]
        cues[cid] = c
    return cues, b['total']


EST, EST_TOTAL = board()
ORDER = [e['id'] for e in script['events']]


def fmt(t):
    return f'{int(t // 60)}:{t % 60:05.2f}'


SNAP = 0.02  # the storyboard prints two decimals: a time this close to a cue or word is that cue or word


def where(t):
    """(voiced time, anchor text, code hint) for a storyboard time t."""
    # on a cue's start or end, or a word's onset: that anchor exactly
    for cid in ORDER:
        c = EST[cid]
        if abs(t - c['start']) <= SNAP:
            return voiced[cid]['start'], f'{cid} start', f"at('{cid}')"
        if c['type'] == 'line':
            for k, on in enumerate(c['words']):
                if abs(t - on) <= SNAP:
                    return voiced[cid]['words'][k][1], f"{cid} word {k} '{c['text'][k]}'", f"word('{cid}', {k})"
        if c['end'] > c['start'] and abs(t - c['end']) <= SNAP:
            return voiced[cid]['end'], f'{cid} end', f"at('{cid}', 'end')"
    # inside a line: by its words (the line wins over a sound it overlaps, as b16 over unroll)
    for cid in ORDER:
        c = EST[cid]
        if c['type'] == 'line' and c['start'] <= t <= c['end']:
            v = voiced[cid]
            on = c['words'] + [c['end']]
            von = [w[1] for w in v['words']] + [v['end']]
            k = max(i for i in range(len(on)) if on[i] <= t)
            f = (t - on[k]) / (on[k + 1] - on[k])
            vt = von[k] + f * (von[k + 1] - von[k])
            off = vt - von[k]
            return vt, f"{cid} word {k} '{c['text'][k]}' + {f:.2f} of the way to the next", f"word('{cid}', {k}, 'start', {off:.2f})"
    # inside any other event: by offset from its start
    for cid in ORDER:
        c = EST[cid]
        if c['type'] != 'line' and c['start'] <= t <= c['end'] and c['end'] > c['start']:
            return voiced[cid]['start'] + (t - c['start']), f"{cid} start {t - c['start']:+.2f}", f"at('{cid}', 'start', {t - c['start']:.2f})"
    # in a gap: by offset from the end of the event before (gaps are the same on both clocks)
    prev = max((cid for cid in ORDER if EST[cid]['end'] <= t), key=lambda cid: EST[cid]['end'], default=None)
    if prev is None:
        return t, 'film start', f'{t:.2f}'
    return voiced[prev]['end'] + (t - EST[prev]['end']), f"{prev} end {t - EST[prev]['end']:+.2f}", f"at('{prev}', 'end', {t - EST[prev]['end']:.2f})"


def scene_starts(cues, total):
    """Scene starts as tools/gen-root.py cuts them, on either clock."""
    sys.path.insert(0, os.path.join(ROOT, 'tools'))
    src = open(os.path.join(ROOT, 'tools', 'gen-root.py')).read()
    table = re.search(r'SCENES = \[(.*?)\n\]', src, re.S).group(1)
    rows = re.findall(r"\('([^']+)', (None|'[^']+'), '([^']*)'\)", table)
    out = []
    for sid, cue, title in rows:
        cue = None if cue == 'None' else cue.strip("'")
        t = 0.0 if cue is None else cues[cue]['start'] - (0.15 if cue in SCENE_CUT else 0.0)
        out.append((sid, cue, title, t))
    return out


def drift():
    vtotal = json.load(open(os.path.join(ROOT, 'cues.json')))['total']
    print(f'Running time: storyboard {fmt(EST_TOTAL)} ({EST_TOTAL:.2f} s), voiced {fmt(vtotal)} ({vtotal:.2f} s), '
          f'{vtotal - EST_TOTAL:+.2f} s ({100 * (vtotal - EST_TOTAL) / EST_TOTAL:+.1f} %)')
    words = sum(len(c['text']) for c in EST.values() if c['type'] == 'line')
    speech = sum(v['end'] - v['start'] for v in voiced.values() if v['type'] == 'line')
    bspeech = sum(c['end'] - c['start'] for c in EST.values() if c['type'] == 'line')
    print(f'Speech: {words} words in {speech:.1f} s, {words / speech:.2f} words a second (the storyboard\'s clock: {words / bspeech:.2f})\n')
    print('| Act | Storyboard start | Voiced start | Shift | Storyboard length | Voiced length | Change |')
    print('| --- | --- | --- | --- | --- | --- | --- |')
    marks = ACT_MARKS + [None]
    for a, b in zip(marks, marks[1:]):
        es = 0.0 if a == 'open' else EST[a]['start']
        vs = 0.0 if a == 'open' else voiced[a]['start']
        ee = EST_TOTAL if b is None else EST[b]['start']
        ve = vtotal if b is None else voiced[b]['start']
        print(f'| {ACT_NAMES[a]} | {fmt(es)} | {fmt(vs)} | {vs - es:+.2f} s | {ee - es:.2f} s | {ve - vs:.2f} s | '
              f'{(ve - vs) - (ee - es):+.2f} s ({100 * ((ve - vs) - (ee - es)) / (ee - es):+.1f} %) |')
    print('\n| Scene | Storyboard start | Voiced start | Storyboard length | Voiced length |')
    print('| --- | --- | --- | --- | --- |')
    es_, vs_ = scene_starts(EST, EST_TOTAL), scene_starts(voiced, vtotal)
    for i, ((sid, _, _, et), (_, _, _, vt)) in enumerate(zip(es_, vs_)):
        ee = es_[i + 1][3] if i + 1 < len(es_) else EST_TOTAL
        ve = vs_[i + 1][3] if i + 1 < len(vs_) else vtotal
        print(f'| {sid} | {et:.2f} | {vt:.2f} | {ee - et:.2f} s | {ve - vt:.2f} s |')
    hook_e, hook_v = EST['o2']['end'], voiced['o2']['end']
    print(f"\nThe hook (o2) ends at {fmt(hook_e)} on the storyboard's clock and {fmt(hook_v)} voiced (BRIEF § Hook: done by about 0:34 voiced).")


def scene(sid):
    es = {r[0]: r for r in scene_starts(EST, EST_TOTAL)}
    vs = {r[0]: r for r in scene_starts(voiced, json.load(open(os.path.join(ROOT, 'cues.json')))['total'])}
    ids = list(es)
    i = ids.index(sid)
    e0, v0 = es[sid][3], vs[sid][3]
    e1 = es[ids[i + 1]][3] if i + 1 < len(ids) else EST_TOTAL
    print(f'{sid}: storyboard {e0:.2f}-{e1:.2f}, voiced from {v0:.2f} (scene time = film time - {v0:.2f})')
    for cid in ORDER:
        c = EST[cid]
        if c['end'] < e0 - 1e-6 or c['start'] > e1 + 1e-6:
            continue
        v = voiced[cid]
        print(f"  {cid:14s} {c['type']:6s} storyboard {c['start']:7.2f}-{c['end']:7.2f}   voiced {v['start']:7.2f}-{v['end']:7.2f}")
        if c['type'] == 'line':
            for k, (w, (vw, va, vb)) in enumerate(zip(c['text'], v['words'])):
                print(f"      {k:2d} {w:16s} {c['words'][k]:7.2f} -> {va:7.2f}")


def main():
    args = sys.argv[1:]
    if not args:
        drift()
    elif args[0] == '--scene':
        scene(args[1])
    else:
        for a in args:
            t = float(a)
            vt, why, hint = where(t)
            print(f'{t:8.2f} -> {vt:8.3f}   {hint:40s} ({why})')


if __name__ == '__main__':
    main()
