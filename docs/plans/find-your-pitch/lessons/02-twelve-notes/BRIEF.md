---
workflow: motion-designer
flow: automation
storyboard: no
renders: ask
unattended: false
message: 'Between the seven letters sit five more notes: twelve equal semitones make an octave, each a hundred cents, and one key can carry two names.'
audience: 'Adult and teen beginners who sing or want to, with no theory beyond Lesson 1 (what a note is, the octave, the pitch spiral); YouTube viewers who like Veritasium and 3Blue1Brown'
destination: youtube, landing-page
aspect: 1920x1080
sizes: 1920x1080
length: about 6m36s (estimated at 2.6 words a second; cues.json total once voiced)
fps: 60
language: en-GB
project_dir: output/motion/lesson-02
---

# Brief

## Intent

- What the video is for: Lesson 2 of "Find Your Pitch", MercuryPitch's music theory and singing
  series, and its second theory lesson (topics T03, twelve notes, and T04, cents). It answers the
  question Lesson 1's film ends on and embeds in the Lesson 2 web page.
- Who is watching: beginners who have seen Lesson 1 or know what an octave is, many of whom think
  the black keys are a mystery, or that they "can't sing". They want to understand, not memorise
  jargon. Most watch with the sound on (this is about hearing small steps), but the picture must
  still carry every idea with the sound off and captions on.
- What they should do at the end: answer the recap in their head, then practise telling a
  semitone from a tone in MercuryPitch's Ear Lab. On screen: "Practise it free:
  mercurypitch.com/ear-lab", with "Leap · m2 = semitone · M2 = tone". Next-episode tease: Lesson
  3's hook, ending on orange's "So what's going on?"

## Teaching

### Objectives (CURRICULUM § 2.1, Lesson 2)

1. Find the twelve notes on a keyboard and on the spiral.
2. Tell a semitone from a whole tone by ear.
3. Know why one key has two names (C sharp, D flat).
4. Know that a semitone is 100 cents, the unit MercuryPitch measures in.

### Hook

The cold open re-asks the question Lesson 1's film closes on, after a warm-up retrieval from Lesson
1 (playbook rule 18): blue "Seven letters, but twelve notes." Orange: "Then where do the other five
come from?" (done by about 0:28; rule 1). The web page's title is the curriculum's wording:
"Musicians only use seven letters, so where do the other five notes come from?" YouTube title
variants for Test & Compare (MASTER-PLAN § 4.1): "Seven letters, but twelve notes: where do the
other five come from?" (67 characters); "Why are there 12 notes but only 7 letters?" (42);
search-style, "Semitones, sharps and flats, explained for singers" (50).

### Length target

About 6:30 (6:00 to 7:00); the estimate is 6:36. Reason: T03 alone carries five ideas (semitones,
tones, the keyboard, sharps and flats, two names), T04 adds cents, and the film refutes two
misconceptions with a predict, then ends on a sung checkpoint and a four-beat recap. That sits
inside the series' 6 to 9 minutes (MASTER-PLAN D6), near the MOOC engagement median of about 6
minutes, and about a minute and a half longer than Lesson 1 (4:57), which had one refutation and a
single sung gap. Nothing is cut to hit a number: each act is one idea (rule 8).

### Misconceptions (orange voices them sincerely; a demonstration breaks them)

1. "Black keys are sharps and white keys are naturals" (o6, "So black keys are the sharps and
   flats, and white keys are the plain ones?"). Broken by: a sharp is a direction, not a colour;
   one semitone up from E is F, a white key, so E sharp is F; and one black key carries two names.
2. "B to C must be a bigger step, since there's no black key between them" (o5, "No black key to
   step on? Then B to C must be a bigger jump than C to D."). Broken by: a predict, then the sound
   (B to C is the same step as C to the black key above it, and half of C to D), then the picture
   (the keyboard drawn with every key the same width). Every neighbouring key, white or black, is
   one semitone.
3. The cold-open guess, the spiral form of misconception 1: the five dim beads are "just gaps"
   (o1). Broken by ear in the first act: the bead after A plays a note.

### Signature object and its transformation

Lesson 1's pitch spiral (three turns, A2 to A5, 30 degrees per semitone, the seven letters at their
true angles, five dim beads on every turn). The five beads light up one by one as twelve steps
climb A3 to A4; seen from straight above, the turn is a ring of twelve equal beads. The spiral then
unrolls into the keyboard, as in Lesson 1, but now with all twelve keys of every octave lit. The
keyboard straightens into a row of equal tiles, one semitone each; the row stands up into a ruler
of cents, a hundred to each semitone and twelve hundred to the octave; and the ruler's lanes
become MercuryPitch's pitch canvas, where Merc sings the semitone. Twelve equal steps make an
octave, on every object.

### Three signature moments

1. **The ring of twelve.** As the climb plays, the five dim beads on the lit turn light up one by
   one, the count reaches twelve just as A comes back one turn up, and then we look straight down
   the spiral: the turn is a ring of twelve beads, evenly spaced like the hours on a clock.
2. **The keyboard drawn fair.** Every key slides into one row at the same width, and B and C turn
   out to touch, as close as C and its black key. Then the five dark tiles lift out, leaving the
   seven letters with five holes a note wide and two touching pairs, B and C, E and F; the five
   drop back into their holes: that is where the other five come from.
3. **One key, two names.** An arrow climbs one semitone from C and writes C♯ on the black key;
   another steps one semitone down from D and writes D♭ on the very same key; both names stay, side
   by side, under one gold ring.

### Checkpoint (sung)

Slide up one semitone from a held note, and back. Blue holds A3, slides to A#3 and comes back;
the viewer does the same on a hum or "ooh", from Merc's A or the A an octave up (every voice type
the app knows has one of them in its comfortable range, FACTS 38); orange then sings it an octave
higher and asks how to know it was exactly one semitone. Nothing listens in the film; "Keep it
gentle. Never push." A one-semitone hum slide is within a comfortable hum, so the comfort-check
line is not needed (DECISIONS 25).

### Practise link

Ear Lab Leap with only Minor 2nd and Major 2nd (`leap:m2`, `leap:M2`, `src/lib/ear/banks.ts:36-50`).
Today no link opens it (FACTS 33): the film's end card shows mercurypitch.com/ear-lab, which works
now and stays valid, and the page tells the viewer to tap Leap, where m2 is a semitone and M2 a
tone. When the `ear-drill` launch kind accepts a bank subset (CURRICULUM § 4 item 5), the page and
the YouTube description switch to the proposed `/exercises/semitone-or-tone`. Contour appears only
on the page, as an optional warm-up for direction: it never asks semitone or tone.

### What must read with the sound off (captions on)

- The warm-up: "× 2" in gold and "octave" between the two stacked A beads.
- The five beads lighting one by one, the counter reaching 12, "220 Hz" becoming "440 Hz".
- The ring of twelve, its equal wedges, and the word "semitone".
- "7 white + 5 black" over one octave of the keyboard.
- The predict card's two pills, then a check on "C to D", with step bars of 1 and 2.
- The equal tiles: B3 and C4 touching; a "1" under every pair of neighbours; "tone = 2 semitones".
- The five holes and two touching pairs, then "7 + 5 = 12".
- "♯ = up a semitone", "♭ = down a semitone", C♯ and D♭ on one key, "E♯ = F".
- "C#4" in the house-style pitch-line labels.
- The cents ruler: the readout running 0 to 100 ¢; "1200 ¢ = 1 octave"; the monitor's name flip
  at 50 ¢.
- The slide drawn on the lanes; "Your turn."; orange's readout "+100 ¢", then "0 ¢".
- The recap cards, each answered by the object that taught it.
- "59 %" asked, "13 % · 16 %" tested, "≥ 1 semitone".
- The end card's address and the Leap line.

## Brand

- Name: MercuryPitch. Series: "Find Your Pitch".
- Logo files: `assets/brand/mark.svg`, `assets/brand/lockup-horizontal.svg` (copied from
  `docs/branding/logo/meniscus2/`, the only canonical source).
- Colours: as Lesson 1. Obsidian `#0d1117`, ink `#e6edf3`, ink-2 `#a8b3bf`, chrome `#c3ccd6`
  (any other note), blue Merc's note `#58a6ff`, orange Merc's note `#ff7448`, gold `#ffd84d` for
  the fit only, violet `#8957e5` marks and `#bc8cff` labels for the contrast case. Pitch-canvas
  scenes (S14) take the app's canvas set instead: target amber `#f59e0b`, singer violet `#a78bfa`
  (MASTER-PLAN § 5).
- Fonts (local, SIL OFL 1.1, licences in `assets/fonts/`): Outfit, Inter, Instrument Serif italic,
  JetBrains Mono, and Noto Music for the ♯ and ♭ glyphs, drawn as paths.

## Facts

- Facts file: `FACTS.md`, the only source for any number, name or claim on screen or in the voice.

## Assets

- `assets/merc-lib/merc-blue.js`, `merc-orange.js` - the app's own WebGL2 Merc, bundled read-only
  by the film kit's `tools/build-merc.mjs` (Lesson 1's), orange with the build-time warm swap.
- `assets/voice/*.wav` - scratch narration, local Kokoro-82M (Apache-2.0): blue `am_michael` at
  0.84, orange `af_heart` at 0.9, as Lesson 1. To be re-voiced with the final cast.
- Merc's sung A3 and A4 in the cold open: `src/features/echo/voice/echo-merc-ooh-57-A3.mp3`,
  `-69-A4.mp3` (development placeholders, `src/features/echo/merc-voice-set.ts`; MASTER-PLAN § 12
  item 1).
- Merc's two sung slides: the synthesised "ooh" (`src/lib/demo-audio.ts` timbre, Lesson 1's
  `voice_tone()`), following the cents contour in FACTS 50 and 51.
- Every other example is synthesised at its exact frequency by `tools/mix.py` (FACTS 41 to 53).
- The spiral, keyboard and lanes: Lesson 1's scene code (`output/motion/lesson-01/compositions`,
  s13 to s17) and kit (`assets/lib`), promoted into the Phase 1 film kit.
- Noto Music ♯ and ♭ paths: the `sharp` and `flat` glyphs already in Lesson 1's
  `assets/lib/noto-music-glyph-paths.json` (Noto Music 2.003, SIL OFL 1.1).

## Style references

Lesson 1's film is the reference: its room, its persistent objects (the spiral, the keyboard, the
lanes) and its grammar carry on. Mechanisms from `kit/business-motion-film/references/
motion-grammar.md` (persistent actor, continuous canvas, materialising result) and the 3Blue1Brown
habit of one object that transforms into the next idea (spiral, keyboard, tiles, ruler, lanes).

## Audio

- Music: none recorded. Lesson 1's quiet open-fifth pad in A, only in the act transitions and under
  the dressed pauses (`q0`, `predict`, `your-turn`, `q1` to `q3`); silent under narration and under
  every example, both slides and the listening quiz included (playbook rule 12). Its A gives the
  viewer the starting note in the your-turn pause. The title and end stings are Lesson 1's chimes.
- Sound effects: synthesised in code (one soft whoosh per act change). The effects that matter are
  the examples.
- Voiceover: yes, two characters (blue Merc teaches, orange Merc asks).

## Must never appear

- Claims not in FACTS.md; "wrong", "failed", "bad" or "tone deaf" about anyone; emojis; any
  AI-assistant attribution.
- "The smallest step in music" (only "the smallest step a piano has"); "sharp" or "flat" meaning a
  little too high or low (the film keeps one meaning per word); any claim that the app checks the
  viewer's slide in the film, that Leap scores singing, or that the pitch line "always" or "only"
  shows sharps.
- A link that does not exist yet (no `/exercises/...` slug on screen).

## Notes

- Teaching film, not a launch film: Lesson 1's adapted pacing (4 to 8 layout changes a minute, a
  visual event every 2 to 5 s tied to its word, dressed holds while a diagram is explained) and its
  two-second chapter breaths after the act 2 and act 3 cards.
- Production state: planning documents only. Nothing in `output/motion/lesson-02/` exists yet;
  `tools/mix.py` needs Lesson 2's sounds (FACTS 42 to 52) and `tools/merc-shots.py` the slide
  special case (STORYBOARD, Merc passes).
