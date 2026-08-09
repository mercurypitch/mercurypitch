# Ear Lab — hardware test script

The Ear Lab's readings depend on real speakers, microphones and rooms, so
every phase gets a manual pass on real hardware before merging. This is the
script for that pass. Run it on desktop first, then repeat the marked steps
on a phone. Keep results/notes per run at the bottom.

Owner: Komediruzecki · Plan: `docs/plans/ear-training.md` (§10 tracks status)

Setup: `pnpm dev` (add `--host` via `pnpm dev:host` for phone testing over
LAN), open the **Ear Lab** tab.

---

## 1. Timing calibration (the latency wizard) — NEW in Phase 2

The number every millisecond drill will subtract. Speakers up, room quiet.

1. On the Ear Lab dashboard, find the **Timing calibration** card. It should
   read **Not measured** on first run.
2. Press **Measure round trip**. You will hear five short clicks over about
   3 seconds while it listens through the mic.
3. Expect a result like **"140 ms ± 3"** on the card badge.
   - Wired speakers/headphones + built-in mic typically read ~20-120 ms.
   - Bluetooth output typically reads 150-350 ms. Both are fine — the point
     is the number, not its size.
4. Press **Re-measure** twice more. The three medians should agree within
   roughly ±10 ms. If the card warns "unsteady", the room was noisy — retry.
5. Failure cases to try deliberately:
   - Volume muted → expect "Could not hear the clicks", no value stored.
   - Deny mic permission → expect the mic-unavailable message.
6. Phone repeat: same steps; expect a larger but stable number.

Report: the three medians, the spread, device + output (e.g. "laptop
speakers + built-in mic").

## 2. Home in Sing-or-play mode — NEW in Phase 2

The ear-vs-voice diagnostic. Needs a mic; works sung or on any instrument.

1. Open **Home**, switch the toggle under the description to
   **Sing or play**, press Start. Grant mic access.
2. After each cadence + probe, sing (or play) the degree you heard — any
   octave. The buttons are disabled in this mode; your voice is the answer.
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
   *obvious*. If even those feel random, flag it — that points at audio
   scheduling, not your ear.
5. Watch the six dots pulse: they must light in a perfectly even rhythm
   regardless of which click was displaced. If the dots visibly reveal the
   answer, that is a bug.

## 2c. Leap / Stack / Contour — NEW in Phase 3

Three button drills, 12 rounds each, all sharing one engine.

1. **Leap** — name the interval (12 choices). Roved root, ascending or
   descending. Wrong answers replay slower.
2. **Stack** — name the chord quality (6 choices). Wrong answers replay
   the chord **broken then re-stacked** — check you hear the arpeggio then
   the block.
3. **Contour** — up / down / same, fast. Deliberately easy at first; as
   the rating climbs the gaps shrink toward quarter-tones.
4. For each: the reveal should colour the correct button green (and your
   wrong pick red), and the end card should show the rating with its
   session delta.
5. Dashboard check: Shape should now read a number (Leap and Contour
   averaged), Colour should read Stack's rating.

## 2d. Ear Report — NEW in Phase 3

1. After playing the drills above, open **Ear Report** from the dashboard.
2. **Thresholds over time**: sparklines for Hairline and The Grid. The
   line should RISE as your readings fall (it is plotted inverted on
   purpose — rising must mean improving). Check the "best" figure.
3. **Confusion maps**: one section per drill. Expect sentences like *"You
   answer Fa (4) as Sol (5) on 33% of attempts"* and a heatmap where rows
   are what played and columns are what you answered.
4. Deliberately miss the same degree the same way 3-4 times in Home, then
   re-open the report — that pair should top the list.
5. Sections with no misses should say so, not render an empty grid.
6. Phone: the heatmap scrolls horizontally inside its own box; the page
   itself must not scroll sideways.

## 2e. The Daily Sprint — NEW in Phase 4

The habit loop. Everything here is local and same-day, so the quickest
way through it is to just play the three drills it names.

1. On the dashboard, find **Today's sprint** above the drill cards. It
   should list **three** drills, each with a reason chip — on a fresh
   profile all three read **Never measured**.
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

## 3. Phase 1 regression (quick pass)

1. **Hairline practice** — one run: lands near your previous readings,
   trials feel quicker than before (audio was tightened ~15%).
2. **Home tap mode** — one run: cadence noticeably slower/roomier than the
   first build; still comfortable.
3. **Calibration** — one run: three interleaved tracks, pooled reading,
   column marks. Abandoning it mid-run must NOT mark the column.
4. **Mercury Column on the phone** — after the fixes: no white blob at the
   tube top, the dashed cap floats above the glass, tube centred, column no
   longer fills the whole first screen.

## 3b. Stop behaviour — regression check

The bug found on 2026-07-31: Stop showed the end card but the clicks kept
playing, then the question came back. Worth re-checking on every drill.

1. In **each** of Hairline, The Grid, Home and Leap/Stack/Contour: start a
   run and press **Stop while the sound is still playing**.
2. Expect: audio cuts within a beat, the end card appears, and **nothing
   comes back** — no returning question, no further sounds.
3. Press **Back** mid-run on one drill too: same silence.
4. A stopped *practice* run should still show a reading (marked
   "Provisional" if short). A stopped *calibration* must show "nothing was
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

| Date | Device / audio path | Latency (3 runs) | Sing-mode verdict | Notes |
| --- | --- | --- | --- | --- |
| 2026-08-09 | desktop (Arch) | 274 ms ± 1.2 | _pending_ | Drills themselves reported fine. Latency reads ~124 ms high against `main`'s `MicLatencyWizard` (~150 ms, same audio path) — known bug, diagnosed in [`plans/ear-lab-handoff-2026-08-09.md`](plans/ear-lab-handoff-2026-08-09.md) §3. Not a device fault; do not re-run chasing it. |
| _fill in_ | | | | |
