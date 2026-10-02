# HyperFrames under the motion-designer skill

HyperFrames (heygen-com/hyperframes, Apache-2.0) renders HTML compositions to
video, frame by frame, from a seekable timeline. It is the renderer this skill
uses; its own skills are the technical reference for composition syntax. This
file says how to drive it from this pipeline.

Audited on 2026-09-30: CLI `hyperframes@0.8.97` (npm latest), Claude Code
plugin `hyperframes@hyperframes` 0.8.97, Chrome Headless Shell 152.0.7977.30,
GSAP 3.14.2 (the version the HyperFrames templates pin).

## Which command runs HyperFrames

- Use the pinned CLI: `npx --yes hyperframes@0.8.97 <command>`. The pin is the
  contract; do not upgrade in the middle of a project.
- Inside a project, its `package.json` scripts carry the same pin:
  `npm run check`, `npm run render -- <flags>`.
- A HyperFrames plugin skill may tell you to use its launcher,
  `node <PLUGIN_ROOT>/skills/hyperframes/scripts/plugin-cli.mjs`. That is
  equivalent. If its version differs from the project's pin, keep the project's
  pin and say so in `DECISIONS.md`.
- Never run `hyperframes skills`, `hyperframes skills update` or
  `npx skills add` from this pipeline: they copy HyperFrames skills into
  `~/.claude/skills`, `~/.agents/skills` and every other installed agent's
  global folder, outside the plugin's version control. `init` does the same
  unless `HYPERFRAMES_SKIP_SKILLS=1` is set, so always set it.
- Upgrading is a deliberate change: bump the pin here, in `SKILL.md` and in
  `scripts/smoke-test.sh`, run the smoke test, then commit.

## Preflight

```bash
node --version                                   # v22 or newer
ffmpeg -hide_banner -filters | grep -E ' (ebur128|tblend|signalstats|scdet) '   # four lines
python3 --version                                # any Python 3; scripts/ use the standard library
npx --yes hyperframes@0.8.97 doctor              # FFmpeg, FFprobe and Chrome must be ok
npx --yes hyperframes@0.8.97 browser ensure      # if Chrome is missing: downloads about 114 MB once
```

`doctor` also lists whisper-cpp, Kokoro TTS, MusicGen and Docker. They are
optional; missing is fine. Install hints: macOS `brew install node ffmpeg`;
Debian or Ubuntu `sudo apt-get install -y ffmpeg`; Windows: run everything in
WSL2. The kit's audio solvers (`sfx-candidates.py`, `solve-sfx-gains.py`) also
need `numpy` and `scipy`.

## New project

```bash
mkdir -p output/motion
HYPERFRAMES_SKIP_SKILLS=1 npx --yes hyperframes@0.8.97 init output/motion/<slug> --non-interactive
```

- `init` refuses a non-empty directory, so write `BRIEF.md` after it.
- `--resolution portrait` starts a 9:16-first project. Every extra size, and
  the music-only version, is a sibling project (§ One root per project).
- `init` pins the CLI in the project's `package.json` and writes a `CLAUDE.md`
  and an identical `AGENTS.md` telling agents to start at `/hyperframes`, which
  would run an interview. Append the director block below to both files.

### Director block

```markdown
## Director: motion-designer

This project is directed by the `motion-designer` skill. `BRIEF.md` is the
confirmed brief: do not run the `/hyperframes` intent interview or route to
another workflow. Use the HyperFrames domain skills (core, animation,
keyframes, cli, audio, media-use, registry) for technical questions only. When
`BRIEF.md` says `renders: pre-authorized`, render without asking. Every render
is judged by a fresh `motion-critic` subagent, never by the builder.
```

## Composition rules that bite

Read the `hyperframes-core` skill before writing composition HTML. The rules
that cost a render when missed:

- One paused `gsap.timeline` per composition, registered at
  `window.__timelines["<root data-composition-id>"]`. Render length is the
  root's `data-duration`, not the timeline's.
- Timed elements carry `data-start` and `data-duration`, plus `class="clip"`.
  Never tween `visibility`, `display` or `autoAlpha` on a `.clip`; animate a
  child.
- Never pair a CSS `transform` with a GSAP tween of the same property. Use
  `fromTo`.
- Two `fromTo` tweens on the same target: give the later one
  `immediateRender: false`, or a seek before it shows the wrong resting state
  (`gsap_repeated_fromto_without_baseline`).
- A named font needs an `@font-face` pointing at a local file. Every `<audio>`
  needs an `id` or the render is silent. No `crossorigin` on media. No `<br>` in
  body text.
- Build scenes as sub-compositions (`data-composition-src`); lint warns
  `nested_structure_needs_subcomposition` when a scene is inline.
- A deliberate fly-through past the frame edge takes
  `data-layout-allow-overflow`. Never use that or `data-layout-allow-overlap` to
  silence a real collision: the smoke test's first draft had the outgoing title
  flying through the incoming headline, and `check` caught it.

## Pinned local files

The HyperFrames template loads GSAP from a version-pinned CDN URL. This pipeline
wants pinned local files, so a render never depends on the network:

```bash
mkdir -p assets/vendor assets/fonts
curl -sSfL -o assets/vendor/gsap-3.14.2.min.js https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js
```

Pin Three.js to an exact version the same way when a scene needs it. Fonts go in
`assets/fonts/` next to their licence file.

## The loop

```bash
npm run check                                                      # lint, runtime, layout, motion, contrast
npx --yes hyperframes@0.8.97 snapshot . --at 0,1.2,2.4 -o shots    # stills plus a contact sheet
npx --yes hyperframes@0.8.97 render --quality draft --fps 30 --output renders/draft.mp4
npx --yes hyperframes@0.8.97 render --fps 60 --quality delivery --strict --output renders/<name>.mp4
npx --yes hyperframes@0.8.97 timeline --json                       # what is on the timeline
npx --yes hyperframes@0.8.97 preview --background                  # only for a human to scrub; stop with preview --stop
```

- `check` can pass with warnings; read them. A lint error switches off the
  layout and contrast audits, so "0 samples" means nothing ran.
- `render` carries on past lint errors unless given `--strict`.
- The render summary's second line names the capture path. `beginframe capture`
  is the fast path; `screenshot capture` with `software gpu` is the slow one.
- Measured here: 5 s at 1080p60, delivery quality, rendered in 19 s on 4 CPU
  cores with software GL, and two renders were byte-identical.

## One root per project: sizes and the music-only version

`check` fails a project with more than one root-level composition file
(`multiple_root_compositions`: the runtime may load both and play the audio
twice), and render-time variables (`render --variables`) do not reach the
audio, which is extracted from the authored HTML. Verified here: a variable that
hid the effect track at runtime left the rendered audio byte-identical. So every
variant is a sibling project that passes `check` on its own.

- **Another size.** `<slug>-9x16/`, made with
  `HYPERFRAMES_SKIP_SKILLS=1 npx --yes hyperframes@0.8.97 init <dir> --resolution portrait --non-interactive`,
  with its own `index.html` recomposed for the format (never a letterboxed or
  scaled 16:9 cut). Copy the shared assets and sub-compositions across.
- **The music-only version.** Copy the finished project to
  `<slug>-music-only/` (everything except `renders/`), add `data-hidden` to
  every sound-effect `<audio>` in its `index.html`, keep the music, and render
  it. Hiding the effect track removes it from the mix (verified). Then compare
  the two with `scripts/measure.py audio <film> --music-only <music-only film>`.

`render -c <file>` renders one composition file; keep it for sub-composition
lab renders, not for variants of the root.

## Unattended runs

The HyperFrames skills gate rendering ("render now, or what changes?") and ask
brief questions on a fresh project. `BRIEF.md` with `workflow: motion-designer`
and `renders: pre-authorized`, plus the director block, answer both. If a
HyperFrames skill still asks, answer from `BRIEF.md` and continue.

## Smoke test

```bash
bash scripts/smoke-test.sh <empty-work-dir>
```

It scaffolds a project, fetches pinned GSAP and the Outfit font, writes the
5-second composition from `templates/smoke-test.html`, runs `check`, renders
twice at 1080p60 and compares every frame, renders the music-only version from a
sibling project and checks the effect against it, then measures the result.
Expect `SMOKE TEST PASSED`.

## Telemetry

HyperFrames sends anonymous usage telemetry by default. Opt out once with
`npx --yes hyperframes@0.8.97 telemetry disable`, or per shell with
`HYPERFRAMES_NO_TELEMETRY=1` or `DO_NOT_TRACK=1`.
