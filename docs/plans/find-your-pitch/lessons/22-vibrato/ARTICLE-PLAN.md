# Article plan: Lesson 22, Vibrato

Voice lesson (S19). Needs Lesson 14 (and Lesson 5 through it). The plan for LESSON.md, in Season 1's
section order; facts point at [RESEARCH.md](RESEARCH.md) as R-numbers. Planned on SEASON-2 § 7's
recommended answers. A voice lesson: the vocal coach signs off every line marked **[coach]**, and
the whole page at the script and publish gates. Words are learner-visible copy, budgeted to land
near 1,300 (Season 1's practice; cap 2,379).

## Header

- Kicker: FIND YOUR PITCH · SEASON 2 · LESSON 22
- Title (hook): **If a singer's held note swings up and down six times a second, why do we still
  hear one note?** It names the puzzle, not which note is heard.
- Meta chips: about 15 minutes (set from the lab's timed run) · After Lesson 14: Phrasing · Sound on
- Promise: "By the end you'll know what a vibrato's rate and extent measure, which note a listener
  hears, and how to read what the app says about yours." Checked against the predict: it does not
  say "the middle".
- Words: 70.

## Sound gate

"This lesson is about a held note that waves. Tap to turn sound on: nothing plays until you press a
play button." 25 words.

## Cold open: predict

- What plays first: Merc holds A3 (Tavi's version A4, by the stored voice) for 3 s with a vibrato
  of 6 waves a second, ±50 cents, grown in over 0.3 s, synthesised with the demo voice's vibrato
  parameter (R18; `demo-voice.ts:33-37`). The pitch line draws it on Lesson 5's band: the wave
  crosses both edges of the ±35-cent band; nothing marks a centre yet.
- Tavi's sincere guess: "It swings that far out of the band. Isn't it out of tune half the time?"
- Merc: "Listen, then match it."
- **Predict before you listen.** "Merc's note swings 50 cents up and 50 cents down, six times a
  second. Which steady note sounds the same as it?" [ The top of the swing ] [ The middle of the
  swing ]
- After a choice: Play the wavy note, then Play steady: top (A3 + 50 cents, 226.45 Hz) and Play
  steady: middle (A3, 220 Hz), both without vibrato. The reveal waits until both have been heard.
- Reveal: "The middle. Listeners match a long, even vibrato to a steady note near the middle of its
  swing (R5). The wave is real, but the note you hear is its centre. (The top is where the line
  reaches furthest, which made it a fair guess.)" A centre line draws itself through the wave.
- Facts: R5, R20, R18. Words: 150.
- Not in any title, tease, promise or share line: "middle", "centre", "average".

## Recall from Lesson 14 (and Lesson 5)

Asked afresh, for everyone (S19 needs S17, Lesson 14, and S06, Lesson 5; SEASON-2 § 4.1).

1. Lesson 14, quick check 3, word for word: "On a swell, a note grows louder, then softer. What
   should its line do?" Stay level, in its band [correct] · Rise as it grows, then fall · Drop below
   the band as it fades. Feedback as Lesson 14, with "Try Lesson 14, Step 3 again".
2. Lesson 5, quick check 4, word for word: "What does a steady long note look like on the pitch
   line?" It settles into the band and stays there [correct] · A perfectly straight line, with no
   movement at all · The longest line you can make on one breath. Feedback as Lesson 5 ("It can
   wave a little and still stay in the band."), with "Try Lesson 5, Step 5 again".

Question 2 is the bridge: Lesson 5 called a vibrato a small wave inside the band; this lesson
widens it.

## Four words you'll meet

- **Vibrato**: a regular wave in a held note's pitch, up and down, several times a second. [Play:
  A3 with a vibrato] (R1)
- **Rate**: how many waves a second. [Play: 5 a second, then 7] (R1)
- **Extent**: how far the pitch swings either side of its centre, in cents, written with ±. [Play:
  ±20 cents, then ±60] (R1, R15)
- **Straight tone**: a held note with no wave. [Play: A3 straight]
- Words: 80.

## Step 1 of 4: What makes a held note wave?

- Point: sound first. A straight note and the same note with a vibrato, then the pitch line, zoomed
  in time, shows the difference: the line itself waves, regularly, up and down around one height.
  That regular wave in pitch is a vibrato (R1). It is not a change in loudness (Lesson 14's swell
  changes loudness; playbook rule 20: pitch is height).
- Examples: A3 straight, 3 s; A3 at 6 a second, ±40 cents, 3 s. Higher voice: A4.
- Toy (the signature, first state): Lesson 5's steady-note band, its time axis stretching until the
  wave shows.
- Try: play the straight note, then the wavy one; drag the zoom. Notice: the wave goes up and down
  the same distance each time.
- Facts: R1. Words: 120.

## Step 2 of 4: How fast, and how far?

- Point: a vibrato has two numbers. Rate: count the waves in a second. Extent: measure from the
  centre to the top of a wave, in cents. Measured trained singers sit at about 5 to 8 waves a second,
  and usually less than a semitone (100 cents) either side (R3); measured averages sit near six a
  second (R4). Voice Mirror writes the extent the same way, with ± (R15).
- Examples, all on A3 (A4): 5 a second, ±25; 7 a second, ±25; 6 a second, ±60. Then Merc's own
  "ooh" from earlier lessons: 5.5 a second, ±14, small enough to stay inside Lesson 5's band (R18).
- Toy: the counter ticks once per wave (rate); a ruler measures centre to peak (extent); two
  sliders, rate 4 to 8 and extent ±10 to ±80, with the sound following.
- Try: set 6 a second and ±30, then double the extent. Notice: the counter does not change when the
  wave widens; rate and extent are separate.
- Facts: R1, R3, R4, R15, R18. Words: 150.

## Step 3 of 4: If it swings, why do we hear one note?

- Predict (written out): "Merc slows the same wave down to two waves a second. What do you hear?"
  [ Still one note ] [ A note that moves up and down ]. Reveal: "A note that moves. Slow enough,
  and the ear follows the pitch up and down; at singers' usual speeds it hears one note (R7). (At six
  a second you heard one note, which made 'still one note' a fair guess.)"
- Examples: A3 ±50 cents at 2 a second, then at 6 a second.
- Tavi: "So the wave isn't out of tune?" (a re-explanation in her words follows the card).
- Common mix-up card (rule 3):
  - Belief: "A wobbling note is out of tune."
  - Why it seems right: the line leaves the band on every wave.
  - The evidence: listeners match an even vibrato to the middle of its swing (R5), and in one
    experiment they judged vibrato notes as accurately as straight ones (R6).
  - The better idea: the centre is the note. If the centre drifts, the note drifts, Lesson 5's band
    again; the wave around a steady centre does not.
- Toy: rate slider 2 to 7 a second; the centre line stays drawn; a "drift" switch slides the centre
  20 cents up over 3 s so the learner hears the difference between a wave and a drift.
- Go deeper: "Which middle? Shonle and Horan found the heard pitch close to the geometric mean of
  the two extremes. For a ±50-cent wave on A3 that is 220 Hz exactly; the plain average is 0.7 cents
  higher, too close to hear (R5, R20)."
- Facts: R5, R6, R7, R20. Words: 230.

## Step 4 of 4: Does a singer need one?

- Point: no. Styles differ: some choirs ask for a minimal vibrato or a straight tone, soloists often
  sing with one, and studies show singers can change theirs to fit a group (R11). This lesson asks
  for none and scores none. A straight note is a finished answer.
- Then reading the app. Voice Mirror's hold names a vibrato it finds, between 3.5 and 8.5 waves a
  second and at least 10 cents wide, as "a feature, not scored against you", and keeps it out of the
  wobble number (R15). The app's own drawing of a vibrato note, the ribbon on a piano roll, is a
  mark: its waves follow the note's width, not a singer's rate (R16). Shown side by side, labelled
  "measured" and "mark".
- Examples: a measured 5.5 a second, ±30 trace beside a ribbon drawn for a 2-second note.
- Toy: the signature's last state, the ribbon appearing beside the measured wave, labelled as a
  mark.
- Words: 170. Every sentence of this step is **[coach]**.

## Sing it (scored on the page)

- Comfort check, word for word as Lessons 3, 5, 10 and 12 ("Sore, hoarse or unwell today? Just
  listen along." with its six conditions, the two buttons). "Just listen today": Lesson 5's line
  with "two holds, one straight and one that floats". **[coach]**
- Voice choice: Lesson 3's two buttons and stored choice.
- Headphones: not needed (nothing plays during a take).
- Hold 1: "Hold a comfortable note for 10 seconds, straight, as in Lesson 5." Merc gives the note
  first (A3 or A4, Move note as Lesson 5). **[coach]**
- Hold 2: "Now hold it again for 10 seconds. Let the note float. If a wave comes, let it; if it
  doesn't, the note is just as finished." (card wording) **[coach]**
- Stop line: "Stop immediately if anything feels uncomfortable." **[coach]**
- What it scores: the centre staying in the band, for both holds; a vibrato counts in full; nothing
  scores a vibrato's presence, rate or extent. Any octave counts.
- What it says: Lesson 5's time-in-band reading of the centre line; then, only if a vibrato is
  found, a description of the sound, never of the singer: "A wave about 5.5 times a second, about 30
  cents either side of its centre." (the ± form Voice Mirror uses; real measured values). No line
  for its absence. **[coach]**
- How did that feel? Lesson 3's four answers and endings, the rest card after Effortful.
- Works today, and what waits: the kit's hold reader (`kit/hold-take.ts:13-25`) scores every frame
  against ±35 cents, so it would mark a wide vibrato as partly outside (R17). Until a centre-line
  reading exists (remove the fitted wave as Voice Mirror's steadiness does, `metrics.ts:499-509`;
  code with tests, not yet in SEASON-2 § 5), the page either (a) ships with today's reader and
  Hold 2's line drops "counts in full", or (b) waits. Recommended: (b), a small kit item; the
  vibrato description also needs the vibrato view (SEASON-2 § 6.2 item 6).
- Words: 260 (shared lines included).

## Quick check

Three answers each, shuffled.

1. "A singer's held note waves up and down six times a second. What does 'six times a second'
   measure?"
   - Its rate **[correct]** · "Rate counts the waves in a second; extent measures how far each one
     swings."
   - Its extent · "Extent is how far the pitch swings either side of the centre, in cents. Try Step
     2 again."
   - How loud it is · "A vibrato is a wave in pitch, not in loudness: the line moves up and down."
2. "A long note waves evenly 50 cents up and 50 cents down. Which steady note sounds the same?"
   - The middle of the swing **[correct]** · "Listeners match an even vibrato to the middle of its
     swing."
   - The top of the swing · "The top is where the line reaches furthest, but the ear hears the
     middle. Try Step 3 again."
   - The bottom of the swing · "Listeners match it to the middle, between the top and the bottom."
3. "Listen. [Play] Is this one note with a vibrato, or a note moving up and down?" (A3 ±50 at 2 a
   second.)
   - A note moving up and down **[correct]** · "At two waves a second the ear follows the pitch;
     at singers' usual speeds it hears one note."
   - One note with a vibrato · "This wave is slow, two a second, so the pitch is heard moving. Try
     Step 3 again."
   - A straight note · "The line goes up and down: listen for the pitch rising and falling."
4. "A friend says: 'A held note without a vibrato isn't finished.' What does this lesson say?"
   - Both are used in singing, and a straight note is finished **[correct]** · "Styles differ, and
     singers can change their vibrato to fit."
   - They're right: every finished note needs a vibrato · "Some choirs ask for a minimal vibrato or
     a straight tone. Try Step 4 again."
   - A vibrato puts a note out of tune · "Listeners hear an even vibrato at its centre: it's in tune
     if its centre is."
- Words: 260.

## Wrap

- Three lines: a vibrato is a regular wave in pitch, measured by its rate and its extent; we hear
  one note at the middle of the swing, as long as the wave is quick enough; straight and vibrato are
  both finished notes, and the app scores neither.
- One-sentence challenge: "Explain to a friend, in one sentence, why a note that swings 50 cents
  either way can still be in tune."
- Practise it: Voice Mirror's hold (below). Next lesson card and tease (below). Words: 120.

## Practise links (verified at `b803c7d43`)

- **Linked: Voice Mirror's hold**, `/mirror?lesson=22`. Its hold records 6 s (Lesson 5 FACTS 59)
  and, when it finds a vibrato between 3.5 and 8.5 a second and at least ±10 cents, shows "Vibrato
  N Hz, ±N cents. That's a feature, not scored against you." and keeps it out of the wobble
  (`MirrorApp.tsx:2194-2199`; `metrics.ts:72-74`, :499-509). Card text: Lesson 5's Voice Mirror card,
  plus "If your hold has a vibrato, it tells you its rate and extent, and doesn't count it against
  you." **[coach]**
- **Missing:** `?lesson=22` is not read (`lesson-marker.ts:11-19`; SEASON-2 § 5 item 21), so First
  Light does not step aside until item 21 ships; the card then needs Lesson 1's first-visit line.
- **Not linked:** the Vibrato exercise (health word, method claim, "the polished sound" default,
  scores the vibrato itself; `exercise-help.ts:96-97`, `vibrato-styles.ts:56-57`, :71,
  `use-vibrato-controller.ts:12-14`) until SEASON-2 § 5 item 14 and the coach's call; Long Note
  Lantern ("a vibrato counts as a wobble", `exercise-help.ts:43`) and Long Note (stability counts the
  spread of all cents, vibrato included, Lesson 5 FACTS 64).
- Gap: no practice exists that neither scores a vibrato nor rewards a straight tone, other than
  Voice Mirror's report (SEASON-2 § 5.3).

## Go deeper

- Which middle: the geometric mean (Step 3).
- A wave glues sounds together: Chowning's cluster becomes "three voices singing a chord" (R
  interesting finding 2; Sundberg 1994, pp. 60-61).
- The wave speeds up at a note's end, in ten recordings of one aria (R8).
- Measured averages: 29 recorded artists averaged 6.6 waves a second (R4).

## Closing tease and next card

- Tease (about 70 characters): "One note, swinging. Now hold two together: one pair wants to move."
- Next hook, word for word: Lesson 23's, "Which interval splits the octave exactly in half, and why
  does it want to move?"
- Checked: neither names the tritone, six semitones or fa and ti.

## Footer

Season 2 · Lesson 22 · Vibrato. The practice links, printed mercurypitch.com/mirror, with "Voice Mirror is free." Lesson 1's fonts line, and "Every sound on this page is synthesised in your browser." Whether each linked room is free is checked against the app before publishing, as Season 1 did.

## For the vocal coach (lines to sign off)

Every line marked **[coach]** above, and: the hold note and Move note range (Lesson 5's); the two
10 s holds and their order (straight first); Hold 2's "Let the note float. If a wave comes, let it;
if it doesn't, the note is just as finished."; the vibrato description's wording and that nothing is
said when none is found; that the page gives no instruction for making a vibrato; Step 4's style
lines; the Voice Mirror card's added line; whether a theory line from R13 (how a vibrato is made,
or that it appears with classical training) is ever wanted, which this plan leaves out; and whether
the lesson should ever link a drill that scores the vibrato itself (SEASON-2 § 5 item 14).

## Depends on decision N

- Decision 10 (who sings): the examples are synthesised Merc and Tavi "ooh"s with set rate and
  extent. A sung cast would need takes with measured rates, or the examples stay synthesised.
- Decision 1 (numbering): the kicker and `?lesson=22` assume global numbers.
- Decision 5 (Season 1 assumed): the recall asks Lessons 14 and 5.

## Open questions

1. The centre-line hold reader (Sing it): add it to SEASON-2 § 5 as a kit item, or ship with
   today's reader and reword Hold 2?
2. Does the ±50-cent cold open sit badly with Lesson 5's "a small vibrato can sit inside the band"?
   This plan uses the crossing as the lesson's point; a ±30 example would stay inside.
3. Should the page report a measured extent wider than ±35 cents differently, given the band?
4. Lesson 24 will ask for straight notes against the drone, because a vibrato hides beats (R
   interesting finding 3). Should this lesson's wrap say so, or leave it to Lesson 24?
