# LRC Mapper Studio — full-screen mapper, waveform markers, sub-word precision, A/B differ

**Status:** planned, nothing implemented. Branch `feat/lrc-mapper-studio`, cut
from `main` after [#415](https://github.com/mercurypitch/mercurypitch/pull/415)
(`dab58b64`). 2026-08-06.

Follow-up to [lrc-per-word-mapping-research.md](lrc-per-word-mapping-research.md),
which answered the format and algorithm questions this plan now acts on.

The goal in one line: **make one hand-made mapping good enough to be a gold
standard, then make it cheap to prove any other mapping is worse.**

---

## 0. Decisions already taken

| Question | Answer |
|---|---|
| Marker types | Per-word mapped-position ticks; A-vs-B overlay ticks in the differ. **No** loop A/B handles, **no** ABX blind test. |
| Build order | Full-screen shell first, then markers, then sub-word, then differ. |
| Differ home | Both — a `/lab` subtab *and* inside the mapper. |
| Save format | Adopt `lyricsfile` as the native format now; export enhanced LRC for compatibility. |

---

## 1. What already exists (do not rebuild)

Four things make this much smaller than it looks:

- **`scripts/compare-lrc-timing.mjs`** (140 lines, `pnpm lyrics:compare`) already
  computes compared-word count, mean/median absolute error, p95, max, median
  bias, and mismatched line/word lists. The differ is a **UI over logic that
  exists**, not new math.
- **`WordSweepTimingsMap`** (`src/features/stem-mixer/types.ts:15`) is
  `Record<lineIdx, Record<wordIdx, {time, progress}[]>>` where `progress` runs
  0→1 through the word's glyphs. That is already a sparse, per-word,
  sub-word split-point structure — stored only for words that have one. Phase 4
  is mostly **an editor over an existing model**, not a new tree.
- **`PitchStageShell`** (`src/components/pitch-stage/PitchStageShell.tsx`, 126
  lines) is the established full-screen chrome, with modes
  `stem-edit | zen-monitor | zen-exercise | challenge` and slots for eyebrow,
  title, icon, canvas, sidecar, footer, primary action.
- **`overview-mapping.ts`** (76 lines) already owns the single time↔pixel
  mapping for the waveform overview, with `clampOverviewWindow`, `timeToX`,
  `columnSampleRange`, and tests pinning them.

## 2. The blocker to clear first

`useStemMixerLyricsController.ts` is **3,229 lines** (~25k tokens to read) and
is listed in [REFACTOR-PLAN.md](../agent/REFACTOR-PLAN.md) §1 as one of six
files whose size dominates change cost. It grew ~260 lines in #415 alone.

Four features are about to land in it. Splitting it first is not tidiness — it
is the difference between each later phase costing one file read or four.

---

## Phase 0 — split the lyrics controller

**Why first:** every later phase edits this file.

Apply the pattern REFACTOR-PLAN §2 documents and `src/features/stem-mixer/`
already uses (one `deps` object in, one object of accessors and actions out,
owns its own signals and `onCleanup`). Proposed seams, by concern:

| New module | Owns | Rough LOC |
|---|---|---|
| `useLrcGenController.ts` | passes, cursor, tap/marker input, redo, finish/reset, progress persistence | ~1,200 |
| `useLyricsDataController.ts` | load, search, upload, canonical LRC, versions, persistence | ~900 |
| `useLyricsBlocksController.ts` | blocks, instances, template auto-fill | ~400 |
| `useStemMixerLyricsController.ts` (remaining) | composition + display/edit state | ~700 |

Non-negotiable: **no behaviour change in this phase.** The full suite (4,693
tests) must stay green with zero test edits. If a test needs changing, the
split has changed behaviour — back it out.

Ship as its own PR. Do not combine with Phase 1.

---

## Phase 1 — `lyricsfile` as the native format

**New:** `src/lib/lyricsfile.ts` — `parseLyricsfile` / `serialiseLyricsfile`,
plus round-trip tests over the gold corpus (§8).

Spec recap (from the research doc §4): YAML, `version: "1.0"`, root
`version`/`metadata`/`lines`/`plain`. Metadata carries `title`, `artist`,
`album`, `duration_ms`, `offset_ms`, `language`, `instrumental`. Each line has
`text`, `start_ms`, optional `end_ms`, optional `words[]`; each word has
`text`, `start_ms`, optional `end_ms`. Integer ms from track start.
Concatenating word `text` must reconstruct the line exactly — **spacing lives
inside the word strings**, which our `split(/\s+/)` model currently discards.
That is the one real import/export trap; round-trip tests must cover it.

Model additions that are cheap and independently useful:

- `metadata.offset_ms` → a **global offset control**. Today "the whole song is
  200 ms late" is unfixable without remapping every word. This alone may be the
  highest value-per-line change in the plan.
- `duration_ms`, `language` → carried through, currently absent.

**The sub-word problem.** `wordSweepTimings` has no home in the spec, and the
spec defines *no extension mechanism* and no rule for unknown fields. Plan:

1. Serialise sweeps under a namespaced key (`x_mercurypitch_sweeps`) inside the
   lyricsfile, and
2. treat that key as **lossy-optional** — a reader that drops it still gets a
   fully valid word-synced file, and
3. propose a sweep/animation extension upstream. The format is at 1.0 draft and
   the author is iterating; LRCLib's live API already returns a `lyricsfile`
   field. This is an open door, not a fork.

Enhanced LRC stays as an export. Blocks/repeats stay out of the interchange
file — they are authoring state, not lyrics data. Rests stay derived at render
time from line gaps (`canonical-lrc.ts` already does this) and are never
serialised.

---

## Phase 2 — the full-screen mapper

**Route:** a hash route in the same family as the existing full-screen surfaces.

**Shell decision to make at implementation time.** `PitchStageShell` fits
pitch work: one canvas, one sidecar. The mapper's primary content is a *lyric
list* with a waveform beneath it — two co-equal regions, not canvas + sidecar.
Recommendation: **a sibling `LrcMapperStage` that shares
`PitchStageShell.module.css` tokens and header/footer markup**, rather than
bending `PitchStageShell` into a fifth mode it does not structurally fit.
Decide by trying the mode first; if the slot mapping needs more than a couple
of conditionals, split.

Layout, wide:

```
┌──────────────────────────────────────────────────────────┐
│ eyebrow · title                        [Compare ▾] [Done]│
├──────────────────────────────────────────────────────────┤
│  lyric lines (scroll, the focus)                          │
│    ▸ current line, large, word cursor visible             │
├──────────────────────────────────────────────────────────┤
│  vocal-stem waveform + word ticks        [markers ▾]      │
├──────────────────────────────────────────────────────────┤
│  ▶  0:34 / 3:12   ·  All│Lines│Words  ·  ⚙                │
└──────────────────────────────────────────────────────────┘
```

The interface bar from #415 already carries nine controls. In the full-screen
surface the rule is: **only mapping actions stay on the surface** (transport,
progress, Next Word/Line, Redo). Everything else — pass mode, input mode,
speed, reaction/calibration, live highlight, marker visibility — moves behind
a settings menu. That is the "hidden behind nice menus, as optional" the brief
asks for, and it is also what stops the small-screen case from being a
scrolling toolbar.

Narrow screens: lyric list and waveform stack, waveform collapsible to a
strip. Reuse `use-viewport`'s `isMobile()`/`isNarrow()` — do not re-implement
`matchMedia`.

---

## Phase 3 — waveform word markers

**Pure layer first** — extend `overview-mapping.ts`:

```ts
/** Inverse of timeToX. */
export function xToTime(x: number, win: OverviewWindow, width: number): number

/** Nearest marker to x within a pixel tolerance, or null. */
export function nearestMarker(
  markers: readonly { time: number; lineIdx: number; wordIdx: number }[],
  x: number, win: OverviewWindow, width: number, tolerancePx?: number,
): { lineIdx: number; wordIdx: number } | null

/** Markers inside the window, thinned so ticks never overplot. */
export function visibleMarkers(
  markers: readonly Marker[], win: OverviewWindow, width: number, minGapPx?: number,
): readonly Marker[]
```

All three are pure and unit-testable without a canvas — the same seam that made
`lrc-gen-passes.ts` testable in #415.

**Behaviour:**
- A tick per mapped word start on the vocal-stem waveform.
- Show/hide toggle (required — a dense song is a picket fence).
- Click a tick → seek there and move the mapping cursor to that word.
- Drag a tick → move that word's start time; commit on release.

**Clutter is the real design risk.** At full zoom-out a 3-minute song has
~400 words across ~1200 px — roughly one tick per 3 px. Mitigations, in order:
`visibleMarkers` thinning by minimum pixel gap; line-start ticks drawn taller
than inner-word ticks so structure survives thinning; ticks only at or below a
zoom threshold, with a density heat strip above it.

**Drag needs a real-mouse test.** Per repo memory, drag/scrub gestures need a
Playwright spec with actual mouse events before merge — `<For>` and
value-binding pitfalls in Solid make hand-verification unreliable here.

---

## Phase 4 — sub-word (letter-level) precision

The data model largely exists. What is missing is the **editor** and a defined
`progress → letter index` mapping.

```ts
/** Split point at a glyph boundary within a word. */
export function progressForLetter(word: string, letterIdx: number): number
export function letterForProgress(word: string, progress: number): number
```

Both pure, both trivially testable, both must agree on grapheme handling —
`"I'll"` and combining marks must not split mid-glyph. Use `Intl.Segmenter`
with a code-point fallback.

**Interaction:** in the full-screen mapper, clicking a letter inside a word
sets that letter's time. Setting a syllable's start *is* the previous
syllable's end, so one gesture fixes both sides — no separate "end" gesture.

**Storage stays sparse.** Only words the user actually split get an entry.
This is already how `WordSweepTimingsMap` behaves; the plan is to keep that
invariant and assert it in tests (mapping a song without splitting anything
must produce an empty sweep map).

**Interpolation** across a word's start/end and across a line's last word is
the payoff: with real split points the renderer stops guessing at held vowels.

---

## Phase 5 — the A/B differ

**Step 1 — lift the logic.** Move the comparison core out of
`scripts/compare-lrc-timing.mjs` into `src/lib/lrc-compare.ts`, and have the
CLI import it. One implementation, two consumers, and the CLI's existing
behaviour becomes the regression test.

Keep the existing asymmetry: one side is the **reference** (the gold manual
map), the other the **candidate**. Stats stay as they are — compared words,
mean/median absolute error, p95, max, median bias, mismatched lines/words —
plus per-line breakdown, which the CLI does not currently expose.

**Step 2 — the view**, in both homes as chosen:

- `/lab` → a new `LabTab` (`'lrc-diff'`) alongside `workbench | detection |
  algorithms`. Load two files, compare arbitrary mappings. Follows the existing
  lazy-loaded `TABS` array pattern in `LabSurface.tsx`.
- In the mapper → a `Compare ▾` menu diffing current work against a saved
  version.

Same component, two mounts.

**Rendering:** both mappings' ticks on one waveform in two colours, with the
per-word delta as a connecting segment — the drift is the thing to see, so
draw the drift, not just two tick rows. Per-line and total stats beside it.

This phase is what turns "some LRCs are better, some worse" into a number, and
it is the measuring instrument for the auto-alignment benchmark (vocal stem
waveform vs Whisper vs forced alignment vs the gold map) that motivated all of
this.

---

## Phase 6 — start cue for sub-rest gaps

Carried over from the 2026-08-06 backlog note; it belongs to this surface.

With a line's last-word end and the next line's start both mapped precisely, a
4-second gap still leaves the singer blind as to when to come back in.
`RestCountdownDots` only covers long gaps (5s+). Add either a prefix cue on the
next line or a suffix on the previous one, joining the two neatly when there is
no formal rest. Threshold and presentation to be decided against a real song —
this is the one phase where the right answer comes from singing to it.

---

## 8. The gold corpus

`~/Downloads/cc-songs` currently holds **one** song — Josh Woodward, *I'll Be
Right Behind You, Josephine* — with vocal and instrumental stems already
separated, plus one hand-made enhanced-LRC mapping (38 lines, word-level).
A second song is expected.

Josh Woodward's catalogue is Creative Commons (hence `cc-songs`), so the
**mappings can ship as test fixtures** in-repo. The audio cannot (24 MB per
stem) — keep audio local or in the models bucket, commit only the `.lrc` /
`.lyricsfile`.

Two mappings of the same song are needed before the differ has anything to
show. The natural first pair is *current hand map* vs *the same song remapped
in the new full-screen mapper* — which also measures whether the new tooling
actually improves the output, not just the experience.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Phase 0 silently changes behaviour | Zero test edits allowed; any needed edit means back it out |
| `lyricsfile` sub-word extension is formally undefined | Namespaced key, lossy-optional, propose upstream |
| Word-string spacing lost by `split(/\s+/)` | Round-trip tests over the gold corpus before anything depends on it |
| Marker clutter makes the waveform useless | Pixel-gap thinning + zoom threshold + taller line-start ticks |
| Drag interactions silently broken | Real-mouse Playwright spec, per repo convention |
| Scope: six phases is a lot | Each phase is its own PR and independently useful; stop anywhere |

## 10. Sequence

```
Phase 0  split the controller          (no behaviour change)
Phase 1  lyricsfile native + offset_ms (unblocks precision storage)
Phase 2  full-screen mapper shell      (the space everything else needs)
Phase 3  waveform word markers         (pure mapping layer first)
Phase 4  sub-word split points         (editor over existing model)
Phase 5  A/B differ, lab + mapper      (the measuring instrument)
Phase 6  start cue for sub-rest gaps   (tune against a real song)
```

Phases 1 and 2 are independent of each other and can swap. Everything else is
ordered by dependency.
