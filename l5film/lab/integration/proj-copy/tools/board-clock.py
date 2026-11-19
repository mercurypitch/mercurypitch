#!/usr/bin/env python3
"""The storyboard's clock against the voiced one.

  python3 tools/board-clock.py                  drift by act and by scene
  python3 tools/board-clock.py 37.28 105.3      where storyboard times fall now
  python3 tools/board-clock.py --scene s06-diaphragm   every cue and word of a scene, both clocks
  python3 tools/board-clock.py --freeze         write tools/board-cues.json, only if it does not exist

Reads tools/board-cues.json (the board's clock, frozen), script.json (event order), cues.json and
tools/gen-root.py (the scene table and the marks a cut leads). Writes nothing, but for --freeze.

STORYBOARD.md and HANDOFFS.md are timed on the board clock, 9:22.0 (562.01 s): script draft 3's
word-rate estimate as script.json times it (Merc 2.32 and Tavi 3.08 words a second, Lesson 2's
voiced pace, as tools/script-draft.py counts it; a word's time is its place in the line at the
line's rate). It is frozen in tools/board-cues.json (18 November 2026, DECISIONS 127), in
cues.json's schema, from the script.json the board was timed on; never regenerate it. A change to
script.json goes through the lead, who re-times the board on purpose: then move the old file aside
and --freeze again. It maps a storyboard time onto the voiced clock (cues.json):
inside a line by its words (the k-th word to the k-th word), inside any other event by its offset
from the event's start, and in a gap by its offset from the end of the event before, since gaps and
sound lengths are the same on both clocks. Each answer names its anchor, so a scene can key the
moment off that cue or word instead of a typed second.
"""
import ast
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_GEN = open(os.path.join(ROOT, 'tools', 'gen-root.py')).read()
SCENES = ast.literal_eval(re.search(r'^SCENES = (\[.*?^\])', _GEN, re.S | re.M).group(1))
SCENE_CUT = ast.literal_eval(re.search(r'^MARKS = (\(.*?\))', _GEN, re.M).group(1))  # cut 0.15 s early

script = json.load(open(os.path.join(ROOT, 'script.json')))
voiced_sheet = json.load(open(os.path.join(ROOT, 'cues.json')))
voiced = voiced_sheet['cues']
ACT_MARKS = ['open', 'act1', 'act2', 'act3', 'act4', 'act5', 'sing', 'recap', 'next', 'end']
ACT_NAMES = {'open': 'Cold open, title, promise, recall', 'act1': '1: What pushing does',
             'act2': '2: What the diaphragm does, and "support"', 'act3': '3: Breathing in',
             'act4': '4: Starting a note', 'act5': '5: A steady note', 'sing': 'Sing it, and your turn',
             'recap': 'Quick check and practise', 'next': 'Next time', 'end': 'End card'}


FROZEN = os.path.join(ROOT, 'tools', 'board-cues.json')


def estimate():
    """The board's clock rebuilt from script.json at the word rates (only --freeze uses it)."""
    _draft = open(os.path.join(ROOT, 'tools', 'script-draft.py')).read()
    RATE = ast.literal_eval(re.search(r'^rate = (\{.*?\})', _draft, re.M).group(1))
    cues, t = {}, 0.0
    for e in script['events']:
        t += e.get('gap', script.get('gap', 0.3))
        c = {'start': t, 'type': e['type']}
        if e['type'] == 'line':
            words = e['text'].split()
            r = RATE[e['who']]
            c['words'] = [t + k / r for k in range(len(words))]
            c['text'] = words
            t += len(words) / r
        else:
            t += e.get('dur', 0.0) if e['type'] != 'mark' else 0.0
        c['end'] = t
        cues[e['id']] = c
    return cues, t


def freeze():
    if os.path.exists(FROZEN):
        sys.exit('board-clock.py: tools/board-cues.json exists; it is never regenerated (move it aside on purpose first)')
    est, total = estimate()
    out = {}
    for e in script['events']:
        c = est[e['id']]
        o = {'start': round(c['start'], 3), 'end': round(c['end'], 3), 'dur': round(c['end'] - c['start'], 3), 'type': c['type']}
        if c['type'] == 'line':
            on = c['words'] + [c['end']]
            o.update({'who': e['who'], 'text': e['text'],
                      'words': [[w, round(on[k], 3), round(on[k + 1], 3)] for k, w in enumerate(c['text'])]})
        if c['type'] == 'sound':
            o['sound'] = e['sound']
        out[e['id']] = o
    note = (f'The board clock of STORYBOARD.md and HANDOFFS.md: script draft 3\'s word-rate estimate '
            f'({total:.2f} s; Merc 2.32 and Tavi 3.08 words a second, a word at its place in the line), frozen on '
            '18 November 2026 from the script.json the board was timed on (DECISIONS 127). tools/board-clock.py maps '
            'its times onto cues.json. Never regenerate it.')
    json.dump({'note': note, 'total': round(total, 3), 'cues': out}, open(FROZEN, 'w'), indent=0, ensure_ascii=False)
    print(f'tools/board-cues.json written: {len(out)} events, {total:.3f} s')


def board():
    """The storyboard's cue sheet, frozen: {id: {start, end, type, words: [onsets], text: [words]}}, and its total."""
    b = json.load(open(FROZEN))
    cues = {}
    for cid, v in b['cues'].items():
        c = {'start': v['start'], 'end': v['end'], 'type': v['type']}
        if v['type'] == 'line':
            c['words'] = [w[1] for w in v['words']]
            c['text'] = [w[0] for w in v['words']]
        cues[cid] = c
    return cues, b['total']


if sys.argv[1:2] == ['--freeze']:
    freeze()
    sys.exit(0)
EST, EST_TOTAL = board()
# The events on both clocks, in script order. An event added to script.json after the freeze has
# no board time (DECISIONS 190's `break`, between b54 and b55): a board time in the gap it fills
# maps, as any gap does, by its offset from the event before.
ORDER = [e['id'] for e in script['events'] if e['id'] in EST]


def fmt(t):
    t = round(t, 1)
    return f'{int(t // 60)}:{t % 60:04.1f}'


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
    # inside a line: by its words
    for cid in ORDER:
        c = EST[cid]
        if c['type'] == 'line' and c['start'] <= t <= c['end']:
            v = voiced[cid]
            on = c['words'] + [c['end']]
            von = [w[1] for w in v['words']] + [v['end']]
            k = max(i for i in range(len(on)) if on[i] <= t)
            k = min(k, len(c['words']) - 1)
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


def scene_starts(cues):
    """Scene starts as tools/gen-root.py cuts them, on either clock."""
    return [(sid, cue, title, 0.0 if cue is None else cues[cue]['start'] - (0.15 if cue in SCENE_CUT else 0.0))
            for sid, cue, title in SCENES]


def drift():
    vtotal = voiced_sheet['total']
    print(f'Running time: storyboard {fmt(EST_TOTAL)} ({EST_TOTAL:.2f} s), voiced {fmt(vtotal)} ({vtotal:.2f} s), '
          f'{vtotal - EST_TOTAL:+.2f} s ({100 * (vtotal - EST_TOTAL) / EST_TOTAL:+.1f} %)')
    words = sum(len(c['text']) for c in EST.values() if c['type'] == 'line')
    speech = sum(v['end'] - v['start'] for v in voiced.values() if v['type'] == 'line')
    bspeech = sum(c['end'] - c['start'] for c in EST.values() if c['type'] == 'line')
    print(f'Speech: {words} words in {speech:.1f} s, {words / speech:.2f} words a second '
          f"(the storyboard's clock: {bspeech:.1f} s, {words / bspeech:.2f})\n")
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
    es_, vs_ = scene_starts(EST), scene_starts(voiced)
    for i, ((sid, _, _, et), (_, _, _, vt)) in enumerate(zip(es_, vs_)):
        ee = es_[i + 1][3] if i + 1 < len(es_) else EST_TOTAL
        ve = vs_[i + 1][3] if i + 1 < len(vs_) else vtotal
        print(f'| {sid} | {et:.2f} | {vt:.2f} | {ee - et:.2f} s | {ve - vt:.2f} s |')
    hook_e, hook_v = EST['o2']['end'], voiced['o2']['end']
    print(f"\nThe hook (o2) ends at {fmt(hook_e)} on the storyboard's clock and {fmt(hook_v)} voiced "
          f'(BRIEF § Hook: done by about 0:37).')


def scene(sid):
    es = {r[0]: r for r in scene_starts(EST)}
    vs = {r[0]: r for r in scene_starts(voiced)}
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
