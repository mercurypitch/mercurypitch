"""Write SCRIPT-DRAFT.md: the script as a reader sees it, before any voice exists.

  python3 tools/script-draft.py

Reads script.json and the scene table in tools/gen-root.py (SCENES: id, first cue, title).
Lines are printed as captions write them (A3, mercurypitch.com/mirror ...), with the facts each
rests on; [coach] marks a line the lesson lists for the vocal coach. Each scene opens with what
the picture is for (PICTURE, below). Times are an estimate at Lesson 2's voiced pace, Merc 2.32
and Tavi 3.08 words a second; the voiced clock is SCRIPT.md, from cues.json, once the lines are
spoken.
"""
import ast, json, os, re
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
script = json.load(open(os.path.join(ROOT, 'script.json')))
src = open(os.path.join(HERE, 'gen-root.py')).read()
SCENES = ast.literal_eval(re.search(r'^SCENES = (\[.*?^\])', src, re.S | re.M).group(1))
WHO = {'blue': 'MERC', 'orange': 'TAVI'}
# the voice's spellings, and how captions and the picture write them (FACTS 78)
SAY = [
    (r'\bA two\b', 'A2'),
    (r'\bA three\b', 'A3'),
    (r'\bA four\b', 'A4'),
    (r'\bmercurypitch dot com slash mirror\b', 'mercurypitch.com/mirror'),
]
PICTURE = {
    's01-cold-open': 'Frame 0 is finished: the band chart in the dark room, Merc\'s amber band at A3 with his steady amber line at its centre, "A3" and "in the band: within 35 cents (Lesson 3)" beside it, a level strip under it, and a small "Illustration" tag; Merc and Tavi either side of it, watching. From 0.6 s the easy take draws a violet line as it sounds, belonging to neither host: in from below, into the band by 0.5 s, then holding there with the small, even wave its voice carries (5.5 a second, 14 cents either way), the strip even; "sung easily". On the predict, Tavi\'s guess appears as a dashed ink-2 line held dead flat in the band with a "?", as if a push would iron the wave out, and two pills, "Settle, steadier than before" and "Get louder and drift higher", hold through the 2 s pause. The pushed take draws a second violet line, tagged "listen only": a second in the band, then the strip swells and the wavy line climbs out of the top of the band: its wave\'s peaks leave the band from about 2 s into the take, its centre at 2.75 s, and the whole line is above the band only from 3.45 s ("above the band", the mint edge off). So the finished line stays drawn, whole and still, through Merc\'s reveal, until the hook: the half second it spends wholly above the band must be there to read. "louder · higher" lands on the climb, the second pill checks, the dashed guess fades, and small type reads "Both lines are drawings of that rule, not recordings." Last, the hook in type: Singers are told to "support" a long note. If that doesn\'t mean pushing, what keeps it steady?',
    's02-title': 'Title sting: "Find Your Pitch · Lesson 05 · Breath and a steady note".',
    's03-promise': 'Three short labels land along the chart as Merc names them: "what your diaphragm does", "breathe in low · start easily", "a comfortable note · 10 s".',
    's04-recall': '"FROM LESSON 3". Tavi\'s question over a loudness strip with three marks, "whisper · about speaking volume · shout"; on the answer the middle one lights and stays lit, and nothing else moves: the strip does not grow or shrink (chapter 1 owns loud against high). Then "Four words you\'ll meet": air pressure, diaphragm, onset, "support", four labels that park at the frame\'s top edge, each to light in its chapter.',
    's05-push': 'Chapter card "01 What pushing does". The Push toy: the band chart, the level strip, a held violet line (with its wave) and one slider, "Push", at 50, tagged "listen only". "pressure: how hard your breath pushes on your vocal folds"; "mainly: louder", "also: a little higher". As the note sounds the slider climbs to 100, the strip grows and the line climbs out of the top of the band and stays there for 1.5 s ("above the band"), then the slider eases back to 50 and the line returns ("in the band"), answering Tavi\'s question. On her doubt, Lesson 1\'s loud-or-high figure beside the chart, "loud ≠ high"; on Merc\'s answer, one arrow from Push forks to both "louder" and "higher": "in a voice, one push moves both".',
    's06-diaphragm': 'Chapter card "02 What the diaphragm does". The breath figure, a schematic side view in chrome (not to scale): lungs, the diaphragm\'s dome under them, the belly wall, labelled "diaphragm" and "belly"; on the breath in the dome flattens and the belly moves out. The predict: "Predict", and "Push it out" and "Hold it back", 2 s. Then the breath gauge, with sound before any words: one 10-second note across, up the side "push of air (not pitch)" with no scale; a falling chrome line, "the lungs\' own push"; a level gold line, "what the note needs"; "held back" above the gold line, "added" below it. Merc sings A3 for the whole 10 s, his small band beside the gauge showing the note unchanged, while a cursor runs across: "Now: holding back", then, at 7 s, "Now: adding"; "Hold it back" checks. For the storyboard: these are six new labels in 10 s, so build them in stages, never together: the frame and its side label settle in the predict\'s 2 s; the falling line and its label draw in with the cursor; the gold line and its label follow; "held back" and "Now: holding back" arrive with the cursor in that region, and "added" and "Now: adding" only at the 7 s crossing. Only then do the words come; on "can\'t push air out", an arrow from the dome up into the lungs is struck through. On the last line, Loud: the crossing moves to 3 s, "less holding back at first", and the "added" region grows, "more adding as the air runs low". The hosts sit small at the edge.',
    's07-support': 'The mix-up card, its rows landing with the lines: "Common mix-up: \'support\' means pushing hard, or squeezing"; "push harder: louder, and higher", with the pushed take\'s line in miniature; "squeeze: a pressed sound, more pressure, not less", with two level strips side by side under one push of air, "easy" tall and "pressed" much shorter, "same push: much quieter" (no numbers); "\'support\': how singers manage the breath · no one agreed meaning"; and the better idea, "steady air, not more of it · breathe in low · start easily · let it flow out unforced".',
    's08-breathe': 'Chapter card "03 Breathing in". The breath figure upright, the cues landing as Merc names them: "tall but easy", "knees unlocked", "jaw · tongue · neck loose", "breathe in quietly, low", "shoulders still", "as much as feels easy". The figure breathes once, slowly: the dome flattens and the belly moves out, "diaphragm at work", then both return; no ring, no count, nothing asks the viewer to breathe along (that Try stays on the page). "Singers breathe in different ways." in type.',
    's09-onset': 'Chapter card "04 Starting a note". Lesson 3\'s vocal folds seen from above beside a 1.6-second trace strip: the wave\'s height is the level, fine dots are air with no note, a short mark is the catch. "Air first": the folds apart, dots, then the wave grows. "A catch": the folds drawn pressed shut with a heavier stroke, a short silence, the mark, then the full wave at once, tagged "listen only". "Together": the folds close to a slit as the wave starts and grows smoothly, a gold tick where air and sound begin at once. Then the three traces stack one above another and light in turn as the three play back to back, the dots and the click mark circled: "the puff", "the click", and nothing to circle on the third: "neither". Then "the easy start" over the third trace, and a faint "h" over it that fades: "the h, only in your mind". All three traces tagged "Illustration".',
    's10-steady': 'Chapter card "05 A steady note". Tavi\'s guess as a dashed ink-2 dead-straight line with a "?", the same dashed line as her cold-open guess. The band chart in hold mode, tagged "Illustration": 0 to 10 s across, Merc\'s band "A, any octave" with his steady amber line at its centre; Tavi sings an A4 and her violet line draws as it sounds: up from 60 cents low, wavering, into the band, then level with a small, even wave, a "settled" marker where it stays in the band (no number); the dashed guess fades. Under Merc\'s next two lines, the first second again, slowed and enlarged: "scoop", then "small vibrato: inside the band". Then "steady: settles into the band and stays", "a comfortable, fixed length". On Tavi\'s guess about steady air, "steady air keeps it there?" dashed with a "?"; on Merc\'s answer, the voice box beside the folds, "muscles here set the note", then "a steady note needs steady air too", and the Push slider moving the line up and back as it moves: "a change in the air moves it". Never a beat with the slider held still and the line still: that would draw "keep the push still and the note stays still" (BRIEF, Must never appear).',
    's11-sing': 'Chapter card "Sing it". The care block, above the caption band (nothing below y 864): "Sore, hoarse or unwell today? Just listen along." in bold, and under it the page\'s reasons to listen instead, in short ("hurts or uncomfortable · unusually hoarse or tired · usual notes suddenly gone · ill · talking or singing is hard work"); at its foot, from here to the end of the turn, the doctor lines in small type (30 px or more), carried whole. "Nothing listens" beside the chart. On "Listening along?", the ring appears with "listening along: rest your voice and watch the ring".',
    's12-your-turn': 'Two labels under the band, "A3 · Merc" and "A4 · Tavi, an octave up". The ring with its three phases, "Listen · Breathe · Sing", "at about speaking volume", "stop sooner if you need to", and the stop line added to the care block. Listen: Merc and Tavi sing their A together, 2 s, both with sound arcs, each label lighting. Breathe: the ring breathes once, "Breathe in, low and quiet". Sing: a soft tick, and the ring turns; it closes over 10 s, its counter running the seconds without a pause, while a chrome playhead sweeps a 10-second frame of the band; a second tick as it closes. No violet line, no reading, Merc and Tavi still: nothing listens. Then "How did that feel?" and the four answers, "Easy · Workable · Effortful · Uncomfortable", each lighting with its line and what it leads to, "rest a few easy breaths", "rest before you sing again", "enough singing for today". Then, on "Whatever you chose", all four answers light together and the doctor lines grow to full size under them, and stay while Merc says them. All of it above the caption band.',
    's13-recap': 'Three recap cards, each answered by the object that taught it: the breath figure\'s dome flattening; the three traces with the gold tick on "together"; Tavi, small at the card\'s edge, asks the third, and her own line answers it, settling into the band with its wave. A clean break, then the practise card on its own, as the page words it, under a "Voice Mirror" heading so its six-second hold reads as that drill\'s own and never sits beside the film\'s ten seconds: "Practise it.", glide up, glide down, "a six-second hold", five notes; then, in type only and word for word, "For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn\'t counted against you."; "Keep the glides comfortable."; "Sore, hoarse or unwell today? Just listen along."; "Free, no account: mercurypitch.com/mirror"; and under the card, in type only and word for word, "Ten minutes, gently, most days. Missed a day? Just come back.". Each type-only line lands as the voice line before it ends and stays on screen to the end of the scene, and the scene ends on 2 s with no voice, so both can be read whole. Beside it, landing with its line, the rest card, "after \'Uncomfortable\' or listening along": "Rest today", "Voice Mirror will be here when your voice feels comfortable: mercurypitch.com/mirror", with no "Ten minutes" line.',
    's14-next': '"Next time": seven beads on faint semitone rows, the first line of "Twinkle, Twinkle", unnamed; they light one by one as Merc sings the line once, from C. Then a dashed copy six rows up with a "?", silent; the tease line in type, "Merc moves every single note of \'Twinkle, Twinkle\' up."; Lesson 6\'s hook in type.',
    's15-end': 'End card: "mercurypitch.com/mirror", "Voice Mirror is free, with no account", the lockup; the tease figure small; Merc and Tavi to one side; the lower-left third clear for the next lesson\'s video and room for Subscribe.',
}
def shown(text):
    for pat, rep in SAY:
        text = re.sub(pat, rep, text)
    return text
rate = {'blue': 2.32, 'orange': 3.08}
first = {cue: (sid, title) for sid, cue, title in SCENES}
out = ['# Script draft: Find Your Pitch, Lesson 5, "Breath and a steady note"', '',
       'Draft 3, 18 November 2026. Generated from `script.json` by `tools/script-draft.py`. Lines as captions',
       'write them; the voice spells the address "mercurypitch dot com slash mirror" (FACTS 78). Times are estimates',
       'at Lesson 2\'s voiced pace. Each line ends with the facts it rests on (Lesson 5 FACTS 1 to 77 in docs; the',
       'film\'s from 78 in `FACTS.md`; "L3 FACTS 23" is another lesson\'s); `[coach]` marks a line the lesson lists',
       'for the vocal coach (`FACTS.md`, The vocal coach\'s lines).', '']
t = 0.0
def mmss(x):
    x = round(x, 1)  # round first, so 359.96 prints 6:00.0, never 5:60.0
    return f'{int(x // 60)}:{x % 60:04.1f}'
def note(e):
    return f" _[{e['facts']}]_" if e.get('facts') else ''
words = {'blue': 0, 'orange': 0}
lines = {'blue': 0, 'orange': 0}
speech = 0.0
marks = {}
for i, e in enumerate(script['events']):
    if i == 0 or e['id'] in first:
        sid, title = first.get(None if i == 0 else e['id'], first.get(e['id']))
        out += ['', f'## {sid}: {title} (~{mmss(t)})', '', f'_Picture:_ {PICTURE.get(sid, "")}', '']
    t += e.get('gap', script.get('gap', 0.3))
    marks[e['id']] = t
    if e['type'] == 'line':
        n = len(e['text'].split())
        out.append(f"- `{mmss(t)}` **{WHO[e['who']]}:** {shown(e['text'])} _[{e.get('facts', '?')}]_")
        t += n / rate[e['who']]
        speech += n / rate[e['who']]
        words[e['who']] += n
        lines[e['who']] += 1
    elif e['type'] == 'sound':
        out.append(f"- `{mmss(t)}` _Sound: {e['sound']} ({e['dur']:.2f} s)._{note(e)}")
        t += e['dur']
    elif e['type'] == 'pause':
        out.append(f"- `{mmss(t)}` _Pause: {e['id']} ({e['dur']:.1f} s)._{note(e)}")
        t += e['dur']
    elif e['type'] == 'sting':
        out.append(f"- `{mmss(t)}` _Sting: {e['id']} ({e['dur']:.1f} s)._")
        t += e['dur']
out += ['', f'Estimated running time {mmss(t)}. Merc: {lines["blue"]} lines, {words["blue"]} words; Tavi: '
        f'{lines["orange"]} lines, {words["orange"]} words; about {mmss(speech)} of speech. The hook question ends at '
        f'about {mmss(marks["hook"])}; the viewer\'s hold runs {mmss(marks["hold"])} to {mmss(marks["hold"] + 10.0)}.']
open(os.path.join(ROOT, 'SCRIPT-DRAFT.md'), 'w').write('\n'.join(out) + '\n')
print('SCRIPT-DRAFT.md written,', mmss(t), '| Merc', lines['blue'], 'lines', words['blue'], 'words | Tavi',
      lines['orange'], 'lines', words['orange'], 'words | hook ends', mmss(marks['hook']))
