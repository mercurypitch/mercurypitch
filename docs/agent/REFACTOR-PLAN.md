# Refactor handoff — the oversized files

Working plan for breaking up the files that dominate context cost and change
risk. Written so an agent picking up any single slice has everything it needs
without re-deriving the analysis.

**Status: proposed, two slices done, and losing ground.** The lyrics
controller was split on `feat/lrc-mapper-studio` (see
[docs/plans/lrc-mapper-studio-plan.md](../plans/lrc-mapper-studio-plan.md)
Phase 0), and the "From vocal" orchestration left StemMixer for
`useStemMixerVocalLyricsController.ts` (#683). Everything else stands.
Sequence and scope are open to change; ordering rationale is in §5.

**Every number below was re-measured on 2026-09-21 at `608891d7`**, and the
table in §1 had drifted 30-44% low on four of its six files. Re-measure before
trusting any figure here: `pnpm metrics` prints the LOC and hotspot tables this
document is built from. The counts are ratcheted in CI from #842 onward, so the
files can no longer grow unremarked — but nothing shrinks them except this work.

---

## 1. Why these files

A handful of files carry disproportionate cost. They are simultaneously the
largest and among the most-changed, so every session that touches them pays to
re-read them.

Measured 2026-09-21 at `608891d7`. Churn is over twelve months, which is the
window `scripts/code-metrics.mjs` uses; the old "last 400 commits" column is
gone because 400 commits is fifteen days in this repo and an unlabelled window
quietly changes meaning between readings. "Cog" is summed cognitive complexity
per file, from the same harness.

| File                                                      | LOC   | ~tokens to read | Commits (12 mo) | Cog |
| --------------------------------------------------------- | ----- | --------------- | --------------- | --- |
| `src/components/StemMixer.tsx`                            | 8,172 | ~64,800         | 200             | 25  |
| `src/lib/piano-roll.ts`                                   | 5,965 | ~58,800         | 61              | 687 |
| `src/features/drum-night/DrumNightApp.tsx`                | 5,183 | ~52,600         | 38              | 184 |
| `src/App.tsx`                                             | 4,723 | ~53,100         | 248             | 86  |
| `src/components/UvrPanel.tsx`                             | 3,444 | ~36,300         | 116             | 104 |
| `src/features/stem-mixer/useStemMixerLyricsController.ts` | 1,964 | ~17,900         | 20              | 67  |

`StemMixer.tsx` and `App.tsx` together are ~118k tokens. That is still the
problem in one line, and both files are bigger than when this was written:
StemMixer by 1,904 lines (+30%), App.tsx by 1,437 (+44%), `UvrPanel.tsx` by 803
(+30%), `piano-roll.ts` by 879 (+17%).

`src/components/VocalAnalysis.tsx` has left the table: it was **deleted on
2026-08-01 by `591bc095`**, the same integration-train commit that last revised
this document. It was already gone when it was listed. §3.3 is kept for the
method it describes, which now applies to a different file.

Three files belong in this conversation and were never in it:

| File                                                   | LOC   | Note                                                |
| ------------------------------------------------------ | ----- | --------------------------------------------------- |
| `src/features/drum-night/DrumNightApp.tsx`             | 5,183 | 43 `createSignal` calls; no extraction started      |
| `workers/db-worker/src/auth.ts`                        | 3,706 | the largest file outside `src/`; hotspot score 5369 |
| `apps/beside-cue/src/games/glass/JourneyPrototype.tsx` | 3,196 | a different app, but the same reading cost          |

### The extraction is working on complexity, not on size

`StemMixer.tsx` is the largest file in the repo and its summed cognitive
complexity is **25** — lower than almost anything else on the list. The
complexity left with the controllers, exactly as intended:
`useStemMixerCanvasController.ts` is now at **374**, the second-highest in the
codebase.

That is worth being honest about, because it changes what finishing the
extraction buys. It buys **reading cost** — 65k tokens per session that touches
the file — and it buys merge surface on a file with 200 commits a year. It does
not buy much risk reduction, because the risky code has already moved. Anyone
justifying a slice on "this file is dangerous" should say "this file is
expensive" instead, and anyone looking for danger should look at
`useStemMixerCanvasController.ts` and `piano-roll.ts`.

## 2. The pattern to apply

This is not a new architecture — it is finishing one that already works.
`src/features/stem-mixer/` already holds six extracted controller hooks, and
`StemMixer.tsx` consumes them:

```tsx
const mic     = useStemMixerMicController({ ... })
const audio   = useStemMixerAudioController({ ... })
const canvas  = useStemMixerCanvasController({ ... })
```

Each controller:

- lives in `src/features/<feature>/use<Feature><Concern>Controller.ts`
- takes one `deps` object, returns one object of accessors and actions
- owns its own signals and `onCleanup`
- has an exported return-type interface

StemMixer is still 6.3k lines because the extraction stopped halfway, not
because it failed. **Continue it; do not invent a second pattern.**

## 3. Slices

Each slice is independently shippable and independently reviewable. Line
numbers are from the section banners at time of writing — re-grep
`^\s*// ──` before starting, they will have moved.

### 3.1 StemMixer.tsx → 8,172 to ~1,200

Already extracted: mic, audio, lyrics, pitch-analysis, canvas, layout. The
file has grown 1,904 lines since these seams were catalogued, so the section
banners below have moved and the list is no longer exhaustive — re-grep
`^\s*// ──` first, and add any new section to this table before starting.
Remaining seams, roughly in dependency order:

| Slice | Sections                                                                            | Target                                                                                                                                                           |
| ----- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A     | Karaoke playlist integration (344), Zen transport (461)                             | `useStemMixerTransportController.ts`                                                                                                                             |
| B     | Volume/Mute/Solo (1354), Stem controls props bundle (1426)                          | `useStemMixerStemControls.ts`                                                                                                                                    |
| C     | Pitch-word alignment memo (917), Auto word-sync (1312), Loop lyric↔audio sync (739) | fold into the existing lyrics controller, or `stem-mixer/word-sync.ts` if it stays pure                                                                          |
| D     | Melody audition synth (1549)                                                        | DONE: `useStemMixerMelodyAuditionController.ts` — a Solid hook rather than `melody-synth.ts`, which is a pure audio graph with no Solid import; same call as F   |
| E     | Circular Progress (111), Karaoke Focus Mode (160)                                   | plain components in `src/features/stem-mixer/`                                                                                                                   |
| F     | "From vocal" lyrics generation (1627)                                               | DONE (#683): `useStemMixerVocalLyricsController.ts` — a Solid hook rather than `lrc-gen-engine.ts`, because the code is reactive orchestration, not engine logic |

Slices C, D and F move code into files that **already exist**; those are the
cheapest and should go first.

### 3.2 App.tsx → 4,723 to ~800

27 section banners when this was written, most already mirroring a
`src/features/` module that exists but is only partially used. 1,437 lines have
arrived since, and at 248 commits in twelve months this is the most-changed file
in the repo — which is both why it is worth splitting and why a slice here
conflicts most easily with work in flight. Highest value first:

| Slice | Sections                                                          | Target                                                           |
| ----- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| G     | A-B Loop state (1334) — 257 lines, self-contained                 | `src/features/playback/useAbLoop.ts` (`@/lib/ab-loop.ts` exists) |
| H     | Share handlers (555), Singing song picker (1327)                  | `src/features/session/`                                          |
| I     | Take review (902), Compose live recording preview (877)           | `src/features/recording/`                                        |
| J     | Octave shift (1651), Target note (1681), Accuracy heatmap (1695)  | `src/features/practice/`                                         |
| K     | Swipe to change tabs (503), Tab-change cleanup (1203)             | `src/features/routing/`                                          |
| L     | Guide Selection dialog (464), header practice-context pill (1069) | components                                                       |

App.tsx's job afterwards is composition: mount controllers, wire them, render
the shell. It should hold close to zero business logic.

### 3.3 The signal-density method (was VocalAnalysis.tsx)

`VocalAnalysis.tsx` was deleted on 2026-08-01 by `591bc095`. The slice is moot;
the method it described is not, because the density it warned about moved.

Highest `createSignal` counts in one file today, non-test:

| File                                       | `createSignal` |
| ------------------------------------------ | -------------- |
| `src/stores/jam-store.ts`                  | 50             |
| `src/components/UvrPanel.tsx`              | 46             |
| `src/features/drum-night/DrumNightApp.tsx` | 43             |
| `src/App.tsx`                              | 36             |

`jam-store.ts` is a store, so loose signals are its job. **`UvrPanel.tsx` now
carries the exact 46 that made the old file hard to change safely** — up from
the 35 recorded in §3.4 below. So the method applies there:

1. Group the signals into a handful of `createStore` objects by concern.
2. Then extract each group with its logic into a controller hook.

Do not attempt a straight file split first; splitting 46 loose signals across
files makes the coupling worse, not better.

### 3.4 UvrPanel.tsx → 3,444

46 signals (was 35) and only one section banner — the least internally
structured file on the list. **Add section banners first** as a separate,
reviewable commit. That makes the seams visible and the subsequent extraction
mechanical. Do not combine the two steps. Then group the signals per §3.3
before extracting anything.

### 3.5 piano-roll.ts → 5,965

**The "low churn" rationale for deferring this no longer holds, and the file is
now the repo's top hotspot.** Measured 2026-09-21: 61 commits in twelve months
and summed cognitive complexity **687**, the highest in the codebase, giving a
churn × complexity score of 43,281 — roughly double the next file (`App.tsx`,
21,328) and eight times `StemMixer.tsx` (5,000).

Everything else the original note said is still true: it is a canvas editor with
its own internal architecture, it is not a Solid component, and it talks through
`@/lib/event-bus`. Those are reasons it is _awkward_ to split, not reasons it is
safe to leave. It stays last in §5 on difficulty, not on risk — and if a defect
lands anywhere on this list, the measurement says to expect it here.

## 4. Rules for every slice

1. **One slice per PR.** These files are change hotspots; a large refactor PR
   will conflict with feature work in flight.
2. **Pure move first, behaviour change never.** If a slice needs a bug fixed,
   land the fix separately, before or after.
3. **No new patterns.** Match the existing controller shape exactly.
4. `pnpm check` must pass; add the module header per
   [CONVENTIONS.md](CONVENTIONS.md) §7 so the file lands in the index with a
   real blurb.
5. Regenerate the index: `node scripts/gen-agent-index.mjs`.
6. **Verify in the browser.** All six files are user-facing surfaces. Type
   safety will not catch a controller wired up in the wrong order.
7. Anything surprising found on the way goes in [MISTAKES.md](MISTAKES.md).

## 5. Suggested order

1. **StemMixer C, D, F** — move into files that already exist. Lowest risk,
   immediate payoff on the single worst file.
2. **App.tsx G** — A-B loop is 257 self-contained lines; a clean pilot for the
   App.tsx pattern.
3. **StemMixer A, B, E** — new controller files, pattern now proven twice.
4. **App.tsx H–L** — bulk of the App.tsx reduction.
5. **UvrPanel banners** — cheap, unblocks its extraction.
6. **VocalAnalysis state grouping** — highest risk, do it once the pattern is
   routine.
7. **UvrPanel extraction.**
8. `piano-roll.ts` — only if churn justifies it.

## 6. Done when

- No file in `src/` over ~1,500 LOC except `piano-roll.ts`.
- `StemMixer.tsx` and `App.tsx` are composition shells.
- The context-hazard table in [INDEX.md](INDEX.md) is under ten entries.

The distance, measured 2026-09-21: **44 files over 1,500 LOC** across `src`,
`workers`, `apps` and `packages`; **56 files over 1,200** in `src` alone; **129
over 800**. The first goal above is therefore 43 files away, not a handful. Land
it in slices and let the ratchet hold each one.
