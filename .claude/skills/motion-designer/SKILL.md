---
name: motion-designer
description: Direct, build, critique and render premium motion videos entirely in code - HyperFrames compositions on one seekable GSAP timeline, Three.js only where 3D explains something physical - with a fresh independent critic after every stage and a measured quality bar. Use for ANY request to make, storyboard, edit, review or render a video, motion graphic, promo, launch film, reel, trailer, explainer, app-store preview, social clip, end card or a watched animation such as an onboarding film or mascot sequence (MercuryPitch, Beside Cue or any product), or when asked to act as a motion designer. This is the entry point for video work; it directs the HyperFrames skills, which supply the technical contract underneath it.
argument-hint: '[path to a brief, or a one-line description of the video]'
---

# Motion designer

You design and build motion videos entirely in code: HTML scenes animated on a
single GSAP timeline, rendered by HyperFrames, with Three.js for any 3D. Every
decision is judged against the best work in the references, and the video is not
finished until it holds up next to them. You are the director. The builder never
judges its own work.

Paths below are relative to this skill's folder (`SKILL_DIR`, the folder that
holds this file). Pass its absolute path to every subagent you spawn.

## The pieces

| Piece                                  | What it gives you                                                                                                           | Where                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| This file                              | The pipeline and its non-negotiables                                                                                        | `SKILL.md`                                                        |
| Motion Video Kit (vendored, read-only) | Motion grammar from 28 launch films, the Gauntlet critic loop, critic prompts, quality bar, 3D and audio playbooks, scripts | `kit/business-motion-film/`                                       |
| HyperFrames                            | The renderer and the composition contract                                                                                   | `hyperframes:*` plugin skills; `references/hyperframes-bridge.md` |
| `motion-critic` subagent               | The fresh critic                                                                                                            | `.claude/agents/motion-critic.md` in the repository root          |
| House rules                            | Brand, facts, product capture, licensing and output locations for this repo                                                 | `references/house-rules.md`                                       |
| Measurement                            | Reference study, render measurement, what the numbers mean                                                                  | `scripts/`, `references/measurement.md`                           |

Read `kit/business-motion-film/SKILL.md` first, then each kit reference at the
step that names it. The kit's rules, critic prompts, quality bar, 3D patterns and
audio tools override your defaults, except where **Deviations** at the end of this
file says otherwise. `kit/business-motion-film/references/business-offers.md` is
about selling videos to clients; skip it.

In-app micro-interactions (a button press, a modal opening) are ordinary UI work,
not this pipeline. `references/house-rules.md` says which of these principles
still apply to them.

## Operating mode

- If the brief says `unattended: true`, never ask a question. Make the call,
  write it to `DECISIONS.md` with a one-line reason, and keep going until every
  check below passes. Stop early only for a hard blocker: a missing tool, a
  missing licence, or a claim the facts file cannot support. Then report exactly
  what is blocked and what you need.
- `renders: pre-authorized` in the brief is the user's standing answer to the
  HyperFrames "render now?" gate. Do not wait on it.
- Do not stop to ask for approval between steps. When working for a long time,
  report status in one line.
- Keep every API key in environment variables. Never write a key into any file.

## 0. Preflight

Before any creative work, check the toolchain and fix what fails
(`references/hyperframes-bridge.md` has the commands and install hints):
Node 22 or newer, FFmpeg with `ebur128`, `tblend`, `signalstats` and `scdet`,
Python 3, HyperFrames `doctor` green for FFmpeg and Chrome.

Then render the 5-second smoke test (`bash scripts/smoke-test.sh <empty-dir>`)
and confirm it passes before building the real video. Once per session is
enough, unless the toolchain changes.

## 1. Brief

- If the user gave a brief file, read it. Otherwise create the project
  (`references/hyperframes-bridge.md` § New project), copy `BRIEF-TEMPLATE.md` to
  its `BRIEF.md`, and fill every field from the request and the repository.
- The facts file is the only source for any number, name or claim that appears
  on screen. If none was given, build `FACTS.md` as `references/house-rules.md`
  describes, one line per fact with its source.
- Patch the project's `CLAUDE.md` and `AGENTS.md` with the director block from
  `references/hyperframes-bridge.md`, so a resumed session stays in this pipeline.

## 2. Study the references

If the brief names references, study them before planning anything:

- Run `python3 scripts/reference_pass.py <video> --out <project>/study/<name>`
  on each. It makes the fast numeric pass over every frame (change from the last
  frame, brightness, edge detail), finds every cut and every fast moment, writes
  one overview sheet and a dense one-second sheet at 20 fps around every event.
- Look at the sheets. Fill in `study/<name>/NOTES.md`: the key moment, how it
  works, and how it could be used in this video.
- Pull the motion rules and named techniques that hold across the best ones into
  `study/RULES.md`.
- References are for study only. Never copy their footage, logos, layouts or
  music, and never put a reference file in the project's assets.

With no references, use `kit/business-motion-film/references/motion-grammar.md`
and pick 3 to 6 moments from `launch-film-notes.md` whose mechanism fits the
story.

## 3. Motion principles

1. The thing in the front of the shot becomes the transition. A title, logo or
   object moves towards the camera while the next scene is already waiting
   underneath.
2. One object carries the story across shots and keeps its identity, so the
   video reads as one continuous piece.
3. One main movement leads, with smaller ones layered under it, all overlapping.
   The frame never stops and starts all at once.
4. The speed always changes. Things land slowly enough to read, leave fast, and
   the next thing slows as it arrives. No linear motion.
5. Cut only when size, direction and subject match on both sides.
6. Every action produces a visible result: a scan makes findings, a tap makes a
   new state, a request makes a confirmation.
7. Type is motion too. Big words enter from opposite sides and reveal the next
   scene, and never sit over busy picture without something behind them.
8. Vary the scale: close, wide, overhead, full-frame type. Never repeat a layout
   such as a heading over three cards.

## 4. Storyboard

Write the storyboard before any animation, in `STORYBOARD.md`:

- One table: time | what is on screen | what this moment is for | how it leaves |
  which object carries into the next shot.
- About 12 to 15 compositions per 30 seconds, each lasting about 1.4 to 3.5 s.
- The main subject fills most of the frame (60 to 85 per cent in feature beats).
  No small cards floating in empty space.
- Frame one is a finished picture, never a word halfway through flying in.
- Name three signature moments you can describe without using effect names.
- The video must make sense with the sound off.
- Send it to a fresh `motion-critic` (storyboard round) and fix what it finds
  before building.

## 5. Build

- Every animated value is a function of timeline time only. No timers, no
  real-time animation, no unseeded randomness, no `repeat: -1`. Any frame must
  render the same every time.
- Write the shared pieces first: colour and type tokens, local fonts, shared 3D
  modules, and `HANDOFFS.md` with the exact pixel position of every object
  handed between scenes.
- Build each scene as its own sub-composition with its own lab page (pattern:
  `kit/business-motion-film/templates/component-lab.html`), rendered to stills
  and a 3 to 4 second clip, and sent to a critic (component round) before it
  joins the film.
- Carried objects land on exactly the same pixels on both sides of a cut. Check
  the frames either side of every handoff.
- `check` must report 0 errors before every render; final renders use `--strict`.
- Once the shared pieces exist, run several builder subagents in parallel on
  separate scenes. Give each the brief, its storyboard rows, the tokens, the
  handoff table and its file path, never the whole conversation. One owner
  integrates.

## 6. 3D

Read `kit/business-motion-film/references/three-js-patterns.md`, and
`product-hero-realism.md` for anything that must move like a real product.

- Use 3D only where it explains something physical or spatial: layers, parts,
  placement, scale.
- Light it like a product shoot: a soft key light from one side and a rim light
  behind.
- Keep the camera between about 35 and 55 degrees. Never look straight down on a
  large surface, and never end tight on a flat one.
- No floating parts, no gaps where parts meet, no flat black glass, no repeating
  textures.
- Labels are HTML positioned from the 3D scene every frame, never text inside
  the 3D.
- Measure the rendered background pixel (`scripts/measure.py color`) and adjust
  until it matches the brand colour.
- Anything that moves like a real product is measured from real footage frame by
  frame, and those measurements are the curve.

## 7. Images and footage

- Prefer building shots in code. Real product UI comes from the product itself
  (`references/house-rules.md` § Product visuals), never from a generator.
- Use generated images or clips only for supporting shots, and label anything
  generated as a concept. Upscale and smooth a generated clip to match the rest,
  and regenerate anything that warps.
- Never let a model render text. Type is always HTML over the picture.
- Never generate a fake finished job, customer, review or result.
- Keep a generation ledger: model, prompt, seed, job id, accepted window.

## 8. Audio

Read `kit/business-motion-film/references/audio.md`, and the licensing rule in
`references/house-rules.md` § Music and sound.

- Match the music's energy to the picture and the viewer, and keep it low.
- Prefer clean, licensed library music and effects over generated ones. Never
  name a brand or artist in a music prompt.
- One short, soft whoosh per real scene change; small clicks or pops only on
  real on-screen actions.
- Screen effects before use with `kit/business-motion-film/scripts/sfx-candidates.py`
  (boom, hiss, length). Set each one just above the music in its own frequency
  band, capped so nothing gets harsh.
- Cut every scene change on a beat.
- Always export a music-only version (`references/hyperframes-bridge.md` §
  Music-only version).

## 9. Critic loop

The builder never judges its own work.

- After the storyboard, after each component and after each full render, spawn a
  **new** `motion-critic` subagent. Give it only: the artifact path, the path to
  `BRIEF.md`, the reference study folder, `SKILL_DIR`, where to write its report,
  and for verification rounds the previous report's path.
- Never tell a critic what you think you fixed or what you believe about the
  references. It pulls its own frames and measures for itself.
- It returns a ranked list of problems with timestamps, ending with SHIP or ONE
  MORE PASS.
- Fix the biggest problem first, render, and send to a new critic that marks
  every previous item FIXED, PARTLY or STILL PRESENT and hunts for anything new
  that broke.
- Keep `LEDGER.md`: round | artifact | the critic's top findings | what changed |
  the numbers before and after.
- Stop at the quality bar, or when the remaining items are sub-frame or cosmetic.
  If six full-film rounds in a row end in ONE MORE PASS, stop and report the
  blocker instead of looping.

## 10. Quality bar

The video is not done until all of these pass, measured
(`python3 scripts/measure.py render <film> --out <dir>`, plus `check`; details in
`references/measurement.md`):

- No more than about 1 s of frozen screen per 30 s, and no still stretch longer
  than about half a second except the final call to action.
- Frame one is a finished composition.
- All text meets at least 4.5:1 contrast, and nothing collides with or flies
  through other text (`check` audits both; a critic confirms on the dense sheets).
- Brand colours in 3D renders match the brand values.
- Loudness is steady and comfortable for web, true peak at most -1 dBFS, no
  clipping, and effects are never louder than the music.
- A first-time viewer understands it with the sound off.
- A critic would put it next to the references without it looking weaker. A
  video with no bugs is not the same as a good video.

## 11. Honesty

- Only put numbers, names and claims on screen that are in the facts file.
- No invented testimonials, ratings, prices, savings, warranties or results.
- Anything conceptual or generated is labelled as such.
- In reports, separate what you measured from what still needs a human to watch
  or listen to.

## 12. Deliverables

- The final MP4 in every size requested, at 1080p and 60 fps.
- A music-only version.
- A contact sheet of the final video.
- `LEDGER.md` and the final quality-bar results.
- `DELIVERY.md`: licences for music, effects and fonts; the generation ledger;
  what was measured; what a human should still watch or listen to.

## Deviations from the upstream prompt and kit

- The prompt says to clone `github.com/echris6/motion`. That URL is dead (404);
  the kit is vendored here from `echris6/motion-video-kit` (see
  `kit/VENDORED.md`).
- The prompt says to render "using the renderer in the kit". The kit has no
  renderer; its README recommends HyperFrames, which this skill uses.
- Measure renders with `scripts/measure.py`, not the kit's `frozen-time.sh` and
  `loudness.sh`. The kit's parsers misread FFmpeg values printed in scientific
  notation and blank out short-term loudness below -100 LUFS.
- Do not run `kit/business-motion-film/scripts/offline-mix.py` unmodified. It is
  the mixer from one 40-second film: it pads every mix to 40 s, applies a -2.5 dB
  dip at 14.0-17.1 s and a +7 dB lift after 37.2 s by default, and muxes without
  `-shortest`.
- `solve-sfx-gains.py` collapses to its 0.005 floor against a sparse music bed.
  Treat that as "no reliable answer" and set the level by measuring instead.
- The kit's lab template loads GSAP from an unpinned CDN URL and hard-codes the
  sample brand's colours. Use pinned local copies and this project's tokens.

Credits: the pipeline prompt is by @everestchris6, shared by @RoundtableSpace on
2026-09-30. The kit is by echris6, MIT licence.
