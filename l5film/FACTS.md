# Facts: Lesson 5 film, Breath and a steady note

`claim | source | how it was verified`, as the series' facts files are kept. This is the film's
facts file, draft 3, 18 November 2026, after script critic 02 (`review/script-02/REPORT.md`) and
the lead's calls on it (`LEAD-NOTES.md` there), as draft 2 followed critic 01 (`review/script-01/`)
and `LEAD-ANSWERS.md`. Drafts 1 and 2 are kept in `review/draft-1/` and `review/draft-2/`.
Lesson 5's facts 1 to 77
(`docs/plans/find-your-pitch/lessons/05-breath-steady-note/FACTS.md`, read at `4cab3f53d` on main,
where the lesson's folder last changed at `3742e6983`) bind the film exactly as they bind the
page, by the same numbers, and every scoping note there holds here. Above all: 10 (the film says a
steady note *needs* steady air, and since draft 2 says what sets the note, 91); 15, 21 and 22
(never "only" for the diaphragm); 39 ("many" teachers, never "most" or "usually"); 41 ("can",
never "always"); 42 ("small"); 45 (nothing rates the breath); and 72 to 76 (the takes, the Push
note, the gauge, the starts and the hold are illustrations). Another lesson's fact is written "L3
FACTS 23". The film's own facts run on from 78. Draft 2's new facts are 91 to 99, each carried
with its source before any line used it. Draft 3 adds no fact: it rewords 91 to match b33,
retires 92 (no line uses it), and adds the wavy lines' band times to 80. Nothing goes on screen or in a line that is not here;
each line's facts are listed beside it in `script.json` and `SCRIPT-DRAFT.md`.

The page code read for the sounds, at `4cab3f53d` (both files last changed at `fc948aa57`):
`src/features/lessons/kit/push-take.ts` (the two takes) and
`src/features/lessons/lesson-05/lines.ts` (the hold demo's hand-set rise); `toy-push.ts:41-42`
for the Push rule; `toy-hold.ts:135` and `:167` for how the page voices the demo;
`src/features/lessons/kit/sound.ts:48` (`MERC_VIBRATO`). Frequencies are f = 440 × 2^((m − 69) /
12), and cent offsets b × 2^(c / 1200), printed by `python3 -I` on 18 November 2026; the same runs
replayed the Push contour and the demo's rise by the page's own rules (80). No voice, image, video
or music service was called, and no sound was rendered: every sound below is a specification for
the mixer, measured from its output in the sound round, as Lesson 4's were.

## 1. The lesson's facts the film uses

By the lesson's number. "Lines" are `script.json` ids (b = Merc, o = Tavi; ids are stable from
draft 1, a new line takes a letter, as b27a or o14a, and a dropped id is not reused); "s05" is a scene's
picture (`SCRIPT-DRAFT.md`).

| Fact | What the film says or shows | Lines and picture |
| ---- | --------------------------- | ----------------- |
| 1 | The hook: "Singers are told to "support" a long note. If that doesn't mean pushing, what keeps it steady?" | o2 (with "But" before it, 82); s01's hook in type; answered in b20 and b33 (91) |
| 3 | The recall is Lesson 3's quick check, asked afresh: question 4 word for word, with its correct answer and its feedback (L3 FACTS 28a, 29) | o3, `q0`, b6; s04 |
| 4 | Next lesson: Lesson 6's hook, and the tease line above it | b60, o15; `twinkle`; s14, s15 (90, 99) |
| 5 | The two voices Lesson 3 offered: Merc around A3, Tavi around A4 | b38 ("sing my A, or Tavi's, an octave up"); s12's two labels |
| 6 | Air from the lungs sets the vocal folds vibrating | b7 ("How hard your breath pushes on your vocal folds") |
| 7 | Air pressure is the main control of loudness: more pressure, louder | b3, b7, b9, b17, b33; `pushed`, `push`; s05 "mainly: louder"; s07's miniature |
| 8 | More pressure also raises the pitch; no number is given | b3, b7, b9, b17, b33; `pushed`, `push`; s05 "also: a little higher" |
| 10 | Singers must hit those pressures accurately; "A steady note needs steady air, not more of it", never "steady air holds a note still" | b20; o13 voices the overreach as Tavi's guess, and b33 answers it: "A steady note needs steady air too" (91) |
| 13 | Loud and high are different things (Lesson 1); on the pitch line a quiet and a loud note at one pitch sit at one height (L1 FACTS 3, 21; L3 FACTS 28a) | o5, b9, b6 |
| 14 | The diaphragm is a dome-shaped muscle under the lungs that flattens as it tightens: a breathing-in muscle | b11, b48, b49; s06's breath figure; s13's first recap card |
| 15 | It cannot push air out | b15; s06's struck-through arrow |
| 17 | Full lungs spring back by themselves, with a passive push that grows with the air breathed in; the belly and rib muscles push air out | b14, b15, o7 |
| 18 | With full lungs the passive push can be more than a note needs, and the breathing-in muscles hold it back; as the air goes, the breathing-out muscles take over | b12, b13, b14, b15, o7, b16; `gauge`; s06 ("held back", "added") |
| 19 | A quiet note after a full breath needs much holding back; a loud note with little air left needs much breathing-out effort ("often", never "always") | b14 ("often harder than a quiet note needs"), b16 (both halves, 94); s06's Quiet and Loud |
| 20 | Sundberg's Fig. 4, after which the gauge is drawn, without its numbers | s06 (74) |
| 21, 22 | Some singers keep the diaphragm working through a phrase | why no line says the diaphragm works "only" on the breath in (b11: "It tightens to breathe in.") |
| 24 | Singers and teachers often talk about "support" | o2, o8, b17 |
| 24a | "Support": singers' word for how they manage the breath as they sing | b19; s07 |
| 25 | "Support" has no agreed definition | b19 ("There's no one agreed meaning."); s07 |
| 26 | Squeezing makes a pressed sound, like lifting something heavy, that needs more pressure, not less; at one pressure a pressed note is much quieter | b18; s07's two level strips (95) |
| 28 | Teachers begin with posture and loose muscles | b21; s08 |
| 29 | The belly moving out on the in-breath is a sign the diaphragm is at work | s08 only ("diaphragm at work") |
| 30 | Trained singers breathe in different ways | s08 only ("Singers breathe in different ways.") |
| 32 | The breathing and singing cues are instructions, not claims: low and quiet, as much as feels easy, shoulders still, start easily, flow out unforced, "with your breathing muscles, never your throat" | b13, b20, b22, b39 |
| 34 | A note's start is its onset; three broad kinds | b24; s09 |
| 35 | Air first: a puff of breath, like an "h", then the sound | b25, b27a; `start-air`, `starts`; s09 |
| 36 | A catch: the folds pressed shut, the sound starting as they open, like a cough | b26, b27a; `start-catch`, `starts`; s09 ("listen only") |
| 37 | Together: the folds meet the air as it starts to flow | b27, b27a ("then neither"), b52; `start-together`, `starts`; s09's gold tick |
| 38 | Onsets run on a continuum, and none is called wrong | b24 ("three main ways", "Just listen.") |
| 39 | Many teachers aim for the easy start, found through an "h" kept only in mind ("many", one teacher's guide) | b28, b51, b52; s09's fading "h" |
| 40 | Estill teaches all three as choices, so the aim is scoped to "a long, easy note" | b28, b51 |
| 41 | Sung notes can begin with a scoop | o12, b30, b54; `demo`; s10 |
| 42 | A small vibrato, a regular wave in the pitch, can sit inside the band; Merc's line is drawn steady at the band's centre; Voice Mirror does not count a vibrato against the singer | o12, b31; the Voice Mirror card's readout, on screen; `demo`; every band chart; the takes' and Push note's lines (98) |
| 43 | The band reaches 35 cents either side of Merc's note, every octave folded into one | s01 ("in the band: within 35 cents (Lesson 3)"); s10 ("A, any octave"); s12 |
| 44 | Holds are a fixed, comfortable length, never "as long as you can"; the first is 10 s | b4, b29, b32, b34; `hold`; s10 |
| 46 | Sing at about speaking volume | b6, b39 |
| 47 | The care line: "Lesson 3's care lines still apply: stop if your voice feels scratchy or hoarse." | b35 |
| 48 | "Sore, hoarse or unwell today? Just listen along." before any singing beyond a hum, and on the Voice Mirror card | b36, b37a, b56 |
| 49 | The comfort check's six conditions, Lesson 3's words | b37 |
| 50 | "Stop immediately if anything feels uncomfortable." | b41; s12's care block |
| 51 | The doctor lines | b46a, word for word after "Whatever you chose:"; on screen in small type from b35, full size through b46a |
| 52 | "How did that feel?", its four answers and what each leads to; Effortful and Uncomfortable end the singing | b43, b44, b45, b46 |
| 54 | "Ten minutes, gently, most days. Missed a day? Just come back." under the Voice Mirror card only; the rest card without it | on screen only, under the card (draft 2's b57); b58; s13 |
| 55 | Every one of the app's six voice presets holds A3 or A4 | b38 (the two voices offered, and only them) |
| 56 | A hold goes Listen · Breathe · Sing: Merc's note 2.0 s, a 2 s breath, then the hold, the take open from the in-breath | b39, b40, b42; `listen`, `breathe`, `hold` |
| 58 | Voice Mirror at mercurypitch.com/mirror, free, no account | b55, b56, b58; s13, s15 |
| 59 | Voice Mirror's three tasks, its six-second hold and what it shows: drift as a rate, wobble, a vibrato apart | b55; the card's readout on screen only (draft 2's b55a); s13's card |
| 60 | Voice Mirror's first two tasks are glides | b55, b56 ("Keep the glides comfortable.") |
| 61 | Voice Mirror is its own document, so a link to it never meets First Light | s13, s15: no skip line, unlike Lesson 4's card |
| 62, 66, 68 | Long Note's copy still promises what the claims rules forbid, no slug opens it, and the Ascent's week 2 promises "breath support" | nothing on screen: no Long Note and no Ascent link |
| 63 | The owner's decision: the first hold is 10 s | b4, b34; `hold` |
| 65 | The lesson asks for no breath hold | b39 ("Then sing straight away"), b42; `breathe` runs straight into `tick-in` and `hold` |
| 69 | The pitch-canvas colours: target amber, singer violet, in-tune mint | every band chart |
| 71 | A3 220.00 Hz, A4 440.00 Hz | every sound (80) |
| 72 | The two takes, 4.0 s on A3: easy, and pushing harder | `easy`, `pushed`; s01 |
| 73 | Push: 1.2 cents and 0.12 dB a step from 50, ±60 cents and ±6 dB at the ends | `push`; s05; s10's slider |
| 74 | The breath gauge: one 10-second note, Merc's "ooh" holding A3 unchanged while the cursor runs, the crossing at 7 s for Quiet and 3 s for Loud, "push of air (not pitch)" | `gauge` (93); s06, s08 |
| 75 | The three starts, 1.6 s each on A3 | `start-air`, `start-catch`, `start-together`, `starts` (96); s09 |
| 76 | The hold demo: 10.0 s, from 60 cents low, hand-set wavers, from 0.9 s the band's middle with a small wave | `demo` (an octave up, 80, 86); s10 |
| 77 | Merc's model note 2.0 s | `listen` |

Facts from other lessons, beyond those carried above:

| Fact | What the film uses | Lines and picture |
| ---- | ------------------ | ----------------- |
| L3 quick check 4 | "How loud should you sing when you practise matching?", its correct answer "At about the volume you talk at" and its feedback's "a quiet note is just as much the right note" (as committed; L5 FACTS 3) | o3, b6 |
| L3 FACTS 23 | Muscles in the voice box set the pitch, by stretching the vocal folds (91) | b33; s10 |
| L6 FACTS 1 | Lesson 6's hook | o15 |
| L6 FACTS 20 | "Twinkle, Twinkle"'s first line, C4 C4 G4 G4 A4 A4 G4, crotchets and a minim | `twinkle` (99); s14's seven beads |
| L6 FACTS 28 to 30 | Both tunes are public domain; the page plays only the bare melody, synthesised | `twinkle` (99) |
| L6 FACTS 36 | Lesson 6's cold open moves the first line up 6 semitones | b60; s14's dashed copy six rows up, silent |

## 2. The film's own facts

78. **Voice spellings.** The script spells the address "mercurypitch dot com slash mirror" for
    the voice; captions and the picture write mercurypitch.com/mirror (`tools/script-draft.py`,
    `SAY`, which also maps "A three" and "A four", though no draft 2 line uses them). "Support" is
    in quotation marks every time it is written, as Lesson 4's film wrote it (Lesson 4 film FACTS
    86). The doctor lines keep their parentheses in the voice line, so the caption shows them as
    the lesson words them | design | no voice was generated, so each spelling is checked by ear in
    the voicing round
79. **One timbre for every sung note.** The takes, the Push note, the gauge's note, Tavi's hold, the
    model notes and the tease's tune are the synthesised "ooh" of the app's demo voice, as the page
    plays them: partials 1, .62, .38, .24, .14, .08, .045, .025 through a 2,600 Hz lowpass, with a
    5.5 Hz vibrato of ±14 cents grown in over 0.35 s (L5 FACTS 42 and the paragraph above 71;
    `MERC_VIBRATO`, `src/features/lessons/kit/sound.ts:48`); Tavi's is the same timbre an octave up.
    The films' mixer already makes it (Lesson 4 film FACTS 67). No Echo samples. The three starts
    are the page's synthesised starts (75) | code | read; measured from the mixer's output in the
    sound round
80. **The film's sounds, at their exact pitches.** None belongs to a recording; each is drawn on
    screen from the same numbers it is synthesised from, its wave included (98).

    | Sound | Voice | Notes and contour | Length | Fact |
    | ----- | ----- | ----------------- | ------ | ---- |
    | `easy` | the "ooh", belonging to no host | A3 220.00 Hz: starts 40 cents low (214.98 Hz), glides to the centre by 0.5 s, holds; level steady (`takeContour('easy', 57)`, `push-take.ts`); the voice's vibrato on, and drawn | 4.0 s | 72, 98 |
    | `pushed` | the "ooh", belonging to no host; listen only | as `easy` to 1.0 s; then over 3.0 s up 60 cents (to 227.76 Hz) and 6 dB; its centre leaves the band at 2.75 s (`takeContour('pushed', 57)`); vibrato on, and drawn, so its wave's peaks leave the band from 2.05 s and the whole line is above it only from 3.45 s, which is why the drawn line stays on screen through b3 | 4.0 s | 72, 98 |
    | `push` | the "ooh", belonging to no host; listen only | A3, Push at 50 for 0.6 s, rising evenly to 100 by 2.1 s, held at 100 to 3.6 s, easing back to 50 by 4.8 s, held to 5.6 s; 1.2 cents and 0.12 dB a step (`pushCents`, `pushDb`, `toy-push.ts:41-42`): at 100, +60 cents (227.76 Hz) and +6 dB; the centre outside the band from 1.47 to 4.10 s (2.6 s, 1.5 of them at the top), the whole wavy line from 1.82 to 3.82 s | 5.6 s | 73, 98 |
    | `gauge` | Merc's "ooh" | A3 220.00 Hz, unchanged, under the gauge's 10-second cursor (Quiet: "holding back" to 7 s, then "adding") | 10.0 s | 74, 93 |
    | `start-air`, `start-catch`, `start-together` | synthesised starts on A3 | as 75: air first, band-passed noise 0.35 s with the tone rising under it from 0.25 s over 0.25 s; a catch, 0.15 s of silence, a 3 ms click, the tone at full level within 10 ms; together, the tone rising over 60 ms with no noise and no click | 1.6 s each | 75 |
    | `starts` | the same three | air first, a catch, together, back to back, 0.2 s apart | 5.2 s | 75, 96 |
    | `demo` | Tavi's "ooh" | A4 440.00 Hz, following the page's demo line exactly (`demoCents`, `lines.ts`): from 60 cents low (425.01 Hz) through the hand-set points (0.18 s, −38), (0.34, −52), (0.5, −22), (0.66, −38), (0.8, −10) to the centre at 0.9 s, smoothstep between them, then a 5.5 Hz wave of ±14 cents (436.46 to 443.57 Hz) grown in over 0.35 s. The voice's own vibrato is off for this sound, so the wave heard is the wave drawn, to the cent | 10.0 s | 76, 42 |
    | `listen` | Merc's and Tavi's "ooh", together | A3 220.00 and A4 440.00 Hz at once, 2.0 s: the model note before the hold, in both voices, so either singer has theirs | 2.0 s | 56, 77 |
    | `breathe` (a pause) | none | with b42, the Breathe phase: about 2 s from the end of `listen` (56) | 1.1 s | 56, 65 |
    | `tick-in`, `tick-out` (sound `tick`) | none | a soft click that marks the ring's start and its close, no pitch: band-passed noise in its own band (centred near 3 kHz, clear of the voice's partials), about 30 ms with a 20 ms decay, its peak at least 12 dB under `listen`'s (97) | 0.1 s each | 97 |
    | `hold` (a pause) | none | the viewer's 10 s: room tone only, the ring closing and its counter running over it | 10.0 s | 44, 56, 63 |
    | `twinkle` | Merc's "ooh" | the first line of "Twinkle, Twinkle" from C, once, untouched: C4 261.63, C4, G4 392.00, G4, A4 440.00, A4 at 0.5 s a crotchet, then G4 for 1.0 s, a minim (L6 FACTS 20; the page's demonstrations' 0.5 s a crotchet) | 4.0 s | 99 |

    By the page's own rules, replayed by the runs above: the demo's line, read as the checkpoint
    reads a take (every 16 ms; settled from the first moment it stays within 35 cents for 0.5 s),
    settles at about 0.7 s and is in the band for about 9.5 of its 10 s. Those readouts are a
    replica's arithmetic, not the kit's reader (`kit/take.ts`), so no number from them is on screen
    or in a line: s10 shows a "settled" marker with no number | code and arithmetic | replayed in
    `python3 -I`; the mixer's pitches are measured in the sound round
81. **The bed and the silences.** A quiet open fifth on A, A2 110.00, E3 164.81 and A3 220.00 Hz,
    Lesson 2's pad in A (Lesson 4 film FACTS 69 has the same pad on D), only in the eight act
    transitions (`act1` to `act5`, `sing`, `recap`, `next`) and under the dressed pauses, `predict`,
    `hook`, `q0`, `predict2`, `q1`, `q3`, `q4`, `feel` and `card` (MASTER-PLAN D9; playbook rule 12),
    and through `break`, where each of Merc's two hop landings gets a soft tap (two taps on E4, 3 dB
    under the pad; DECISIONS 215 and 243). The pad fades under the title chime's first note; there
    is none under the end chime.
    It is silent under every line and every sound (the gauge's note and the tease's tune among
    them), and in `heard` (the listening beat after the easy take), `breathe`, the ticks and
    `hold`: the viewer holds the note alone after the model note, as the page's hold has nothing
    playing while it is open (WEB-SPEC, Toys 6). Room tone runs under the whole film
    (PRODUCTION-PIPELINE § 3). The title and end stings are Lesson 1's chimes, an A major chord,
    which sits with the pad in A as it did in Lesson 1 | design; `tools/mix.py` in the sound round
82. **The cold open and the promise.** o1 is LESSON.md's Tavi line, word for word. b1 is the page's
    "Let's listen." with the predict's own second take ("the same note ... pushed harder and
    harder", the page's "with a harder and harder push of air" shortened) and the page's predict
    asked aloud with its two choices, one line since draft 2, as Lesson 4's film asked its
    cold-open predict, over a 2.0 s hold (`predict`, inside CURIOSITY-MOMENTS § 3.2's 2 s). b3 is
    the reveal's first sentence and its third ("So pushing doesn't hold a note still: it moves
    it.", without "So"); its second, the reason (7, 8), is chapter 1's, and its fourth is b20. On
    screen, small: "Both lines are drawings of that rule, not recordings." (72). o2 is the hook (1),
    "But" before it, said by Tavi after the reveal, so it cannot give the predict away
    (CURIOSITY-MOMENTS § 1 rule 4) and it picks up where Lesson 4's film ended: Merc's "Singers are
    told to "support" a long note." and Tavi's "If that doesn't mean pushing, what keeps it
    steady?", voiced, with the hook in type (Lesson 4 film FACTS 86; its s15). The page's kind
    line for a "steadier" guess is carried by Tavi herself: she guessed steadier, and her question
    names why it seemed right. b4 promises what the film has not yet shown: "what your diaphragm
    does" (14, 15), how to breathe in low and start easily (32, 39), and one comfortable note for
    ten seconds (44, 63); the page's promise begins "what pushing does to a note", which the film's
    cold open has already shown | LESSON.md, Header and Cold open | carried
83. **The recall.** o3 is Lesson 3's quick-check question 4, word for word after "From Lesson 3:",
    in Tavi's voice; b6 is its correct answer and the end of its feedback (3). The page also asks
    Lesson 3's question 3 (an A2, an octave lower and 20 cents high); the film leaves it on the
    page, as Lesson 4's film carried one of its page's two recall questions (Lesson 4 film
    DECISIONS 3). On screen only "about speaking volume" lights: nothing shows loudness changing
    while the line keeps its height, so chapter 1's o5 and b9 own the meeting of loud and high. The
    four words (LESSON.md, "Four words you'll meet") are on screen only, each defined in its own
    chapter: air pressure in b7, diaphragm in b11, onset in b24, "support" in b19 | LESSON.md,
    Recall and Four words | carried
84. **Chapter 1, "What pushing does".** o4 asks what the chapter's sound then shows: if the push
    eases off, does the note come back down (8; the toy's rule, 73)? b7 is Step 1's text. b8,
    "Listen, and watch the line: the push rises, holds, then eases off." (script critic 02's
    words), brings in `push` and names only what the push does, so what the line does is left for
    the sound to answer; it opens on "Listen" so it never reads as a cue to sing (Lesson 4 film
    FACTS 80). `push` climbs to the slider's top, 100, and holds there 1.5 s, so
    "above the band" reads (80). o5 is Tavi's "It came back.", what she heard, and her doubt
    from Lesson 1 (13), which b9 answers in Step 1's words. The page's Notice, "Keep Push still,
    and so does the line.", is not voiced in this chapter: over a film it would read as "steady air
    holds a note still". Step 1's "So singers learn to keep each note's pressure steady, and loud
    and high apart." (9 to 11) was cut for length in draft 2 | LESSON.md, Step 1 | carried
85. **Chapter 2's own lines.** o6 bridges from chapter 1 ("Then where does that push come from?")
    to her sincere guess, that it is the diaphragm. b11 is the four words' "Diaphragm" (14). b12 is
    Step 2's predict, its choices the page's, and it now comes before any line says the diaphragm
    can't push air out. `gauge` answers it in sound and picture before any words (93). b13, b14
    and b15 are Step 2's reveal, word for word, and b15 ends on Step 2's "It can't push air out."
    (15) as "Your diaphragm can't push air out.". The page's kind line after the reveal, "If you
    said push: full lungs already push.", is carried by o7, the page's own Tavi line. b16 gives
    both halves of 19 (94). o8, "What about "support"? Don't singers mean pushing hard, or
    squeezing?", is the mix-up card's belief as her question, turning from the gauge to the word;
    b17 is the card's name, "That's a common mix-up.", and its first piece of evidence, voiced as
    "Pushing moves the note, as you heard." and drawn as the pushed take's line in miniature (7,
    8). b18, b19 and b20 are the card's second piece of evidence, the
    four words' "Support" and the card's better idea, word for word but for b20's heading, "The
    better idea:", which is on screen | LESSON.md, Step 2 and Four words | carried
86. **Chapter 5: Tavi's hold, and what sets the note.** b29 asks Tavi to hold an A for ten seconds;
    `demo` is the page's hold demo (76) sung by her, an octave up, in her octave (MERC-BIBLE § 2:
    she sings back an octave higher), against Merc's band at "A, any octave" (43), tagged
    "Illustration". o11 is Step 5's heading, word for word, with her guess, a perfectly straight line (quiz question
    4's second answer), drawn as the same dashed line as her cold-open guess; o12, after her hold,
    asks about what her own line did (41, 42), and b30 and b31 answer it in Step 5's words. Step 5's
    Notice is on screen as the slowed first second, not voiced. b32 is Step 5's "Steady means the
    line settles into the band and stays, for a comfortable, fixed length", ending on the page's
    own "never "as long as you can"" (44); since draft 2 it names no lengths, so the only length
    near the turn is its ten seconds. o13 voices the reading critic 01 warned of, as her sincere
    guess: "Then is it steady air that keeps the note there?" b33 answers it in script critic 02's
    words: "No. Muscles in your voice box set the note. A steady note needs steady air too, because
    a change in the air moves it." (91)
    | LESSON.md, Steps 2 and 5; L3 FACTS 23 | carried; the contour is the page's by construction
    (80)
87. **The viewer's turn.** b34 states the task, one comfortable note for ten seconds (44, 63). b35,
    b36 and b37 are Lesson 3's care line, comfort line and comfort check, word for word (47 to 49).
    b37a, "Listening along? Rest your voice and watch the ring.", is the lead's line for the viewer
    who chose to listen (48; Lesson 3's "Just listen today": "Rest your voice."), so they hear it
    before the ten seconds rather than after them. b38, "Otherwise, sing my A, or Tavi's, an octave
    up.", is Lesson 4's form of the voice choice (Lesson 4 film FACTS 83: "Start on my note, or an
    octave up"), naming the two voices Lesson 3 offered (5, 55). b39 is the page's hold briefing,
    "Listen to Merc's note" as "Listen to our note", because both hosts sing it (`listen`). b40 and
    b41 are the page's, word for word. b42 and `breathe` are the Breathe phase, about 2 s from the
    note's end; `tick-in` and the ring's turn follow at once, so nobody waits holding a breath (56,
    65). `hold` is 10.0 s, the first hold (44, 63), the ring closing and its counter running over
    it, and `tick-out` marks its close (97). Nothing listens: the film has no microphone, draws no
    line for the viewer and gives no reading (45; the page's reader is the page's, 56 and 57). The
    fifteen-second hold, Again and the cap of three tries stay on the page, because a film cannot
    ask how the first hold felt before offering more (52). b43 asks "How did that feel?" with the
    four answers as the page labels them today; b44, b45 and b46 give each answer's line as the page
    words it ("Rest for a few easy breaths."; "Keep it gentle: rest before you sing again."; "Thanks
    for saying so. That's enough singing for today: rest your voice."). b46a is the doctor lines,
    voiced once, word for word with their parentheses (51), after "Whatever you chose:", so they
    are heard as meant for every answer, not only "Uncomfortable", while they show at full size; they are
    on screen in small type from b35, all above the caption band, and in the YouTube description |
    LESSON.md, Sing it; Lesson 4 film FACTS 83 | carried
88. **The recap.** Three of the page's four quick-check questions, asked open (no choices on
    screen), each answered with its correct answer: question 1, b48 and b49 ("Breathing in");
    question 3, b51 and b52 ("Air and sound starting together", with its feedback's "the easy
    start"); question 4, asked by Tavi word for word (o14a), as she asked one in Lesson 4's recap, and
    answered by b54. Question 2 (what pushing does) stays on the page: the film asks it twice
    already, in the cold open and chapter 1 | LESSON.md, Quick check | carried
89. **The practise card and the rest card.** On screen, the page's two cards word for word:
    "Practise it." and the Voice Mirror card (LESSON.md, Wrap, Practise it, its first bullet),
    "Ten minutes, gently, most days. Missed a day? Just come back." under it, and the rest card, "Rest today" and "Voice Mirror will be here when your voice
    feels comfortable: mercurypitch.com/mirror", without it (54). In the voice since draft 3: the card's first sentence (b55), its glides,
    comfort line and address (b56), and the rest card (b58). The card's readout ("For the hold, it
    shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn't counted
    against you.", draft 2's b55a) and the "Ten minutes" line (draft 2's b57) are on screen only,
    word for word, held to the scene's end with 2 s of no voice (`card`). A film cannot know which
    ending a viewer had, so it gives both; b58 opens on a new question that says whom the rest card
    is for, "Felt uncomfortable, or listened along today?", the page's own condition (54) in the
    film's words, for the coach. On screen the Voice Mirror card stands apart, under its own name,
    so its six-second hold reads as that drill's and never beside the film's ten seconds. No skip
    line: Voice Mirror is its own document (61). The YouTube description's link carries
    `?lesson=05` (LESSON.md, Footer) | LESSON.md, Wrap | carried
90. **Next time.** b59; `twinkle` (99); b60 is the tease line, "Merc moves every single note of
    'Twinkle, Twinkle' up.", in Merc's voice as "I move ..."; on screen as the line is written. o15
    is Lesson 6's hook, word for word (4; L6 FACTS 1). The figure is CURIOSITY-MOMENTS § 2's for
    Lesson 5: seven beads on faint semitone rows, the first line of "Twinkle, Twinkle" (L6 FACTS 20)
    unnamed, lighting as the tune plays, and a dashed copy six rows up with a "?" (L6 FACTS 36),
    silent. The moved copy is never played, so the tease gives the set-up and never its answer
    (CURIOSITY-MOMENTS § 1 rule 6) | CURIOSITY-MOMENTS § 2; LESSON.md, Wrap | carried

### New in draft 2, each carried with its source first

91. **What sets the note.** Pitch rises when the vocal folds are stretched longer and tighter, and
    muscles in the voice box do the stretching: "Vocal fold tension is regulated by elongating or
    shortening the vocal folds", and cricothyroid contraction "elongates the vocal folds and
    increases the stiffness and tension" (Zhang 2016, p. 2617); "stiffening or tensioning the vocal
    folds would increase the F0 of the voice" (p. 2626). Lesson 3 says it as "To go higher, muscles
    in your voice box stretch them longer and tighter", and Lesson 5's FACTS 10 cites it for why
    the page never says steady air holds a note still: "muscles in the voice box set the pitch".
    Air pressure moves the pitch too (8), and a missed pressure shows as a pitch error (10), so a
    change in the air moves the note, and that is why a steady note needs steady air. Said as b33,
    in script critic 02's words (draft 3): "No. Muscles in your voice box set the note. A steady
    note needs steady air too, because a change in the air moves it." It says what sets the note,
    what a steady note needs and why, and never that steady air keeps a note steady or still |
    L3 FACTS 23 (Zhang 2016, §§ II.B and IV.A, read in full for Lesson 3); L5 FACTS 8 and 10
    (Sundberg 1992, pp. 49, 57-59) | carried; "No." answers her yes-or-no question, and the line
    keeps the page's own "needs" (10). Draft 2's "Not on its own. ... A change in the air moves it;
    steady air doesn't." is withdrawn: "steady air doesn't" said the page's cut Notice in other
    words (84)
92. **The biggest breath** (no line uses it since draft 3; kept so its number is not reused: b20a
    and s08's small gauge were cut, § 5). The lungs' passive push "increases with the amount of air inhaled"
    (17: Sundberg 1992, p. 51); with full lungs it can be more than a quiet note needs, and the
    breathing-in muscles hold it back (18: p. 53); "the demands for compensatory activity of
    inspiratory muscles are quite high when a note is to be sung pp after a maximum inhalation" (19:
    p. 53). Tavi's guess, o9's "The biggest breath I can?", is answered by b20a: "After the biggest
    breath, full lungs push hardest by themselves, so a quiet note needs a lot of holding back."
    It describes what the breath does and claims no benefit for any amount of breath; b22's "taking
    as much as feels easy" stays an instruction (32), and the coach decides whether b20a may stand
    next to it. On screen, s08's small gauge draws a fuller breath as the lungs' own push starting
    higher, so "held back" grows; no numbers | L5 FACTS 17, 18, 19 | carried; the picture is an
    illustration by construction after 74
93. **The gauge, heard before it is explained.** FACTS 74's 10-second note, Merc's "ooh" holding A3
    unchanged while the cursor runs (the page's Play the breath), plays straight after the predict
    and before any words: the note stays put while "Now: holding back" becomes "Now: adding" at
    7 s (Quiet). The note's steadiness here is the drawing's (74), not a claim about a voice | L5
    FACTS 74, 18 to 20 | carried; by construction
94. **Both halves of 19.** b16: "Yes. And a loud note needs less holding back at first, but more
    adding as the air runs low." Sundberg 1992, p. 53: "a good deal of muscular expiration activity
    is required if a note is to be sung ff with lungs that contain only some small proportion of
    their full capacity". "Adding" is the gauge's own word for the breathing-out muscles' share
    (74) | L5 FACTS 19 | carried
95. **Squeezing, seen.** At one air pressure, pressed singing came out much quieter than neutral
    singing: "the sound level obtained in pressed phonation, i.e., with an exaggerated glottal
    adduction, is much lower that in neutral phonation" (Sundberg 1992, pp. 53-54, the source's
    "that"). s07 draws it as two level strips under one push of air, the pressed one much shorter,
    with no numbers and no sound (the film synthesises no pressed voice, § 5) | L5 FACTS 26 | carried;
    an illustration by construction
96. **The three starts, back to back.** The page's three starts (75), replayed in one row 0.2 s
    apart after each has been heard alone, so the puff and the 3 ms click can be heard against the
    smooth start; b27a, "Back to back now: listen for the puff, then the click, then neither.",
    says what to listen for in all three and asks for nothing to be sung | L5 FACTS 75, 35 to
    37 | by construction
97. **The ticks.** A soft, pitchless click marks the start of the viewer's ten seconds and its end
    (`tick-in`, `tick-out`, 80), in its own band and quieter than the model note, so a viewer
    singing with eyes closed knows when the ten seconds began and ended. Nothing in the page has
    one; it marks time and measures nothing | the lead's answer to draft 1's question 4 | design
98. **Every voice's line shows its wave.** The takes and the Push note sound with the "ooh"'s
    vibrato (79: 5.5 Hz, ±14 cents), so the film draws their violet lines with that wave, as it
    draws Tavi's, and the series' rule for a singer's line requires (§ 4). The page draws its takes
    without it (`takeCents`); in the film, sound and line are one. A wave of ±14 cents stays inside
    the 35-cent band (42) | L5 FACTS 42, 79 | code and arithmetic (14 < 35)
99. **The tease's tune.** The first line of "Twinkle, Twinkle", C4 C4 G4 G4 A4 A4 G4, crotchets
    and a minim (L6 FACTS 20), played once, untouched, in Merc's "ooh" at the page's demonstration
    pace, 0.5 s a crotchet (Lesson 6 FACTS, the paragraph above 62), 4.0 s. The tune and its words
    are in the public domain in the UK and the US, and the page plays only the bare melody,
    synthesised (L6 FACTS 28 to 30). The moved copy (L6 FACTS 36) is never played | L6 FACTS 20, 28
    to 30, 36 | carried

## 3. The vocal coach's lines

Every film line that carries a voice line or exercise on LESSON.md's list for the coach ("For the
vocal coach and the owner", and "Changed in the plain-language review"), marked `[coach]` in
`script.json`, word for word as the film says it. Lines new or changed in draft 2 are marked
"(new)" or "(changed)"; lines new or changed in draft 3 are marked "(draft 3)", and so are the
lines draft 3 took out of the voice, which stay here so the coach sees every change. The coach
signs off the film's script at the day-1 gate and the film at the day-6
gate, as the page (MASTER-PLAN § 7; § 12 item 8).

| Line | Word for word | The lesson's item |
| ---- | ------------- | ----------------- |
| `pushed` (changed) | (a voice pushed louder and higher, 4.0 s, now tagged "listen only" on screen, 80) | "The cold open's pushed note and Step 1's Push toy: a voice pushed louder and higher, for listening only." |
| b7 | "How hard your breath pushes on your vocal folds is its pressure. It mainly sets how loud the note is, and it nudges the pitch." | Plain-language review, Step 1 |
| `push` (changed) | (a held note pushed to the top, held 1.5 s, and back, 5.6 s, now tagged "listen only" on screen, 80) | As `pushed`: "for listening only" |
| b13 | "Hold it back, with your breathing muscles, never your throat." | "Step 2's reveal and the Wrap: holding back "with your breathing muscles, never your throat"." |
| b14 | "Full lungs spring back by themselves, often harder than a quiet note needs. So at first your breathing-in muscles keep working, holding some of that push back." | Plain-language review, Step 2's reveal |
| b15 (changed) | "As the air goes, your belly and rib muscles take over the pushing. Your diaphragm can't push air out." | Plain-language review, Step 2's reveal; Step 2's "It can't push air out." |
| b16 (changed) | "Yes. And a loud note needs less holding back at first, but more adding as the air runs low." | Plain-language review, Step 2's Notice, with the other half of FACTS 19 (94) |
| b18 | "Squeezing your throat makes a pressed sound, the sound people make lifting something heavy, and a pressed sound needs more air pressure, not less." | Plain-language review, the mix-up card's evidence |
| b19 | ""Support" is singers' word for how they manage the breath as they sing. There's no one agreed meaning." | Plain-language review, the four words, Support |
| b20a (draft 3: cut) | (draft 2: "After the biggest breath, full lungs push hardest by themselves, so a quiet note needs a lot of holding back.") | Cut with Tavi's biggest-breath guess and s08's small gauge, so b22's "taking as much as feels easy" stands alone, as the page has it (DECISIONS 62) |
| b21 (changed) | "Start tall but easy. If you're standing, keep your knees unlocked. Let your jaw, tongue and neck go loose." | "Step 3's cues: tall but easy, knees unlocked, jaw, tongue and neck loose"; plain-language review, Step 3's cues (its last sentence, "That's where singing teachers usually begin.", cut for length) |
| b22 | "Then breathe in quietly, and let the breath drop low, shoulders still, taking as much as feels easy." | "a low, quiet breath with the shoulders still, taking as much as feels easy ... NIDCD's care page says "deep breaths from the chest" (FACTS 27), so the breathing cue is the coach's call." |
| b24 (draft 3) | "How a note starts is its onset. A voice has three main ways. Just listen." | "Step 4: the page plays a catch and an air-first start for listening only and never asks for a catch" |
| b26, `start-catch` | "A catch: the vocal folds are pressed shut, and the note starts as they open, a little like a cough." | As b24 |
| `starts` (new) | (the three starts back to back, the catch among them, 5.2 s, 96) | As b24: for listening only |
| b27a (draft 3) | "Back to back now: listen for the puff, then the click, then neither." | As b24: it names the catch's click as something to listen for, and asks for nothing to be sung |
| b28 | "For a long, easy note, many singing teachers aim for the third, the easy start. It's often found by beginning with a soft "h", then keeping it only in your mind." | Step 4, "the "h" in mind"; plain-language review, Step 4 |
| b31 | "And steady doesn't mean dead straight: a small vibrato, a regular wave in the pitch, can sit inside the band." | Plain-language review, Step 5 ("dead straight") |
| b32 (changed) | "Steady means the line settles into the band and stays, for a comfortable, fixed length, never "as long as you can"." | The holds' lengths; the owner's decision of 19 October 2026 |
| b34 | "Your turn: one comfortable note, held for ten seconds." | "The holds: ten seconds, then fifteen only after "Easy" or "Workable"" (the film offers the ten only, 87) |
| b35 (draft 3: for the coach) | "Lesson 3's care lines still apply: stop if your voice feels scratchy or hoarse." | "Step 3's care line, which points back to Lesson 3's four (FACTS 47 to 49)". Critic 02 noted that it repeats b37 and b41 (about 6 s); the lead keeps it voiced, since a safety line said twice is not a fault, and lists it for the coach |
| b36 | "Sore, hoarse or unwell today? Just listen along." | "The comfort check and the comfort line, Lesson 3's current text" |
| b37 | "Choose listening if anything hurts or singing has felt uncomfortable, if your voice feels unusually hoarse or tired, if notes you usually reach have suddenly gone, if you're ill, or if talking or singing feels like hard work today." | As b36 |
| b37a (new) | "Listening along? Rest your voice and watch the ring." | As b36: what the listen-only choice leads to (Lesson 3's "Rest your voice.") |
| b38 (changed) | "Otherwise, sing my A, or Tavi's, an octave up." | The holds, "A3 or A4" (no move of four semitones in the film, 87); the voice line, in Lesson 4's film's form |
| b39 (changed) | "Listen to our note. Breathe in, low and quiet. Then sing straight away, easily, at about speaking volume." | The holds: "Listen · Breathe · Sing, with the take open from the in-breath so nobody waits holding their breath; at speaking volume"; plain-language review, the hold briefing |
| b40 | "Hold the note until the ring closes, or stop sooner if you need to." | The holds, "the stop-early line" |
| b41 | "Stop immediately if anything feels uncomfortable." | "The stop line, "Stop immediately if anything feels uncomfortable."" |
| `listen`, b42, `breathe`, `hold` | (both hosts' A, 2.0 s; "Breathe in."; the ticks; 10.0 s) | The holds: "Merc's two-second note"; the ten seconds |
| b43 | "How did that feel? Easy, workable, effortful, or uncomfortable?" | "The answers to "How did that feel?" (FACTS 52)"; and the proposed labels [ Easy ] [ OK ] [ Hard work ] [ Uncomfortable ] ("Proposed, not applied") |
| b44 | "Easy or workable? Rest for a few easy breaths." | As b43; "a rest the singer ends" |
| b45 | "Effortful? Keep it gentle: rest before you sing again." | As b43: "After "Effortful" the page shows the reading and no more holds" |
| b46 | "Uncomfortable? Thanks for saying so. That's enough singing for today: rest your voice." | As b43 |
| b46a (draft 3) | "Whatever you chose: if hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or swallowing is hard, get help straight away." | "Lesson 3's doctor lines: a couple of weeks ..., "a doctor (a GP or an ear, nose and throat specialist)", and the urgent signs"; the opener, "Whatever you chose:", is new in draft 3, so the lines are heard as meant for every answer |
| b55 (changed) | "Practise it. Voice Mirror has you glide up and down, hold any comfortable note for six seconds, then sing back five notes it plays." | "the two practice cards: Voice Mirror's six-second hold (not one of the house lengths of 5, 10 or 15 seconds) and its two glides" |
| b55a (draft 3: on screen only) | (on the Voice Mirror card, word for word, not voiced: "For the hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn't counted against you.") | As b55 |
| b56 (changed) | "Keep the glides comfortable. Sore, hoarse or unwell today? Just listen along. Free, no account: mercurypitch.com/mirror." | As b55, "its two glides" |
| b57 (draft 3: on screen only) | (under the Voice Mirror card, word for word, not voiced: "Ten minutes, gently, most days. Missed a day? Just come back.") | The practice card |
| b58 (changed) | "Felt uncomfortable, or listened along today? Rest today. Voice Mirror will be here when your voice feels comfortable: mercurypitch.com/mirror." | "the rest card after "Uncomfortable" or "Just listen today"": the card word for word, after a new question in the film's words (89) |

Not in the film, so not on this list: Step 3's five-second "sss" (its Try stays on the page), the
"hoo" to "oo" exercise, the warm-up, the fifteen-second hold, the move of up to four semitones,
"Done for today", the three-try cap and the proposed Long Note link (DECISIONS 12, 16, 23 and
30).

## 4. Illustrations without claims

- The two takes and the Push note are drawings of the rule in 7 and 8, sized to be seen (72, 73),
  voiced by nobody: no host sings a pushed note. Both are tagged "listen only"; the chart carries
  "Illustration" while they show, and the reveal adds "Both lines are drawings of that rule, not
  recordings." (72). Their violet lines show the wave their voice carries (98).
- Tavi's hold is the page's hand-set demo line (76), sung on the line it draws (80), tagged
  "Illustration". It is an illustration of a steady note, not a measurement of a voice, and it never
  reads out a number.
- The breath figure is a schematic side view, not anatomy to scale: its dome flattens and its belly
  moves out as 14 and 29 say, and on the way out its belly wall moves back in as the belly and rib
  muscles push the air out (17, b15). The gauge is drawn after Sundberg's Fig. 4 with no numbers, its side
  axis "push of air (not pitch)" (20, 74).
- The two level strips in s07 (95) show "much quieter" with no numbers and no sound.
- The voice box in s10 is a label beside Lesson 3's schematic folds, "muscles here set the note"
  (91), not anatomy to scale.
- The three starts are synthesised (75) beside Lesson 3's schematic folds; the catch is tagged
  "listen only".
- On every band chart Merc's line is drawn steady at the band's centre, though his "ooh" carries a
  vibrato (42); a singer's violet line shows its wave.
- Gold marks two things only, the series' colour for the fit: the gauge's "what the note needs"
  line and the "together" start's tick (as the page). Tavi's guesses are dashed ink-2 with a "?"
  (MASTER-PLAN § 5).
- The viewer's turn draws no line and reads nothing: the chrome playhead, the ring and its counter
  are a clock, and the ticks mark time (97).
- The tease's beads and their dashed copy are a drawing of Lesson 6's set-up; only the unmoved
  line is played (99).

## 5. Left out: no support found, or not the film's to say

- "Steady air is what holds a note still", "keep the push still and the note stays still", and any
  version of the hook's answer that says air alone *keeps* a note steady: no source read shows it
  (L5 FACTS 10 and its Unverified list). The film says what sets the note and what a steady note
  needs (91), and Tavi's o13 voices the overreach as a guess so b33 can answer it. Draft 2's
  "steady air doesn't [move it]" is withdrawn as too near this (91).
- "A low breath, or support, makes a note steadier", and any benefit of the breathing cues or of a
  smaller breath: no study read shows it (Unverified; VF 2026: "empirical data were lacking"). The
  cues are instructions only (32). Draft 2's b20a, what the biggest breath costs a quiet note
  (92), is cut in draft 3: answering "should I?" with a cost would be heard as "a smaller breath is
  easier", which no source shows, and would turn b22's "as much as feels easy" into a reason.
- "Pushing, or a hard start, harms the voice", and any health or injury claim: out of bounds
  (TEACHING-PLAYBOOK house rules), so the pushed note and the catch are "listen only" and nothing
  more.
- A synthesised pressed voice for b18: no source gives a model of one to synthesise, so s07's
  strips are silent (95).
- A number on Tavi's hold ("settled after 0.7 seconds", "9.5 of 10"): a replica's arithmetic, not
  the kit's reader (80).
- How often notes scoop, how long a beginner's note takes to settle, how common a vibrato is: not
  read (L5 FACTS, Unverified). The film says "can" and "small".
- "Inspiratory checking", the name for holding back: in the lesson's facts (23) and its Go deeper,
  but its source is about speech in adults with a voice disorder, and the film has no Go deeper.
- Supported, but cut for length in draft 2 or 3: Step 1's "So singers learn to keep each note's pressure
  steady, and loud and high apart." (9 to 11); Step 3's "If your belly moves out, that's your
  diaphragm at work." (29) and "Singers breathe in different ways; this is a calm place to start."
  (30), both now in type only; "That's where singing teachers usually begin." (28); the page's
  quick-check question 2; Lesson 3's recall question 3 (3); the Go deeper's three studies (16, 30,
  31, 21); and, from the voice only, the Voice Mirror card's readout (59) and "Ten minutes, gently,
  most days." (54), both still on screen word for word (89).
- That the film or the app hears, checks or scores the viewer's hold: the film has no microphone
  (87).
- Long Note, its slug, and the Ascent's "Breath & Power" week: not linked (62, 66, 68).
