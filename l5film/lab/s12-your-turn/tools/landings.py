# Group D's landings on the scratch clock (scene time), from cues.json the way L.at and L.word read it, and the
# 0.4 s sweep over them (STORYBOARD § Type, Staging; § Build checks): every pair of separate landings 0.40 s or more
# apart. Writes nothing; prints the table.
import json, os, re
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../..'))
cues = json.load(open(f'{ROOT}/cues.json'))['cues']
js = open(f'{ROOT}/assets/scenes.js').read()
SC = json.loads(js[js.index('=') + 1:].strip().rstrip(';'))
norm = lambda s: re.sub(r"[^a-z0-9']", '', s.lower().replace('’', "'"))
def at(sid, cue, edge='start', off=0): return cues[cue][edge] - SC[sid]['start'] + off
def word(sid, line, phrase, edge='start', off=0):
    ws = cues[line]['words']; p = [norm(x) for x in phrase.split()]
    for i in range(len(ws) - len(p) + 1):
        if all(norm(ws[i + k][0]) == p[k] for k in range(len(p))):
            return (ws[i][1] if edge == 'start' else ws[i + len(p) - 1][2]) - SC[sid]['start'] + off
    raise KeyError(phrase)
rows = {}
s = 's11-sing'
SING = at(s, 'sing'); BR = word(s, 'b34', 'ten')
rows[s] = [('card "Sing it"', SING + 0.22), ('"Your turn."', word(s, 'b34', 'Your')), ('the bracket, "0", "10 s"', BR),
  ('"Nothing listens"', max(word(s, 'b34', 'seconds'), BR + 0.4)), ('the doctor lines, small', word(s, 'b35', 'care lines')),
  ('the icon, "Sore, hoarse or unwell today?"', word(s, 'b36', 'Sore')), ('"Just listen along."', word(s, 'b36', 'Just')),
  ('"hurts or uncomfortable"', word(s, 'b37', 'hurts')), ('"· unusually hoarse or tired"', word(s, 'b37', 'unusually')),
  ('"usual notes suddenly gone"', word(s, 'b37', 'suddenly')), ('"· ill"', word(s, 'b37', 'ill')), ('"talking or singing is hard work"', word(s, 'b37', 'talking')),
  ('the ring (drawn on)', word(s, 'b37a', 'Listening', off=0.05)), ('the listening line', word(s, 'b37a', 'Rest'))]
s = 's12-your-turn'
LISTEN = at(s, 'listen'); TICKIN = at(s, 'tick-in'); HOLD = at(s, 'hold'); ALL = at(s, 'b46a')
rows[s] = [('"A3 · Merc"', word(s, 'b38', 'my A')), ('"A4 · Tavi, an octave up"', word(s, 'b38', 'an octave')), ('the phase row', at(s, 'b39')),
  ('"at about speaking volume"', word(s, 'b39', 'at about')), ('"stop sooner if you need to"', word(s, 'b40', 'stop sooner')), ('the stop line', at(s, 'b41')),
  ('"Listen" (ring)', LISTEN), ('"Breathe" (switch)', at(s, 'b42')), ('"Breathe in, low and quiet"', word(s, 'b42', 'in')), ('"Sing" (switch)', TICKIN),
  ('the counter "0"', TICKIN + 0.4)] + [(f'the counter "{k}" (switch)', HOLD + k) for k in range(1, 11)] + [
  ('"How did that feel?"', at(s, 'b43')), ('"Easy"', word(s, 'b43', 'Easy')), ('"Workable"', word(s, 'b43', 'workable')), ('"Effortful"', word(s, 'b43', 'effortful')),
  ('"Uncomfortable"', word(s, 'b43', 'uncomfortable')), ('the bracket, "rest a few easy breaths"', word(s, 'b44', 'Rest')), ('"rest before you sing again"', word(s, 'b45', 'rest')),
  ('"enough singing for today"', word(s, 'b46', 'enough')), ('the doctor lines, full size', ALL + 0.5)]
for sid, rs in rows.items():
    rs.sort(key=lambda r: r[1])
    print(f'\n{sid} (scene time; board time by cue in STORYBOARD)')
    worst = None
    for i, (n, t) in enumerate(rs):
        gap = t - rs[i - 1][1] if i else None
        if gap is not None and (worst is None or gap < worst[0]): worst = (gap, rs[i - 1][0], n)
        print(f'  {t:7.3f}  {n}' + (f'   (+{gap:.2f})' if gap is not None else ''))
    print(f'  closest pair: {worst[0]:.2f} s, {worst[1]} / {worst[2]}')
