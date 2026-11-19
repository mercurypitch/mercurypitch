#!/usr/bin/env python3
"""Write captions/chapters.json (the YouTube chapters and the web player's
chapter list) from the scene table, so chapters follow every re-time.

  python3 tools/chapters.py

Each chapter starts where its first scene starts (assets/scenes.js), or on its cue (cues.json).
Reads both; writes captions/chapters.json.
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = json.loads(re.search(r'window\.SCENES\s*=\s*(\{.*\})', open(os.path.join(ROOT, 'assets/scenes.js')).read(), re.S).group(1))

CUES = json.load(open(os.path.join(ROOT, 'cues.json')))['cues']

CHAPTERS = [  # STORYBOARD § Scene table: each over 10 s; a chapter inside a scene names its cue
    ('One push', 's01-cold-open'),
    ('How loud to sing', 's04-recall'),
    ('What pushing does', 's05-push'),
    ('What the diaphragm does', 's06-diaphragm'),
    ('"Support"', 's07-support'),
    ('Breathing in', 's08-breathe'),
    ('How a note starts', 's09-onset'),
    ('A steady note', 's10-steady'),
    ('Sing it', 's11-sing'),
    ('Your turn', 's12-your-turn'),
    ('Quick check', 's13-recap'),
    ('Practise it', 'cue:b55'),        # the recap's clean break
    ('Next time', 's14-next'),
]


def label(t):
    t = int(t)
    return f'{t // 60:02d}:{t % 60:02d}'


def main():
    out = []
    for title, scene in CHAPTERS:
        if scene.startswith('cue:'):
            start = round(CUES[scene[4:]]['start'], 2)
        else:
            start = 0.0 if scene == 's01-cold-open' else round(SCENES[scene]['start'], 2)
        out.append({'title': title, 'start': start, 'label': label(start)})
    os.makedirs(os.path.join(ROOT, 'captions'), exist_ok=True)
    path = os.path.join(ROOT, 'captions', 'chapters.json')
    json.dump(out, open(path, 'w'), indent=1)
    for c in out:
        print(f"{c['label']} {c['title']}")


if __name__ == '__main__':
    main()
