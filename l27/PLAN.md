# Lesson 27 page plan (lead-only), branch feat/lesson-27-page on feat/lesson-25-page (e18f31089)

Stacked: L16 (#1406) -> L18 (#1407) -> L20 (#1408) -> L25 (#1409) -> L27. Baseline = L25's final gates
($S/l25/g/r1c, r1d: fp, css lists), cites 301, units 5,649.

Package: docs/plans/find-your-pitch/lessons/27-sevenths-inversions/{LESSON,FACTS,WEB-SPEC,ARTICLE-PLAN}.md.
Spec read in full (592 lines); LESSON.md read in full (549). FACTS: 72 pitches, 73 levels, 30-33 ring,
42-44 plays, 48-52 Step 4/staff/sing, 56 exercise.

## The page
- Masthead Lesson, Sing, Explorer (no Watch). lesson 27. Title "Seventh chords and chord inversions |
  MercuryPitch" (50). Description "Add one note to the V chord and it pulls towards home. Which note, and
  why? A fifteen-minute lesson with sound toys: seventh chords and inversions." og/twitter title "Seventh
  chords and inversions · Find Your Pitch, Lesson 27"; og desc = hook; og card learn/lesson-27-og.jpg alt
  "The title card: Find Your Pitch, Lesson 27, Seventh chords and inversions, above Lesson 12's ring of
  rooms with the V room lit, between Merc and Tavi." (V room three corners). JSON-LD: headline lesson name,
  alternativeHeadline hook, description = meta desc, timeRequired PT15M, position 27, teaches "Building
  seventh chords", "The dominant seventh and its pull towards I", "Root position and inversions".
- Chips: 15 minutes; After Lesson 12: Chords and the four-chord song (/learn/12); After Lesson 23:
  Perfect, major, minor and the tritone (/learn/23); Sound on. Promise and gate in LESSON.md.
- Hero: ring alone (no staff), two rooms: V lit (G B D), I faint (C E G); centre "V · G major". Plays: Play
  V, then I (free; G3 B3 D4 1.5 s then C4 E4 G4 1.5 s, everyone, centre names each "V · G major" / "I · C
  major"); Play it with F / Play it with F♯ (locked until choice; V + F4/F♯4 1.5 s then I 1.5 s; as the 4th
  note sounds its bead lights + V room grows a 4th corner; centre the four letters, no chord name; after
  the reveal the F play's centre reads "V7"). IV never drawn. Bubbles: Tavi "F♯ sits a semitone under G,
  and G is in the home chord. Won't F♯ pull hardest?" Merc "Choose, then hear both go home."
- Predict 1: stem in LESSON.md; choices F / F♯; lock hint "Choose an answer to unlock the two chords.";
  chosen "Locked in. Play both."; silent "Sound is off: nothing played. Turn sound on, then play it again.";
  again "Play any of them again."; no next; guess "You said: F"/"You said: F♯"; revealOn both,
  revealAfter all; reveal = [hero .reveal, Step 1's held paragraph+play, Step 2's text, Step 3's text];
  unlocks: steps' toy V chip (+Add the seventh plays V7), free play V chip, V's seventh, diagonal, V7
  plays; onChoice: Step 2's V room grows its 4th corner, release holdTour, enable Step 4's predict (lock
  line "Choose an answer to unlock the two comparisons.", then mount predict 2).
- Predict 2 (Step 4): "Still C major" / "E minor"; disabled at first paint, hint "Choose an answer at the
  top first."; plays "Play C, E, G, then E, G, C" and "Play E, G, C, then E, G, B" (1.2 s a chord, 2.4 s
  each); chosen "Locked in. Play both."; again "Play either again."; guess "You said: still C major" /
  "You said: E minor"; reveal = reveal + text + Try/Notice + drawer; unlocks Step 4's chips + Turn over,
  free play's Turn over.
- Recall: l12-q3 + l23-q1 (import, links "Try Lesson 12, Step 4 again" -> /learn/12#step-4 new tab).
- Words: Seventh chord (C E G B a note every 0.4 s, then together 1.2 s), Major seventh (pair C-B),
  Minor seventh (pair C-B♭), small staffs in learner's clef; higher voice from C4, lower from C3.
- Steps' toy: ring (Lesson 12's, inert) + staff toy (learner's clef, Clef + pitch-line switches).
  Step 1: chips I, V (V held), switch Add the seventh (off); I lit at first paint; chip plays triad 1.2 s;
  with seventh on, the 7th chord; switching on plays the lit chord with its 7th (corner grows); readout
  "Root to seventh: 11 semitones" (I) / "10" (V). Step text plays: C E G then C E G B; held: G B D then G B D F.
  Step 2: I and V rooms each with 4 corners (V's 3 until the choice); plays maj7 then dom7 (1.5 s each),
  dom7 then I (1.5 s each). Step 3: V7 room + diagonal B-F labelled "B to F: 6 semitones" + I room; plays
  B3+F4 then C4+E4 (1.5 s each, arrows 0.4 s), V7 then I. Step 4: chips I, V7, Turn over, bass mark +
  "bass", position name under the ring; Turn over = lowest note up an octave + play 1.2 s; staff restacks
  (climb 0.4 s), mark moves 0.3 s, room unchanged; press after the last inversion returns to the first
  pitches. Held until Step 4's choice.
  Free play: chips I, V, Add the seventh, Turn over (turns the lit chord), diagonal while V7 lit; V parts
  held until cold open's choice ("Choose an answer at the top to unlock the rest of this figure."), Turn
  over until Step 4's ("Choose an answer in Step 4 to unlock this.").
- Figure names: "V, G major: G, B and D", "V7: G, B, D and F", "I with its seventh: C, E, G and B. Root to
  seventh: 11 semitones", "C major, first inversion, E in the bass: E, G and C".
- Pitches (FACTS 72), higher voice; lower = an octave down (G2..G4): I C4 E4 G4 (+B4); V G3 B3 D4 (+F4);
  Step 3 B3+F4 -> C4+E4; Step 4 predict C4 E4 G4 / E4 G4 C5 / E4 G4 B4; Turn over I: C4E4G4, E4G4C5,
  G4C5E5; V7: G3B3D4F4, B3D4F4G4, D4F4G4B4, F4G4B4D5; free V: G3B3D4, B3D4G4, D4G4B4; free I7: C4E4G4B4,
  E4G4B4C5, G4B4C5E5, B4C5E5G5 (G5 highest). Hero + check q4 Merc's register for everyone.
- Levels: single 0.13, three-note chord 0.075 a voice, four-note 0.056 a voice (FACTS 73), Merc 0.2.
- Staff (FACTS 51): no key signature, no stems, accidentals left; seconds side by side (upper right): F/G
  in V7's inversions, B/C in I7's. Treble G3 under 2nd ledger below; G5 space above, no ledger. Bass E4 on
  2nd ledger above, G4 on 3rd.
- Sing it: Lesson 25's flow; figure so ti re fa, mi, do in G: lower D3 F♯3 A3 C4 B3 G3 (bass), higher D4
  F♯4 A4 C5 B4 G4 (treble); 1.2 s each, do 1.8 s, 1.15 hold + 0.05 glide, "ooh"; no key signature, F♯'s own
  sharp, house on G; count-in on so; no Move do, no octave switch. Lines in LESSON.md 296-336.
- Check: l27-q1..q4 (LESSON.md 343-362); q4 plays G3 B3 D4 F4 1.5 s for everyone. Keys fyp-l27-seed,
  fyp-l27-quiz-v1; recall fyp-l27-recall-seed, fyp-l27-recall-v1.
- Wrap: three lines, challenge, practice card Chord Stacker (/pitch-training?lesson=27) + Stack second
  drill (/ear-lab?lesson=27), rest version Lesson 12's form; next card Lesson 28 (tease "A song in two
  parts. At bar 8 it seems to end, then keeps going."), still of Lesson 28's opening; free play.
- Tease still for Lesson 26's card: ring with V lit, I faint, no 4th corner, Merc and Tavi, no bubbles.
- Season data: L27 entry gets minutes 15, page '/learn/27' (+ draft comment). lesson-copy 27 (tease "G, B
  and D going home to C, E and G. Now add one note on top.", teaseAlts three-notes "Three notes make a
  chord. Add one more to V, and hear where it goes.") and 28 (tease above). TEASE_NOTES 27 (and 28?).
- drafts.ts 27: "Lessons 12 and 23's pages at /learn/12 and /learn/23, and the vocal coach's look at the
  sung checkpoint and the sung drill".

## Kit work
- C2 refactor: NEW kit/room-ring.ts = Lesson 12's ring mount (RING 60, RANGE, RING_BLACK, mountRing) +
  geometry/drawing (Point, Ring, ringOf, onRing, drawRoom, drawHalos, HALO, centre text). lesson-12
  rooms-draw.ts/rooms.ts import them (behaviour unchanged). Spiral option `inert` (no taps/keys/slider).
- C3: four-corner rooms in ring order, growing corner 0.3 s, diagonal + label + arrows 0.4 s, bass mark +
  "bass" 0.3 s move; chord theory: seventh chords, turnOver, position names (kit/inversions.ts?);
  kit/sound.ts four-voice level 0.056.
- C4: staff toy: seconds side by side in a column; climb (a note travelling up the staff 0.4 s).

## Commits (planned)
C1 shell+registrations; C2 kit ring move; C3 kit rooms of four, diagonal, bass mark, inversions, level;
C4 kit staff seconds + climb; C5 steps' toy + sounds; C6 cold open + predicts; C7 words, recall, check;
C8 Sing it, wrap, tease still; C9 e2e + tour; C10 sitemap; C11 docs (As built, Length, ceilings, cites
reanchor base e18f31089 expect 301, INDEX). <=2 reviews. PR on base feat/lesson-25-page.
