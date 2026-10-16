# Decisions (draft v1)

One line each, with the reason. These are Lesson 2's own choices; what waits for the owner across
the series stays in MASTER-PLAN § 12, and the questions this lesson raises are at the end.

## Shape and length

1. Shape: MASTER-PLAN § 4.1's beat sheet scaled to 6:36: a cold open with a warm-up retrieval and the hook, the title, a short spoken promise, four acts, a recap and the next hook. It is the series template; Lesson 1's deviations (no promise, one sung gap) do not apply, and the Phase 1 re-voice adds a promise to Lesson 1 too.
2. Length about 6:30, estimated 6:36 at 2.6 words a second: T03 holds five ideas and T04 one more, with two refutations, a predict and a sung checkpoint, inside D6's 6 to 9 minutes. Lesson 1's scratch voices ran at 2.73 words a second, so the measured cut may be nearer 6:20.
3. The warm-up asks Lesson 1's octave afresh ("How much faster does the higher A shake?") rather than a naming question: the 2:1 octave, one turn of the spiral, is exactly what twelve equal steps fill, and asking it puts the spiral back on screen in the first seconds.
4. The cold open restages Lesson 1's two sung As, now landing on the spiral: the same sound and the same beads re-open the persistent object, and Merc's A3 and A4 are already in the mix's sample set.
5. Orange's first spoken line comes at about 0:16, after the warm-up; orange sings at 0:03, so both hosts act on the phenomenon from the first seconds, and the hook question ends by about 0:28 (playbook rule 1).
6. The hook is split between the hosts: blue states "Seven letters, but twelve notes", and orange, the learner, re-asks Lesson 1's closing question, "Then where do the other five come from?"

## Teaching

7. Orange's cold-open guess is "Are those just gaps?", the spiral form of misconception 1 (the in-between notes are not real notes); the first heard step breaks it eight seconds into Act 1.
8. Every orange line is a sincere question or a sincere wrong guess (11 lines, audited in SCRIPT.md); unlike Lesson 1's o7, orange never answers a recap question, and its recap line is a what-if question (a tone in cents).
9. Sound before symbol: "semitone" is named only after the first step and the twelve-step climb are heard (b13), "tone" after tone-split, "sharp" and "flat" after the black keys have sounded, and "enharmonic" after two names were seen on one key.
10. "Semitone" and "tone" lead, with "half step" and "whole step" said once each: the drafts are British (MASTER-PLAN § 12 item 5), ABRSM uses tones and semitones, and the app's Contour labels its tiers "Half steps" and "Whole steps", so the viewer meets both pairs.
11. The climb runs A3 to A4, Lesson 1's lit turn, so its twelve steps end on numbers the viewer already knows: 220 Hz doubled to 440 Hz.
12. "Exactly the same size" is shown rather than argued: the climb's beads on equal 30-degree steps, then the ring of twelve seen from above. The ratio that makes it true stays off the film (decision 21).
13. The predict is "Which step is bigger: B to C, or C to D?", two choices, so the film card and the page widget are both the playbook's two-choice predict, and the curriculum's misconception 2 is the guess on trial.
14. Orange's guess carries its reasoning ("No black key to step on?"), so it reads as a sincere stepping-stone intuition, not a strawman.
15. Misconception 2 is broken twice: by ear (B to C against C to D, then against C to the black key above it) and by picture (the keyboard drawn with every key the same width), because a real keyboard's equal white keys are what mislead.
16. Step bars, 40 px per semitone, carry each heard step's size with the sound off; on the keyboard the two pairs look equally far apart, which is the point of S8d.
17. The hook's answer lands at the end of Act 2, with the tiles: five letter gaps a tone wide hold the five notes, B to C and E to F hold none, 7 + 5 = 12. It is the episode's central idea, so it carries the second signature moment.
18. Misconception 1 ("black keys are sharps") is voiced after "one key, two names" and broken with E sharp = F only; B sharp, C flat and F flat stay on the page's "Show the rare ones" switch, to keep the film's load low.
19. "Enharmonic" is said once in the film and once on the page, after the idea: viewers will meet the word elsewhere, and naming it costs four seconds.
20. The app's sharps-only labels are claimed only for its pitch line ("On MercuryPitch's pitch line, you'll see the sharp names"), never "always": the sheet-music view spells flats in flat keys and the key picker offers "Bb" (FACTS 28).
21. The 2^(1/12) ratio, the hertz gaps and Ellis are in the page's Go deeper drawer and in FACTS, not in the film: CURRICULUM makes the ratio a writer's note, and the film keeps the concrete version (twelve steps double 220 Hz to 440 Hz).
22. The film never dates the cent: Ellis first defined it in 1880 and introduced it in his 1885 paper (FACTS 22); the page says only that he used it in 1885.
23. Cents are taught with a glide whose readout shows the true cents at each moment (Lesson 1's sweep rule, FACTS 25), then with the app's own reading, the nearest note and -50 to +50 flipping at 50 cents, drawn as a labelled house-style monitor (FACTS 30).

## The checkpoint and safety

24. The checkpoint is a one-semitone slide on a hum or "ooh", from Merc's A or the A an octave up: every voice type the app knows has one of them in its comfortable range (FACTS 38), and a slide is gentler than a jump for a first semitone (Kodály's note on half steps, research/curriculum-benchmark.md § 2.6).
25. No comfort-check line before the checkpoint: a one-semitone hum slide at speaking volume is within a comfortable hum (the playbook's house rules); the film keeps "Keep it gentle. Never push." and the page adds "stop if anything feels uncomfortable". Lesson 2 is a theory lesson, so the vocal-coach gate does not apply (owner question 3).
26. Merc's slides are `sound` events (`slide-blue`, `slide-orange`), like Lesson 1's `tune`: a `sing` event plays a fixed Echo sample and cannot glide, so the synthesised demo-audio "ooh" follows the exact contour, and `merc-shots.py` gets a `slide` special case with state `ride`. The script's schema is unchanged.
27. Blue models first, the viewer sings in a 5.2 s guided pause, orange answers an octave higher, as in Lesson 1's call and response: the worked example, then the fade (rule 16), and the octave counts (rule 22).
28. Orange's checkpoint question is "How do I know I went up exactly one semitone?", answered with the cents readout: it ties the sung step to the unit and sets up Lesson 3's landing in cents.
29. The pitch canvas (S14, S16) uses the app's canvas colours, amber target and violet singer (MASTER-PLAN § 5); every explanatory diagram uses the series code.

## Recap, links and the next hook

30. The recap's listening question compares two steps (C to D, then E to F) instead of naming one alone: comparing is fair for a beginner; naming a lone interval is the later skill Leap trains. Its caption says only "[two steps]", so it cannot give the answer away.
31. The film's end card shows `mercurypitch.com/ear-lab` with "Leap · m2 = semitone · M2 = tone": no link opens Leap today, an address burned into the picture cannot change after publishing, and `/ear-lab` stays valid. The page, the footer and the YouTube description switch to the proposed `/exercises/semitone-or-tone` when the `ear-drill` launch kind ships (owner question 1).
32. The names m2 and M2 appear only in the page's practise card and on the end card: the drill's buttons use them, and Lesson 6 teaches interval names properly.
33. Contour appears only on the page, as an optional warm-up: it asks up, down or same, never semitone or tone (CURRICULUM).
34. The next hook is Lesson 3's curriculum hook; its numbers were checked against the full paper (59 % of 1,105; 13 % and 16 %; the abstract's 10 to 15 %), and the viewer now knows the word "semitone" it rests on.

## Picture and motion

35. Three signature moments, one per act, so the film's peaks are spread: the ring of twelve (Act 1), the keyboard drawn fair with the five lifting out (Act 2), and one key with two names (Act 3).
36. One persistent object: spiral, keyboard, tiles, vertical ruler, lanes, each change on screen and each builder join a frozen frame (HANDOFFS); the ruler stands vertical so pitch is height again once cents are measured (rule 20).
37. The keyboard close-up is a uniform 2x push about (960, 820) on Lesson 1's keyboard, because the A3 to A4 octave is centred on x 960 there: no relayout, and the join with Lesson 1's geometry stays exact.
38. Gold only for the fit, one thing at a time; the predict's right pill gets a check icon and ink; violet only for the contrast cases (orange's guessed big-jump arc and the "black = sharps?" tint).
39. The title sting and card keep Lesson 1's five chimes and staff, for series identity; the episode's own touch is the dim A♯3 bead flying into the lens, "into the gap".
40. The Mercs leave the dense diagrams (S4 to S13) and orange comes back small to ask (rule 13); orange looks rather than points, because the nub is one-sided (MERC-BIBLE backlog item 4).
41. No Merc pass changes at a cut with a Merc on screen: m14-duo runs on through the recap, and the Mercs hop out before S16's drop (Lesson 1's critic 03 found unmatched Merc cuts).
42. Sparkles are off in every pass; a celebration is one gold ring (Lesson 1 decisions 23 and 27).
43. The film keeps one meaning per word: "sharp" and "flat" never mean slightly high or low; that second meaning is in the page's Go deeper with its source (FACTS 37a).
44. Captions write numbers as on screen and note names in words ("C sharp"); the picture writes C♯ with the Noto Music glyph and the app's own labels as "C#4".

## Page

45. Page text: the steps run to 826 words (MASTER-PLAN § 4.2 budget 500 to 900) and the Go deeper drawer to 147, closed by default; step 3's reveal was cut back so its mix-up card carries the evidence.
46. Two mix-up cards, one per concept (playbook rule 3), each inside the step whose toy refutes it, as Lesson 1 placed its card.
47. On phones the tile row stands vertical (13 tiles of 44 px) and the keyboard shows one octave with 44 px black-key targets: touch targets of 44 px, no sideways scroll, and pitch is height.
48. The Semitone or tone? game gives feedback about the sound, never the listener, and keeps no rating or streak: it is a practice toy, not a test (rules 21 and 25).
49. The warm-up retrieval asks Lesson 1's questions 2 and 4 under their Lesson 1 ids, reshuffled and without stored answers, so they measure delayed retrieval (MASTER-PLAN § 9); question 4 (after B3 comes C4) also primes the B-to-C boundary this lesson explains.

## Process

50. Brief front matter `renders: ask`, `unattended: false`: no unattended Lesson 2 production run has been authorised; flip them when the owner does.
51. Every frequency comes from f = 440 x 2^((m - 69) / 12), rounded to two decimals and re-checked by script (FACTS 6); the timings come from a simulation of `tools/cues.py` at 2.6 words a second, so SCRIPT.md and STORYBOARD.md agree to the tenth of a second until the first voice pass re-times both.
52. Considered and left out, though true: Voice Mirror's 12-cent full-marks window (a tuning value that changes between releases), why there are twelve notes (the Pythagorean comma, Season 2's T29), quarter tones, and C sharp and D flat differing in other tunings (Season 2).
53. Aligned with the owner's decisions of 16 October 2026, made while this draft was written (MASTER-PLAN § 12 items 1, 2, 7 and 9): the Echo sung notes stay, because the owner holds their rights; the film's sources move to the private repository; and the page lives at `/learn/02`, built from `src/features/lessons/kit/` like Lesson 1's page, with the episode as an MP4 on R2. Orange's name and pronouns are still open, so no document gives orange a pronoun.

## Open for the owner

1. The end card's address: `/ear-lab` (recommended, decision 31), or the proposed `/exercises/semitone-or-tone` if the `ear-drill` launch kind ships before Lesson 2's delivery render; and whether that slug name is the one to build.
2. For the Phase 1 App track: a two-item Leap launch changes the drill's Elo guess floor (`src/lib/ear/drills.ts:58-59`), and someone must decide whether such a run moves the viewer's full Leap rating (WEB-SPEC, practise link).
3. Whether the vocal coach should glance at the Lesson 2 checkpoint, though it is a theory lesson and only a one-semitone hum slide (decision 25).
4. If MASTER-PLAN § 12 item 5 decides American English, "half step" and "whole step" lead and "semitone" and "tone" become the alternates: about ten lines to re-voice, the term cards on the page, and the captions.
