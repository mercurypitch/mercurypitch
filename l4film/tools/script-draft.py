"""Write SCRIPT-DRAFT.md: the script as a reader sees it, before any voice exists.

  python3 tools/script-draft.py

Reads script.json and the scene table in tools/gen-root.py (SCENES: id, first cue, title).
Lines are printed as captions write them (do, re, mi ...), with the facts each rests on;
each scene opens with what the picture is for (PICTURE, below). Times are an estimate at
Lesson 2's voiced pace, Merc 2.32 and Tavi 3.08 words a second; the voiced clock is
SCRIPT.md, from cues.json, once the lines are spoken.
"""
import ast, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
script = json.load(open(os.path.join(ROOT, 'script.json')))
src = open(os.path.join(HERE, 'gen-root.py')).read()
SCENES = ast.literal_eval(re.search(r'^SCENES = (\[.*?^\])', src, re.S | re.M).group(1))
WHO = {'blue': 'MERC', 'orange': 'TAVI'}
SAY = {'doh': 'do', 'ray': 're', 'mee': 'mi', 'fah': 'fa', 'soh': 'so', 'lah': 'la', 'tee': 'ti'}
PICTURE = {
    's01-cold-open': 'The compact staircase alone in the dark room: eight stairs, do to do, names only, "from C" at its foot, the top stair under an unlit house glyph. Merc\'s blue bead climbs with each sung note and stops on ti. The whole staircase rises one tone ("from D?"), and holds while the viewer predicts ("still hanging?"); Tavi\'s orange bead climbs, hangs on ti, then lands, and the house lights on the new top stair: "home moved". The hook in type: "finished on do · restless on ti?"',
    's02-title': 'Title sting: "Find Your Pitch · Lesson 04 · The major scale and home".',
    's03-promise': 'Four short labels land on the staircase as Merc names them.',
    's04-recall': '"FROM LESSON 2"; Lesson 2\'s row of twelve equal tiles, "1 octave = 12 semitones"; the staircase\'s seven risers over it, "7 steps?".',
    's05-steps': 'Lesson 2\'s keyboard slides in under the staircase; each stair stands over its white key on a grid of semitone rows; each riser is measured as its note sounds, "tone" two rows, "semitone" one row; the two semitones turn gold; E-F and B-C marked on the keys.',
    's06-groups': 'Two brackets, C D E F and G A B C, light with their sounds; the lower group lifts and lays over the upper: the same shape; "2 2 1 · 2 · 2 2 1 = 12", "= 1 octave".',
    's07-predict': 'Chapter card "02 Start anywhere". Tavi\'s dashed ink-2 staircase with its "?", on the white keys from D; the two pills and the hold; the white keys from D sound under it; then the real staircase slides, whole, from C to D, and two keys under it turn black, F♯ and C♯; the dashed risers read T S T T T S T, its third and seventh stairs a row low.',
    's08-anywhere': 'The staircase slides to G (one black key lights) and to E (four), both in the octave above middle C, never changing shape; the count of black keys each start needs, "C 0 · D 2 · G 1 · E 4".',
    's09-names': 'Chapter card "03 Name the stairs"; under it the staircase slides back from E to C, the keys under it white again, so the names start on C. The house on do, "tonic = home"; numbers 1 to 7 replace the letters, "scale degrees"; then do re mi fa so la ti land on their stairs with Merc\'s words, "solfège", "so (sol)"; "fixed do: do = C" set aside; the staircase slides to D: the letters change, the names ride their stairs, the house moves with do.',
    's10-ti': 'Back on C; ti\'s gold riser, "1 semitone"; the bead climbs and hangs under home; the last step taken, the house lit.',
    's11-why': 'The experiment as a picture: the notes regroup into tiers, do on top, then mi and so, then re fa la ti, then the five outside, no numbers, "Krumhansl & Shepard, 1979"; "later studies: without training too, only weaker", "Janata et al., 2003"; Tavi\'s answer as two labels, "learned home" on do and "one short step" on ti\'s gold riser; "leading note"; the staircase on D, "ti = C♯" leaning up to D.',
    's12-sing': 'Chapter card "04 Sing it". The staircase tips into the scale guide\'s lanes; Merc\'s amber path up to ti, the names on the rows, the hold on ti marked "wait", then home; Tavi\'s the same run an octave up.',
    's13-your-turn': 'The care lines in type as they are said; at their foot, from the first ("Sore, hoarse or unwell today?"), the doctor lines in small type, carried whole (FACTS 54, 83), with the stop line landing above them; "Your turn."; "D3 or D4"; "wait on ti"; Merc sings the starting note; the plain chrome guide sweeps the path, 8.6 s, room tone only; the care block and the doctor lines stay up to the end of the turn. Nothing listens.',
    's14-recap': 'Four recap cards, each answered by the staircase; the staircase becomes Scale Runner\'s ladder ("Illustration"): the pitch line has already passed do and re, and six rungs wait ahead of it, as the app draws at most six notes still to come (FACTS 39); the practise card, in the order a visitor meets them: "Practise it free: mercurypitch.com/pitch-training", "First visit? Skip the intro (×)", "Set your range first: Settings › Singing Voice Range", "then tap Scale Runner", "sing in the octave it plays".',
    's15-next': '"Next time": Lesson 5\'s hook in type.',
    's16-end': 'End card: the address, "First visit? Skip the intro (×)", the lockup.',
}
def shown(text):
    def one(m):
        w = SAY[m.group(1).lower()]
        return w.capitalize() if m.group(1)[0].isupper() else w
    text = re.sub(r'\bdoh ray mee\b', lambda m: 'Do-re-mi' if m.group(0)[0].isupper() else 'do-re-mi', text, flags=re.I)
    return re.sub(r'\b(doh|ray|mee|fah|soh|lah|tee)\b', one, text, flags=re.I)
rate = {'blue': 2.32, 'orange': 3.08}
first = {cue: (sid, title) for sid, cue, title in SCENES}
out = ['# Script draft: Find Your Pitch, Lesson 4, "The major scale and home"', '',
       'Generated from `script.json` by `tools/script-draft.py`. Lines as captions write them; the voice spells',
       'solfège for Kokoro (doh, ray, mee ...: FACTS 66). Times are estimates at Lesson 2\'s voiced pace. Each line ends',
       'with the facts it rests on (Lesson 4 FACTS 1 to 65 in docs; the film\'s from 66 in `FACTS.md`).', '']
t = 0.0
def mmss(x):
    return f'{int(x // 60)}:{x % 60:04.1f}'
for i, e in enumerate(script['events']):
    if i == 0 or e['id'] in first:
        sid, title = first.get(None if i == 0 else e['id'], first.get(e['id']))
        out += ['', f'## {sid}: {title} (~{mmss(t)})', '', f'_Picture:_ {PICTURE.get(sid, "")}', '']
    t += e.get('gap', script.get('gap', 0.3))
    if e['type'] == 'line':
        out.append(f"- `{mmss(t)}` **{WHO[e['who']]}:** {shown(e['text'])} _[{e.get('facts', '?')}]_")
        t += len(e['text'].split()) / rate[e['who']]
    elif e['type'] == 'sound':
        out.append(f"- `{mmss(t)}` _Sound: {e['sound']} ({e['dur']:.2f} s)._")
        t += e['dur']
    elif e['type'] == 'pause':
        out.append(f"- `{mmss(t)}` _Pause: {e['id']} ({e['dur']:.1f} s)._")
        t += e['dur']
    elif e['type'] == 'sting':
        out.append(f"- `{mmss(t)}` _Sting: {e['id']} ({e['dur']:.1f} s)._")
        t += e['dur']
out += ['', f'Estimated running time {mmss(t)}.']
open(os.path.join(ROOT, 'SCRIPT-DRAFT.md'), 'w').write('\n'.join(out) + '\n')
print('SCRIPT-DRAFT.md written,', mmss(t))
