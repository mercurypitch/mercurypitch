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
   extra; Merc at 60 would double the slowest step.
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
    errors (`src/lib/mirror/metrics.ts:261`). The web drills score the written octave.
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
