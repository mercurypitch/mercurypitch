# Facts: Lesson 5 film, Breath and a steady note

`claim | source | how it was verified`, as the series' facts files are kept. This is the film's
facts file, draft 1, 18 November 2026. Lesson 5's facts 1 to 77
(`docs/plans/find-your-pitch/lessons/05-breath-steady-note/FACTS.md`, read at `4cab3f53d` on main,
where the lesson's folder last changed at `3742e6983`) bind the film exactly as they bind the
page, by the same numbers, and every scoping note there holds here. Above all: 10 (the film says a
steady note *needs* steady air, never that steady air is what holds a note still); 15, 21 and 22
("mostly", never "only"); 39 ("many" teachers, never "most" or "usually"); 41 ("can", never
"always"); 42 ("small"); 45 (nothing rates the breath); and 72 to 76 (the takes, the Push note, the
gauge, the starts and the hold are illustrations). Another lesson's fact is written "L3 FACTS 28a".
The film's own facts are numbered on from 78, so they can join the lesson's file unchanged when
the film's documents move to the docs folder. Nothing goes on screen or in a line that is not
here; each line's facts are listed beside it in `script.json` and `SCRIPT-DRAFT.md`.

The page code read for the sounds, at `4cab3f53d` (both files last changed at `fc948aa57`):
`src/features/lessons/kit/push-take.ts` (the two takes) and
`src/features/lessons/lesson-05/lines.ts` (the hold demo's hand-set rise); `toy-push.ts:41-42`
for the Push rule; `toy-hold.ts:135` and `:167` for how the page voices the demo. Frequencies are
f = 440 × 2^((m − 69) / 12), and cent offsets b × 2^(c / 1200), printed by `python3 -I` on 18
November 2026; the same run replayed the Push contour and the demo's rise by the page's own rules
(below, 80). No voice, image, video or music service was called for this draft, and no sound was
rendered: every sound below is a specification for the mixer, to be measured from its output in
the sound round, as Lesson 4's were.

## 1. The lesson's facts the film uses

By the lesson's number. "Lines" are `script.json` ids (b = Merc, o = Tavi); "s05" is a scene's
picture (`SCRIPT-DRAFT.md`).

| Fact | What the film says or shows | Lines and picture |
| ---- | --------------------------- | ----------------- |
| 1 | The hook: "Singers are told to "support" a long note. If that doesn't mean pushing, what keeps it steady?" | o2 (with "But" before it, 82); s01's hook in type; answered in b20 and o13 |
| 3 | The recall is Lesson 3's quick check, asked afresh: question 4 word for word, with its correct answer and its feedback (L3 FACTS 28a, 29) | b5, o3, `q0`, b6; s04 |
| 4 | Next lesson: Lesson 6's hook, and the tease line above it | b60, o15; s14, s15 (90) |
| 5 | The two voice buttons, "Lower: sing with Merc, around A3" and "Higher: sing with Tavi, around A4", as Lesson 3 named them | b38; s12 |
| 6 | Air from the lungs sets the vocal folds vibrating | b7 ("How hard your breath pushes on your vocal folds") |
| 7 | Air pressure is the main control of loudness: more pressure, louder | b3, b7, b9, b17, o14 and b50; `pushed`, `push`; s05 "mainly: louder" |
| 8 | More pressure also raises the pitch; no number is given | b3, b7, b9, b17, b50; `pushed`, `push`; s05 "also: a little higher" |
| 9 | Each pitch needs its own pressure | b10 ("keep each note's pressure steady") |
| 10 | Singers must hit those pressures accurately; "A steady note needs steady air, not more of it", never "steady air holds a note still" | b10, b20, o13 |
| 11 | Singers learn to control loudness and pitch separately | b10 ("and loud and high apart") |
| 13 | Loud and high are different things (Lesson 1); on the pitch line a quiet and a loud note at one pitch sit at one height (L1 FACTS 3, 21; L3 FACTS 28a) | o5, b9, b6; s04's level strip under a line that keeps its height |
| 14 | The diaphragm is a dome-shaped muscle under the lungs that flattens as it tightens: a breathing-in muscle | b11, b48, b49; s06's breath figure; s13's recap card 1 |
| 15 | It cannot push air out; it mostly works on the breath in | b11, b49; s06's struck-through arrow |
| 17 | Full lungs spring back by themselves; the belly and rib muscles push air out | b14, b15, o7 |
| 18 | With full lungs the passive push can be more than a note needs, and the breathing-in muscles hold it back; as the air goes, the breathing-out muscles take over | b12, b13, b14, b15, o7, b16; s06's gauge ("held back", "added") |
| 19 | A quiet note after a full breath needs much holding back; a loud note needs less ("often", never "always") | b14 ("often harder than a quiet note needs"), b16; s06's Quiet and Loud |
| 20 | Sundberg's Fig. 4, after which the gauge is drawn, without its numbers | s06's gauge (74) |
| 21, 22 | Some singers keep the diaphragm working through a phrase, hence "mostly" | b11 ("mostly") |
| 24 | Singers and teachers often talk about "support" | o2, o8, b17 |
| 24a | "Support": singers' word for how they manage the breath as they sing | b19; s07 |
| 25 | "Support" has no agreed definition | b19 ("There's no one agreed meaning."); s07 |
| 26 | Squeezing makes a pressed sound, like lifting something heavy, and it needs more pressure, not less | b18; s07 |
| 28 | Teachers begin with posture and loose muscles ("usually", on two sources) | b21; s08 |
| 29 | The belly moving out on the in-breath is a sign the diaphragm is at work | b23; s08 |
| 30 | Trained singers breathe in different ways; belly in or belly out | b23 ("Singers breathe in different ways; this is a calm place to start."); s08 |
| 32 | The breathing and singing cues are instructions, not claims: low and quiet, as much as feels easy, shoulders still, start easily, flow out unforced, "with your breathing muscles, never your throat" | b13, b20, b22, b39, o13 |
| 34 | A note's start is its onset; three broad kinds | b24; s09 |
| 35 | Air first: a puff of breath, like an "h", then the sound | b25; `start-air`; s09 |
| 36 | A catch: the folds pressed shut, the sound starting as they open, like a cough | b26; `start-catch`; s09 ("listen only") |
| 37 | Together: the folds meet the air as it starts to flow | b27, b52; `start-together`; s09's gold tick |
| 38 | Onsets run on a continuum, and none is called wrong | b24 ("three main ways", "Just listen to these") |
| 39 | Many teachers aim for the easy start, found through an "h" kept only in mind ("many", one teacher's guide) | b28, b51, b52; s09's fading "h" |
| 40 | Estill teaches all three as choices, so the aim is scoped to "a long, easy note" | b28, b51 |
| 41 | Sung notes can begin with a scoop | o12, b30, b54; `demo`; s10 |
| 42 | A small vibrato, a regular wave in the pitch, can sit inside the band; Merc's line is drawn steady at the band's centre; Voice Mirror does not count a vibrato against the singer | o12, b31, b55; `demo`; every band chart |
| 43 | The band reaches 35 cents either side of Merc's note, every octave folded into one | s01 ("in the band: within 35 cents (Lesson 3)"); s10 ("A, any octave"); s12 |
| 44 | Holds are a fixed 5, 10 or 15 seconds, never "as long as you can"; the first is 10 | b4, b29, b32, b34; `hold`; s10 |
| 46 | Sing at about speaking volume | b6, b39 |
| 47 | The care line: "Lesson 3's care lines still apply: stop if your voice feels scratchy or hoarse." | b35 |
| 48 | "Sore, hoarse or unwell today? Just listen along." before any singing beyond a hum, and on the Voice Mirror card | b36; s08 has no singing, so it waits for s11; s13's card |
| 49 | The comfort check's six conditions, Lesson 3's words | b37 |
| 50 | "Stop immediately if anything feels uncomfortable." | b41; s12's care block |
| 51 | The doctor lines | on screen from b35 to the end of `rest`, full size from b46 (87) |
| 52 | "How did that feel?", its four answers and what each leads to; Effortful and Uncomfortable end the singing | b43, b44, b45, b46 |
| 54 | "Ten minutes, gently, most days. Missed a day? Just come back." under the Voice Mirror card only; the rest card without it | b57, b58; s13 |
| 55 | Every one of the app's six voice presets holds A3 or A4 | b38 (the two voices offered, and only them) |
| 56 | A hold goes Listen · Breathe · Sing: Merc's note 2.0 s, a 2 s breath, then the hold, the take open from the in-breath | b39, b40, b42; `listen`, `breathe`, `hold` |
| 58 | Voice Mirror at mercurypitch.com/mirror, free, no account | b55, b56; s13, s15 |
| 59 | Voice Mirror's three tasks, its six-second hold and what it shows: drift as a rate, wobble, a vibrato apart | b55; s13's card |
| 60 | Voice Mirror's first two tasks are glides | b56 ("Keep its glides comfortable.") |
| 61 | Voice Mirror is its own document, so a link to it never meets First Light | s13, s15: no skip line, unlike Lesson 4's card |
| 62, 66, 68 | Long Note's copy still promises what the claims rules forbid, no slug opens it, and the Ascent's week 2 promises "breath support" | nothing on screen: no Long Note and no Ascent link |
| 63 | The owner's decision: the first hold is 10 s | b4, b34; `hold` |
| 65 | The lesson asks for no breath hold | b39 ("Then sing straight away"), b42; `breathe` runs straight into `hold` |
| 69 | The pitch-canvas colours: target amber, singer violet, in-tune mint | every band chart |
| 71 | A3 220.00 Hz, A4 440.00 Hz | every sound (80) |
| 72 | The two takes, 4.0 s on A3: easy, and pushing harder | `easy`, `pushed`; s01 |
| 73 | Push: 1.2 cents and 0.12 dB a step from 50 | `push`; s05 |
| 74 | The breath gauge: one 10-second note, the crossing at 7 s for Quiet and 3 s for Loud, "push of air (not pitch)" | s06 |
| 75 | The three starts, 1.6 s each on A3 | `start-air`, `start-catch`, `start-together`; s09 |
| 76 | The hold demo: 10.0 s, from 60 cents low, hand-set wavers, from 0.9 s the band's middle with a small wave | `demo` (an octave up, 80, 86); s10 |
| 77 | Merc's model note 2.0 s; a Lower or Higher tap 1.0 s | `listen`, `pick` |

Facts from other lessons, beyond those carried above:

| Fact | What the film uses | Lines and picture |
| ---- | ------------------ | ----------------- |
| L3 quick check 4 | "How loud should you sing when you practise matching?", its correct answer "At about the volume you talk at" and its feedback "No shouting, no whispering: a quiet note is just as much the right note." (as committed; L5 FACTS 3) | o3, b6 |
| L6 FACTS 1 | Lesson 6's hook | o15 |
| L6 FACTS 20 | "Twinkle, Twinkle"'s first line, C4 C4 G4 G4 A4 A4 G4 | s14's seven beads (drawn, not played) |
| L6 FACTS 36 | Lesson 6's cold open moves the first line up 6 semitones | b60; s14's dashed copy six rows up |

## 2. The film's own facts

78. **Voice spellings.** The script spells "A three" and "A four" for the voice, and the address
    as "mercurypitch dot com slash mirror"; captions and the picture write A3, A4 and
    mercurypitch.com/mirror (`tools/script-draft.py`, `SAY`). "Support" is in quotation marks every
    time it is written, as Lesson 4's film wrote it (Lesson 4 film FACTS 86) | design | no voice
    was generated for this draft, so each spelling is checked by ear in the voicing round
79. **One timbre for every sung note.** The takes, the Push note, Tavi's hold and the model notes
    are the synthesised "ooh" of the app's demo voice, as the page plays them: partials 1, .62,
    .38, .24, .14, .08, .045, .025 through a 2,600 Hz lowpass, with a 5.5 Hz vibrato of ±14 cents
    grown in over 0.35 s (L5 FACTS 42 and the paragraph above 71; `MERC_VIBRATO`,
    `src/features/lessons/kit/sound.ts:48`); Tavi's is the same timbre an octave up. The films'
    mixer already makes it (Lesson 4 film FACTS 67). No Echo samples. The three starts are the
    page's synthesised starts (75) | code | read; measured from the mixer's output in the sound round
80. **The film's sounds, at their exact pitches.** None belongs to a recording; each is drawn on
    screen from the same numbers it is synthesised from.

    | Sound | Voice | Notes and contour | Length | Fact |
    | ----- | ----- | ----------------- | ------ | ---- |
    | `easy` | the "ooh", belonging to no host | A3 220.00 Hz: starts 40 cents low (214.98 Hz), glides to the centre by 0.5 s, holds; level steady (`takeContour('easy', 57)`, `push-take.ts`) | 4.0 s | 72 |
    | `pushed` | the "ooh", belonging to no host | as `easy` to 1.0 s; then over 3.0 s up 60 cents (to 227.76 Hz) and 6 dB; its centre leaves the band at 2.75 s (`takeContour('pushed', 57)`) | 4.0 s | 72 |
    | `push` | the "ooh", belonging to no host | A3, Push at 50 for 1.0 s, rising evenly to 85 by 3.0 s, falling back to 50 by 4.2 s, held to 5.5 s; 1.2 cents and 0.12 dB a step (`pushCents`, `pushDb`, `toy-push.ts:41-42`): at 85, +42 cents (225.40 Hz) and +4.2 dB; outside the band from 2.67 to 3.20 s | 5.5 s | 73 |
    | `start-air`, `start-catch`, `start-together` | synthesised starts on A3 | as 75: air first, band-passed noise 0.35 s with the tone rising under it from 0.25 s over 0.25 s; a catch, 0.15 s of silence, a 3 ms click, the tone at full level within 10 ms; together, the tone rising over 60 ms with no noise and no click | 1.6 s each | 75 |
    | `demo` | Tavi's "ooh" | A4 440.00 Hz, following the page's demo line exactly (`demoCents`, `lines.ts`): from 60 cents low (425.01 Hz) through the hand-set points (0.18 s, −38), (0.34, −52), (0.5, −22), (0.66, −38), (0.8, −10) to the centre at 0.9 s, smoothstep between them, then a 5.5 Hz wave of ±14 cents (436.46 to 443.57 Hz) grown in over 0.35 s. The voice's own vibrato is off for this sound, so the wave heard is the wave drawn, to the cent | 10.0 s | 76, 42 |
    | `pick` | Merc's "ooh", then Tavi's | A3 220.00 Hz for 1.0 s; 0.2 s apart; A4 440.00 Hz for 1.0 s: a Lower tap and a Higher tap | 2.2 s | 77 |
    | `listen` | Merc's and Tavi's "ooh", together | A3 220.00 and A4 440.00 Hz at once, 2.0 s: the model note before the hold, in both voices, so either singer has theirs | 2.0 s | 56, 77 |
    | `breathe` (a pause) | none | with b42, the Breathe phase: about 2 s from the end of `listen` (56) | 1.1 s | 56, 65 |
    | `hold` (a pause) | none | the viewer's 10 s: room tone only, the ring closing over it | 10.0 s | 44, 56, 63 |

    By the page's own rules, replayed by the run above: the `push` line is outside the band for
    0.53 s; and the demo's line, read as the checkpoint reads a take (every 16 ms; settled from the
    first moment it stays within 35 cents for 0.5 s), settles at about 0.7 s and is in the band for
    about 9.5 of its 10 s. Those two readouts are a replica's arithmetic, not the kit's reader
    (`kit/take.ts`), so no number from them is on screen or in a line: s10 shows a "settled" marker
    with no number. If the storyboard wants the readouts, the kit's own reader computes them first
    and they join this file | code and arithmetic | replayed in `python3 -I`; the mixer's pitches are
    measured in the sound round
81. **The bed and the silences.** A quiet open fifth on A, A2 110.00, E3 164.81 and A3 220.00 Hz,
    Lesson 2's pad in A (Lesson 4 film FACTS 69 has the same pad on D), only in the eight act
    transitions (`act1` to `act5`, `sing`, `recap`, `next`) and under the dressed pauses, `predict`,
    `hook`, `q0`, `predict2`, `q1` to `q4`, `feel` and `card` (MASTER-PLAN D9; playbook rule 12).
    It is silent under every line and every sound, and in `heard` (the listening beat after the
    easy take), `breathe`, `hold` and `rest`: the viewer holds the note alone after the model note,
    as the page's hold has nothing playing while it is open (WEB-SPEC, Toys 6), and `rest` is a care
    moment. Room tone runs under the whole film (PRODUCTION-PIPELINE § 3). The title and end stings
    are Lesson 1's chimes, an A major chord, which sits with the pad in A as it did in Lesson 1 |
    design; `tools/mix.py` in the sound round
82. **The cold open and the promise.** o1 is LESSON.md's Tavi line, word for word. b1 is the page's
    "Let's listen." with the predict's own words for the second take ("the same note ... with a
    harder and harder push of air"); b2 asks the page's predict aloud with its two choices, as
    Lesson 4's film asked its cold-open predict, over a 2.0 s hold (`predict`, inside CURIOSITY-
    MOMENTS § 3.2's 2 s). b3 is the reveal's first sentence and its third ("So pushing doesn't hold
    a note still: it moves it.", without "So"); its second, the reason (7, 8), is chapter 1's, and
    its fourth is the better idea's (b20). On screen, small:
    "Both lines are drawings of that rule, not recordings." (72). o2 is the hook (1), "But" before
    it, said by Tavi after the reveal, so it cannot give the predict away (CURIOSITY-MOMENTS § 1
    rule 4) and it picks up where Lesson 4's film ended ("Singers are told to "support" a long
    note." / "If that doesn't mean pushing, what keeps it steady?"). The page's kind line for a
    "steadier" guess is carried by Tavi herself: she guessed steadier, and her question names why it
    seemed right. b4 is the page's promise without "then fifteen if that felt easy", because the
    film's turn is one ten-second hold (87) | LESSON.md, Header and Cold open | carried
83. **The recall.** b5, then o3 and b6: Lesson 3's quick-check question 4, word for word, its
    correct answer and its feedback (3). The page also asks Lesson 3's question 3 (an A2, an octave
    lower and 20 cents high); the film leaves it on the page, as Lesson 4's film carried one of its
    page's two recall questions (Lesson 4 film DECISIONS 3). Question 4 is the one this lesson
    builds on: a quiet note is the right note, and loud and high are different things, which
    chapter 1 then complicates. The four words (LESSON.md, "Four words you'll meet") are on screen
    only, at the end of s04, each defined in its own chapter: air pressure in b7, diaphragm in b11,
    onset in b24, "support" in b19 | LESSON.md, Recall and Four words | carried
84. **Chapter 1's own lines.** o4 is Step 1's heading put as Tavi's question about what she has just
    heard. b8 brings in `push` and claims nothing; it opens on "Listen" so it never reads as a cue
    to sing (Lesson 4 film FACTS 80). o5 is her doubt from Lesson 1 (13), which b9 answers in Step
    1's words. The page's Notice, "Keep Push still, and so does the line.", is not voiced: over a
    film it would read as "steady air holds a note still", which 10 rules out. The picture shows the
    toy's line returning as the slider returns, which is the toy's rule (73) | LESSON.md, Step 1 |
    carried
85. **Chapter 2's own lines.** o6 is Step 2's heading with her sincere guess, that the diaphragm is
    the muscle that pushes, which b11 answers in Step 2's and the four words' words (14, 15). b12
    is Step 2's predict; its choices are the page's. The page's kind line after the reveal, "If you
    said push: full lungs already push.", is carried by o7, the page's own Tavi line. b16 is the
    Notice's last sentence (19); the gauge's labels carry the rest of it. o8 is the mix-up card's
    belief as her question; b17 is "That's a common mix-up." and the card's first piece of evidence,
    said as what the viewer heard in the cold open and chapter 1 (7, 8). b18, b19 and b20 are the
    card's second piece of evidence, the four words' "Support" and the card's better idea, word for
    word | LESSON.md, Step 2 and Four words | carried
86. **Chapter 5: Tavi's hold.** b29 asks Tavi to hold an A for ten seconds; `demo` is the page's hold
    demo (76) sung by her, an octave up, in her octave (MERC-BIBLE § 2: she sings back an octave
    higher), against Merc's band at "A, any octave" (43). o11 is Step 5's heading with her guess, a
    perfectly straight line (quiz question 4's second answer); o12, after her hold, asks about what
    her own line did (41, 42), and b30 and b31 answer it in Step 5's words. Step 5's
    Notice is on screen as the slowed first second ("scoop", "small vibrato: inside the band"), not
    voiced. o13 answers the hook in one place, in the page's words: the better idea's "a steady note
    needs steady air, not more of it" (10) and its cues (32), with "let it settle" for Step 5's
    "settles into the band and stays". It says "needs", never that steady air is what keeps a note
    still: muscles in the voice box set the pitch (L3 FACTS 23; L5 FACTS 10). b33, "That's it.",
    agrees with that sentence and no more | LESSON.md, Steps 2 and 5 | carried; the contour is the
    page's by construction (80)
87. **The viewer's turn.** b34 states the task, one comfortable note for ten seconds (44, 63). b35,
    b36 and b37 are Lesson 3's care line, comfort line and comfort check, word for word (47 to 49).
    b38 is the page's two buttons in Merc's voice ("with me"), after "Otherwise, choose a voice",
    the short form LESSON.md offers ("Choose a voice:"). b39 is the page's hold briefing, with "Listen
    to Merc's note" as "Listen to our note", because both hosts sing it (`listen`), so a singer who
    chose Tavi hears her A. b40 and b41 are the page's, word for word. b42 and `breathe` are the
    Breathe phase, about 2 s from the note's end, and `hold` follows at once, so nobody waits
    holding a breath (56, 65). `hold` is 10.0 s, the first hold (44, 63), the ring closing over it.
    Nothing listens: the film has no microphone, draws no line for the viewer and gives no reading
    (45; the page's reader is the page's, 56 and 57). The fifteen-second hold, Again and the cap of
    three tries stay on the page, because a film cannot ask how the first hold felt before offering
    more (52). b43 asks "How did that feel?" with the four answers as the page labels them today;
    b44, b45 and b46 give each answer's line as the page words it ("Rest for a few easy breaths.";
    "Keep it gentle: rest before you sing again."; "Thanks for saying so. That's enough singing for
    today: rest your voice."). The doctor lines (51) are on screen, word for word with their
    parentheses, in small type from b35 to the end of `rest`, at full size from b46 through `rest`
    (2.5 s), all above the caption band; they are also in the YouTube description, as Lesson 4's
    were | LESSON.md, Sing it; Lesson 4 film FACTS 83 | carried
88. **The recap.** The page's quick check, its four questions asked open (no choices on screen),
    each answered with its correct answer: question 1, b48 and b49 ("Breathing in", with its
    feedback's "It can't push air out"); question 2, Tavi's o14 and b50; question 3, b51 and b52
    ("Air and sound starting together", with its feedback's "the easy start"); question 4, b53 and
    b54 | LESSON.md, Quick check | carried
89. **The practise card and the rest card.** On screen, the page's two cards word for word: the Voice
    Mirror card (LESSON.md, Wrap, Practise it, its first bullet) with "Ten minutes, gently, most
    days. Missed a day? Just come back." under it, and the rest card, "Rest today" over "Voice
    Mirror will be here when your voice feels comfortable: mercurypitch.com/mirror", without it
    (54). A film cannot know which ending a viewer had, so it shows both, side by side, where the page
    picks one. The voice: b55 is the card's second sentence after "Practise it in Voice Mirror."
    ("For its hold", since the voice has not listed the tasks; the card on screen lists them, 59);
    b56 is the card's "Keep the glides comfortable." ("its glides") and its address line (58, 60);
    b57 word for word; b58 the rest card, for a viewer who listened along or felt uncomfortable.
    The card's own "Sore, hoarse or unwell today? Just listen along." is on screen; the film voiced
    it at b36, before the turn, where the page's Step 3 and Sing it place it (48). No skip line: Voice
    Mirror is its own document (61). The YouTube description's link carries `?lesson=05`
    (LESSON.md, Footer) | LESSON.md, Wrap | carried
90. **Next time.** b59; b60 is the tease line, "Merc moves every single note of 'Twinkle, Twinkle'
    up.", in Merc's voice as "I move ..."; on screen as the line is written. o15 is Lesson 6's hook,
    word for word (4; L6 FACTS 1). The figure is CURIOSITY-MOMENTS § 2's for Lesson 5: seven beads on
    faint semitone rows, the first line of "Twinkle, Twinkle" (L6 FACTS 20) unnamed, and a dashed
    copy six rows up with a "?" (L6 FACTS 36). The tune is not played, so the tease gives the set-up
    and never its answer (CURIOSITY-MOMENTS § 1 rule 6) | CURIOSITY-MOMENTS § 2; LESSON.md, Wrap |
    carried

## 3. The vocal coach's lines

Every film line that carries a voice line or exercise on LESSON.md's list for the coach ("For the
vocal coach and the owner", and "Changed in the plain-language review"), marked `[coach]` in
`script.json`, word for word as the film says it. The coach signs off the film's script at the day-1
gate and the film at the day-6 gate, as the page (MASTER-PLAN § 7; § 12 item 8).

| Line | Word for word | The lesson's item |
| ---- | ------------- | ----------------- |
| `pushed` | (a voice pushed louder and higher, 4.0 s, 80) | "The cold open's pushed note and Step 1's Push toy: a voice pushed louder and higher, for listening only." |
| b7 | "How hard your breath pushes on your vocal folds is its pressure. It mainly sets how loud the note is, and it nudges the pitch." | Plain-language review, Step 1 |
| `push` | (a held note pushed up and back, 5.5 s, 80) | As `pushed`: "for listening only" |
| b13 | "Hold it back, with your breathing muscles, never your throat." | "Step 2's reveal and the Wrap: holding back "with your breathing muscles, never your throat"." |
| b14 | "Full lungs spring back by themselves, often harder than a quiet note needs. So at first your breathing-in muscles keep working, holding some of that push back." | Plain-language review, Step 2's reveal |
| b15 | "As the air goes, your belly and rib muscles take over the pushing." | Plain-language review, Step 2's reveal |
| b16 | "Yes. And a loud note needs less holding back." | Plain-language review, Step 2's Notice |
| b18 | "Squeezing your throat makes a pressed sound, the sound people make lifting something heavy, and a pressed sound needs more air pressure, not less." | Plain-language review, the mix-up card's evidence |
| b19 | ""Support" is singers' word for how they manage the breath as they sing. There's no one agreed meaning." | Plain-language review, the four words, Support |
| b21 | "Start tall but easy. If you're standing, keep your knees unlocked. Let your jaw, tongue and neck go loose. That's where singing teachers usually begin." | "Step 3's cues: tall but easy, knees unlocked, jaw, tongue and neck loose"; plain-language review, Step 3's cues |
| b22 | "Then breathe in quietly, and let the breath drop low, shoulders still, taking as much as feels easy." | "a low, quiet breath with the shoulders still, taking as much as feels easy ... NIDCD's care page says "deep breaths from the chest" (FACTS 27), so the breathing cue is the coach's call." |
| b24 | "A voice has three main ways to start a note: its onset. Just listen to these." | "Step 4: the page plays a catch and an air-first start for listening only and never asks for a catch" |
| b26, `start-catch` | "A catch: the vocal folds are pressed shut, and the note starts as they open, a little like a cough." | As b24 |
| b28 | "For a long, easy note, many singing teachers aim for the third, the easy start. It's often found by beginning with a soft "h", then keeping it only in your mind." | Step 4, "the "h" in mind"; plain-language review, Step 4 |
| b31 | "And steady doesn't mean dead straight: a small vibrato, a regular wave in the pitch, can sit inside the band." | Plain-language review, Step 5 ("dead straight") |
| b32 | "Steady means the line settles into the band and stays, for a comfortable, fixed length: five, ten or fifteen seconds, never "as long as you can"." | The holds' lengths; the owner's decision of 19 October 2026 |
| b34 | "Your turn: one comfortable note, held for ten seconds." | "The holds: ten seconds, then fifteen only after "Easy" or "Workable"" (the film offers the ten only, 87) |
| b35 | "Lesson 3's care lines still apply: stop if your voice feels scratchy or hoarse." | "Step 3's care line, which points back to Lesson 3's four (FACTS 47 to 49)" |
| b36 | "Sore, hoarse or unwell today? Just listen along." | "The comfort check and the comfort line, Lesson 3's current text" |
| b37 | "Choose listening if anything hurts or singing has felt uncomfortable, if your voice feels unusually hoarse or tired, if notes you usually reach have suddenly gone, if you're ill, or if talking or singing feels like hard work today." | As b36 |
| b38 | "Otherwise, choose a voice. Lower: sing with me, around A three. Higher: sing with Tavi, around A four." | The holds, "A3 or A4" (the film offers no move of four semitones, 87); plain-language review, the voice line ("Choose a voice:" is its short form) |
| b39 | "It goes listen, breathe, sing. Listen to our note. Breathe in, low and quiet. Then sing straight away, easily, at about speaking volume." | The holds: "Listen · Breathe · Sing, with the take open from the in-breath so nobody waits holding their breath; at speaking volume"; plain-language review, the hold briefing |
| b40 | "Hold the note until the ring closes, or stop sooner if you need to." | The holds, "the stop-early line" |
| b41 | "Stop immediately if anything feels uncomfortable." | "The stop line, "Stop immediately if anything feels uncomfortable."" |
| `listen`, b42, `breathe`, `hold` | (both hosts' A, 2.0 s; "Breathe in."; 10.0 s) | The holds: "Merc's two-second note"; the ten seconds |
| b43 | "How did that feel? Easy, workable, effortful, or uncomfortable?" | "The answers to "How did that feel?" (FACTS 52)"; and the proposed labels [ Easy ] [ OK ] [ Hard work ] [ Uncomfortable ] ("Proposed, not applied") |
| b44 | "Easy or workable? Rest for a few easy breaths." | As b43; "a rest the singer ends" |
| b45 | "Effortful? Keep it gentle: rest before you sing again." | As b43: "After "Effortful" the page shows the reading and no more holds" |
| b46 | "Uncomfortable? Thanks for saying so. That's enough singing for today: rest your voice." | As b43 |
| `rest` and the care block | The doctor lines, on screen: "If hoarseness or discomfort lasts more than a couple of weeks, see a doctor (a GP or an ear, nose and throat specialist). If it's very painful, or breathing or swallowing is hard, get help straight away." | "Lesson 3's doctor lines: a couple of weeks ..., "a doctor (a GP or an ear, nose and throat specialist)", and the urgent signs" |
| b55 | "Practise it in Voice Mirror. For its hold, it shows in cents how fast the note drifted and how much it wobbled, and a vibrato isn't counted against you." | "the two practice cards: Voice Mirror's six-second hold (not one of the house lengths of 5, 10 or 15 seconds) and its two glides" (the six seconds are on the card on screen) |
| b56 | "Keep its glides comfortable. Free, no account: mercurypitch.com/mirror." | As b55, "its two glides" |
| b57 | "Ten minutes, gently, most days. Missed a day? Just come back." | The practice card |
| b58 | "If you listened along today, or it felt uncomfortable: rest today. Voice Mirror will be here when your voice feels comfortable." | "the rest card after "Uncomfortable" or "Just listen today"" |

Not in the film, so not on this list: Step 3's five-second "sss" (its Try stays on the page), the
"hoo" to "oo" exercise, the warm-up, the fifteen-second hold, the move of up to four semitones,
"Done for today", the three-try cap and the proposed Long Note link (DECISIONS 12, 16, 23 and
30).

## 4. Illustrations without claims

- The two takes and the Push note are drawings of the rule in 7 and 8, sized to be seen (72, 73),
  voiced by nobody: no host sings a pushed note. The chart carries "Illustration" while they show,
  and the reveal adds "Both lines are drawings of that rule, not recordings." (72).
- Tavi's hold is the page's hand-set demo line (76), sung on the line it draws (80). It is an
  illustration of a steady note, not a measurement of a voice, and it never reads out a number.
- The breath figure is a schematic side view, not anatomy to scale: its dome flattens and its belly
  moves out as 14 and 29 say. The gauge is drawn after Sundberg's Fig. 4 with no numbers, its side
  axis "push of air (not pitch)" (20, 74); it makes no sound.
- The three starts are synthesised (75) beside Lesson 3's schematic folds; the catch is tagged
  "listen only".
- On every band chart Merc's line is drawn steady at the band's centre, though his "ooh" carries a
  vibrato (42); a singer's violet line shows its wave.
- Gold marks two things only, the series' colour for the fit: the gauge's "what the note needs"
  line and the "together" start's tick (as the page). Tavi's guesses are dashed ink-2 with a "?"
  (MASTER-PLAN § 5).
- The viewer's turn draws no line and reads nothing: the chrome playhead is a clock, not a
  listener.
- The tease's beads and their dashed copy are a drawing of Lesson 6's set-up; the tune is not
  played.

## 5. Left out: no support found, or not the film's to say

- "Steady air is what holds a note still", "keep the push still and the note stays still", and any
  version of the hook's answer that says what *keeps* a note steady: no source read shows it (L5
  FACTS 10 and its Unverified list; L3 FACTS 23). The film says a steady note *needs* steady air.
- "A low breath, or support, makes a note steadier", and any benefit of the breathing cues: no
  study read shows it (Unverified; VF 2026: "empirical data were lacking"). The cues are
  instructions only (32).
- "Pushing, or a hard start, harms the voice", and any health or injury claim: out of bounds
  (TEACHING-PLAYBOOK house rules), so the catch is "listen only" and nothing more.
- A synthesised pressed voice for b18: no source gives a model of one to synthesise, so the film
  plays none.
- A number on Tavi's hold ("settled after 0.7 seconds", "9.5 of 10"): a replica's arithmetic, not
  the kit's reader (80); left out until the kit computes it.
- How often notes scoop, how long a beginner's note takes to settle, how common a vibrato is:
  not read (L5 FACTS, Unverified). The film says "can" and "small".
- "Inspiratory checking", the name for holding back: in the lesson's facts (23) and its Go deeper,
  but its source is about speech in adults with a voice disorder, and the film has no Go deeper;
  the film describes the holding back without the name.
- The Go deeper's three studies (six baritones; belly in, belly out; four singers' diaphragms):
  supported (16, 30, 31, 21), left on the page for length. Their one point the film needs, that
  singers breathe in different ways, is b23.
- That the film or the app hears, checks or scores the viewer's hold: the film has no microphone
  (87).
- Lesson 3's recall question 3 (A2, 20 cents high): supported (3), left on the page (83).
- Long Note, its slug, and the Ascent's "Breath & Power" week: not linked (62, 66, 68).
