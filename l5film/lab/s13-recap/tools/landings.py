#!/usr/bin/env python3
"""The board's 0.4 s rule over group E's rows: every landing's onset, from the clock (assets/cues.js and
assets/scenes.js, the same numbers L.at and L.word read), sorted, with each pair closer than 0.4 s named.

A stagger inside one row (the traces 0.1 s apart, the arrows 0.08 s apart, a glyph 0.25 s before its words) is one
landing in the board's sense and is listed once, with its stagger. Moves (the frame's slide, the hops, the drift, the
camera) and leaves are listed apart: the rule is about things arriving to be read.

  python3 lab/s13-recap/tools/landings.py      (from P) writes lab/<scene-id>/landings.txt for the three scenes
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
P = os.path.normpath(os.path.join(HERE, '..', '..', '..'))


def load(js):
    src = open(os.path.join(P, 'assets', js)).read()
    return json.loads(src[src.index('{'):src.rindex('}') + 1])


CUES = load('cues.js')['cues']
SCENES = load('scenes.js')


def norm(w):
    return re.sub(r"[^a-z0-9']", '', w.lower().replace('’', "'"))


def mk(sid):
    s0 = SCENES[sid]['start']

    def at(cid, edge='start', off=0.0):
        return CUES[cid][edge] + off - s0

    def word(line, which, edge='start', off=0.0):
        ws = CUES[line]['words']
        want = [norm(w) for w in which.split()]
        have = [norm(w[0]) for w in ws]
        for i in range(len(have) - len(want) + 1):
            if have[i:i + len(want)] == want:
                return (ws[i][1] if edge == 'start' else ws[i + len(want) - 1][2]) + off - s0
        raise SystemExit(f'{line} does not say {which!r}')
    return at, word


def s13():
    at, word = mk('s13-recap')
    SETTLES = word('b54', 'settles')
    # the redraw from the clock (DECISIONS 215): 2.4 s at most, ending 0.5 s or more before the cascade (break + 0.2)
    REDRAW = min(2.4, at('break', 'start', 0.2) - 0.5 - SETTLES)
    LINE_K = 10 / REDRAW
    ENTRY = 0.704                       # the page's rule over L.CONTOUR.demo (the probe's A.ENTRY)
    LAND = [
        (at('recap'), 'kicker "QUICK CHECK"'),
        (word('b48', 'What is'), 'panel and question 1 (0.3 s)'),
        (word('b48', "diaphragm's"), 'card 1: the figure draws on (0.8 s)'),
        (word('b49', 'Breathing'), 'answer 1 "Breathing in." (and the figure breathes, 1.2 s)'),
        (at('b51') + 0.12, 'question 3 in (a swap: the old out 0.12 s first)'),
        (word('b51', 'long'), 'card 2: the three traces with names, 0.1 s apart (one stagger, board)'),
        (word('b52', 'together'), 'row 3 lights, its tick scales; answer 3'),
        (at('o14a') + 0.12, 'question 4 in (a swap)'),
        (word('o14a', 'steady'), 'the frame back to full with its labels (0.6 s)'),
        (SETTLES, 'Tavi\'s line starts its silent redraw'),
        (SETTLES + ENTRY / LINE_K, 'the mint edge and "in the band" light (0.2 s)', 'board 13d: the redraw 504.93, the mint edge at the line\'s 0.69 s, 505.10'),
        (word('b54', 'band'), 'answer 4 "It settles into the band / and stays there."'),
        (SETTLES + (ENTRY + 0.5) / LINE_K, 'the "settled" flag stands (0.25 s)', 'board 13d: the mint edge 505.10, the flag 505.21, both by the page\'s rule at the redraw\'s speed'),
        (word('b55', 'Practise'), 'the Voice Mirror panel and "Practise it."'),
        (word('b55', 'Practise') + 0.4, '"Voice Mirror" and its rule, 0.4 s after the panel (DECISIONS 215)'),
        (word('b55', 'glide') - 0.25, 'row 1: its glyph, its words 0.25 s later (one row)'),
        (word('b55', 'hold') - 0.25, 'row 2: its glyph, its words 0.25 s later (one row)'),
        (word('b55', 'then') - 0.25, 'row 3: its glyph, its words 0.25 s later (one row)'),
        (word('b55', 'plays'), 'the hold\'s readout'),
        (word('b56', 'Keep'), '"Keep the glides comfortable."'),
        (word('b56', 'Sore'), '"Sore, hoarse or unwell today? Just listen along."'),
        (word('b56', 'Free'), '"Free, no account: mercurypitch.com/mirror"'),
        (word('b56', 'mercurypitch'), 'the address underlined (0.5 s, the free line\'s own)'),
        (at('b56', 'end', -0.3), 'the ten line'),
        (word('b58', 'Felt'), 'the rest card\'s panel and question'),
        (word('b58', 'Rest'), 'the rest card\'s title'),
        (word('b58', 'Voice'), 'the rest card\'s body'),
        (word('b58', 'mercurypitch'), 'the rest card\'s address (its underline 0.2 s on)'),
        (at('next', 'start', -0.92), 'the carried bead takes over from the glyph\'s first dot (0.1 s)'),
    ]
    MOVES = [
        (at('recap', 'start', -0.04), 'the frame slides down and widens (1.2 s, power2.inOut), then dims (0.3 s)'),
        (at('break', 'start', 0.2), 'the clean break (DECISIONS 215): kicker +0.20, panel +0.27, answer +0.34, frame +0.41 (leaves, up fast, 0.3 s each)'),
        (SETTLES + REDRAW, 'card 3\'s redraw complete; the answer holds 0.5 s to the cascade'),
        (at('break', 'start', 0.6), 'hop 1 (the pass\'s crouch, then the air 0.41 s)'),
        (at('break', 'start', 1.25), 'hop 2'),
        (at('card'), 'both cards drift up 14 px over `card`'),
        (at('card', 'end', -0.32), 'the cards\' lines leave in turn, 0.03 s apart, 0.2 s each'),
    ]
    return LAND, MOVES


def s14():
    at, word = mk('s14-next')
    ARROWS = word('b60', 'every')
    COPY = ARROWS + 0.3
    QM = COPY + 7 * 0.08 + 0.1
    TW = at('twinkle')
    LAND = [
        (at('next'), 'kicker "NEXT TIME"', 'board 14a: the kicker 540.62 = next + 0.15; the rows from S14\'s first frame since DECISIONS 219'),
        (0.0, 'the faint rows and the six outlines fade in from S14\'s first frame (0.6 s; DECISIONS 219)'),
        (at('next', 'start', -0.92) + 1.6, 'the carried bead lands on C4 (squash), filled until its note', 'board 14a: the bead 541.30, a carried object in flight since S13, landing while the rows come in (DECISIONS 219)'),
    ] + [(TW + 0.5 * i, f'bead {i} lights on its note (0.2 s), its echo ring' + (' (the carried bead gives way to it)' if i == 0 else '')) for i in range(7)] + [
        (word('b60', 'I move'), 'the tease line'),
        (ARROWS, 'the arrows rise, 0.08 s apart (one stagger)'),
        (COPY, 'the dashed copy draws bead by bead (0.56 s, with the arrows)', 'board 14b: the arrows and the copy are one beat, the copy drawing as each arrow arrives'),
        (QM, 'the copy\'s "?"'),
        (word('o15', 'Why'), 'the hook, line 1'),
        (word('o15', 'and'), 'the hook, line 2'),
    ]
    MOVES = [
        (at('next', 'start', -0.92), 'the carry (from S13, film time)'),
        (at('b60', 'end', -0.06), 'the tease line and the kicker leave up fast'),
        (at('o15', 'end', 0.04), 'the hook leaves up fast'),
        (at('end', 'start', -0.31), 'the shrink starts; the rows and arrows fade (0.4 s)'),
    ]
    return LAND, MOVES


def s15():
    at, word = mk('s15-end')
    LAND = [
        (at('end', 'start', 0.14), 'the lockup\'s wipe (0.5 s)'),
        (at('end', 'start', 0.54), '"mercurypitch.com/mirror" (0.2 s)', 'board 15: the wipe 556.15, the address 556.55: 0.40 s, on the rule'),
        (at('end', 'start', 0.94), '"Voice Mirror is free, with no account" (0.2 s)'),
    ]
    MOVES = [
        (0.0, 'the camera F-turn to F-end over the scene (sine.inOut); the shrink carries on from S14'),
        (at('end', 'start', 0.04), 'Merc grows to 400 in place; Tavi grows and hops to 1610 (0.7 s)'),
    ]
    return LAND, MOVES


def report(sid, fn):
    land, moves = fn()
    land = sorted((x + ('',))[:3] for x in land)
    out = [f'{sid}: the board\'s 0.4 s rule over the landings (scene time, from the clock)', '']
    close = []
    for i, (t, what, board) in enumerate(land):
        gap = t - land[i - 1][0] if i else None
        flag = ''
        if gap is not None and gap < 0.4 - 1e-6:
            flag = '   <-- %.3f s after the last' % gap
            close.append((land[i - 1], (t, what), gap, board))
        out.append(f'  {t:7.3f}  {what}{flag}')
    out += ['', 'moves and leaves (not landings):']
    out += [f'  {t:7.3f}  {what}' for t, what in sorted(moves)]
    out += ['', f'{len(land)} landings, {len(close)} closer than 0.4 s, each the board\'s own or not:']
    out += [f'  {a[0]:.3f} -> {b[0]:.3f} ({g:.3f} s): ' + (f'the board\'s ({bd})' if bd else 'NOT the board\'s')
            for a, b, g, bd in close]
    txt = '\n'.join(out) + '\n'
    open(os.path.join(P, 'lab', sid, 'landings.txt'), 'w').write(txt)
    print(txt)


if __name__ == '__main__':
    report('s13-recap', s13)
    report('s14-next', s14)
    report('s15-end', s15)
