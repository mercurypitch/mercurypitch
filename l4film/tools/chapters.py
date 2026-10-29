#!/usr/bin/env python3
"""Write captions/chapters.json (the YouTube chapters and the web player's
chapter list) from the scene table, so chapters follow every re-time.

  python3 tools/chapters.py

Each chapter starts where its first scene starts (assets/scenes.js).
"""
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCENES = json.loads(re.search(r'window\.SCENES\s*=\s*(\{.*\})', open(os.path.join(ROOT, 'assets/scenes.js')).read(), re.S).group(1))

CHAPTERS = [  # STORYBOARD § Scene table: each at least 10 s
    ('One short of home', 's01-cold-open'),
    ('Twelve semitones, seven steps', 's04-recall'),
    ('Measure the steps', 's05-steps'),
    ('Two groups', 's06-groups'),
    ('Start anywhere', 's07-predict'),
    ('Name the stairs', 's09-names'),
    ('Ti, one short of home', 's10-ti'),
    ('Why do is home', 's11-why'),
    ('Sing it', 's12-sing'),
    ('Your turn', 's13-your-turn'),
    ('Quick check', 's14-recap'),
    ('Next time', 's15-next'),
]


def label(t):
    t = int(t)
    return f'{t // 60:02d}:{t % 60:02d}'


def main():
    out = []
    for title, scene in CHAPTERS:
        start = 0.0 if scene == 's01-cold-open' else round(SCENES[scene]['start'], 2)
        out.append({'title': title, 'start': start, 'label': label(start)})
    path = os.path.join(ROOT, 'captions', 'chapters.json')
    json.dump(out, open(path, 'w'), indent=1)
    for c in out:
        print(f"{c['label']} {c['title']}")


if __name__ == '__main__':
    main()
