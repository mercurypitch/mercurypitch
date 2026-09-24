# Loader, tutorial and Glassworks Journey — implementation checkpoint

Status: 2026-09-20. The owner authorized the loading presentation, the next
tutorial step and the first longer route blockout. This records the implementation prepared for draft PR #807. It is not a
production-release record. The final revision and CI status belong to the PR
and the canonical HANDOFF checkpoint.

## Implemented in the development build

### Honest loading presentation

- An opaque, Merc-led loading screen now hides unfinished WebGL frames.
- Readiness requires installed assets and a successfully rendered frame, with a
  two-second initial presentation minimum. Reveal occurs on a rendered frame
  at or after that deadline, so a resize cannot expose a cleared buffer. A later slow state explains the wait without
  claiming that rendering is ready.
- Failed asset or graphics initialization shows a focused error state with
  **Retry** and **Leave museum** actions. Retry attempts are generation-safe;
  stale completions and disposed attempts cannot reveal the scene.
- The host supplies the existing Merc loading artwork through its asset map.
  No new model or voice generation was needed for the loader.

### First Light tutorial candidate

- The enclosed room keeps its stable save identity
  `glassworks-chamber/chamber`; only its player-facing title and authored
  tutorial changed. Its content revision is `3`.
- The title is **First Light Gallery**. Its compact authored tutorial teaches
  movement, camera control and the first held-note interaction before leaving
  the player in the existing two-required, one-optional chamber route.
- Both `?layout=chamber` and `?layout=tutorial` intentionally load this same
  level and save identity. They are preview aliases, not separate campaigns.

### Glassworks Journey blockout

- The first longer held-note route is authored as reusable level data at the
  stable identity `glassworks-journey/journey`, content revision `1`.
- The route is vestibule → concealed window passage → garden → offset archive
  approach → archive → portrait salon → panorama. Floors and ports form one
  continuous physical route; each required success permanently removes the
  next route gate.
- Four required encounters drive progression:
  `vestibule-goblet`, `garden-decanter`, `archive-carafe` and
  `portrait-finale`.
- Four optional encounters never gate progression or departure:
  `garden-amphora`, `garden-coupe`, `panorama-amphora` and
  `panorama-coupe`.
- The blockout reuses the enclosed chamber, entry, corner and panorama
  assemblies, plus a reusable two-port gallery room. It uses existing V4
  window/screen bays, deck and plinth recipes, and the existing goblet,
  decanter, fluted vessel, portrait, amphora and coupe assets. It adds no Meshy
  dependency or new generated model.
- The authored movement profile walks at `1.55`, reaches `2.7` after a `0.6 s`
  run-up and ramps over `0.8 s`. These remain playtest values.

## Stable previews and IDs

Use these paths beneath a local or approved LAN preview origin:

| Preview               | Path                           | Runtime level/layout ID      |
| --------------------- | ------------------------------ | ---------------------------- |
| Existing prototype    | `/glass-game/`                 | `glassworks`                 |
| First Light Gallery   | `/glass-game/?layout=chamber`  | `glassworks-chamber/chamber` |
| Tutorial alias        | `/glass-game/?layout=tutorial` | `glassworks-chamber/chamber` |
| Longer route blockout | `/glass-game/?layout=journey`  | `glassworks-journey/journey` |

The compiled journey encounter IDs use this stable form:

`glassworks-journey/journey/<room>/encounter/<encounter-id>`

The authored source and reusable catalog are exported as
`GLASSWORKS_JOURNEY_SOURCE`, `GLASSWORKS_JOURNEY` and
`GLASSWORKS_JOURNEY_AUTHORING_CATALOG`. The existing `glassworks` and
`glassworks-chamber/chamber` identities and saves remain intact.

## Route walk reference

Coordinates below are world `(x, z)` positions rounded to three decimals. The
full design intent remains in the canonical `LONGER-LEVELS.md`; the companion
pace and campaign decisions are in
`JOURNEY-PACE-AND-RESONANCE-FINALE.md`.

| Beat                    | Checkpoint or walk coordinate                                                                          | Encounter anchor / gate                          |
| ----------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------ |
| Vestibule               | spawn `(0.000, -2.800)`                                                                                | anchor `(0.000, -0.050)`; east gate `x=4.447`    |
| Window passage          | `(7.471, 0.000)` → `(12.096, 0.000)` → `(12.096, 4.625)`                                               | concealed turn into the garden                   |
| Garden                  | checkpoint `(12.096, 9.296)`                                                                           | anchor `(12.096, 12.046)`; north gate `z=16.543` |
| Offset archive approach | `(12.096, 19.567)` → `(12.096, 24.192)` → `(16.721, 24.192)` → `(21.346, 24.192)` → `(21.346, 28.817)` | continuous coplanar corridor                     |
| Archive                 | checkpoint `(21.346, 33.488)`                                                                          | anchor `(21.346, 36.238)`; north gate `z=40.735` |
| Portrait salon          | checkpoint `(21.346, 48.430)`                                                                          | anchor `(21.346, 51.180)`; north gate `z=55.677` |
| Panorama                | checkpoint `(21.346, 65.426)`                                                                          | exit `x=20.696..21.996`, `z=66.626..67.026`      |

Stable compiled checkpoints are:

- `glassworks-journey/journey/vestibule/checkpoint/arrival`
- `glassworks-journey/journey/garden/checkpoint/entry`
- `glassworks-journey/journey/archive/checkpoint/entry`
- `glassworks-journey/journey/portrait/checkpoint/entry`
- `glassworks-journey/journey/panorama/checkpoint/panorama`

For visual review, the panorama checkpoint supports the final south-facing
overview; `(21.346, 24.192)` is the useful interior overview at the route turn.

## Verification

- Focused lifecycle/required-asset/renderer suites: **27 passed**.
- Focused authoring/journey/chamber suite after checkpoint review: **33 passed**.
  Malformed saves cannot select a later checkpoint while its entry gate is
  still locked. Per-placement checkpoint prerequisites are reusable authoring
  data, with missing-reference validation.
- Glass-game package and BesideCue/shared-package typechecks: **passed**.
- Native games asset packaging: **6 passed**.
- Browser checks cover loading, texture failure/retry, real context loss,
  progress retention, leaving pending work, teaching, keyboard/mouse/touch,
  chamber gates and seams, and real PCM microphone lifecycle.
- The initial combined browser run passed 16/17 cases. Its last touch case
  measured only six physics steps in a fixed RAF-count window; the isolated
  unchanged case passed. The helper now polls actual travel within a bounded
  time while preserving its original movement threshold. Final targeted
  verification passed both affected keyboard/touch cases twice: **4/4**.
- Changed-file validation (`pnpm pr:validate`) passed after fixing the two
  preparation lint findings. Games-enabled production build passed.
- Actual loader/ready/error screenshots cover desktop and phone portrait and
  landscape. Production CSS, Merc framing and touch targets are inspected at
  320px, 390px, 768px and 1280px. Evidence lives in
  `art/glass-adventure/loading/v1/`.
- Eight real-rendered journey views (arrival, garden, portrait and panorama,
  desktop and phone aspect ratios) loaded without asset or page errors.
  Fixed inspection poses seed completion and are not a complete playthrough.
  Evidence lives in `art/glass-adventure/v4/architecture/proofs/journey-blockout/`.
- Captured journey frames report **224–510 draw calls** and approximately
  **2.1–4.74 million triangles**, including render passes. These are workload
  counts, not measured frame rate. They require a visibility/LOD/shadow budget
  pass and physical-device profiling before campaign promotion.

## Acceptance still required

- Playtest the complete journey layout, sightlines, optional-treasure
  visibility, camera composition and final panorama. Fixed views were inspected;
  the owner still needs to evaluate the whole route in motion.
- Walk the route on a physical touch device, including tutorial clarity,
  loading/error controls, sustained travel and all four gates.
- Measure actual first-play duration and fatigue. The 10–15 minute longer-level
  target is a playtest goal, not a verified claim.
- Accept or revise the blockout's room rhythm and repeated wall treatment before
  commissioning additional art. The garden currently has its soundscape and
  exhibits, but no botanical dressing; archive and portrait rooms also need
  distinctive dressing and a floor/shadow refinement pass.

Coins, measured grades/stars, portrait collection badges, campaign progression,
next-level navigation, Coda Echo or other melodic imitation, pitch-verified sung
references, and saved/shared player recordings remain plan-only. None is implied
by the current encounter labels, Merc reactions or completion copy.
