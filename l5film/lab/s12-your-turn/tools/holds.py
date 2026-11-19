# Each hold measure.py lists (its summary's Holds table), against the voices: the words or the pause under it, and
# whether it falls in a pause between words (no word sounding) or inside a word, with that pause's length.
#   python3 holds.py <summary.md> <scene-id> [clip offset in scene seconds]
import json, re, sys
summary, sid = sys.argv[1], sys.argv[2]
off = float(sys.argv[3]) if len(sys.argv) > 3 else 0.0
ROOT = __import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.dirname(__import__('os').path.abspath(__file__)))))
js = open(f'{ROOT}/assets/scenes.js').read()
T0 = json.loads(js[js.index('=') + 1:].strip().rstrip(';'))[sid]['start']
cues = json.load(open(f'{ROOT}/cues.json'))['cues']
words = []
for cid, c in cues.items():
    for w in c.get('words') or []:
        words.append((w[1], w[2], cid, w[0]))
    if c.get('type') == 'sound':
        words.append((c['start'], c['end'], cid, '(' + cid + ')'))
words.sort()
holds = re.findall(r'^\| ([\d.]+) s \| ([\d.]+) s \|', open(summary).read().split('## Holds')[1].split('##')[0], re.M)
tot_pause = tot_word = 0
for s, l in holds:
    a = T0 + off + float(s); b = a + float(l)
    inw = [w for w in words if w[0] < b and w[1] > a]
    if inw:
        tot_word += float(l)
        print(f'{float(s):6.2f} +{l}: inside {", ".join(w[2] + " " + w[3] for w in inw)}')
    else:
        prev = max([w for w in words if w[1] <= a], default=None, key=lambda w: w[1])
        nxt = min([w for w in words if w[0] >= b], default=None, key=lambda w: w[0])
        gap = (nxt[0] if nxt else float('nan')) - (prev[1] if prev else float('nan'))
        tot_pause += float(l)
        print(f'{float(s):6.2f} +{l}: in a pause of {gap:.2f} s after {prev[2]} "{prev[3]}" before {nxt[2]} "{nxt[3]}"')
print(f'holds in pauses {tot_pause:.1f} s, inside words {tot_word:.1f} s')
