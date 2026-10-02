# Handoff: the motion-designer and agent-team-architect skills

**Date:** 2026-09-30 · **Branch:** `feat/nifty-ptolemy-nd0hoh` · **For:** a
local Claude Code agent on the owner's machine.

A cloud session audited the sources, built both skills into this branch, and
verified the render pipeline end to end on Linux. What is left needs the owner's
machine: installing the prerequisites and the HyperFrames plugin, proving it
works there, and reporting back. Section 0 is the whole job in order; the rest
explains it.

**Status on 2026-10-02:** on the owner's machine the branch is checked out and
the smoke test passes (§ 5.4, 63 s). The HyperFrames plugin is not installed
yet (§ 5.3), so steps 3, 5 and 7 of § 0 remain. A critic dry run in the cloud
went two rounds (§ 10); its feedback on the measuring tools is fixed.

---

## 0. Checklist for the local agent

1. Check out the branch: `git fetch origin feat/nifty-ptolemy-nd0hoh && git checkout feat/nifty-ptolemy-nd0hoh`.
2. Install the prerequisites (§ 5.2): Node 22 or newer, FFmpeg, Python 3.
3. Install the HyperFrames plugin at user scope, then ask the owner to start a
   new Claude Code session so it loads (§ 5.3).
4. Run the smoke test and get `SMOKE TEST PASSED` (§ 5.4).
5. Confirm the skills, the agent and the plugin are loaded (§ 5.5).
6. Ask the owner about the optional steps (§ 5.6 to § 5.8) before doing them.
7. Run the acceptance test and report back (§ 6).

Do not commit, push or merge unless the owner asks. Never run
`npx hyperframes skills ...` or `npx skills add heygen-com/hyperframes`: they
copy HyperFrames skills into `~/.claude/skills`, `~/.agents/skills` and every
other installed agent's global folder, duplicating the plugin outside its
version control. Never run the vendored kit's `offline-mix.py` unmodified
(§ 3.2).

---

## 1. What was asked

1. The owner saw
   [a post](https://x.com/RoundtableSpace/status/2105209785335373948) promising
   "high-end motion graphics with Claude" from one prompt plus an open-source
   kit, and asked for it as a skill: Claude should act as the best possible
   motion designer for our videos and animations, automatically for that kind
   of work, or when invoked.
2. Later, the owner attached an image of a second prompt, an "AI agent
   architect" workflow, and asked for it as a skill to invoke when a problem is
   big or hard.

## 2. Sources audited

| Source                                                                                                                 | What it is                                                                                                                                                                                                          | Version                                 | Licence                               |
| ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------- |
| [The post](https://x.com/RoundtableSpace/status/2105209785335373948) and its thread reply (status 2105212446122062051) | A pipeline prompt in XML sections (role, brief, kit, setup, reference study, motion principles, storyboard, build, 3D, footage, audio, critic loop, quality bar, honesty, deliverables), credited to @everestchris6 | Posted 2026-09-30 08:15 and 08:25 UTC   | n/a                                   |
| [echris6/motion-video-kit](https://github.com/echris6/motion-video-kit)                                                | A Claude Code skill: the Gauntlet critic loop, motion grammar from 28 launch films, quality bar, audio rules, Three.js patterns, 7 scripts, 2 templates                                                             | `255562b` (2026-09-29), 24 files, 95 KB | MIT                                   |
| [heygen-com/hyperframes](https://github.com/heygen-com/hyperframes)                                                    | The HTML-to-video renderer the kit is built for, with its own Claude Code plugin of 21 skills                                                                                                                       | CLI and plugin 0.8.97                   | Apache-2.0                            |
| The attached image                                                                                                     | The "AI agent architect" prompt, transcribed verbatim to `.claude/skills/agent-team-architect/references/source-prompt.md`                                                                                          | 2026-09-30                              | n/a                                   |
| [Melies cinematic techniques](https://melies.co/cinematic-techniques)                                                  | A catalogue of 424 film techniques in 13 categories, each with narrative function, look-alikes, what goes wrong and a prompt; 146 read in depth                                                                     | Read 2026-10-02                         | Proprietary text; studied, not copied |

## 3. Audit findings

### 3.1 The motion prompt

It is a good pipeline: study references, storyboard first, a fresh critic after
every stage, measured ship criteria, strict honesty rules. As a pasted prompt it
cannot work as written:

| Finding                                                                                                                                                                                                         | Resolution                                                                                                                                                          |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| It says to clone `github.com/echris6/motion`. That URL returns 404; the repository was renamed `motion-video-kit`.                                                                                              | The kit is vendored at a pinned commit (`kit/VENDORED.md`).                                                                                                         |
| It says to render "using the renderer in the kit". There is no renderer in the kit; its README recommends HyperFrames.                                                                                          | HyperFrames, pinned to 0.8.97, verified here (§ 10).                                                                                                                |
| "I'm away and won't answer questions" collides with HyperFrames: its router interviews on a fresh project, gates every render on a user answer, and `init` writes a `CLAUDE.md` saying "start at /hyperframes". | `BRIEF.md` carries `workflow: motion-designer` and `renders: pre-authorized`, and the skill appends a director block to each project's `CLAUDE.md` and `AGENTS.md`. |
| "Send it to a fresh critic" and "run several builders in parallel" have no mechanism in a pasted prompt.                                                                                                        | A `motion-critic` subagent that only ever receives paths; builders are subagents given only their scene's inputs.                                                   |
| "A fast numeric pass over every frame" of the references: no tool for it exists in the kit.                                                                                                                     | `scripts/reference_pass.py`.                                                                                                                                        |
| "All as pinned local files", but the HyperFrames template and the kit's lab load GSAP from a CDN.                                                                                                               | Pinned local copies (`references/hyperframes-bridge.md` § Pinned local files).                                                                                      |
| Nothing about where the truth, the brand, licensed music or the output live in this repository.                                                                                                                 | `references/house-rules.md`.                                                                                                                                        |

### 3.2 The kit

Worth keeping: the lessons are specific and measured (frozen-time numbers per
round, loudness targets, real client rejections, a frame-by-frame method for
realistic product motion). Its scripts only call FFmpeg, make no network
requests and read no secrets. Problems found, each reproduced here:

- `offline-mix.py` is one film's mixer: it pads every mix to 40 s, applies a
  -2.5 dB dip at 14.0-17.1 s and a +7 dB lift after 37.2 s by default (its usage
  text says `--ring-db 0`), and muxes without `-shortest`. Its shebang is on line 10.
- `frozen-time.sh` misreads FFmpeg values printed in scientific notation:
  `5.20833e-05` is read as `5.20833`, so a nearly still stretch counts as motion.
  Replaced by `scripts/measure.py`.
- `loudness.sh` prints blanks for silent seconds (FFmpeg writes `S:-120.7` with
  no space) and samples at x.1 s. `contact-sheet.sh` writes one untimestamped
  sheet and drops everything past it.
- `solve-sfx-gains.py` returned its 0.005 floor against a sparse music bed.
- The kit's 0.35 frozen-time threshold was set on bright films. On the Obsidian
  stage a slow push reads 0.2 to 0.6, so the skill reports a hard-hold threshold
  (0.1) and a low-motion one (0.35) and lets the critic judge the second.
- The lab template and the overlay module hard-code the sample brand's palette.
  `business-offers.md` is about selling video work and does not apply.

### 3.3 HyperFrames

Apache-2.0, needs Node 22 or newer and FFmpeg, and downloads Chrome Headless
Shell 152 (about 114 MB) to `~/.cache/hyperframes` on first use. It sends
anonymous usage telemetry unless disabled (§ 5.8). `init` refreshes standalone
HyperFrames skills from GitHub into the global skill folders of every installed
agent unless `HYPERFRAMES_SKIP_SKILLS=1` is set; the skill always sets it, so
the plugin stays the only copy. Its router skill
calls itself the "mandatory entry point" for any video request, so the
motion-designer description, the director block and the new row in `CLAUDE.md`
and `AGENTS.md` all say that video work starts in motion-designer, with
HyperFrames skills underneath for syntax. `render` carries on past lint errors
unless given `--strict`; the skill always passes it for final renders. A project
may hold only one root composition (`check` fails `multiple_root_compositions`),
and render-time variables do not reach the audio, so each extra size and the
music-only version are sibling projects. The `check` layout audit only compares
text with text, so a title flying across an image goes unflagged; the critic
caught exactly that.

### 3.4 The agent-architect prompt

Its structure is strong: an eight-step build process, a complete blueprint per
agent, explicit human checkpoints and five final checks. As written it produces
a consulting-style answer about a business workflow and stops; it names models
abstractly, assumes a 7-day plan even for a one-off problem, gives agents no
tool limits and has no cost stop. The skill keeps every section and adds: the
mapping to Claude Code primitives (subagent types, model tiers, file handoffs,
worktrees, checkpoints), a phased plan for one-off problems, repository rules
that bind every agent, least-privilege tool lists, a run mode that starts only
after explicit approval, a retry-once-then-escalate rule and a cost guard. It is
user-invoked only (`disable-model-invocation: true`), because a multi-agent run
should never start by itself.

### 3.5 The Melies cinematic techniques catalogue

The owner pointed to it as a source of shot ideas. Its most useful idea for this
pipeline is the "wrong cousin": every technique has a look-alike that builders
and generators drift into, with a visible tell (a "dolly in" with no parallax is
a zoom; a "rack focus" where both planes stay sharp is not one). That turns shot
quality into something a critic can check on a dense sheet. Its prompt advice is
consistent too: name the geometry of a move, what stays fixed and how long it
lasts, and ban the look-alike by name, rather than describing a mood.

The 146 techniques that matter for code-built brand and product films were read
in depth (the site's `robots.txt` allows it) and rewritten, not copied, into
`references/shot-grammar.md`: a shot line for every storyboard row, what each
technique says, how to build it in GSAP, CSS or Three.js, its wrong cousin and
tell, the HyperFrames registry item that already implements it (`whip-pan-cut`,
`rack-focus`, `camera-dolly-zoom`, `match-cut` and about 30 more), a lens to
field-of-view table, and a prompt template for generated footage. Anything else
is looked up on its Melies page when needed. One registry finding worth
knowing: HyperFrames' `push-in` scales the whole stage, so it is optically a
zoom, not a dolly.

## 4. What is in this branch

| Path                                                              | Purpose                                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `.claude/skills/motion-designer/SKILL.md`                         | The director: the prompt's pipeline, fixed and wired to the kit, HyperFrames, the critic and this repository                                  |
| `.claude/skills/motion-designer/BRIEF-TEMPLATE.md`                | The brief, in HyperFrames' `BRIEF.md` format, with the unattended and render-authorisation switches                                           |
| `.claude/skills/motion-designer/references/hyperframes-bridge.md` | How to drive HyperFrames: pinned CLI, new project, director block, rules that bite, sizes, music-only version, telemetry                      |
| `.claude/skills/motion-designer/references/house-rules.md`        | MercuryPitch and Beside Cue brand, measured contrast, the facts file, real product capture, licensing, where work goes                        |
| `.claude/skills/motion-designer/references/measurement.md`        | Reading the numbers, calibrated thresholds, the kit script bugs                                                                               |
| `.claude/skills/motion-designer/references/shot-grammar.md`       | Shot vocabulary from the Melies catalogue, rewritten for code: what each technique says, how to build it, its wrong cousin                    |
| `.claude/skills/motion-designer/scripts/measure.py`               | Render measurement: holds, low motion, single-frame events, loudness, effects against music, timestamped and frame-exact sheets, brand colour |
| `.claude/skills/motion-designer/scripts/reference_pass.py`        | Reference study: per-frame change, brightness, edges, cut detection, overview and dense sheets, a notes skeleton                              |
| `.claude/skills/motion-designer/scripts/smoke-test.sh`            | The end-to-end proof: scaffold, check, render twice, compare every frame, measure                                                             |
| `.claude/skills/motion-designer/templates/smoke-test.html`        | The 5-second MercuryPitch composition the smoke test renders                                                                                  |
| `.claude/skills/motion-designer/kit/`                             | The Motion Video Kit, byte-identical to upstream `255562b`, with `VENDORED.md` (provenance, hashes, audit, update steps)                      |
| `.claude/agents/motion-critic.md`                                 | The fresh critic subagent                                                                                                                     |
| `.claude/skills/agent-team-architect/SKILL.md`                    | The agent-team skill                                                                                                                          |
| `.claude/skills/agent-team-architect/references/source-prompt.md` | The image's prompt, verbatim                                                                                                                  |
| `.gitignore`, `.prettierignore`                                   | `output/motion/` stays out of git; the vendored kit stays out of Prettier                                                                     |
| `AGENTS.md`, `CLAUDE.md`                                          | A table row and a paragraph that make motion-designer the entry point for video work                                                          |

## 5. Install on the owner's machine

### 5.1 The branch

```bash
git fetch origin feat/nifty-ptolemy-nd0hoh
git checkout feat/nifty-ptolemy-nd0hoh
```

Project skills load from the working tree, so they exist only while this branch
(or, after a merge, `main`) is checked out.

### 5.2 Prerequisites

```bash
node --version      # v22 or newer (the repository already uses Node 22)
ffmpeg -hide_banner -filters | grep -E ' (ebur128|tblend|signalstats|scdet) '   # expect four lines
python3 --version
```

- FFmpeg: macOS `brew install ffmpeg`; Debian or Ubuntu
  `sudo apt-get install -y ffmpeg`.
- Python: the skill's scripts use only the standard library. The kit's audio
  solvers need `numpy` and `scipy`; install them in a virtual environment when
  audio work starts (`python3 -m venv ~/.venvs/motion && ~/.venvs/motion/bin/pip install numpy scipy`).
- Windows: run everything inside WSL2.

### 5.3 The HyperFrames plugin

```bash
claude plugin marketplace add heygen-com/hyperframes
claude plugin install hyperframes@hyperframes
npx --yes hyperframes@0.8.97 browser ensure     # downloads Chrome Headless Shell once
npx --yes hyperframes@0.8.97 doctor             # FFmpeg, FFprobe and Chrome must be ok
```

If the `claude plugin` subcommands are not available in the installed version,
the owner can type `/plugin marketplace add heygen-com/hyperframes` and then
`/plugin install hyperframes@hyperframes` at the Claude Code prompt instead.
Plugins load when a session starts, so the owner then starts a new session; an
agent cannot restart its own. Use the plugin, not `npx skills add`: it is one
versioned bundle updated through `/plugin`, instead of loose copies in
`~/.claude/skills`, `~/.agents/skills` and every other agent's global folder.
HyperFrames suggests enabling auto-update for its marketplace; leave
it off, because the skill pins CLI 0.8.97 and upgrades should be deliberate
(§ 9). In `doctor`, whisper-cpp, Kokoro, MusicGen and Docker are optional.

### 5.4 Smoke test

```bash
bash .claude/skills/motion-designer/scripts/smoke-test.sh "$(mktemp -d)"
```

Expected, as it ran in the cloud session (83 s from a clean directory once npm
and Chrome were cached; 63 s on the owner's Arch Linux machine, where the render
path reads `hardware gpu`):

```text
1/7 scaffolding .../motion-smoke
2/7 fetching pinned GSAP 3.14.2 and the Outfit font
3/7 check
4/7 rendering twice at 1080p60
5/7 comparing every frame
6/7 rendering the music-only version and comparing the effect with it
7/7 measuring

SMOKE TEST PASSED
  render:        .../motion-smoke/renders/smoke-a.mp4 (300 identical frames in both takes)
  music only:    .../motion-smoke-music-only/renders/smoke-music-only.mp4
  measurements:  .../motion-smoke/review/summary.md, .../motion-smoke/review/audio.md
  contact sheet: .../motion-smoke/review/sheet-01.jpg
  render path:   beginframe capture · software gpu · ...
```

On a failure the script names the step and its log file. `doctor` explains most
of them; on macOS a sandboxed agent can block Chrome from starting at all, in
which case run the smoke test from a normal terminal.

### 5.5 Confirm what is loaded

Start `claude` in the repository root, then:

- `/skills` lists `motion-designer` and `agent-team-architect`.
- `/agents` lists `motion-critic`.
- `/plugin` shows `hyperframes` installed.
- Typing `/motion-designer` and `/agent-team-architect` autocompletes.
- Asked "which skill would you use to make a 20-second promo video?", Claude
  names motion-designer.

If a skill is missing, check that the branch is checked out, then have the owner
start a new session in the repository root.

### 5.6 Optional: every project, not just this repository

Ask the owner first. Before this branch is merged, copy rather than link, or the
skills disappear whenever another branch is checked out:

```bash
mkdir -p ~/.claude/skills ~/.claude/agents
cp -R .claude/skills/motion-designer .claude/skills/agent-team-architect ~/.claude/skills/
cp .claude/agents/motion-critic.md ~/.claude/agents/
```

After the merge, symbolic links to the `main` checkout keep one copy up to date
(`ln -s "$PWD/.claude/skills/motion-designer" ~/.claude/skills/motion-designer`,
and the same for the other two). To make Claude reach for it in every project,
add one line to `~/.claude/CLAUDE.md`:

```markdown
- For any video, motion graphic or watched animation, start with the motion-designer skill; it directs the HyperFrames skills.
```

Outside this repository `references/house-rules.md` does not apply, and the
skill asks the brief for the brand, the facts and the licences instead.

### 5.7 Optional: unattended runs without permission prompts

An unattended film runs hundreds of commands (`npx hyperframes`, `ffmpeg`,
`python3`). In the default permission mode each one waits for approval, which
defeats "I'm away". With the owner's agreement, add a local allowlist to
`.claude/settings.local.json` (not committed), then check it with
`/permissions`:

```json
{
  "permissions": {
    "allow": [
      "Bash(npx --yes hyperframes@0.8.97:*)",
      "Bash(npm run check:*)",
      "Bash(npm run render:*)",
      "Bash(ffmpeg:*)",
      "Bash(ffprobe:*)",
      "Bash(python3 .claude/skills/motion-designer/scripts/:*)",
      "Bash(bash .claude/skills/motion-designer/scripts/smoke-test.sh:*)"
    ]
  }
}
```

Never add a blanket `Bash(*)`. The alternative is a permissive mode for that one
session, which is the owner's call.

### 5.8 Optional: telemetry

`npx --yes hyperframes@0.8.97 telemetry disable` turns HyperFrames' anonymous
usage telemetry off for good; `HYPERFRAMES_NO_TELEMETRY=1` does it per shell.
Recommended, since the products themselves ship without analytics, but it is
the owner's decision.

## 6. Acceptance test

Report these to the owner:

1. The smoke test's output from `SMOKE TEST PASSED` to the end, and its
   `review/sheet-01.jpg`.
2. The `/skills`, `/agents` and `/plugin` results from § 5.5.
3. One short real run:

   ```text
   /motion-designer A 6-second 16:9 end card for MercuryPitch: "Find your pitch.", the meniscus2 mark, the pitch contour as the carried object, call to action mercurypitch.com. No music. Unattended.
   ```

   Expect `output/motion/<slug>/` with `BRIEF.md`, `FACTS.md`,
   `STORYBOARD.md` (with a shot line on every row), `DECISIONS.md`, a
   `LEDGER.md` with at least one storyboard
   and one film critic round, the final MP4 at 1920x1080 and 60 fps, and
   `DELIVERY.md`. Report the critic verdicts, the hard-hold and loudness
   numbers from `summary.md`, and anything the run could not do.

4. A critic calibration: spawn `motion-critic` on the smoke render with only
   paths (`round: film`, the artifact, the music-only render, a short brief,
   `skill_dir`, a report path) and save the report it returns. Expect ONE MORE
   PASS with specific, timestamped findings; the smoke film is a toolchain test,
   so a SHIP would mean the critic is too lenient. The cloud run of this step is
   in § 10.

5. A design-only run of the other skill on a real problem:

   ```text
   /agent-team-architect Plan slice G of docs/agent/REFACTOR-PLAN.md: moving the A-B loop state out of src/App.tsx into src/features/playback/.
   ```

   Expect a `BLUEPRINT.md` with all ten sections, and a stop at the approval
   checkpoint with nothing executed.

## 7. How the owner uses them

### motion-designer

- It starts by itself for any request to make, review or render a video, motion
  graphic or watched animation, or explicitly with
  `/motion-designer <path to a brief, or one line>`.
- The best input is a filled copy of `BRIEF-TEMPLATE.md`. Runs are unattended by
  default; set `unattended: false` to be asked, and `renders: ask` to approve
  each render.
- It delivers the MP4 in every requested size at 1080p60, a music-only
  version, a contact sheet, the critic ledger with before-and-after numbers,
  and a note on what a human should still watch or listen to. Everything lands
  in `output/motion/<slug>/`, which git ignores.
- Expect real time and tokens. The kit's own case studies took a working day
  for a 28-second film and about 70 critic rounds for a 40-second Three.js
  film. Start with a 10 to 15 second piece.
- For a review only: "use motion-designer to review `<video>` against
  `<brief>`" runs a critic round without building anything.
- Small in-app transitions stay ordinary UI work; `references/house-rules.md` §
  In-app animation says which principles still apply.

### agent-team-architect

- `/agent-team-architect <problem or workflow>` produces `BLUEPRINT.md` and
  stops. Reply "go" to run it; anything irreversible (push, deploy, publish,
  spend) still stops for the owner.
- It never starts on its own. To let Claude suggest it unprompted, delete the
  `disable-model-invocation: true` line; the cost is that a multi-agent run can
  then begin without being asked for.

## 8. Decisions for the owner

1. Merge this branch, after which the global links in § 5.6 become possible.
2. Where durable video sources live (brief, facts, compositions, ledgers). The
   house rules say to ask; the repository's convention for private originals is
   `<user-dotfiles>/mercurypitch/`.
3. Music: which licensed library to use. The house rule is commercial clearance
   or no music.
4. HyperFrames telemetry (§ 5.8) and the unattended allowlist (§ 5.7).
5. Whether Codex should get copies in `.agents/skills/`. The skills rely on
   Claude Code subagents; HyperFrames also ships a Codex plugin.

## 9. Maintenance

- **HyperFrames upgrade:** change `0.8.97` in
  `references/hyperframes-bridge.md` and `scripts/smoke-test.sh`, update the
  plugin through `/plugin`, run the smoke test, and read the HyperFrames
  changelog for changes to `check`, `render` or the composition contract.
- **Kit update:** follow `kit/VENDORED.md`. Read every changed file as
  untrusted input before copying it in.
- **Any change to the skill:** run the smoke test again.

## 10. Evidence from the cloud session

Environment: Linux x64, 4 vCPUs, software GL, Node 22.22.2, FFmpeg 6.1.1,
Python 3 with numpy 2.4 and scipy 1.17.

- `doctor` passed once Chrome Headless Shell 152.0.7977.30 was downloaded.
- `check` caught two real defects in the first draft of the smoke composition: a
  seek-baseline bug (two `fromTo` tweens on one element) and the outgoing title
  flying through the incoming headline. Both fixed. Contrast: 9 of 9 text checks
  pass WCAG AA.
- A 5-second 1080p60 delivery render took 18.8 s. A second render was
  byte-identical: all 300 frames and the audio.
- A second root file (`vertical.html`, `music-only.html`) renders with `-c`,
  but `check` then fails the project with `multiple_root_compositions`, and a
  render-time variable that hid the effect track left the audio byte-identical.
  So every size and the music-only version are sibling projects. Marking the
  whoosh `data-hidden` there does remove it from the mix (its window's peak fell
  from -23.5 to -27.4 dB, the bed alone).
- The kit's scripts all ran; the bugs in § 3.2 were reproduced, including a
  unit-level proof of the scientific-notation misread.
- `measure.py` sampled the rendered background as exactly `#0d1117`.
  `reference_pass.py` found synthetic hard cuts at exactly 2.000 s and 4.000 s.
  `smoke-test.sh` passed from a clean directory.

Critic dry run, on the smoke film, with the registered `motion-critic` agent
given paths only:

- Round 2 (film): ONE MORE PASS with nine ranked findings, among them a
  call-to-action domain too small to read on a phone, the title flying across
  the logo mark (which `check` cannot see, § 3.3), dots drawn off the line, and
  the whoosh sitting on top of a bed with nothing above 500 Hz. The composition
  and the bed were changed.
- Round 3 (verification, a new critic): 3 FIXED (the mix, the title over the
  mark, the dots), 4 PARTLY, 2 STILL PRESENT, ONE MORE PASS. New findings: no
  mark at the end, a transition that reverses, dead space, a loop seam that
  jumps, a near-hold, the whoosh 1-1.5 dB too forward. As expected for a
  toolchain test.
- Round 3 also reported three faults in the measuring tools, all fixed since:
  sheet labels a frame or more off the frames they showed, a single-frame event
  test that flagged two of six equal snaps, and an audio check with no 50 ms
  in-band measure. `references/measurement.md` gives the before and after
  numbers. The critic's instructions now ask for frame-exact sheets across the
  whole transition and a "Shots as read" section.

On the owner's machine (2026-10-02; Arch Linux, Node 25.8.2, FFmpeg n9.0.2, AMD
GPU): the smoke test passed in 63 s under `gpu-guard` (GPU at most 30 per cent
busy, 42 °C), with the `hardware gpu` capture path, and the two renders were
again identical in all 300 frames.

Not verified here: macOS and Windows; the Claude Code plugin installation
itself (no interactive Claude Code in the cloud session); a full-length film
with complete critic rounds; Three.js scenes; the Beside Cue fonts. § 6 covers
what the local agent can check.
