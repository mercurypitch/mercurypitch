# Decisions (unattended run)

One line each, with the reason. Newest last.

1. Host canon: the WebGL2 resin Merc from `src/lib/merc`, bundled read-only. It is the
   premium-exercise host and renders deterministically.
2. Orange Merc: no orange Merc existed in the repo. Made one with the same body: a warm palette
   through `setLook`, plus a build-time swap of the shader's hard-coded cool light
   (`tools/build-merc.mjs`), so his floor light is amber. The app's source is untouched.
3. Merc is pre-rendered per performance (about 0.4 to 1.0 s a frame on this 4-core CPU with
   SwiftShader). Rendering him live inside the composition would make a full render take hours.
4. One straight-alpha WebM per performance, with alpha = max(A, R, G, B) over his premultiplied
   colour. The first design (matte + plus-lighter light pass) was exact but breaks inside any
   transformed or faded layer: CSS blends only within its stacking context. The production
   research measured the light pass painting black over the background.
5. ffmpeg graph: force `format=rgba` before any other filter. Left to negotiate, ffmpeg chose a
   format without alpha, every matte came out opaque, and two passes had to be re-rendered.
6. 60 fps master, Merc at 30 fps (animation on twos). Smooth camera, waves and type cost nothing
   extra; Merc at 60 would double the slowest step. Replaced by 29.
7. Scratch narration with local Kokoro-82M (Apache-2.0): blue `am_michael` at speed 0.84, orange
   `af_heart` at 0.9. No API keys exist in this environment. The owner-approved ElevenLabs D2 voice
   is the planned final voice for blue.
8. Merc's sung notes: the Echo "ooh" samples A3 and A4 (development placeholders; measured 220.0
   and 439.6 Hz by the critic). The S17 tune uses the app's synthesised "ooh" timbre.
9. Every musical example is synthesised at its exact frequency in `tools/mix.py`. No recorded or
   licensed music; a quiet open-fifth pad in A, ducked to silence half a second around every
   example.
10. Music-only version: the music-only mix (bed and stings) muxed onto the same picture, not a
    second HyperFrames render. The picture is identical by construction, and the skill only needs
    the music-only audio to measure the effects against.
11. Loudness: -16 LUFS target for a calm teaching film, held to -1.2 dBTP true peak; the first mixes
    land near -19.5 LUFS because peaks limit the gain. A gentle limiter comes in the audio pass.
12. Captions: a word-perfect SRT/VTT from the cue sheet, with speaker labels on speaker change and
    sound descriptions in the gaps. Nothing burned into the long form (redundancy principle;
    production research). The bottom 17 % of every frame is kept clear.
13. Pacing for a teaching film: about 4 to 8 layout changes a minute, a visual event every 2 to
    5 s, dressed holds while a diagram is explained (brand-motion research). This replaces the
    kit's 12 to 15 compositions per 30 s.
14. Storyboard went through two fresh critic rounds before building (ONE MORE PASS both times). All
    findings were applied as v2 and v3, including four teaching errors: octave numbers start at C;
    letters at true semitone angles; "lines up" is not "same note"; the slowdown is 220x, not 100x.
15. Parallel build: six builders own contiguous scene groups, with exact handoff frames between
    groups (`HANDOFFS.md`) and a shared kit (`assets/lib`). The workflow tool runs only two agents
    at once on this machine, so builders run as background agents.
16. Lines re-voiced after the critic rounds (b19, b39, o6); the cue pipeline re-timed scenes, Merc
    performances, the mix and the captions automatically.
17. CTA: mercurypitch.com/mirror. Voice Mirror is free, needs no account and ignores octave
    errors (`src/lib/mirror/metrics.ts:249`). The web drills score the written octave.
18. Durable sources: brief, facts, script, storyboard, handoffs and decisions are copied to
    `docs/plans/find-your-pitch/lessons/01-what-is-a-note/`. The HyperFrames project stays in
    gitignored `output/motion/` per the house rules; where its durable home is, is an owner
    decision.
19. Merc videos are static `<video data-merc>` tags in each scene, timed by `tools/merc-tags.py`
    from the cue sheet; `L.merc()` only adopts and places them. HyperFrames parses videos and their
    timing from the HTML before scripts run, so script-made videos rendered as nothing (found by
    builder A, confirmed in the producer source, fix proved by a render).
20. A container restart stopped every background job at 01:05. Files survived; the Merc queue was
    restarted from the first incomplete pass and every builder resumed from its transcript.
21. Plan review (four lenses, adversarial verification): the reveal line b16a became "Higher, yes.
    But together, they melt into one note." (played in sequence the octave plainly sounds higher;
    only together do the tones fuse), and s17's on-screen claim became "counts any octave" (Voice
    Mirror scores octave-folded and never asks for an A).
22. Music bed: silent under narration and every example (coherence), but present in act
    transitions and under the dressed pauses (predict, hum, quiz), so the mix never drops to
    digital silence (critic 03). The brief is updated to match.
23. Merc's celebration sparkles (the app's own) stay only on the end card; elsewhere they read as a
    stock effect (critic 03). A build-time switch (`__mercSparkles`) turns them off per pass.
24. Merc crown crescent: a one-frame black crescent at the top of a fast stretch (5 of 17 passes).
    `merc-pass.mjs` re-renders a flagged frame at a nudged time; passes are written atomically.
25. b21b re-worded to "The same letter, every time." (naming is always true; sounding the same is
    the perception claim FACTS 9 never makes absolute).
26. Two-second chapter breaths after the act 2 and act 3 cards (lines b13 and b23 now start 2.2 s
    after their act marks): the pad swells there without playing under narration, and each act
    gets a real chapter moment (critic 04). The film is 4:57.
27. Sparkles are off in every Merc pass, the end card included (critic 04 still read them as a
    stock effect); scenes mark a celebration with one gold ring.
28. Ticket-stub cards (perforation and stub column) became plain rounded cards: the critics read
    the shape itself as a generated-video tell.
29. Merc renders at 60 fps (replaces 6). Critic 05 measured him changing only on alternate frames in
    the 60 fps master, worst on the hop. `merc-shots.py` snaps every pass to the film's 60 fps grid
    and `merc-pass.mjs` renders it at 60 (two lanes, about 2.5 hours for all 17 passes on this machine).
30. Merc tags are written in frames (`merc-tags.py`). The renderer floors film time into frames
    extracted from media-start with millisecond timestamps, so three-decimal seconds could tip a
    tag one frame either way and repeat a frame at a cut. Each tag now starts half a frame before
    its first film frame, and its media-start sits half a frame past the source frame it wants, so
    film frame n shows pass frame n - P exactly (checked by simulating every frame and by hashing
    ffmpeg's own extraction). s10's orange lead is `data-merc-lead="0.100"` (6 frames), no longer manual.
31. The Merc who is not speaking idles, still turned to the speaker by his facing bias. `listen`
    draws arcs at his side and closes one eye, and on mute it read as the listener talking (critic
    05). It stays only where a sound arrives at him in the picture (S3d, `m03-orange`). The speaker's
    arcs run at 0.5 while he talks and at full on sung notes, as step keys with 80 ms fades.
32. A scene never sets `visibility: visible`; it uses `inherit`. The runtime hides a scene's host
    with `visibility: hidden`, and a child set `visible` overrides it: s03's string, set visible by
    its own timeline, drew the hairline over s01 and s02 for critics 04 and 05.
33. End card: each bead circles its own small orbit beside the lockup (blue left of the mark, orange
    right of "Pitch", orange twice per blue turn), not one ring round the whole lockup. With the
    mark 65 px from the top edge and 90 px between the wordmark and the line, no ring fits that stays
    40 px clear above and below.
34. Dimmed answer diagrams in the recap show no labels until their answer lights them (at 34 % they
    sat at 1.35:1).
35. "Twice as fast" lands 0.5 s after the act 2 mark, once the carried 220 line has glided under it.
    The mark has no spoken word to tie it to, and type over a moving line would collide.
36. A room tone runs under the whole film, in both mixes (amends 22). Critic 06 counted 78 stretches
    of digital silence of 150 ms or more in rc-04 (28.8 s in all, the longest 0.80 s at 1:56.6). They
    were not intended: 22 says the mix never drops to digital silence. All 78 sat where the bed is
    ducked to exactly zero: 50 between two spoken lines, 26 beside an example, a sung note, a sting
    or a pause, and 2 inside a line's own pause. The bed still stays out from under speech and
    listening. The floor is steady pink noise between 150 and 3000 Hz at -55 LUFS, 37 LU under the
    voice and about -56 dBFS in the gaps. It has no pitch, so it gives nothing to hear against an
    example. The mix now has no digital-zero stretch, and the voice level and loudness are as before.
37. No Merc `listen`s anywhere (replaces the S3d exception in 31). In S3d Orange is alone in frame
    while Blue narrates off screen. Wearing the arcs and a wink, he seemed to speak Blue's line
    (critic 06). He idles there, turned towards the sound. Only the Merc making a sound shows arcs.
38. A host pass runs past the end of its last scene: 0.1 s for m03-orange and the m21 passes, 0.2 s
    for m10. A tag ends on its pass's last frame, so a pass that stopped exactly on the scene's end
    left that scene's last frame without Merc. On the film's last frame (4:57.033), both hosts and
    their reflections vanished (critic 06).
39. The recap deck is dealt from s19's first frame. Before, it waited 0.15 s for the recap mark.
    s18's chart now thins out on an accelerating fade that ends on the cut, 1 % on its last frame.
    Its smoothstep had emptied the frame 0.3 s early, and the room stood empty at 4:16.55-4:16.9
    (critic 06). What is left is about three near-empty frames around the cut, still on the recap
    whoosh.
40. S15b (the A4 and C4 cards and the gold flash) frames the whole helix about 11 % smaller and
    lower.
    - Scale: k 1.32-1.36 becomes 1.17-1.205; at the gold flash, 1.25 becomes 1.11.
    - Height: oy -185 becomes -95, and -175 becomes -85.
    - Result: the helix sits about 165 px from the top with about 215 px below it. The lowest
      184 px of that is the caption band.
    - Why not fully centred: at the old size, a centred helix put the A2 label and the turn tag
      "2" below y 896, into the caption band (STORYBOARD c1.11), where the spiral fades labels
      out. Critic 06 had seen the helix 20 px from the top with 250 px empty below.
    - The C4 card moves down 80 px to stay level with its tick.
41. In LOUDER/HIGHER the small "time" axis label shows only on the lit panel, in ink-2, where it
    measures 8.5:1 on the plate. Inside a dimmed panel (50-55 %) it measured 2.5:1 (critic 06). To
    pass there, it would have had to be the brightest small text on the lit panel. It moves with
    the focus, like the panel's light.
42. The piano roll before the tune (S17, "...an octave apart. Listen.") gets a subject and a move.
    - On the kicker's entrance (3:42.9), a faint dotted trail draws out along each ball's own A
      lane. Before, the solid tune lines were the first marks, 1.2 s later.
    - The trails mark the lane, not a sung pitch; the solid lines draw over them.
    - The camera pushes in about 5 % on the balls (scale 0.985 to 1.05, x +40), then eases back
      while the tune draws, ending where s18 starts.
    - Critic 06 had seen a 16 px drift and idle hosts for 4.4 s.
43. Labels keep their strength; only strokes dim. Critic 07 measured settled text under 4.5:1 in
    five places, all present since rc-04:
    - the recap's answer labels sat under the cards' translucent glass;
    - s08's Hz readouts dimmed with their traces;
    - the dimmed LOUDER panel dimmed its tick numerals.

    The fixes:
    - s19: the answer labels ride above the glass, in ink-2 or their own colour; the glass dims
      only the strokes.
    - s08: the readouts ride above the traces. Dimming the traces after the listen leaves them
      alone, and under the predict card they step out.
    - s06: each panel's text sits in its own group above its strokes. A dimmed panel dims its
      strokes and eases its headline type from ink to ink-2, never lower. In 6a the diagram's
      labels step out instead of sitting at 30 % behind Orange.
    - S14: the dial letters wait at ink-2 at full strength and light to ink and white; depth shows
      in their size. The five "?" keep their strength; only their dashed rings step back.
    - Every small "time" label is ink-2 (s07, s08, s09-s12).

    `tools/text-sweep.mjs` and `.py` swept every scene every 0.25 s, measuring the DOM's text
    boxes on rendered pixels. They found no other text under 4.5:1 that stays 0.5 s or more. The
    only short dips are text in motion:
    - the cold open's fly-through;
    - the recap deck, dealt with its cards overlapping;
    - the keyboard letters leaving s20;
    - the wordmark arriving in s21.

44. Axis labels stay inside the frame.
    - The "time" labels of s08-s12 sit under the axis's left end, 16 px in and 26 px down,
      inside the frame at every camera. Left of the axis, s09's push cut the label to "ime"
      (critic 07).
    - The ladder's tight frame (`RAIL_P1`, s09-s12) is centred on y 740, not 720. The A 440 label
      is now out of frame there, not half cut at the top edge for 2 s.
    - Labels that cross a frame edge while the camera moves are left as they are: the ladder's
      climb and crane, the s17 push and the s18 push in.
45. S15's cards land whole, and the helix keeps moving.
    - Each card's headline ("A4", "C4") lands with its card; the subline follows 0.15 s later.
      "440 Hz" still arrives on its words. Critic 07 saw an empty box, or only the subline, for
      1.2-1.8 s.
    - The helix keeps turning through S15b: a 9° sway that is back to zero by the unroll, so S16
      is unchanged.
    - The 3 % drift starts as the move in ends. Critic 07 had measured 3:20.4-3:21.0 as the
      film's stillest 0.6 s.
46. S17's hosts and floor live in their own layer, and the push is on the chart alone (replaces
    42's 5 % push).
    - During "...an octave apart. Listen." the camera pushes 1.35x on the chart, bringing the two
      balls from the left edge to x 700 and up to y 360. The chart's foot stays above the floor
      line.
    - The camera pulls back while the tune draws.
    - The hosts stay put. Orange stays at least 97 px from the edge (critic 07: 10 px), and Blue
      stands in front of the keyboard's lower keys.
    - Outside the push the hosts' layer moves exactly as the room does, so both hand-offs are
      unchanged.
47. Critic 08's three cosmetic items are fixed for rc-07 (review/fixes-critic-08.md).
    - In the S17 push, "A2", "A5" and "time" wait until the pull-back and come in where they are
      clear of both hosts and 48 px inside the frame. The moment comes from the same camera table
      that drives the camera.
    - s08's waiting "440" dims to 0.9 (5.56:1), and the scrim behind "octave" stops short of the
      readouts, so the "Hz" after 220 reads 7.67:1.
    - The S17 zoom starts 1 s earlier, while the keyboard is still turning, and the dotted trails
      start just before "octave", larger and brighter until the tune.
48. The film speaks with the owner's ElevenLabs voices (17 October 2026).
    - Blue is D2, "Merc V1 Gentle Whimsical D2" (`B4fBPRmasEsTgd6YlSok`), and Orange is
      "Orange Merc" (`p2JfZCXWY245UrEylK7q`), both Eleven v3, one take a line, brought in with
      `output/motion/voice-elevenlabs/import.py`. The Kokoro takes are in `assets/voice-kokoro/`.
    - The film is 314.23 s, 17.2 s longer than rc-06's 297.04 s.
    - Scenes time words inside lines as a cue plus seconds measured on the Kokoro takes, so 109
      of those numbers moved, in 15 files, by `voice-elevenlabs/resync.py`. It aligns both takes
      by forced alignment (wav2vec2) and keeps each time's distance from the nearest word start.
      Changes are recorded in `assets/voice/_resync.json`; the run, its report and the reviewed
      exceptions are in `review/resync-rc07/`.
    - Sums that are lengths (a fade from a line's start, a camera move's duration) keep their
      numbers; so do times on a variable that already sits on a word, whose call moved instead.
    - "BLUE: Is it?" is now 0.58 s, too short for its own caption, so it shares a caption with
      "Mine shook the air 220 times a second." `captions.py` joins a too-short line to the same
      speaker's next line when they fit together, and lets the next caption start up to 0.1 s late
      as Lesson 2's does.
49. The recap's dealt deck is marked as intentional layering. With the new clock, `check` sampled
    the deal and the fan (4:32.8 to 4:33.8) and found the tickets' numerals and "?" overlapping,
    which a fanned deck does by design. Each ticket's numeral and "?" carry
    `data-layout-allow-overlap` (it covers only the marked block), as s08's labels do; `check` then
    reports 0 errors, and contrast passes 28 of 28.
