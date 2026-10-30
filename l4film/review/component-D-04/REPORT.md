# Component critic D-04 (verification): s09-names, s10-ti, s11-why

You sent only paths, with no opinions. For the spec I read STORYBOARD v3.1 rows 9a–11f and the D sections of HANDOFFS. I did not read the notes, ledger, decisions or source. I have not written REPORT.md, because my harness does not allow report files. Please save this text to `/home/user/mercurypitch/output/motion/lesson-04/review/component-D-04/REPORT.md`.

## Verdicts
- **s09: KEEP.** Item 1 is fixed. Nothing new broke.
- **s10: KEEP.** One small new finding (item 1 below).
- **s11: KEEP.** Items 2–4 are fixed.
- **Group:** nothing blocks. Every finding below is polish.

## D-03 items
1. **FIXED.** s09 15.0–19.9: I sampled the inside of every black key 10 times a second. The keys keep their own colour: blue minus red is 10 everywhere, and the maximum luma is 20–24. No violet disc shows on F♯4 at 18.2 or on A♯4 at 16.0 and 17.5. The only bright spots, luma 45–65, are dust motes (see item 5).
2. **FIXED.** s11, rows y 1030–1080: from 12.8 to 24.4 the mean luma is 15–16 and the maximum is 24 or less, which is the ground. The strip is gone from the frame by 12.8 and comes back over the pull.
3. **FIXED by the row change.** The credits, kicker and axis leave at 24.40–24.50, which matches the amended 11c/11d rows (320.34–320.44).
4. **FIXED.** On their turn the dim chips rise from luma 15.6 to 108 (at 24.25). The cascade now visibly reaches the fourth shelf: do 23.48, mi and so 23.68, re fa la ti 23.92, the sharps 24.18.
- **D-03's numbers:** all three clips are now 60 fps (D-03 found 30). The lip-sync and contrast numbers still hold.

## Shots as read
- **s09** (film = clip + 229.24)
  - 0.37–2.25: chapter card over the dimmed staircase.
  - 2.36–15.16: slow push. The bokeh slides against the diagram, so the parallax is faint but present.
  - 15.16–16.56: the push quickens into an ECU at 2.4x.
  - 16.61–19.61: truck along the names.
  - 19.46–20.26: pull out.
  - Then a static WS with Tavi: the pill morphs 26.42–26.88, the slide to D runs 33.97–34.8, the slide back 39.36–40.16.
  - Not in row 9e: at 22.0–22.85 the bottom house rides up with stair 1's rising outline, fades out, and fades back in on stair 1.
- **s10**
  - Push into CU-C 0.07–1.55, then a static CU.
  - Not in row 10a: ti, then do, light at 6.2–7.4.
  - Pull 10.07–11.77, then a static WS.
- **s11**
  - WS; push to F-exp 2.76–3.96, then the drift.
  - Push to F-chart 11.19–13.04.
  - Pull 24.29–25.09, then a static WS.
  - Not as HANDOFFS has it: "leading note" sits centred over ti (x 840–1195, baseline about 250) with a hairline down to ti's tread, not at x 660, baseline 300. It reads well. Amend HANDOFFS or move the label.

## Problems, ranked (all low)
1. **s10 10.75–11.40, left third.** As the pull brings stairs 1–3 back into frame, they have no names. "do re mi" only fade in at 11.35–11.45, while the camera is still moving. They were hidden at 0.4–0.8, presumably because "mi" would be cut by the frame edge in CU-C. Fix: fade each name in as its column clears the left edge, all done by about 10.9.
2. **s11 24.18–24.6, fourth shelf.** The sharps' lift is still at luma 83 at 24.45, after the pull has started (24.29) and while the credits are leaving. Fix: shorten the settle back so the chips are at rest by 24.29, or start the cascade 0.15 s earlier.
3. **s09 26.58–26.80, top right.** The pill sits empty for about 0.22 s while it widens. Fix (optional): let "fixed do: do = C" fade in, clipped to the pill as it widens.
4. **s09 22.0–22.85.** The house rising with the outline goes beyond what row 9e asks for, and stair 1 is without its house for about 0.3 s. It supports the line "moved up to D". Either amend the row or keep the house where it is.
5. **Dust motes at 2.4x.** At s09 19.0 a dot of about 10 px (luma 55) sits on C♯5's face, and at s11 24.0 one sits on the F♯ chip. Optional fix: cap the dust size at large camera scales.

## Numbers
- **Holds:** s09 1.5 s (1.1 per 30 s, longest 0.3 s, on the card); s10 0.7 s (0.8 per 30 s, longest 0.1 s); s11 0.6 s (0.4 per 30 s, longest 0.2 s).
- **Loudness:** −15.6, −16.7 and −15.6 LUFS; true peak −1.4, −1.9 and −1.6 dBTP.
- **The cuts:** s09 to s10 has a mean change of 0.41, with 0.017 % of pixels changing by more than 24; s10 to s11 has 0.40 and 0.02 %. Only the idles, glows and dust change.
- **Sync in s10:** the sung onsets are at 12.95 and 15.65 against bead landings at 12.94 and 15.64, and at 23.52 against 23.51.
- **Contrast:** "F♯" on its lit black key 5.3:1; "ti" on its lit stair 5.7:1; "ti = C♯" 16.6:1.
- **Single-frame pops:** s09 at 12.383; s11 at 8.917, 19.400 and 20.433. Each changes 0.09–0.27 % of pixels, from label fades and dust. Nothing shows on the frame-exact sheets.
- **Facts:** every on-screen string traces to FACTS 78–82.

## Could not judge
- The whoosh and pad against the voices: there was no music-only render.
- The mix on phone speakers.
- Captions over the s10 CU and the s11 chart.
- Whether the faint push parallax reads as depth at phone size.

I deleted the frames I worked from in /dev/shm to save disk. `measure.py` reproduces every number.
