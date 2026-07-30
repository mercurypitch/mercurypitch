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

## 4. Known limitations (do not file as bugs)

- Millisecond drills (The Grid) are not shipped yet — the wizard's number is
  banked for them; nothing consumes it visibly today.
- Mic mode uses the same YIN tracker as the singing surfaces: very low bass
  notes (below ~E2) and heavily distorted guitar tones read less reliably.
- The Ear Lab has no guided tour yet (deferred deliberately).

---

## Run log

| Date | Device / audio path | Latency (3 runs) | Sing-mode verdict | Notes |
| --- | --- | --- | --- | --- |
| _fill in_ | | | | |
