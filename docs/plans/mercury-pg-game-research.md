# Mercury PG (Pitch Game) — Research: voice-controlled caricature platformer

**Date:** 2026-07-11 · **Status:** research, no code
**Concept owner's brief:** render the mirror-feature caricatures as "little
pop" (big-head / small-body chibi) characters that are playable in a
platformer-like level where you collect notes and long notes — controlled by
the voice (microphone pitch), not the keyboard — and figure out how
Higgsfield AI fits into the pipeline.

*Method note: web findings below come from a fan-out search pass whose
adversarial-verification stage was intentionally cut short to save tokens.
Claims from sources that were fully read are marked **[read]**; claims known
only from search snippets are marked **[snippet]** and should be re-checked
before load-bearing decisions. Codebase and Higgsfield-MCP facts were
verified directly.*

---

## 1. Verdict

**Feasible, and unusually well-suited to this codebase.** Every hard
subsystem the game needs already exists in MercuryPitch in some form:

- a production **pitch engine** (YIN/MPM + SwiftF0 ONNX) with confidence and
  RMS gating (`src/lib/pitch-detector.ts`),
- a proven **rAF-polled mic→F0 stream** pattern (`src/features/mirror/f0-stream.ts`),
- an **exercise framework** with note-accuracy scoring, adaptive difficulty
  and score history (`src/features/exercises/*`) whose existing drills
  (long-note, pitch-hold, scale-runner, siren, arpeggio-jumper) are already
  proto-mechanics for a pitch platformer,
- **14 caricature portraits** with an established, cheap Higgsfield
  generation recipe (handoff doc §8) that can be extended to full-body chibi
  sprites,
- gamification surface to plug results into (**Challenges + Leaderboard**
  pages).

Shipped prior art (One Hand Clapping; the "scream go" genre; the academic
Orpheus study) confirms the core mapping — *sung pitch → character
altitude* — works, is learnable by non-singers, and measurably supports
pitch training. The genuinely new work is (a) game-feel tuning of a noisy,
~60–110 ms-latent control signal, and (b) the chibi sprite pipeline.

---

## 2. Concept

> You've met your voice twin in the Mirror. Now *play as them.* A chibi
> big-head Freddie/Elvis/Amy floats through a cosmic level on the strength
> of your voice: sing higher, they rise; sing lower, they sink; go quiet,
> they glide down. Notes hang in the sky like coins on a staff — hit their
> pitch to collect them. Long notes are glowing rails you must *hold* to
> ride. The level **is** a melody; clearing it means you sang the melody.

Working name: **Mercury PG** ("Pitch Game"). In-app it could surface as
"Twin Runner", "Voice Runner", or a Challenges entry — naming open.

---

## 3. What we already have (verified in-repo)

### Caricatures (the game's cast)
- 14 legend portraits shipped for the Mirror reveal: `public/legends/<slug>.webp`
  (elvis, sinatra, freddie, bruce-dickinson, johnny-cash, barry-white,
  amy-winehouse, cher, adele, whitney-houston, mariah-carey, celine-dion,
  kurt, bowie), wired via `LegendArt.imageSrc` in
  `src/features/mirror/LegendCaricature.tsx`, with SVG
  constellation fallbacks.
- Generated with Higgsfield `nano_banana_2` using the **Style A "mercury
  accents"** master template (oversized expressive head already!) at
  **1.5 credits/image**; per-legend subject clauses are catalogued in
  `docs/plans/voice-mirror-midjourney-prompts.md`; full recipe + failure
  modes (NSFW false positives auto-refund; resubmit softened) in
  `docs/plans/voice-mirror-handoff-2026-07-09.md` §8.
- These are head-and-shoulders portraits — the game needs **new full-body
  chibi renders**, but style, likeness clauses, model choice and cost are
  already solved.

### Pitch engine
- `src/lib/pitch-detector.ts` — YIN (default) + MPM + **SwiftF0** (ONNX
  neural detector, 16 kHz path, weights loaded via `VITE_OVERRIDE_ONNX_MODEL`
  machinery); returns `{frequency, clarity, noteName, octave, cents, midi}`;
  defaults: 44.1 kHz, 2048-sample buffer, 65–2100 Hz, `minConfidence 0.3`,
  `minAmplitude` (RMS) `0.02`, 5-frame pitch history.
- `src/features/mirror/f0-stream.ts` — the pattern to copy: shared
  `MicManager` stream → `AnalyserNode` (fftSize 2048) → YIN, polled on
  requestAnimationFrame (~16 ms hop), emitting a pure `F0Frame` stream;
  deliberately YIN-only so the mirror bundle ships no ONNX weights (same
  bundle rule should apply to the game if it lives in `mirror.html`, or can
  use SwiftF0 if it lives in the main app).
- Latency reality: rAF hop (~16 ms) + 2048-sample window (~46 ms) + history
  smoothing ⇒ roughly **60–110 ms voice→screen**. Fine for *continuous*
  altitude control; wrong for reaction-time jumps — design accordingly (§5).
  For reference, tuned browser AudioWorklet round-trips measured ~14 ms
  (Firefox) vs 19–41 ms (Chrome) in 2020 **[read]** — an AudioWorklet port
  is a later optimisation, not a blocker.

### Exercise framework = proto-game mechanics
- `src/features/exercises/` (19 exercises) with `use-base-exercise.ts`
  (mic + lifecycle + scoring loop), `exercise-scoring-utils.ts`
  (`scoreNoteAccuracy`, `scoreNoteInRange`), adaptive difficulty via
  `practice-intelligence` (`difficultyFactor`, `launchDifficulty`), results +
  history UI (`ExerciseScoreHistory.tsx`), and per-exercise controllers.
- Directly reusable mechanics: **long-note** (sustain hold = long-note
  rails), **pitch-hold / drone-intonation** (dwell-on-pitch = hovering on a
  platform), **scale-runner** (stepwise melody = staircase level),
  **arpeggio-jumper** (leaps = jump gaps), **siren/slide** (glissando =
  ramps/waves), **staccato-precision** (short bursts = tap targets).
- `src/features/falling-notes/` + `src/lib/falling-notes-engine.ts` — an
  existing moving-notes visualisation (piano-roll style), proof the app
  already animates note streams at 60 fps.
- Gamification surface: `ChallengesPage`, `LeaderboardPage`, score history —
  the game's scores have somewhere to live on day one.

### Calibration data (the "only we can do this" hook)
- `settings-store.ts` → `vocalRangePreset` (`VOCAL_RANGES`, soprano→bass)
  plus a "Find my voice" listening flow (app-store walkthrough copy).
- The Mirror measures the user's **actual range** (voiceprint, e.g.
  "F2–C#5") and picks their voice-type + twin. **The game should never ask
  for calibration — it inherits the user's measured range and their twin.**
  This is exactly the calibration One Hand Clapping ships as a manual
  setup step (§4), for free.

### Constraints to respect
- `/mirror` is a separate Vite entry (`mirror.html`) with a strict
  bundle-size rule (no ONNX weights). A game route inside the main app can
  lazy-load; a game inside the mirror bundle must stay lean.
- CLAUDE.md: tours must cover ≥80 % of a new page's features in the same PR;
  `pnpm check` after code changes; `feat/*` branches.

---

## 4. Prior art & what it teaches

### Shipped games
| Game | Control | Lessons for us |
|---|---|---|
| **One Hand Clapping** (Bad Dream Games, 2021 — 2D singing puzzle-platformer) | continuous pitch → platform/height; melody puzzles | **Calibrate to each player's comfortable range up front so every voice type can finish** — never demand notes outside it. Onboarding ramps from "make any noise" to precise pitch. Pitch works best as a *platforming verb* (hitting a note ≈ a well-timed jump), not as a singing exam. Cute low-stakes art measurably lowered singing anxiety ("didn't fear failure… tried all kinds of crazy notes"). The avatar's **mouth animates in sync with your voice** — the single most-loved feedback touch. **[read: dev interview + review]** |
| **Don't Stop! Eighth Note! / Yasuhati** (2017) | volume only → run/jump | Volume-only is hilariously viral but shouty: players scream, fatigue fast, and can't play in shared spaces. Use loudness as a *secondary* channel at most; provide mic-sensitivity adjustment. **[snippet: genre survey by Pitch Pilot devs]** |
| **Scream Go Hero** | volume only | Same genre; confirms demand + the embarrassment/fatigue ceiling. **[snippet]** |
| **SingStar / Rock Band vocals** | pitch vs note highway (scored, not steering) | The "collect notes on a highway" scoring model: cent-tolerance bands, sustain scoring, streaks. Note highways are *judged*, our game makes pitch *causal* — combining both (pitch steers AND scores) is the design. **[read: Paney study below]** |

### Research
- **Orpheus (HCI in Games 2021)** — a serious game where the player sings
  specific pitches to move the character through tasks; pilot players rated
  it "challenging but engaging" and **better for pitch-matching training
  than traditional drills**. Built in Unity, so browser feasibility comes
  from elsewhere, but it's direct academic validation of pitch-as-controller
  for training. Wraps drills in a story to fight monotony — our "play as
  your voice twin" is the same lever. **[read]**
- **Paney, *Music Education Research*** — karaoke note-highway games
  (Karaoke Revolution / Rock Band) produced significant pre/post
  **pitch-matching improvement after as little as ~10 minutes** of play.
  Supports short session design and the pedagogy claim in marketing copy.
  **[snippet, journal abstract]**
- **Design Patterns for Voice Interaction in Games (CHI PLAY 2018)** — 25
  patterns from 449 voice games; key warnings: **sustained or rapid vocal
  input is physically fatiguing**, and supporting *quieter* inputs reduces
  both fatigue and social embarrassment. **[snippet]**
- **Voice Games (INTERACT 2011)** — non-speech vocal input (pitch/volume) is
  up to **50 % faster than spoken commands** for discrete game actions; the
  Vocal Joystick line of work maps vowel/loudness/pitch to continuous
  control. Don't use speech recognition for anything time-critical. **[read]**
- **SMARC effect (Rusconi et al., *Cognition*)** — people (musicians and
  non-musicians) automatically associate **higher pitch with higher vertical
  position**. Pitch→altitude is the culturally "free" mapping and doubles as
  staff-notation pedagogy. **[snippet, well-established effect]**
- **Real-time visual feedback in singing training (review; Wilson et al.)**
  — concurrent visual feedback helps pitch accuracy, but **richer displays
  cost cognitive load**, and beginners benefit from *simpler* displays than
  trained singers. In-game: the character IS the feedback; keep extra HUD
  minimal, add detail only in post-run summaries. **[read/snippet mix]**
- **30+ Years of Automatic Singing Assessment (arXiv 2026 survey)** — how
  karaoke systems score: cent-error tolerance bands, separate onset vs
  sustain weighting — the template for our note/long-note scoring. **[snippet]**

### Distilled design rules
1. Calibrate silently from the user's stored range; fold detected octaves
   into that range (octave errors become invisible).
2. Pitch = altitude (continuous), voicing = thrust, silence = glide/fall.
   No reaction-time jumps; telegraph everything ≥1 s ahead (scrolling level).
3. Loudness at most cosmetic (glow/size), never required — quiet singing
   must be a first-class way to play (fatigue + embarrassment).
4. Levels are short (45–90 s) with **breath rests designed in** (gaps where
   silence is correct) — this is also just… singing pedagogy (phrasing).
5. Cute, low-stakes, funny failure. The chibi twin *is* the anxiety-reducer.
6. Mouth-sync the character to live voicing. Cheap, magical.
7. Session sweet spot ~5–10 min; improvements are measurable at that dose.

---

## 5. Control & signal design

### Mapping (v1)
| Voice signal (existing API) | Game verb |
|---|---|
| voiced + `clarity ≥ ~0.5` | character is "singing": thrust on, mouth open |
| `midi` (folded into user range, EMA-smoothed) | target altitude (lerp toward it, spring-damped) |
| silence / below RMS gate | glide → gentle fall (never instant death) |
| sustain ≥ N ms within ±tolerance of a rail | riding a long-note rail (progress fills) |
| optional: RMS level | sparkle intensity / trail thickness (cosmetic only) |

### Signal conditioning recipe (all knobs already exist)
- Gate: `minAmplitude` RMS ≥ ~0.02 **and** clarity ≥ ~0.5 for *control*
  (looser than the 0.3 default used for display).
- Smooth: median-of-5 (the detector's history) → EMA (α ≈ 0.3–0.5) →
  spring toward target y. Add ±30–50 cent hysteresis before switching the
  "current semitone" so the avatar doesn't shiver between adjacent notes.
- Octave handling: fold every detection into the user's calibrated range
  (mirror voiceprint / `vocalRangePreset`); a bass and a soprano then play
  identical level geometry.
- Dwell: 100–150 ms lock windows (the mirror's metric windows) before
  registering note *collection*; long-note rails accumulate hold time with
  brief dropout forgiveness (~120 ms) so a flickering detector doesn't break
  a hold.
- Latency: with rAF+2048 the loop is fine for steering. If it ever feels
  mushy, the upgrade path is an AudioWorklet feeding 128-sample quanta into
  a ring buffer with sub-window estimates (the `pitchlite` architecture,
  WASM MPM, **[read]**) — measured browser audio paths reach ~14–20 ms.
  Not needed for v1.

### Anti-frustration
- Never require notes outside the calibrated range (One Hand Clapping rule).
- "Any-noise mode" for the first level / kids: voicing alone flies, pitch
  ignored (Yasuhati mode) — then introduce pitch.
- Game audio bleed: if playing without headphones, the backing track can
  false-trigger the mic. Mitigations: clarity gate already rejects most
  music; duck backing under detected voicing; show a one-time "headphones
  recommended" hint. (Known open risk to prototype early.)

---

## 6. Level & scoring design

- **A level is a melody.** Reuse exercise generators: scale-runner ⇒
  staircases, arpeggio patterns ⇒ jump gaps, siren ⇒ sine waves, long-note ⇒
  rails, staccato ⇒ coin bursts, call-response ⇒ "echo caves" (hear phrase,
  then its coins appear). Later: any karaoke/melody asset (`melody-engine`,
  key-detection) becomes a level — "play your song".
- **Collectibles:** short notes = orbs pinned at (time, pitch); collected
  when the avatar passes within the cent-tolerance band. Long notes =
  glowing rails; hold to fill; releasing early keeps partial credit.
- **Scoring:** reuse `scoreNoteAccuracy`/`scoreNoteInRange` per collectible;
  weight onset vs sustain separately for rails (per the singing-assessment
  literature); stars per level; streak multiplier for consecutive
  collections. Results flow into the existing exercise history +
  Challenges/Leaderboard.
- **Difficulty:** `practice-intelligence` scaling narrows tolerance
  (±50 → ±25 cents), widens interval leaps, lengthens rails, adds density —
  same knob philosophy as current exercises.
- **HUD:** minimal during play (character + next notes + streak). Full pitch
  trace and per-note breakdown on the results screen (reuse
  `last-run-trace.ts` pattern), where cognitive load is free.

---

## 7. Rendering / engine choice

Facts gathered:
- **Phaser** has an official **SolidJS + TS + Vite template**
  (`phaserjs/template-solid`): component mounts/destroys the game instance,
  EventBus bridges Solid ↔ Phaser. **[read: repo]** Batteries included
  (physics, particles, tilemaps, tweens); heaviest bundle of the options.
- Cross-engine sprite benchmark (`Shirajuki/js-game-rendering-benchmark`):
  PixiJS ≈ 47 fps and Phaser ≈ 43 fps at high sprite counts while
  **Kaplay/Kaboom collapses (~3 fps)**. **[snippet: repo readme numbers]**
- Apr-2026 phaser.io comparison (self-hosted, mind bias): Phaser wins
  stability/perf (esp. Safari); Kaplay easiest for jams; Excalibur is a
  lighter TS-first engine. **[snippet]**
- **License trap:** `pitchfinder` is GPL-family ("GNU v3") — do **not**
  bundle; `pitchy` is 0BSD — fine; our in-house detector makes both moot.
  **[read: npm/readme]**

**Recommendation:**
- **v1: no engine — plain canvas + rAF,** the house style
  (`falling-notes-engine`, `card-renderer`, `ab-loop-canvas`, `arc-physics`
  are precedents). The scene is one avatar, ~30 collectibles, parallax
  starfield — trivially within a hand-rolled loop, keeps the bundle rule,
  zero new deps, and the physics we need (spring toward pitch, glide) is
  ~50 lines.
- **Escalate to Phaser 4 via `template-solid`** only if scope grows real
  platforming (enemies, tilemaps, collisions beyond note pickup). Avoid
  Kaplay (perf) and any GPL pitch lib.

---

## 8. Character & asset pipeline — where Higgsfield fits

*Grounding: tool contracts read directly from the connected Higgsfield MCP
server this session (tool execution needs interactive approval, so no jobs
were run). Costs from the transaction-verified spend log in the handoff doc.*

### 8.1 Chibi sprite generation (the main use)
1. **Master chibi per legend** — `generate_image` with `nano_banana_2`
   (1.5 cr @1k, known-good for our style), extending the Style A template.
   Draft clause to test:

   > …Style A scaffold… — **full-body chibi caricature, oversized head on a
   > tiny rounded body (head ≈ half of total height), short stubby limbs,
   > standing in a neutral A-pose, whole figure fully in frame, plain flat
   > dark background** — {LEGEND signature clause from the prompt library},
   > no text, no watermark

2. **Identity consistency across poses** — pass the existing portrait
   (`public/legends/<slug>.webp`) and/or the chibi master as **reference
   media**: upload via `media_upload`/`media_import_url`, or save as an
   **Element** (`show_reference_elements`, instant, works with Nano Banana
   models). Higgsfield's **Soul ID** (trained identity, 5–20 photos, ~10 min,
   usable only with `soul_2`/Soul Cinema) is the heavier option — relevant
   later for **player-selfie characters**, not needed for the 14 legends.
   (Note: Soul 2.0 was disqualified for legend likenesses in the style
   shootout — uncanny; stick with the nano family for legends.)
3. **Pose set per character** — either
   - **Paper-doll (recommended):** 1–2 renders per legend (A-pose +
     sing-pose) → `remove_background` (transparent cutout) → slice into
     head / body / arm layers → animate in code: bob, tilt, squash-stretch,
     and a swapped/scaled **mouth layer synced to live voicing** (the One
     Hand Clapping delight, and our LiveViz already tracks voicing). Big-head
     chibi is ideal for this — the head does all the acting. ~2–4 images per
     legend.
   - **Sprite-sheet:** 5–7 pose stills (idle, glide, sing, strain-high,
     low-croon, hit, celebrate) per legend → `remove_background` each →
     pack an atlas. More charming, ~7–10 images per legend, more retry risk.
4. **Post:** `magick -quality 82 → webp` (~120–230 KB each, existing recipe);
   store under `public/legends/game/<slug>/…`.

**Cost model** (preflight everything with `get_cost:true`, per the agreed
approve-then-generate workflow): paper-doll pilot with 3 legends ≈ 3 × 3
images × 1.5 cr ≈ **13–20 cr** with retries; full 14-legend set ≈
**60–160 cr** depending on approach — comfortably inside the ~358-credit
balance, and the pilot alone validates the style.

### 8.2 Other Higgsfield capabilities mapped to this project
| Tool (verified contract) | Use for Mercury PG |
|---|---|
| `remove_background` (image *and video*) | transparent sprites; cutout of animated clips |
| `generate_3d` (image→GLB, texturing/PBR, rigging; `multi_image_to_3d`) + `animation_actions` (678-clip rig library: locomotion, dancing, gestures) | **3D route:** one chibi render → rigged GLB → apply walk/jump/dance clips → render to sprite sheets offline (or a Three.js cameo). Higher ceiling, more credits/complexity — *defer to v2*; also a future "dancing twin" share asset |
| `motion_control` (Kling 3.0: character still + driving video) | puppeteer a legend from a real performance clip — marketing/teaser material, or frame-source for sprites |
| `generate_video` / `upscale_*` / `outpaint_image` | trailers, App-store/OG assets, background plates (outpaint the cosmic nebula into wide parallax layers) |
| `generate_audio` / `create_voice` | menu jingles, crowd cheers; (voice cloning of legends is a rights minefield — avoid) |
| `deploy_game` + `publish_game` | **separate channel, not the in-app path:** ships a zip (`index.html` + `logic.js` turn-based rules *or* `server.js` realtime) to a hosted play URL + Higgsfield marketplace listing. A cut-down standalone "Mercury PG demo" could live there as viral marketing that funnels to MercuryPitch. `get_game_creation_instructions` (their build SKILL + scaffolds) requires an interactively-approved session — pull it from a normal claude.ai chat when we want this. |
| Higgsfield "AI Game Generator" product | their prompt-to-game platform (2D/3D, hosted multiplayer sync claimed) **[snippet — marketing page proxy-blocked this session]** — worth one look before building the standalone demo by hand |

### 8.3 Practicalities
- Tool execution requires per-call user approval (and cost approval is our
  own agreed rule) — asset generation happens in an interactive session,
  exactly like the portrait batch did.
- CDN result URLs expire and are proxy-blocked in cloud sandboxes — download
  winners promptly on a local session (documented limitation in the handoff).
- NSFW false-positives on female celebrities auto-refund; soften adjectives
  and resubmit (known recipe).

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Likeness rights** — playable caricatures of real celebrities is a bigger legal surface than reveal portraits (interactive use, potential marketing screenshots) | High (before any public/prod release) | Ship v1 behind the existing account/dev gates; get a rights read before marketing; keep the SVG-constellation fallback path so the game works with abstract "voice creatures" too (the user's "creatures" idea — original characters per voice type sidestep the issue entirely) |
| Mic environment: noise, speaker bleed from backing audio, shared spaces | Med | clarity+RMS gates; duck backing under voicing; headphone hint; "any-noise" easy mode; pause-on-silence ≥3 s |
| Vocal fatigue / health | Med | 45–90 s levels, rests as mechanics, no loudness requirement, gentle "take a break" after ~10 min (which is also the pedagogically-proven dose) |
| iOS Safari audio quirks (AudioContext gesture, mic focus loss) | Med | mirror already solved gesture-scoped AudioContext; reuse `MicManager` |
| Latency feel | Med | continuous-control design (no reaction jumps); AudioWorklet upgrade path documented |
| Bundle size (esp. if inside `mirror.html`) | Low | plain-canvas v1, lazy route in main app, YIN-only in mirror context |
| Scope creep (it's a *mini*-game) | Med | phase plan below; v1 = one mechanic, three legends, five levels |
| Credits | Low | pilot ≈ 15–20 cr; full set ≤ ~160 cr vs ~358 balance; preflight `get_cost` always |

---

## 10. Suggested build plan

- **P0 — control-feel spike (1–2 dev-days, no art):** hidden dev route
  (`?game=` hash, like `?demo=`); canvas; circle avatar driven by the
  existing `PitchDetector` via a copied `f0-stream`; five hardcoded orbs +
  one rail. *Go/no-go: does steering feel good on desktop + phone?*
- **P1 — game feel:** spring/glide physics (`arc-physics` as base), scrolling
  level, collection FX, mouth-flap placeholder, results screen reusing
  exercise scoring.
- **P2 — art pilot:** 3 legends (freddie, elvis, amy) paper-doll via
  Higgsfield (§8.1), mouth-sync, cosmic parallax (outpainted nebula).
- **P3 — content & integration:** level-from-exercise generator (scale,
  arpeggio, long-note, siren), difficulty via practice-intelligence, scores
  into history + a Challenge entry, remaining legends batch.
- **P4 — polish/release:** onboarding ramp ("make any noise" level),
  headphones hint, share card ("cleared Level 3 as Freddie — 94 %"), page
  tour (CLAUDE.md ≥80 % rule), likeness-rights decision, optional
  Higgsfield-hosted standalone demo.

---

## 11. Open questions for the product owner

1. **Cast:** legends only, the user's own caricature (Soul ID from selfies —
   a whole feature), original "voice creatures", or all three tiers?
2. **Where does it live:** main app page (lazy route, SwiftF0 allowed) vs
   mirror bundle (YIN-only, size-capped) vs both (shared core)?
3. **Framing:** arcade mini-game in Challenges, or a "training world" that
   wraps existing exercises in levels?
4. **Backing audio:** silent levels (purest control) vs melody playback
   (nicer, but mic-bleed risk on speakers)?
5. Green-light the P2 Higgsfield pilot spend (~15–20 credits, 3 legends)?

---

## 12. Sources

**In-repo:** `docs/plans/voice-mirror-handoff-2026-07-09.md` (esp. §8),
`voice-mirror-midjourney-prompts.md`, `src/lib/pitch-detector.ts`,
`src/features/mirror/f0-stream.ts`, `src/features/exercises/*`,
`src/features/falling-notes/*`, `src/stores/settings-store.ts`.

**Higgsfield:** MCP tool contracts read live this session (`generate_image`,
`show_characters`/Soul, `show_reference_elements`, `remove_background`,
`generate_3d`, `animation_actions`, `motion_control`, `deploy_game`,
`publish_game`, `media_upload`); spend/cost log from the handoff doc;
higgsfield.ai marketing pages were proxy-blocked (marked [snippet]).

**Web (fully read):** Gaming Nexus interview with Bad Dream Games (One Hand
Clapping); Hey Poor Player OHC review; Springer — *Orpheus* (HCI in Games
2021); Springer — *Voice Games* (INTERACT 2011); `ianprime0509/pitchy`;
`sevagh/pitchlite`; `peterkhayes/pitchfinder`; `cwilso/PitchDetect`;
jefftk.com AudioWorklet latency measurements; `phaserjs/template-solid`.

**Web (snippet-grade, re-verify if load-bearing):** CHI PLAY 2018 voice
design patterns (dl.acm.org); Paney pitch-matching study (ResearchGate);
SMARC (Rusconi et al.); arXiv 2601.12153 singing-assessment survey;
phaser.io Apr-2026 engine comparison; `Shirajuki/js-game-rendering-benchmark`;
JSLegendDev & GameFromScratch engine surveys; Higgsfield Soul ID blog +
games-intro; pitchpilotgame.com genre survey; PixelLab/AutoSprite sprite
tools; pitchdetector.com stabilization explainer.
