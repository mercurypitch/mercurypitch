# Brief: Lesson 5's film, production step 1: the project, the tools and the scratch clock

You set up the production of the film for Find Your Pitch, Lesson 5, "Breath and a steady note":
its HyperFrames project, the tools every later step uses, and the scratch voice clock. No scene
is built in this step.

S = /tmp/claude-0/-home-user-mercurypitch/12ae313e-03fe-590a-b304-88d38ce9e159/scratchpad
R = /home/user/mercurypitch/.claude/worktrees/fix (a read-only checkout of main; read files there,
change nothing in it, never run pnpm there)
P = $S/l5film (the film's project folder; it persists across container restarts)

## Rules
- Write only in P. Never in R, any other worktree or the repository.
- One other heavy job shares this 4-core, 13.7 GB machine: run anything heavy (a render, a
  Chromium pass, an esbuild of the app) through `$S/bin/heavy <command>`, one at a time.
- No voice, image, video or music service (no ElevenLabs, no Higgsfield). The scratch voice is
  local Kokoro, already installed: `P/.venv` (kokoro-onnx, soundfile, numpy; run python with
  `-I`) and `P/models/kokoro-v1.0.onnx`, `P/models/voices-v1.0.bin`.
- No attribution anywhere, no emojis, no model names in any file.
- While you work, another agent applies small paper fixes to `P/STORYBOARD.md`, `P/HANDOFFS.md`
  and `P/DECISIONS.md` and writes `P/LAB-CHECKS.md` (labels, chips, the timing of one push inside
  12c). No scene's start or end, no clock time and nothing in `script.json` changes. Read those
  files, never edit them, and take the scene table and the clock from `script.json` and
  `gen-root.py`.

## Read first
1. The skill: `R/.claude/skills/motion-designer/SKILL.md` (§ 0, § 5, § 8, § 10),
   `references/hyperframes-bridge.md` (§ New project, § One root per project, the director block),
   `references/house-rules.md`.
2. `R/docs/plans/find-your-pitch/PRODUCTION-PIPELINE.md`: § 2 (the steps and commands), § 3 (one
   clock, narration pacing, Merc), § 4 (the traps; all of them bind later steps, so the tools must
   not make them easy).
3. Lesson 4's backup, `$S/l4film/`: `BUILD-GUIDE.md` (the clock rules, `at()` and `word()`),
   `DELIVERY.md` (what was voiced how), `tools/` (the tools that survived) and `tools/CHANGES.md`
   (their history and every environment variable they read), `tools/board-cues.json` (a frozen
   `cues.json`: the clock's exact schema), `compositions/` and `assets/` (finished scenes and the
   kit they share).
4. The film: `P/BRIEF.md`, `P/script.json` (final words; its events, hosts, gaps), `P/STORYBOARD.md`
   and `P/HANDOFFS.md` (the board under its last critic round; do not edit them), `P/DECISIONS.md`.

## What to build
1. **The project.** Scaffold with `HYPERFRAMES_SKIP_SKILLS=1 HYPERFRAMES_NO_TELEMETRY=1 npx --yes
   hyperframes@0.8.97 init <temp dir> --non-interactive` and bring what it makes into P without
   overwriting P's documents. Append the skill's director block to P's CLAUDE.md and AGENTS.md.
   Fonts: the OFL fonts Lesson 4 used, fetched with their licences. Run the skill's smoke test
   once (`scripts/smoke-test.sh`) and `doctor`; both must pass.
2. **The tools**, in `P/tools/`, each with a short header saying what it reads and writes:
   - Copy every surviving Lesson 4 tool and adapt only what Lesson 5 needs (act names, the scene
     table, the passes and sounds come later; keep their environment variables). P already has
     adapted `gen-root.py` and `script-draft.py`: keep them.
   - Recreate the ones that were lost, from their contracts: what the surviving tools read from
     them, `board-cues.json`'s schema, PRODUCTION-PIPELINE § 2 and § 3, Lesson 4's DELIVERY and
     CHANGES. At least: `tts.py` and `cues.py` (Kokoro per line at Merc `am_michael` speed 0.84
     and Tavi `af_heart` 0.9, each line's WAV, loudness envelope and word times from Kokoro's own
     phoneme timing, the authored gaps, `cues.json` and a pacing report: words a minute while
     speaking and overall, against the pipeline's target); `build-merc.mjs` (bundles the app's
     Merc renderer from R for `merc-pass.mjs`, which says what it expects); `lab.mjs` (a scene's
     lab stills and its 3 to 4 s clip, as the skill's § 5 asks); and a clock lint (no typed
     second in a scene but 0 and D). If a lost tool's job is done another way now, say so.
   - Log every tool in a new `P/tools/CHANGES.md`, newest first, as Lesson 4's was kept.
3. **The scratch clock.** Run the voice over `script.json`: `cues.json`, the per-line WAVs under
   `P/assets/voice-kokoro/`, the envelopes, the pacing report. Then:
   - compare the scratch total with the board's 9:22.0 and give each act's shift;
   - make `board-clock.py` map board times to cues on this clock (the board stays timed on its
     own clock, as Lesson 4's did; freeze a `board-cues.json` only if the board is re-timed);
   - run `gen-root.py` for the scene table, the root `index.html` and placeholder scenes, and
     prove the film renders end to end as placeholders at a draft size (through the heavy helper).
4. **Merc.** Build the renderer bundle and render one short test pass (`merc-pass.mjs` with a
   two-second shot file of your own: Merc idle, then a sung second) to prove the pass works on
   this machine. Look at a still. Do not write the film's passes yet.

## Hand back
What exists and where; each tool and whether it was copied, adapted or recreated (and from
which contract); the smoke test's and doctor's results; the scratch clock's total, each act's
shift against the board and the pacing numbers; the placeholder render's path; the Merc test
still's path; anything that could not be rebuilt, and the questions the lead must decide.
