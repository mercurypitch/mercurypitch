#!/usr/bin/env python3
"""No typed second in a scene: every time is a cue, a word or a duration, and only 0 (the cut) and D
(the scene's end) are written bare.

  python3 tools/clock-lint.py                          every scene in compositions/
  python3 tools/clock-lint.py compositions/s05-push.html [...]

Reads the scenes' inline scripts, cues.json and assets/scenes.js. Writes nothing. Prints one line
per finding (file:line: what, and the text) and exits 1 on any; prints nothing and exits 0 when the
scenes are clean. A placeholder (gen-root.py's, `PLACEHOLDER · <id>`) is skipped. A line that must
keep such a number (a pixel that happens to match a time) carries `// clock-lint: ok`.

Recreated for Lesson 5 from Lesson 2's contract (tools/CHANGES.md, 17 October: "clock-lint.py:
new"; Lesson 4 BUILD-GUIDE, The clock); the original was lost with Lesson 4's project. It reports:

  1. a bare number given as a time: the time argument of a kit call or a camera move (TIME_ARGS),
     each element of a list of times (pulses, lights), the first value of each `L.track` move, a
     GSAP position (tl.to, from, fromTo, set, add, call, addLabel), and the value of a time key in
     an object (TIME_KEYS: { t: 1.2 }, tIn, tOut, hop ...);
  2. a comparison of `t` or `T` with a bare number (t > 3.2);
  3. any number of 1 or more with two or more decimals that equals a cue or word edge inside the
     scene, in scene time or film time (a time copied from the cue sheet; under a second, a number
     is a length far more often than a time, and a scene cut 0.15 s before a mark has that mark at
     0.15);
  4. an offset of 0.4 s or more after a spoken line's start, at(line, 'start', x) or at(line) + x,
     that lands inside the line: key it to the word instead (PRODUCTION-PIPELINE trap 20).

The kit's calls are Lessons 1 to 4's, and Lesson 5's (L.fade, L.glow, L.run, L.TEASE.carry and .shrink;
a kit object's .draw(t, <time>) and .life(t, tIn, tOut)); when a step adds a timing call, add it here.
"""
import glob
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# callee (the text before the opening parenthesis, matched at its end) -> argument indices that are times;
# 'list' marks an argument that is a list of times
TIME_ARGS = {
    'L.prog': [1], 'L.env': [1], 'L.swap': [1], 'L.lit': ['list1'], 'L.light': ['list1'], 'L.pulse': ['list1'],
    'L.bead4.hopAt': [1], 'L.bead4.dropAt': [1], 'L.bead4.riseAt': [1], 'L.bead4.runAt': [1],
    'L.track': ['moves2'],
    # the Lesson 5 kit's (motion.js, tease.js): fade's in and out, a glow's and a run's start, the cut curves
    'L.fade': [1, 2], 'L.glow': ['list1'], 'L.run': [1], 'L.TEASE.carry': [1], 'L.TEASE.shrink': [1],
}
# a kit object's draw from scene time: `x.draw(t, <time>, ...)` (kicker.draw(t, tIn, tOut), ringTimer.draw(t,
# t0, dur)) and `x.life(t, tIn, tOut, ...)`: their second argument, and life's third, are times
OBJ_TIME = re.compile(r'\.(draw|life)$')
BEAD_CALLS = {'hopAt', 'dropAt', 'riseAt', 'runAt'}
CAMERA = re.compile(r'\b(cam|rig|camera)\w*\.(to|pan|curve|hermite)$')   # (at, dur, ...)
GSAP = re.compile(r'\b(tl|tl\d|timeline|\w*Tl|\w*TL)\.(to|from|fromTo|set|add|call|addLabel)$')
GSAP_POS = {'to': 2, 'from': 2, 'set': 2, 'fromTo': 3, 'add': 1, 'call': 2, 'addLabel': 1}
TIME_KEYS = {'t', 't0', 't1', 'tIn', 'tOut', 'at', 'time', 'hop', 'leaveAt', 'landAt'}
NUM = r'-?(?:\d+\.\d*|\.\d+|\d+)'
BARE = re.compile(rf'^\s*\(?\s*({NUM})\s*\)?\s*$')
OK = '// clock-lint: ok'


def blank_comments(src):
    """Comments replaced by spaces (newlines kept), strings left as they are."""
    out, i, n = list(src), 0, len(src)
    while i < n:
        c = src[i]
        if c in '\'"`':
            j = i + 1
            while j < n and src[j] != c:
                j += 2 if src[j] == '\\' else 1
            i = j + 1
        elif src.startswith('//', i):
            j = src.find('\n', i)
            j = n if j < 0 else j
            for k in range(i, j):
                out[k] = ' '
            i = j
        elif src.startswith('/*', i):
            j = src.find('*/', i + 2)
            j = n if j < 0 else j + 2
            for k in range(i, j):
                if out[k] != '\n':
                    out[k] = ' '
            i = j
        else:
            i += 1
    return ''.join(out)


def args_at(src, open_paren, close='()'):
    """The arguments of the call or list whose opener is at open_paren: [(text, offset)]."""
    o, c = close
    depth, i, n, start, out = 0, open_paren, len(src), open_paren + 1, []
    pairs = {'(': ')', '[': ']', '{': '}'}
    stack = []
    while i < n:
        ch = src[i]
        if ch in '\'"`':
            j = i + 1
            while j < n and src[j] != ch:
                j += 2 if src[j] == '\\' else 1
            i = j + 1
            continue
        if ch in pairs:
            stack.append(pairs[ch])
        elif ch in ')]}':
            if stack:
                stack.pop()
            if not stack:
                out.append((src[start:i], start))
                return out
        elif ch == ',' and len(stack) == 1:
            out.append((src[start:i], start))
            start = i + 1
        i += 1
    return out


def callee_before(src, paren):
    m = re.search(r'([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*)*)\s*$', src[:paren])
    return re.sub(r'\s+', '', m.group(1)) if m else ''


def load_clock():
    cues = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']
    s = open(os.path.join(ROOT, 'assets', 'scenes.js')).read()
    scenes = json.loads(s[s.index('=') + 1:].strip().rstrip(';'))
    return cues, scenes


def edges_in(cues, sc):
    """Every cue and word edge inside the scene, in film time."""
    out = set()
    for c in cues.values():
        for v in (c['start'], c['end']):
            if sc['start'] - 1e-6 <= v <= sc['end'] + 1e-6:
                out.add(round(v, 3))
        for w in c.get('words', []):
            for v in (w[1], w[2]):
                if sc['start'] - 1e-6 <= v <= sc['end'] + 1e-6:
                    out.add(round(v, 3))
    return out


def lint(path, cues, scenes):
    html = open(path).read()
    if 'PLACEHOLDER · ' in html:
        return []
    sid = os.path.basename(path)[:-5]
    sc = scenes.get(sid)
    found = []
    lines = html.split('\n')

    def report(offset, what):
        ln = html.count('\n', 0, offset) + 1
        text = lines[ln - 1]
        if OK not in text:
            found.append((ln, what, text.strip()[:110]))

    for m in re.finditer(r'<script\b[^>]*>(.*?)</script>', html, re.S):
        base = m.start(1)
        src = blank_comments(m.group(1))

        def bare(arg):
            b = BARE.match(arg)
            return b and float(b.group(1)) != 0.0

        # 1. time arguments of calls
        for p in re.finditer(r'\(', src):
            name = callee_before(src, p.start())
            if not name:
                continue
            spec = TIME_ARGS.get(name)
            if spec is None and OBJ_TIME.search(name):
                a0 = args_at(src, p.start())
                if a0 and a0[0][0].strip() == 't':
                    spec = [1, 2, 'list4'] if name.endswith('.life') else ([1, 2] if 'kicker' in name.lower() else [1])
            if spec is None and name.split('.')[-1] in BEAD_CALLS and '.' in name:
                spec = [1]      # a bead call through a local name (const b = L.bead4; b.hopAt(t, t0))
            idx = []
            if spec is not None:
                idx = spec
            elif CAMERA.search(name):
                idx = [0]
            elif GSAP.search(name):
                idx = [GSAP_POS[GSAP.search(name).group(2)]]
            if not idx:
                continue
            args = args_at(src, p.start())
            for k in idx:
                if isinstance(k, int):
                    if k < len(args) and bare(args[k][0]):
                        report(base + args[k][1], f'a typed time as argument {k + 1} of {name}()')
                elif k.startswith('list'):
                    j = int(k[4:])
                    if j < len(args):
                        a, off = args[j]
                        lb = a.find('[')
                        if lb >= 0:
                            for el, eo in args_at(a, lb, '[]'):
                                if bare(el):
                                    report(base + off + eo, f'a typed time in the list of times given to {name}()')
                elif k.startswith('moves'):
                    j = int(k[5:])
                    if j < len(args):
                        a, off = args[j]
                        lb = a.find('[')
                        for el, eo in (args_at(a, lb, '[]') if lb >= 0 else []):
                            inner = el.find('[')
                            if inner >= 0 and el[:inner].strip() == '':
                                parts = args_at(el, inner, '[]')
                                if parts and bare(parts[0][0]):
                                    report(base + off + eo, f'a typed time as a move\'s start in {name}()')
        # time keys in objects
        for k in re.finditer(rf'(?<![\w$.])({"|".join(sorted(TIME_KEYS, key=len, reverse=True))})\s*:\s*({NUM})(?![\w.])', src):
            if float(k.group(2)) != 0.0:
                report(base + k.start(), f'a typed time as the object key {k.group(1)}')
        # 2. comparisons with t
        for k in re.finditer(rf'(?<![\w$.])[tT]\s*(<=|>=|<|>|===|==)\s*({NUM})(?![\w.])|(?<![\w.])({NUM})\s*(<=|>=|<|>|===|==)\s*[tT](?![\w$])', src):
            v = k.group(2) or k.group(3)
            if float(v) != 0.0:
                report(base + k.start(), 'a comparison of t with a typed time')
        # 3. a number equal to a cue or word edge of the scene
        if sc:
            edges = edges_in(cues, sc)
            for k in re.finditer(r'(?<![\w.])-?\d+\.\d{2,}(?![\w.])', src):
                v = float(k.group(0))
                if v >= 1.0 and any(abs(v - e) < 0.0006 or abs(v + sc['start'] - e) < 0.0006 for e in edges):
                    report(base + k.start(), f'{k.group(0)} is a cue or word edge of the scene (key it to the cue or word)')
        # 4. an offset deep inside a spoken line
        pat = rf"(?:\bat|L\.at)\(\s*(?:SID\s*,\s*)?'([\w-]+)'\s*(?:,\s*'start'\s*,\s*({NUM})\s*)?\)(?:\s*\+\s*({NUM}))?"
        for k in re.finditer(pat, src):
            cid, off = k.group(1), k.group(2) or k.group(3)
            c = cues.get(cid)
            if off and c and c['type'] == 'line' and 0.4 <= float(off) < c['dur']:
                report(base + k.start(), f'{off} s into the line {cid}: key it to the word there (word())')
    return [(path, *f) for f in sorted(set(found))]


def main():
    files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, 'compositions', '*.html')))
    cues, scenes = load_clock()
    found = []
    for f in files:
        found += lint(f, cues, scenes)
    for path, ln, what, text in found:
        print(f'{os.path.relpath(path)}:{ln}: {what}\n    {text}')
    sys.exit(1 if found else 0)


if __name__ == '__main__':
    main()
