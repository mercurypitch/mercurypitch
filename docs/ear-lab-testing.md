# Ear Lab — hardware test script

The Ear Lab's readings depend on real speakers, microphones and rooms, so
every phase gets a manual pass on real hardware before merging. This is the
script for that pass. Run it on desktop first, then repeat the marked steps
on a phone. Keep results/notes per run at the bottom.

Owner: Komediruzecki · Plan: `docs/plans/ear-training.md` (§10 tracks status)

Setup: `pnpm dev` (add `--host` via `pnpm dev:host` for phone testing over
LAN), open the **Ear Lab** tab.

---

## 1. Timing calibration — the app's one round-trip number

The Ear Lab no longer measures latency itself (Polish Phase 3). The
**Round trip** chip in the session bar reads the same number Settings →
Microphone → **Round-trip offset** does, and the readiness panel hosts that
same wizard. Speakers up, room quiet.

1. Press the **Round trip** chip (it reads **unmeasured** on a fresh
   device). The readiness panel opens in the rack: a note that says why,
   then the wizard. Nothing listens yet.
2. Press **Start**. The microphone is asked for only now. Eight clicks
   play over about six seconds while it listens.
3. Expect **"N ms round trip"** with "Matched 8 of 8 clicks, spread x ms".
   Press **Use this**: the rack closes and the chip reads **N ms · steady**
   (spread of 25 ms or less) or **unsteady**.
   - Wired speakers/headphones + built-in mic typically read ~20-120 ms.
   - Bluetooth output typically reads 150-350 ms. Both are fine — the point
     is the number, not its size.
4. Open Settings → Microphone: **Round-trip offset** shows the same number.
   Measure there instead; the chip follows.
5. Failure cases to try deliberately:
   - Volume muted → "The clicks never came back…", **Try again**, no value
     stored, chip unchanged.
   - Deny mic permission → the wizard's microphone error, chip unchanged.
6. Phone repeat: same steps; expect a larger but stable number.

Report: the medians, the spread, device + output (e.g. "laptop speakers +
built-in mic"). The old Ear Lab wizard's constant over-read (handoff §3,
274 ms against main's ~150 ms) went with the wizard.

## 2. Home in Sing-or-play mode — NEW in Phase 2

The ear-vs-voice diagnostic. Needs a mic; works sung or on any instrument.

1. Open **Home**, switch the console's toggle to **Sing or play**, press
   **Begin**. Grant mic access.
2. After each cadence + probe, sing (or play) the degree you heard — any
   octave. The ladder's rungs are disabled in this mode and the fork shows
   a dashed listening ring; your voice is the answer.
3. Expect on a clear take: the reveal names what you sang and its
   intonation, e.g. **"Yes — Sol (5), 12¢ sharp"** or "dead in tune" when
   within 8¢.
4. Hum something vague/quiet on purpose once: expect **"Did not catch that —
   once more, louder and steadier"**, then if unclear again the round skips
   with the rating untouched (grey dot on the end card).
5. Sing a deliberately wrong degree once: expect the wrong-answer reveal and
   the probe falling home to the tonic, same as tap mode.
6. Finish all 12 rounds. The end card should show:
   - **Voice rating** (separate from your tap rating) with its session delta,
   - "voice typically N¢ off when right",
   - the **ear-vs-voice line** comparing tap vs sing ratings (only after
     you have played both modes at least once),
   - skipped rounds counted separately from misses.
7. Back on the dashboard, the Function row should now read like
   **"1240 · voice 1150"**.
8. Instrument check (guitarist pass): answer a few rounds by playing the
   degree on guitar instead of singing — detection should behave the same.
9. Phone repeat: steps 1-3 only; check the mode toggle is tappable and the
   sing hint is readable.

Report: does the named degree match what you actually sang (spot-check a
few), do the cents read plausibly (deliberately sing flat once), and the
ear-vs-voice line's two numbers.

## 2b. The Grid — timing resolution — NEW in Phase 3

The first millisecond drill. Perception only: you never tap, so your
device's round trip cannot contaminate the reading (the clicks are
scheduled sample-accurately on the audio clock).

1. Open **The Grid** → Practice run.
2. Six clicks play on a steady grid; one of the last four is nudged early
   or late. Answer 3rd / 4th / 5th / 6th.
3. Expect a reading around **20–60 ms** untrained, lower if you play
   rhythm-heavy music. Same staircase feel as Hairline: mistakes lengthen
   the run.
4. Sanity check: at the opening offset (80 ms) the nudge should be
   _obvious_. If even those feel random, flag it — that points at audio
   scheduling, not your ear.
5. Watch the chase light step along the six pallets: it must step in a
   perfectly even rhythm regardless of which click was displaced. Only the
   reveal pushes the off pallet out of line (early left, late right). If
   the lattice visibly gives the answer away before you answer, that is a
   bug.

## 2c. Leap / Stack / Contour — NEW in Phase 3

Three button drills, 12 rounds each, all sharing one engine.

1. **Leap** — name the interval (12 choices). Roved root, ascending or
   descending. Wrong answers replay slower.
2. **Stack** — name the chord quality (6 choices). Wrong answers replay
   the chord **broken then re-stacked** — check you hear the arpeggio then
   the block.
3. **Contour** — up / down / same, fast. Deliberately easy at first; as
   the rating climbs the gaps shrink toward quarter-tones.
4. For each: the reveal should colour the correct pad green with a tick
   (and your wrong pick garnet with a cross), say it in words on the status
   line, and the instrument should show the truth — the index arc sweeps
   to the interval, the gear train sets the chord's wheels, the stylus
   draws the second segment. The plate should show the rating with its
   delta this run.
5. Dashboard check: Shape should now read a number (Leap and Contour
   averaged), Colour should read Stack's rating.

## 2d. Ear Report — in the room since Polish Phase 3

1. After playing the drills above, open **Ear Report** from the bridge. It
   opens as a stage inside the room: the drill bar with a range control
   (**4 wk / 12 wk / All**), then engraved plates.
2. **Mercury Index · sealed calibrations**: brass marks, one per sealed
   calibration, on a 0-1000 axis; the note reads "Sealed {date} at {index}
   of 1000 · {delta} since {date}". Without a calibration the plate says
   so.
3. **Hairline / The Grid · threshold**: the practice line is silver and
   dashed, sealed calibrations are brass marks. The line RISES as your
   readings fall — plotted inverted on purpose — and the axis labels are
   printed honestly: the smallest value sits at the top. Check "best".
4. **Range**: 4 wk / 12 wk / All re-scale the traces' x axis; the default
   is 12 wk. Confusions are not dated, so the maps do not change — the
   foot line says so.
5. **Confusion maps**: one plate per drill. Rows are what played, columns
   what you answered; the diagonal (right answers) is signal green, misses
   are garnet, darker with count. Expect sentences like _"You answer Fa (4)
   as Sol (5) on 33% of attempts"_.
6. Deliberately miss the same degree the same way 3-4 times in Home, then
   re-open the report — that pair should top the list.
7. Plates with nothing to show say so in words, not an empty grid.
8. Phone: the range control sits under the drill bar; a matrix scrolls
   sideways inside its plate; the page itself must not scroll sideways.

## 2e. The Daily Sprint — NEW in Phase 4

The habit loop. Everything here is local and same-day, so the quickest
way through it is to just play the three drills it names.

1. On the bench, find **Today's regulation** — the engraved plate at the
   right of the Regulator on a desk, below the dials on a phone (the
   bridge's **Today** button scrolls to it). It should list **three**
   drills, each with a reason — on a fresh profile all three read
   **Never measured**.
2. Check the reasons are honest: after you have readings for everything,
   two slots should say **Your weakest** and exactly one **Keeping it
   fresh**. The weakest two must match the lowest faculty numbers in the
   readout above.
3. Press **Start** on one segment — it should open that drill. Finish the
   run, come back, and that row should be ticked and dimmed.
4. Now open a sprint drill **from its own card lower down** instead of
   from the sprint. Finishing it must still tick the sprint row: the
   sprint names what to practise, it does not own the only door in.
5. Finish all three. The subtitle should switch to "Done for today" and a
   **day count badge** should appear top-right.
6. Reload the page — the ticks and the badge must survive.
7. Check the streak is not double-counted: your practice-minutes total
   should rise by roughly the time you actually spent, not twice that.
   (Each drill credits its own run; closing the sprint credits nothing.)
8. Rotation check (optional, needs patience or a clock change): the
   third slot should differ from one day to the next even when your two
   weakest drills do not change.

## 2f. The Ear Lab tour — NEW in Phase 4

1. Open the Guide modal and find **Ear Lab** in the page-tour list.
2. Run it. Eight steps: the column, the index, the faculties, today's
   sprint, Calibration, the drills, timing calibration, and the
   no-percent rationale.
3. Every step must actually spotlight something — no blank highlights,
   no steps that scroll to nothing.
4. Repeat once on a phone viewport.

## 2g. The Ascent, Week 4 — NEW in Phase 4

1. Open **Path** → **Week 4 (Tuning & Ear)**.
2. Among the drill chips there should now be three **Ear Lab ·** chips:
   Hairline, Home and Leap, visually distinct from the singing chips.
3. Tap one: it should jump straight to the Ear Lab **and open that
   drill**, not just the dashboard.
4. Press Back to the dashboard, then switch tabs away and return — you
   should land on the dashboard, not be bounced into the drill again.

## 2h. The instruments on the stage — NEW in Polish Phase 2

Every drill now opens inside the Regulator Room on a stage: the session bar
stays, a drill bar carries the name, the mode and the live progress (gap and
reversal, or round and rating), the instrument sits in the centre with a
status line under it, and the answer console sits at the bottom where the
bench's bridge was.

1. From the bench, open each instrument from the strip (or the rack):
   Hairline shows a vernier under a loupe, Home a tuning fork on its box, The
   Grid an escapement lattice, Leap an index arc, Stack a gear train, Contour
   a drum recorder. Nothing sounds until you press a console pad.
2. **Hairline**: the console offers **Practice run** and the amber
   **Calibration**. During a trial the loupe's readout is the gap; the
   second hairline always sits to the right until the reveal, which swings
   it to the true side. A calibration adds three track pendulums under the
   loupe, one per interleaved track, with their reversal counts.
3. **Keyboard**: Space begins a run from the idle console; digits answer
   (1/2 on Hairline, 3–6 on The Grid, 1–7 on Home, 1–6 on Stack, 1–3 on
   Contour; Leap has no keycaps). Focus lands on the first pad as the
   answer phase opens.
4. **Reveal**: the right pad turns signal green with a tick, a wrong pick
   garnet with a cross, and the status line says the same in words — never
   colour alone. A short sound plays with every reveal.
5. **Plate**: Stop or the last reversal lands on an engraved plate:
   "Reading" with the number and its unit (marked provisional when short),
   "Sealed" after a full calibration ("etched on the glass as {date} ·
   {index}"), or "Stopped" with "nothing was marked". Run again / Back to
   the bench.
6. **Phone**: the console is fixed at the bottom above the app's tab bar,
   pads are at least 44px tall, and the voice-control pill does not cover
   a pad. Reduced motion: the chase light, the hunting needle, the wheels
   and the pendulums stop; every reading still reads.

## 2i. Sound, Today, and the retest fixes — Polish retest 2026-08-27

The founder's first hardware pass on Polish Phases 2-3 found five things.
Each now has a hook the audit script checks (`scripts/audit-ear-lab-mobile.mjs`);
the ear is yours.

1. **Stage volume and the click voice.** Open the rack from the room chip.
   Under _Room visibility_: _Stage volume_ (default 70%) and _The Grid's
   click_ — Wood (default), Tick, Soft. Choosing a click plays it once at the
   stage volume. The Grid's clicks and every tone on the bench follow the
   slider on top of the app's own volume (Settings); leaving the Ear Lab
   resets the trim, so the rest of the app is unchanged. The Grid's idle
   console says which click is set and links to the room. Expected: no
   piercing 2 kHz click at full level on earbuds — Wood is a 1 kHz knock at
   about half the old level.
2. **Home cadence.** I-IV-V-I sound as three-note chords (each member a full
   instrument voice), one after the other, and the lamp for each is lit for
   exactly as long as the chord sounds; the probe follows, and the answer
   opens only once the probe has died away. Before: four bare roots 130 ms
   apart with the probe over them — heard as a five-note scale.
3. **Contour.** After the second tone, the first tone's trace stays on the
   drum and the stylus rests at its end until you answer. Before: the trace
   vanished and only the arm remained. The stylus is a pen carriage on a
   rail inside the drum with the nib straight down (2026-08-28): the old
   lever arm pivoted outside the drum and, on the answer screen, was a brass
   line rising to the upper right — a slope on the one screen that asks
   which way the tone went. The audit checks every part of the pen sits
   inside the drum.
4. **Stack.** The reveal's wheels mesh side by side (even left, odd right of
   the arbor), so a suspended 4th's 5 and 7 are neighbours; captions sit in a
   column to the right and the nameplate keeps clear of the root wheel.
5. **Today.** The bridge's Today button opens the regulation in the rack (the
   same three drills as the bench's card); Start opens the drill and closes
   the rack. Before: it scrolled the bench, invisible on a desk.

## 2j. Doors and native readiness — Polish Phase 4

Nothing new to measure; this phase is how you get in, and what a native
shell will need.

- **Home.** The destination gallery has an Ear Lab card (the Regulator Room
  under brass lamplight, eyebrow _Measured, not scored_) between Exercises
  and Analysis. It opens the tab.
- **The tour.** _Guide_ on the bench speaks the bench's words now: the
  Regulator, Today's regulation, Calibration marks the glass, the
  instruments, Round trip. Eight steps, same hooks.
- **The Ascent, Week 4.** The Ear Lab chips are brass on the week card
  (they were quicksilver) and still open the drill straight from the path.
- **Audio unlock.** Every play pad (Begin, Practice run, Calibration) primes
  the audio session inside the tap (`unlockAudio`), and so does choosing a
  click in the room panel. On an iPhone with the ring switch on silent the
  bench should still sound; before, a context born suspended could stay so.
- **Native readiness on this surface** (`docs/plans/mobile-native/capacitor-readiness.md`
  A1-A4): `viewport-fit=cover` is on `index.html` and the app root sizes with
  `dvh`; the Ear Lab has no bare `100vh` and no `@capacitor/*` import; the
  room is fetched only when the tab mounts, at the phone's portrait size.
- **E2E.** `src/e2e/ear-lab.spec.ts` (`@smoke`): open the tab, Hairline from
  the strip, a practice run arms its pads, Stop lands on the end plate, Back
  returns to the bench. Run it with `VITE_E2E_PORT` set to a free port.
- **Share card.** `scripts/generate-ear-lab-og.mjs` renders a 1200x630 card
  from the room master; nothing references it yet (the Ear Lab is a tab, not
  an entry), so no PNG ships until a share route or landing section wants it.

## 2k. The rhythm seam — Polish Phase 5

The rhythm drills are designed, not built (`docs/plans/ear-rhythm-drills.md`).
What can be tested is the seam they will stand on:

- **Tap check** in the readiness panel (Round-trip chip → the rack). Press
  the pad: eight clicks at 100 BPM in the room's click voice at the stage
  volume. Tap with them. The reading gives the mean (negative is early),
  the spread, how many clicks were met, and whether the round trip was
  subtracted. Run it once with the round trip unmeasured and once after the
  wizard: the mean should move by about the round trip, and a steady tapper
  should sit within ±20 ms with a spread under 25 ms once it is subtracted.
  A large residual is the honest number to bring back — the subtraction
  uses the speaker-to-microphone trip as a stand-in for output + touch
  latency, and the residual on your hardware is what Pulse will inherit.
- Taps register on pointer down and on Space / Enter; a held key does not
  repeat. Closing the rack mid-take silences the clicks.

## 2l. The rooms — Polish Phase 6

Six rooms of the Regulator Room's world, two free and four supporter,
generated through the dotfiles background pipeline (masters at 3840x2160 /
2160x3840, detail ratios 1.66-2.09 against the 1.30 gate).

- **Free, live on any deploy of the branch:** _Regulator Room_ (the default;
  its Phase 1 stand-in is replaced by the master of the same room) and
  _Glasshouse Bench_ (a light room). Room chip → the rack → pick one; the
  choice persists on the device; portrait and landscape are separate
  renders, so turn a phone and the bench should still sit low in the frame.
- **Supporter:** _Transit Observatory_, _Bell Loft_, _Planetarium_,
  _Anechoic Booth_. The picker lists only rooms with a published revision on
  the environment, so they are absent until two things have happened:
  migration `0035_ear_rooms_background_pack.sql` has seeded their identities
  (the dev deploy after merge applies it), and the art has been published
  from `~/.dotfiles/personal/mercurypitch/assets/premium-backgrounds/v6/`
  with `sync-dev.mjs --apply --publish`. They then show unlocked for
  supporter accounts and as locked tiles with the brass-on-slate wash for
  everyone else; prod is a deliberate separate upload.
- **Publishing from the console instead of the sync tool:** Admin Studio →
  Premium perks → surface filter _Ear Lab_ → pick a room → _Create
  replacement_ → _Upload_ `landscape-2k.webp`, `landscape-4k.webp` and
  `portrait-2k.webp` from `v6/variants/ear/<room-id>/` → _Validate and
  ship_. Four rooms, twelve files. The `active-supporters` assignment is
  seeded by `0035`, so nothing needs ticking; a supporter account on dev
  then sees the four tiles unlock in the Room panel.
- What to judge: the centre band under the Regulator and the bottom third
  under the console must stay calm with the room visibility slider at its
  bare end; the Anechoic Booth's wire floor is the one plate the gate flagged
  as busy at the bottom, and the Glasshouse Bench is bright in the centre by
  design.
- **Light rooms ink the bench.** In the Glasshouse Bench everything written
  straight on the room — the headline and its note, the faculty dial
  captions and readings, "Not yet marked", the column's legend — turns to
  ink with a pale halo; the plates (the column, the index dial, the
  regulation card, the strip, the bridge, the rack) keep their parchment.
  Retest finding 2026-08-27: the parchment was invisible on the glass. The
  audit measures the bench title's luminance in that room.

## 2m. Pulse — rhythm dictation — follow-up item 2

The first rhythm drill on the seam of §2k. Bench strip → _Pulse_ (Time ·
rhythm). Begin: four soft clicks count you in, a bar of onsets sounds in
the room's click voice, and the next bar is yours — a soft click keeps the
beat while you tap the call back on the wide pad (Space or Enter work
too). The take is judged when the bar and its grace have passed: every
onset met in order inside the pattern's tolerance (quarters 100 ms,
eighths 80, triplets 65, sixteenths 50), nothing extra.

- **What to check on hardware:** the count-in, the call and your bar sit
  on one steady grid — no gap or hitch between bars; the pad registers
  every tap (the status counts them); the reveal draws the call's onsets
  on the upper rule and your taps under them, signal where met, garnet
  dashed where missed, muted for an extra. With the round trip measured
  (§1), a take you know was tight should come back _Clean_; the
  progress line drops its _raw_ word.
- **The reading:** the bench tile shows the rating and, once the rating
  clears a rung, the finest subdivision it clears (_· eighths_). No
  percent anywhere; the plate says _n of 12 calls tapped back clean_.
- **Latency gate:** with the round trip unmeasured the idle console links
  to the readiness panel and the run is marked _raw_; nothing is locked.
- Stop mid-call silences the clicks already on the audio clock and lands
  on the plate; the tap pad is disabled outside your bar.

## 2n. Echo and Span — melodic dictation — follow-up item 3

The Shape dial's two dictation drills. Bench strip → _Echo_ (Shape ·
dictation) and _Span_ (Shape · span). Both plant the key with a short
I–IV–V–I cadence, sound a phrase, and open the **ladder** — eight rungs,
1 to 1′, keys 1–8 — only after the last note. Each note must match in
order; the strip under the ladder shows the phrase forming in solfège
(_Do Re Mi_ · _2 of 3_) and **Take one back** (Backspace) removes the last
note. Nothing says right or wrong until the whole phrase is in.

- **Echo** (rating run, 12 rounds): phrases of three to six notes from a
  bank of fourteen, steps and triads first, leaps and octave falls at the
  top. A slip replays the phrase slower before the next round.
- **Span** (practice or calibration, the staircase): starts at three
  notes; hold the whole phrase and it grows by one, slip and it shortens.
  The reading is _notes held_. The phrase is drawn fresh every trial — a
  diatonic walk, leaps within a fifth, starting on a chord tone.
- **What to check on hardware:** the cadence sounds as chords, the beads
  on the chain sit on one level line while the phrase plays and light in
  turn (no heights shown — that would draw the contour for the eye); the
  ladder is disabled until the phrase ends and Space does nothing there;
  the reveal strings the phrase at its true heights in brass, a signal
  ring on every matched bead, a garnet ring at the height you tapped
  instead (dashed when the note was never tapped), solfège under each
  bead; the status names the phrase (_Yes — Do Re Mi._ / _That was Do Re
  Mi — listen again._ / _Slipped at note 2 of 3 — it was Do Sol Do. The
  phrase shortens._).
- **The reading:** Echo's rating joins Leap and Contour in the Shape
  readout; Span shows on its own tile in notes. No percent anywhere.
- Stop mid-cadence or mid-phrase silences the engine and lands on the
  plate.

## 2o. Beat Hunt and Drift — follow-up item 4

Two threshold drills on the staircase. Bench strip → _Beat Hunt_
(Resolution · beats) and _Drift_ (Time · tempo); both offer Practice run and
Calibration like Hairline and The Grid.

- **Beat Hunt:** two pairs of tones, 1.4 s each. One pair is in tune with
  itself; in the other one tone is pulled off by the staircase's detune in
  cents, and the pair beats. _Which pair was beating — the first, or the
  second?_ The pairs go through their own synth (`dyad-synth.ts`): each tone
  has its own gain and the second starts at a random phase inside ±90°, so
  the in-tune pair is not simply the louder one. The base is roved A2–E4.
  - **What to check on hardware:** at 40 ¢ the beating is plain (about
    3–7 beats a second depending on the base); as the detune shrinks the
    swell slows to a fraction of a cycle across the pair. The pendulums
    swing together for both pairs while they sound — no hint — and only the
    reveal hangs the detuned pair's second bob out of phase, garnet, with
    the beat rate on the nameplate (_5.1 beats a second_ / _a beat every
    4 s_). The status names the pair and the detune.
- **Drift:** eleven clicks in the room's voice, 520 ms apart. The first five
  hold; the last six gain the level in percent of tempo, lose it, or hold —
  a third each. _Steady / Faster / Slower_ (keys 1–3).
  - **What to check on hardware:** the lamps under the metronome chase the
    clicks at even spacing (never at the drifted timing), the arm stays
    upright until the reveal, then leans forward for _Faster by 10%_, back
    for _Slower_, holds for _Steady_. A steady train answered right reads
    _Right — it held steady._ — the level does not move on catch trials'
    wording but the staircase still counts them.
- **The readings:** Beat Hunt in cents detune on the Resolution dial's
  second tile; Drift in % tempo on Time. No percent-correct anywhere; the
  plate shows the threshold and its unit.
- Stop mid-pair or mid-train cancels the tones already on the audio clock.

## 2p. Gravity and The Pull — function past the seven — follow-up item 5

Two more Function drills beside Home. Bench strip → _Gravity_ (Function ·
chromatic) and _The Pull_ (Function · tendency).

- **Gravity** is Home over the chromatic twelve: the same cadence, the same
  controller and mic path, but the probe can land on any of the twelve and
  the pads are twelve in two rows — the diatonic seven by number, the rest
  by their leaning (♭2, ♭3, ♯4, ♭6, ♭7). Keys run along the keyboard row
  (1–9, 0, −, =). Tap answers rate under `gravity` with a 1/12 floor; _Sing
  or play_ answers under `gravity-sing` with none, the yardsticks untouched,
  the same separation Home keeps. Item ids live in their own namespace
  (`gravity:deg-N`), so Home's Elo state is not shared or disturbed.
  - **What to check on hardware:** the reveal says _Yes — Le (♭6)._ with
    the label, not a bare number; a miss plays the note and then home; the
    twelve pads stay ≥ 44 px on the phone; the bench tile shows Gravity's
    rating (with _· voice N_ once the mic mode has been rated) and the
    Function dial keeps reading Home.
- **The Pull:** a cadence, then two degrees one after the other. _Which
  note leans harder — the first, or the second?_ The table: 7 up to home
  hardest, 4 down to 3, then 6 and 2; 1, 3, 5 rest. Pairs come from a bank
  of sixteen (each restless degree against each stable one, then 7 v 6,
  7 v 2, 4 v 6, 4 v 2 — 6 v 2 and 7 v 4 are left out as contestable); the
  order the two sound in is a coin flip. Rated with a 1/2 floor.
  - **What to check on hardware:** the balance stays level through both
    notes with only the pan's lamp lit; the reveal tips it toward the
    leaning pan, farther for a harder lean, the pan garnet, the plate
    _Ti leaning to Do′_; a miss replays the leaning note and lets it
    resolve (Ti then Do′, Fa then Mi). The plate's dots name each pair.
- No percent anywhere; both tiles show ratings.

## 2q. Cadence and Bassline — the guitar's harmony — follow-up item 6

Two Function drills on the guitar room's voices (`guitar-synth.ts`, struck on
the audio clock through one master gain at the stage's level). Bench strip →
_Cadence_ (Function · progression) and _Bassline_ (Function · root motion).

- **Cadence:** one of the guitar room's eight progressions (I–IV–V, I–V–vi–IV,
  ii–V–I, I–vi–IV–V, I–vi–ii–V, I–IV–vi–V, vi–IV–I–V, I–iii–vi–IV), strummed
  in a roved key, the root doubled below on the bass voice. Four pads: the
  answer and three others drawn fresh each round (keys 1–4). A miss strums it
  again, slower.
  - **What to check on hardware:** the strums sound like a guitar, not a
    click; the going train turns one wheel per chord and every wheel is the
    same until the reveal engraves the numerals and the plate names the
    progression; the pads' labels are numerals with en dashes; no pad is
    pre-lit.
- **Bassline:** the tonic chord rings on the guitar while four roots walk
  under it on the bass voice — the first always I. The ladder is seven rungs
  in numerals (keys 1–7, Backspace takes one back); the whole line is judged
  at once, like Echo. A miss plays the line again, slower.
  - **What to check on hardware:** the bass sits clearly under the chord; the
    beads stay level while the line plays and light in turn; the reveal
    strings the roots at their heights with signal / garnet rings and the
    status says _Yes — I–IV–V–I._ or _That was I–IV–V–I — listen again._
- **The readings:** both are ratings on the Function dial's row; the Function
  readout itself still reads Home.
- Stop mid-strum pulls the master gain to silence and disposes the voices —
  nothing keeps ringing after the stage closes.

## 2r. Subdivide — name the metre — follow-up item 7

The kit's drill on the Time dial. Bench strip → _Subdivide_ (Time · metre).
Two bars on the drum voices (`drum-voices.ts`) through one master gain at
the stage's level: 3/4, 4/4, 5/4, 6/8 or 7/8, two patterns each, the kick on
one and louder. Four pads out of the five metres, the answer among three
others drawn fresh each round (keys 1–4). A miss plays the bars again,
slower.

- **What to check on hardware:** quarters at 120, eighths at 240; the kick
  on one is plainly the accent; the lattice has one pallet per step and the
  lamps chase them through both bars with no bar line and no accent until
  the reveal, which lights beat one brass, draws the bar line and names the
  metre; 6/8 reads as two threes, 7/8 limps, 5/4 leans.
- **The reading:** a rating on the Time dial's row. The plan's alternative
  answer — tapping where beat one falls in the odd metres — is not built;
  naming the metre is the drill, and the tap ledger stays with Pulse.
- Stop pulls the master gain to silence and clears the lamps.

### 2s. Sing mode for Echo and Span — follow-up item 8

Both drills carry an **Answer by** toggle on the idle console: Tap, or Sing
or play. Choose the second and press Begin (Echo) or Practice run (Span): the
drill opens the microphone through the mic manager (`ear-echo-drill` /
`ear-span-drill`) before the run starts; if the mic is refused, the run
starts anyway on the ladder and a warning under the toggle says so.

- The phrase sounds as before. When the ladder would open, the console shows
  a **Listening** pad instead and the status reads "Sing or play it back —
  now, at the pace it sounded." Sing (or play an instrument at the mic) the
  phrase at the pace it sounded, starting straight away. Each note has its own
  window on that grid — a 250 ms breath, then note + gap per note, 450 ms
  grace at the end (`singLeadMs` / `singTailMs` in `timing.ts`); the median
  pitch of the confident frames in a window (its first 30% dropped) names the
  note, and it counts within 60 cents (`src/lib/ear/phrase-score.ts`). Press
  the Listening pad or Space when you are done, or wait for the window to
  close.
- The reveal is the same chain: right beads ringed, wrong beads marked, a
  bead the mic did not catch dashed. A miss replays the phrase slowly (Echo).
- Ratings: Echo's sung run rates under `echo-sing` with no guess floor and the
  phrases' difficulties untouched — the bench's Echo row shows `· voice N`
  once there is one. Span's sung run is practice only (no Calibration pad
  while Sing or play is chosen) and reads under `span-sing`; the Shape dial
  keeps the tapped reading.
- Stop hands the mic back; so does starting a tapped run, or leaving the
  drill.

Checks: the toggle is a radiogroup with two radios on both idle consoles; the
Listening pad is at least 44 px tall; no percent anywhere; the chain shows
nothing before the reveal.

## 3. Phase 1 regression (quick pass)

1. **Hairline practice** — one run: lands near your previous readings,
   trials feel quicker than before (audio was tightened ~15%).
2. **Home tap mode** — one run: cadence noticeably slower/roomier than the
   first build; still comfortable.
3. **Calibration** — from the bench's amber control: the Hairline stage
   opens in its sealed protocol (pendulums at rest, the protocol in the
   status line, an amber **Begin**). One run: three interleaved tracks,
   pooled reading, the plate shows the pendulums in phase, the etched
   index and "Next calibration due {date}" (fourteen days); the session
   bar reads "sealed … · due …". **Abandon** mid-run must NOT mark the
   column.
4. **Mercury Column on the phone** — after the fixes: no white blob at the
   tube top, the dashed cap floats above the glass, tube centred, column no
   longer fills the whole first screen.

## 3b. Stop behaviour — regression check

The bug found on 2026-07-31: Stop showed the end card but the clicks kept
playing, then the question came back. Worth re-checking on every drill.

1. In **each** of Hairline, The Grid, Home and Leap/Stack/Contour: start a
   run and press **Stop while the sound is still playing**.
2. Expect: audio cuts within a beat, the plate appears, and **nothing
   comes back** — no returning question, no further sounds.
3. Press **Back** mid-run on one drill too: same silence.
4. A stopped _practice_ run should still show a reading (marked
   "Provisional" if short). A stopped _calibration_ must show "nothing was
   marked" and leave the column untouched.

## 3c. Pacing — the one file to tune

If a drill feels rushed or draggy, all note lengths and gaps live in
`src/lib/ear/timing.ts`, grouped per drill. Note which drill and roughly how
much slower/faster you want it, and it is a one-file edit. Changing pacing
does not change what a drill measures, but big changes are worth a fresh
calibration since longer gaps make a task genuinely easier.

## 4. Known limitations (do not file as bugs)

- The Grid is perception-only, so it does not consume the latency wizard's
  number yet. The wizard stays banked for tap-timing drills (Pulse) later.
- Mic mode uses the same YIN tracker as the singing surfaces: very low bass
  notes (below ~E2) and heavily distorted guitar tones read less reliably.
- The Ear Lab has no guided tour yet (deferred deliberately).
- Contour's confusion section shows counts, not rates: its answers are
  directions rather than bank items, so there is no per-item denominator.
- Faculties Shape/Colour/Time now read numbers, but the Mercury Index's
  0-1000 anchors are still authored estimates from the JND literature, not
  fitted to real users (plan §9.4).

---

## Run log

| Date       | Device / audio path | Latency (3 runs) | Sing-mode verdict | Notes                                                                                                                                                                                                                                                                               |
| ---------- | ------------------- | ---------------- | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-08-09 | desktop (Arch)      | 274 ms ± 1.2     | _pending_         | Drills themselves reported fine. Latency reads ~124 ms high against `main`'s `MicLatencyWizard` (~150 ms, same audio path) — known bug, diagnosed in [`plans/ear-lab-handoff-2026-08-09.md`](plans/ear-lab-handoff-2026-08-09.md) §3. Not a device fault; do not re-run chasing it. |
| _fill in_  |                     |                  |                   |                                                                                                                                                                                                                                                                                     |
