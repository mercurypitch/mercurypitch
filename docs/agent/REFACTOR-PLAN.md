# Refactor handoff — the oversized files

Working plan for breaking up the files that dominate context cost and change
risk. Written so an agent picking up any single slice has everything it needs
without re-deriving the analysis.

**Status: proposed.** Nothing here has been executed. Sequence and scope are
open to change; ordering rationale is in §5.

---

## 1. Why these files

Six files carry disproportionate cost. They are simultaneously the largest and
among the most-changed, so every session that touches them pays to re-read them.

| File | LOC | ~tokens to read | Commits (last 400) |
|---|---|---|---|
| `src/components/StemMixer.tsx` | 6,268 | ~46,200 | 48 |
| `src/lib/piano-roll.ts` | 5,086 | ~44,000 | — |
| `src/App.tsx` | 3,286 | ~35,400 | 34 |
| `src/components/VocalAnalysis.tsx` | 3,102 | ~28,000 | — |
| `src/features/stem-mixer/useStemMixerLyricsController.ts` | 2,967 | ~25,000 | 11 |
| `src/components/UvrPanel.tsx` | 2,641 | ~26,000 | 30 |

`StemMixer.tsx` and `App.tsx` together are ~82k tokens and account for 82 of
the last 400 commits. That is the whole problem in one line.

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

### 3.1 StemMixer.tsx → 6,268 to ~1,200

Already extracted: mic, audio, lyrics, pitch-analysis, canvas, layout.
Remaining seams, roughly in dependency order:

| Slice | Sections | Target |
|---|---|---|
| A | Karaoke playlist integration (344), Zen transport (461) | `useStemMixerTransportController.ts` |
| B | Volume/Mute/Solo (1354), Stem controls props bundle (1426) | `useStemMixerStemControls.ts` |
| C | Pitch-word alignment memo (917), Auto word-sync (1312), Loop lyric↔audio sync (739) | fold into the existing lyrics controller, or `stem-mixer/word-sync.ts` if it stays pure |
| D | Melody audition synth (1123) | `melody-synth.ts` already exists — move the remainder there |
| E | Circular Progress (111), Karaoke Focus Mode (160) | plain components in `src/features/stem-mixer/` |
| F | "From vocal" lyrics generation (1627) | `lrc-gen-engine.ts` already exists — move the orchestration there |

Slices C, D and F move code into files that **already exist**; those are the
cheapest and should go first.

### 3.2 App.tsx → 3,286 to ~800

27 section banners, most already mirroring a `src/features/` module that exists
but is only partially used. Highest value first:

| Slice | Sections | Target |
|---|---|---|
| G | A-B Loop state (1334) — 257 lines, self-contained | `src/features/playback/useAbLoop.ts` (`@/lib/ab-loop.ts` exists) |
| H | Share handlers (555), Singing song picker (1327) | `src/features/session/` |
| I | Take review (902), Compose live recording preview (877) | `src/features/recording/` |
| J | Octave shift (1651), Target note (1681), Accuracy heatmap (1695) | `src/features/practice/` |
| K | Swipe to change tabs (503), Tab-change cleanup (1203) | `src/features/routing/` |
| L | Guide Selection dialog (464), header practice-context pill (1069) | components |

App.tsx's job afterwards is composition: mount controllers, wire them, render
the shell. It should hold close to zero business logic.

### 3.3 VocalAnalysis.tsx → 3,102

**46 `createSignal` calls in one component** — the highest state density in the
codebase, and the reason this file is hard to change safely. Group state before
moving anything:

1. Group the 46 signals into a handful of `createStore` objects by concern
   (live-mic, annotations, analysis tools, advanced features — the existing
   section banners name them).
2. Then extract each group with its logic into a controller hook.

Do not attempt a straight file split first; splitting 46 loose signals across
files makes the coupling worse, not better.

### 3.4 UvrPanel.tsx → 2,641

35 signals and only one section banner — the least internally structured of the
six. **Add section banners first** as a separate, reviewable commit. That makes
the seams visible and the subsequent extraction mechanical. Do not combine the
two steps.

### 3.5 piano-roll.ts → 5,086

Deliberately last, and possibly never. It is a canvas editor with its own
internal architecture, is not a Solid component, communicates via
`@/lib/event-bus`, and has low churn. It is large but not a change-risk hotspot.
Revisit only if churn rises.

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
