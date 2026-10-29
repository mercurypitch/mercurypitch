**Verdict: ONE MORE PASS**

I could not write files in this harness, so please save this text to /home/user/mercurypitch/output/motion/lesson-04/review/script-03/REPORT.md. Times below use the scratch clock (cues.json). You passed on no opinions, so I had none to set aside.

**Previous report**

1. Call to action and voice range: **FIXED** (b53 at 7:32.9, plus the card line). See new item 4.
2. Doctor lines: **FIXED** (the s13 note and FACTS 83). See new item 5.
3. o13 and b52 scope: **FIXED** (7:22.5 and 7:28.5).
4. Breath after the viewer's turn: **FIXED**. The gap is now 1.8 s (402.8 to 404.6 s).
5. Ladder: **PARTLY**. It has six rungs, but the moment drawn is off by one (new item 2).
6. Captions where "do" read as a verb: **FIXED** (5:06.0 and 5:20.6).
7. b33: **FIXED** (4:39.6).
8. s09 return to C: **FIXED**.
9. Length: **FIXED**. The target is now 7:30 to 9:00. I get 8:36.3 by word rate and 8:44.9 by the ratio. The YouTube title counts (54, 49, 27) are now right.

**Beats as read:** cold open (0:00 to 0:33), title, promise, recall (0:46), Act 1 (1:08 to 2:25), Act 2 (to 3:48), Act 3 (to 5:40), Act 4 with Merc, then Tavi, then the viewer (to 6:43), recap and call to action (to 7:45), tease, end card. Every beat has a job.

**New problems, ranked**

1. **The "learned home" label drops the hedge (s11, 5:20 to 5:27).**
   - FACTS 23a allows this only with "seems", and the brief's mute list does not include the label.
   - Fix: "learned, it seems", or cut the label.
2. **The ladder shows one rung more than the app would (s14, 7:33).**
   - In the app, the rungs are only the notes after the current one (`scaleNotes.slice(noteIndex + 1)`, use-scale-runner-controller.ts:229-231). The current note is a dashed line that ends at the playhead (PitchOverTimeCanvas.tsx:438-447).
   - Once do and re are sung, mi is the current note and only five rungs are left.
   - Fix: show the line past do and on re, with six rungs from mi to do. Correct FACTS 85 to match.
3. **Captions give two of Merc's lines to Tavi.**
   - captions.py adds a speaker label only when the speaker changes, and it ignores sung runs.
   - "Still waiting…" (0:20.0) and "Now you. Sore, hoarse…" (6:11.9) both come straight after "[Tavi sings…]" with no "MERC:". On mute, the invitation to sing and the first care line read as hers.
   - Fix: let each sung sound set `last_who`.
4. **The practise card's path leaves out two taps.**
   - At b803c7d43 the × opens "Skip the intro?" with "Keep going" and "Yes, skip" (FirstLight.tsx:746; skip-confirm.tsx:45-61). FACTS 88 does not mention this.
   - Settings is a separate tab (AppNavTabs.tsx:385), so the viewer has to go back to Exercises.
   - Fix: "First visit? × › Yes, skip" on the card and the end card, and "then Exercises › Scale Runner". Add both steps to FACTS 88.
   - Keep the Settings line. The dialog promises "your range", but nothing in src/features/onboarding sets the range Scale Runner uses.
5. **The doctor lines at the foot of the frame will sit under captions (6:11.9 to 6:42.8).** The brief assumes captions on, so for 31 s the caption band covers them. Fix: keep the care block above the bottom 20 per cent, with the small type at 30 px or more.
6. **The chimes put C♯, this film's ti, over the D pad.**
   - The pad plays under the title chime (33.0 to 36.5 s) and the end chime (473.1 to 478.5 s). Both chimes are A major chords (mix.py:324-326).
   - Fix: turn the pad down under both, or move this film's chimes to D. Judge it by ear.
7. **Small text fixes.**
   - Two caption lines are 43 characters (0:36.6, 1:01.6).
   - The count-in caption runs at 23.2 characters a second (6:33.0). Shorten it to "[Merc sings do]".
   - Keep FACTS 31's quotation marks on "support" in s15.
   - Credit "as summed up in Janata et al., 2003".
   - The s08 note's G4 and E4 sit in middle C's own octave, not "the octave above" it.

**Numbers**

- Scratch length is 478.47 s.
- Merc: 55 lines, 709 words. Tavi: 14 lines, 193 words, every one a question.
- The full mix is −16.0 LUFS, true peak −1.4 dBTP, loudness range 5.0 LU.
- The pad is silent (−240 dB) inside every line, every sound and all six listening silences. It plays in 11 windows only, 11 to 19 LU under the speech.
- The viewer's turn and q3 measure −52 LUFS, room tone only. The count-in is −20 LUFS.
- The whooshes peak at −21 to −23 LUFS against −12 LUFS for speech. There is no music under them, so the effects-against-music figures (+24 to +27 dB) mean nothing here.
- Chapter breaths are 2.2 s. No line overlaps a sound.

**Could not judge from text and numbers**

- Whether the count-in carries on phone speakers, and whether a singer can come in 0.2 s after it.
- Where Merc and Tavi stand on screen; no picture note places them.
- The practise path in a real browser at phone width. Tab names can collapse to icons (AppNavTabs.tsx:444).
- The vocal coach's sign-off on the script (the teaching playbook requires it), the final voices, and how the chimes sound.
- The reference folder (study/) is empty, so there was nothing to compare against.

**ONE MORE PASS**

_(Saved by the director from the critic's returned text; the critic could not write files in this harness.)_
