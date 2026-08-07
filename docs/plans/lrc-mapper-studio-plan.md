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
- **`demo-song.ts`** (276 lines) already fetches a *list* of Cloudflare-served
  songs — stems, lyrics, attribution — and seeds them into the local db as
  normal sessions without ever clobbering a user's edits. Phase 7 is wiring,
  not invention.

## 2. The blocker to clear first

`useStemMixerLyricsController.ts` is **3,229 lines** (~25k tokens to read) and
is listed in [REFACTOR-PLAN.md](../agent/REFACTOR-PLAN.md) §1 as one of six
files whose size dominates change cost. It grew ~260 lines in #415 alone.

Four features are about to land in it. Splitting it first is not tidiness — it
is the difference between each later phase costing one file read or four.

---

## Phase A — fix mapper resume state (DONE)

Shipped in `2cda2615` (the merge) and `fcbd9300` (mapped-vs-yours in the view).
The analysis below is kept because it explains why the code is shaped this way.

**This was a live bug in shipped code**, found while auditing the behaviour
reported on 2026-08-06: "I mapped a few lines, closed it, and now the mapper
only shows those few — I can't preview the rest even though the song is fully
mapped."

### Root cause — verified, not suspected

`startLrcGen` (`useStemMixerLyricsController.ts:1672`) has two ways to populate
gen state, and it picks **one**:

1. Saved in-progress blob from `localStorage` (`lyrics_gen_v1_<sessionId>`),
   restored at line ~1700 — this also sets `resumeLineIdx` / `resumeWordIdx`.
2. Seed from what is already saved on the session — `editBuffer()`, else
   `wordTimings()` — at line ~1740.

Branch 2 is guarded by:

```ts
if (resumeLineIdx === 0 && resumeWordIdx === 0) {
```

So the moment a previous session stopped anywhere other than the very start,
`resumeLineIdx > 0` and **the seed-from-existing-timings branch is skipped
entirely**. Gen state then contains only the handful of lines from the
abandoned session. Every other line reads as unmapped — which is why preview
and live highlight have nothing to play: `lrcGenLineTimes` genuinely does not
hold those times.

The user's second observation — "if I open the mapper on a fully-mapped song I
can't preview without remapping" — is the same defect. With no stale progress
the seed branch does run and preview works; with stale progress it does not.

### The fix is a merge, not a choice

`mergePartialLineTimes` and `mergePartialWordTimings` already exist in
`lrc-gen-engine.ts` and already do exactly this job — but they are only called
at **finish** (line ~2354), never at **restore**. So the partial session is
merged back into the full map when you complete it, and is treated as an island
when you resume it. That asymmetry is the whole bug.

Restore should: seed from existing saved timings **first**, then overlay the
partial progress blob on top, then apply the cursor. `touchedLines` already
distinguishes "mapped in this session" from "already known", so the two are
separable and the UI can still show which is which.

### Also in scope for this audit — outcomes

- **Show mapped vs unmapped honestly.** *Done.* `GenViewLine` gained `isMapped`
  (carries a line start) and `isSessionMapped` (you placed it in this sitting),
  and the row styles use them. Cursor position no longer stands in for
  mapped-ness. `touchedLines` stayed a plain `Set` with a version counter
  beside it, because it is written on every word transition.

- **Stale progress lifetime.** *Decided: no TTL.* The tempting fix is to expire
  blobs after N days. Do not. Until a session is finished, its blob is the
  **only** copy of that mapping work — nothing is written to `wordTimings`
  until finish. A TTL would delete the user's work on a schedule, which is
  strictly worse than the problem it solves. After the merge fix a stale blob
  can no longer overrule the song's timings either; all it still carries
  silently is a cursor and a pass.

  What is left is that resuming happens with no announcement. That is a UI
  affordance ("continue where you left off" vs "start fresh"), and it belongs
  in Phase 2 where the entry surface is being rebuilt — bolting a prompt onto
  the current entry point now would be built twice.

- **Where the mapper opens from.** *Decided: the session edit list stays the
  door for the inline mapper; Phase 2's full-screen stage gets a second one in
  the lyrics panel header (an expand control), not a replacement.* Two doors to
  the same session state, same controller, so neither is a mode the other
  cannot reach.

### Regression test

The pure seam is easy: the restore/merge decision belongs in `lrc-gen-engine.ts`
as a pure function over (savedBlob, existingTimings, lines) → gen state, tested
directly. The current defect is invisible to the existing suite because the
decision lives inline in a 3,229-line controller with no test harness — the
same gap that let the single-word-line regression through in #415.

---

## Phase 0 — split the lyrics controller (DONE)

Three of the four proposed seams were taken; the parent went 3,200 → 1,748
lines with **zero test edits**, which was the condition set below.

| Commit | Extracted | Parent after |
|---|---|---|
| `0d92d630` | `useLrcGenController.ts` — the whole mapping session | 2,045 |
| `891b20eb` | `useLyricsScrollController.ts` + pure `lyrics-scroll.ts` | 1,902 |
| `948f86a5` | `useLyricsBlocksController.ts` | 1,748 |

**`useLyricsDataController.ts` was deliberately not extracted.** Unlike the
three above it does not own its state: load/search/persist write into
`lyricsLines`, `lrcLines`, `rawLyricsText`, `wordTimings` and friends — the
shared model every other concern reads. Extracting it produces a ~15-setter
dep interface, which moves code without moving a boundary, on the riskiest
logic in the feature (what lyrics you see). The parent is now well under the
2,600 lines REFACTOR-PLAN flags, so the cost was real and the benefit was not.
Revisit only if that file grows again.

Two gotchas worth keeping:

- Passing a parent memo back into a child hook as a dep makes the child's
  *inferred* return type circular; TypeScript silently widens it to `unknown`
  rather than erroring. Both new controllers therefore declare an explicit
  return interface. Symptom if you skip it: `untrack(...)` results lose their
  types for no visible reason.
- Move constants verbatim. Rewriting `BLOCK_COLORS` from memory during the
  blocks extraction would have silently recoloured every existing block; only
  the unused-variable error on the parent's original array caught it.

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

## Phase 1 — `lyricsfile` as the native format (PART DONE)

**Done:** the global offset, which this phase called the highest
value-per-line change in the plan. `src/features/stem-mixer/lrc-offset.ts`
holds the arithmetic; a Shift all control sits with the mapper settings.

Two decisions worth keeping:

- The delta is bounded, not each time clamped. Clamping individual times at
  zero would bunch the head of the song against 0:00 while the rest kept its
  spacing — destroying the mapping it was asked to move.
- Every shifted line is marked touched. Untouched lines fall back to their
  pre-session times when a partial session finishes, so a shift that skipped
  this would be silently dropped for most of the song.

Also now honours the LRC `[offset:]` ID tag on import, which was being
ignored outright, rewriting the inline word stamps by the same amount.

**Still to do:** `parseLyricsfile` / `serialiseLyricsfile`. It needs a YAML
parser, which is a new client dependency — hand-rolling one for lyrics (full
of apostrophes, quotes and colons) is the classic version of this mistake.
Decide between a dynamically imported `yaml` package and dropping the import
half, before starting.

---

## Phase 1 (original) — `lyricsfile` as the native format

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

## Phase 3 — waveform word markers (DONE)

Shipped in `80aec96a`. `xToTime`, `nearestMarker`, `visibleMarkers` and
`wordMarkersFrom` landed in `overview-mapping.ts` as planned, and the
clutter mitigation is the one the plan predicted: thin inner words inside a
4 px gap, never thin a line start, and draw line starts full height against
stubs for inner words.

Two things worth knowing:

- Only the ticks actually drawn are grabbable. A thinned-away word has no
  pixel to aim at, and hitting it reads as a misfire.
- The dragged position is held locally and committed once on release, so a
  drag does not write and persist a few hundred timings.

**The real-mouse Playwright spec is done** —
`src/e2e/lrc-word-markers.spec.ts`. It finds the tick by hovering for the
`ew-resize` cursor rather than recomputing the canvas layout, because a second
copy of that maths in the test would agree with a broken implementation.

Writing it turned up a bug that had nothing to do with markers: **an LRC
carrying per-word stamps opened in the mapper as completely unmapped.** Upload
and fetch both clear the session's `wordTimings` map on purpose, so the stamps
survive only on the canonical entries — and `seedGenTimings` read the map
alone. Every line showed `--:--`, the overview had no ticks to draw, and pass 2
had nothing to refine. `seedGenTimings` now falls back to
`canonicalLrcLines()[i].wordTimes`, with `lrc-gen-seed.test.ts` pinning it
(including that inherited timings are *not* marked as this sitting's work, so
finishing cannot rewrite lines nobody looked at).

---

## Phase 3 (original) — waveform word markers

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

## Phase 4 — sub-word (letter-level) precision (DONE)

`progressForLetter`, `letterForProgress`, `splitGraphemes` and
`letterSplitTimes` landed in `src/lib/word-letters.ts`; the split-editing
primitives (`setSplitPoint`, `removeSplitPoint`, `retimeWordStart`,
`retimeWordEnd`) sit beside the recorder in `src/lib/lyric-sweep.ts`. The
editor is `LrcWordLetters`, opened from a **Letters** toggle in the mapper
toolbar; the controller carries `letterMode` / `letterTarget` /
`setLetterSplit` / `clearLetterSplit` / `letterSplits`.

Four decisions worth knowing:

- **Boundaries run 0..n, not 0..n-1.** Index 0 is the word's onset and index
  n its end, so the two word edges are addressable in the same coordinates as
  any interior split — which is what makes "setting a syllable's start is the
  previous syllable's end" literally true everywhere, with no second gesture.
  The controller routes those two indices to `wordTimings` /
  `wordEndTimings`; everything between stays in the sweep curve.
- **No new storage.** A split is a `WordSweepPoint`, so every codec, version
  record and archive already carries it, and the runtime renderer already
  interpolates through it (`computeActiveWord` → `interpolateSweepProgress`).
  Sparseness comes free: a tap-mapped song with no splits has an empty sweep
  map, and there is a test pinning that.
- **Progress is grapheme space, not pixel space.** `progressForLetter`
  divides a word evenly by grapheme count, so a boundary is exact in the data
  and approximate on screen — an `i` and an `m` get the same share of the
  fill. Measuring glyphs would be neither pure nor storable, and the time is
  what a singer needs; the fill is decoration.
- **Letter mode suspends marking.** Both gestures start with a press on the
  current line, so they cannot coexist. Splitting is a refinement pass over
  already-mapped words, and it works on any word in any line rather than only
  at the cursor.

Not verified in a browser — per repo convention the owner tests UI.

---

## Phase 4 (original) — sub-word (letter-level) precision

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

## Phase 5 — the A/B differ (DONE)

Shipped in `8dfef36b` as a `lrc-diff` Lab tab plus `src/lib/lrc-compare.ts`.
`scripts/compare-lrc-timing.mjs` is now a CLI over the same module rather
than a second implementation — it imports the TypeScript directly and lets
Node strip the types (Node >= 22.18).

Not built: the in-mapper `Compare` menu. The Lab tab is where a measurement
belongs; putting it in the mapper too is worth doing only once there is a
reason to compare without leaving the session.

---

## Phase 5 (original) — the A/B differ

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

---

## Phase 7 — an Examples library in the session list (DONE)

`examples-library.ts` holds the decisions (which manifests earn a row, what
that row is, what the group should contain); `seed-examples.ts` writes them,
called once from `App.tsx` after the session and group stores hydrate.

**The auto-add question resolved itself.** The plan's "half-yes" — create rows
now, fetch stems later — assumed the audio had to be downloaded into
IndexedDB. It does not: `outputs.vocal` / `outputs.instrumental` take the R2
URLs directly, which is how Karaoke Night has always played the demo. So a row
costs nothing to create and the audio moves the first time somebody opens the
song. There is no separate pull step, and nobody's mobile data is spent on a
song they never asked for. The rows are `status: 'completed'` because that is
the truth — separation is done and the stems exist.

Three things that had to be got right:

- **The legacy slug.** Goodbye to Spring's row is keyed by the bare
  `DEMO_SESSION_ID`, not by its slug. Everything goes through
  `demoSessionId()`; anything deriving one from the other would seed a
  duplicate on every device that has ever sung the demo.
- **Group membership is reconciled, never rebuilt.** A parked song stops being
  listed, and a session the visitor moved out by hand stays out — so the
  answer is the intersection of "still a live example" and "still a session
  that exists", and only additions are written.
- **Attribution travels with the song.** `ExampleCredit` renders the CC credit
  on the session card and in the full-screen mapper, and returns null for
  anything that is not an example, so it can be dropped into any surface that
  names a song.

A deleted example comes back on the next visit. That is deliberate: the
alternative is remembering every deletion forever, and re-adding is the
cheaper mistake than a library that cannot be repaired. The visitor's *lyrics*
are safe either way — `shouldSeedLyrics` protects an edited copy regardless of
what happens to the row.

Not verified in a browser.

---

## Phase 7 (original) — an Examples library in the session list

The stems are already served from Cloudflare, so the corpus can be **pulled
into any device's session list** rather than living in one person's Downloads
folder. Most of this exists already and is currently wired only to Karaoke
Night.

### What already exists (reuse, do not rebuild)

`src/features/karaoke-night/demo-song.ts` (276 lines) is the mechanism:

- **`GET /api/demo-songs`** already returns a **list** of manifests. Each
  carries `slug`, `title`, `artist`, `attribution {text, url, license,
  licenseUrl}`, `stems {vocal, instrumental}` (R2 URLs), `lyrics` (or inline
  `lyricsText`), `lyricsRevision`, `durationSec`. Live on dev at
  `https://api-dev.mercurypitch.com/api/demo-songs`, authored through
  `https://dev.mercurypitch.com/#/admin/demo-song`, and already serving **two**
  songs at `lyricsRevision: 2`.
- **Slug and asset path are different identifiers**, and both matter. Goodbye to
  Spring has slug `karaoke-night` (the legacy slug, which keys existing local db
  rows and must never change) but assets under `demo/goodbye-to-spring/`.
  Josephine agrees on both. Anything deriving one from the other will break the
  legacy entry — and `demoSessionId()` exists precisely because of this.
- **`public/karaoke-demo-song.json`** is the shipped floor — an absent, parked,
  malformed or unreachable row lands here, so the examples cannot be broken
  from the studio or by an outage.
- **`demoSessionId(slug)`** namespaces each demo into the local db as a normal
  separation session; **`isDemoSessionId()`** identifies them anywhere.
- **`shouldSeedLyrics(existing, stamp, revision)`** already solves the hard
  part: an authored lyric correction reaches an untouched copy, but a visitor's
  own edit always outranks the studio. Do not reimplement this.

And grouping exists: `SessionGroupRecord { name, sessionIds[] }` in
`src/db/entities.ts:488`, plus an optional `groupId` on UVR sessions.

### What is actually new

1. **Surface demos outside Karaoke Night.** Today only that page consumes the
   manifest list. The session list needs to read the same source.
2. **An "Examples" group**, created from `SessionGroupRecord` and populated with
   `demoSessionId(slug)` entries.
3. **A pull action** — "Add example songs" in the session list, and a per-song
   pull for users who want one.

### The auto-add question — recommendation: half-yes

Auto-adding *audio* is the wrong default. The stems are large (the local WAVs
are 24 MB each; even the m4a renders are ~4 MB), and seeding them unasked
spends a stranger's mobile data on content they never requested.

Recommended split:

- **Auto-create the group and its rows** — cheap, metadata only: title, artist,
  attribution, duration, lyrics. The Examples group appears for everyone, with
  each song visible and clearly marked as not-yet-downloaded.
- **Fetch stems on demand** — first play, or an explicit pull. One tap, obvious
  cost, nothing downloaded behind the user's back.

That keeps the discovery value (users see there is something to explore) without
the bandwidth cost, and it sidesteps the "examples crowd out my own sessions"
problem because the group is collapsible and removable.

Serve the **compressed renders** for pull-in, not the 24 MB WAVs — the WAVs are
a mapping-accuracy artifact, not a distribution format.

### Requirements that are not optional

- **Attribution must travel with the song.** The corpus is Creative Commons,
  which requires credit. The manifest already carries
  `attribution {text, url, license, licenseUrl}`; the session list and the
  mapper must both surface it, not just Karaoke Night.
- **Removable and re-pullable.** Deleting an example must not be a one-way
  door, and re-pulling must not resurrect lyrics the user edited — that is
  exactly what the seed stamp protects, so route re-pull through it.

### Why this matters beyond exploration

It gives the gold corpus a **distribution path**. Once the two hand-mapped
songs ship as demo entries, the A/B differ (Phase 5) has real data on any
device, and a reviewer can reproduce a mapping claim without being handed a
folder of audio. That turns "trust my numbers" into "run it yourself".

---

## 8. The gold corpus

Committed at [`fixtures/lrc/`](../../fixtures/lrc/) — see its README for the
versioning rule and licence terms.

| File | Song | Lines | Words |
|---|---|---|---|
| `goodbye-to-spring.v2.lrc` | Josh Woodward — Goodbye to Spring | 25 | 288 |
| `josephine.v2.lrc` | Josh Woodward — I'll Be Right Behind You, Josephine | 38 | 322 |

Both are **byte-identical** to the `lyricsText` served by
`GET https://api-dev.mercurypitch.com/api/demo-songs` at `lyricsRevision: 2`
(verified 2026-08-06). They are authored through the studio at
`https://dev.mercurypitch.com/#/admin/demo-song`; this directory is a synced
copy, not a second source of truth.

**`v2` is the gold reference for both songs.** An earlier `v1` of Josephine was
deliberately not kept: comparing the two showed near-identical timings (median
absolute error 0.000 s over 304 words) but **two mismatched lines** — v1
contained words absent from the lyric text, a duplicated `seen` and a stray
`you`. A baseline with wrong *text* cannot measure timing, so it is
disqualified as a reference rather than useful as an A/B side.

That comparison is also the first real proof the differ's metrics work: a
mismatched line means the **text** differs, not the timing, and that is the
first thing to check when a comparison looks impossibly bad.

Josh Woodward's catalogue is Creative Commons (hence `cc-songs`), so the
**mappings can ship as test fixtures** in-repo. The audio cannot (24 MB per
stem) — commit only the `.lrc` / `.lyricsfile`, and distribute the audio as
demo-song manifest entries (Phase 7), which is where it already lives.

So the corpus has two homes, deliberately: the **mappings** are in-repo
fixtures that tests and the compare CLI run against offline, and the **audio**
is pulled on demand from R2 through the Examples group. Neither duplicates the
other.

Automatic mappings take the **next free version number** (`v3`, `v4`, …) and are
scored against `v2`. They are not committed unless a specific result is worth
pinning — this directory holds references, not every experiment.

So the differ's first real job is *auto-mapped vN* vs *hand-mapped v2*, on two
songs, which is exactly the benchmark that motivated this plan.

### There is already one usable A/B pair

The R2 `lyrics.lrc` URLs still serve **pre-v2 revisions** (see the trap below),
and for Goodbye to Spring that older revision has *identical text* with
different timings — which makes it a genuine A/B pair, unlike Josephine's v1:

```
pnpm lyrics:compare <r2 goodbye-to-spring/lyrics.lrc> fixtures/lrc/goodbye-to-spring.v2.lrc
  Compared words: 288      Mismatched lines: none
  Median absolute error: 0.380 s
  Median bias: -0.380 s    Maximum error: 1.780 s
```

A **uniform −380 ms bias** across all 288 words, not a scatter. That is the
signature of a systematic latency correction rather than better tapping — which
is direct evidence the reaction-calibration shipped in #415 does what it claims.
Useful as the differ's first fixture case: a known-shape difference to render
against before trusting it on unknown ones.

### Trap: the R2 lyric URLs are stale

Each manifest carries both a `lyrics` **URL** and an optional inline
`lyricsText`, and **`lyricsText` wins when set** (`demo-song.ts`). Both songs
now carry v2 inline, while the bucket files still hold older revisions:
`demo/josephine/lyrics.lrc` is the pre-v2 mapping with the extra words, and
`demo/goodbye-to-spring/lyrics.lrc` is the earlier timing revision above.

The app is correct. But anything that reads the URL instead of the API silently
gets the old mapping — including a future importer, a benchmark script, or a
person checking a claim. Phase 7 should either re-sync the bucket on publish or
stop shipping a `lyrics` URL once `lyricsText` is set, so there is one answer to
"what is the current mapping" rather than two that disagree.

---

## 9. Risks

| Risk | Mitigation |
|---|---|
| Phase 0 silently changes behaviour | Zero test edits allowed; any needed edit means back it out |
| `lyricsfile` sub-word extension is formally undefined | Namespaced key, lossy-optional, propose upstream |
| Word-string spacing lost by `split(/\s+/)` | Round-trip tests over the gold corpus before anything depends on it |
| Marker clutter makes the waveform useless | Pixel-gap thinning + zoom threshold + taller line-start ticks |
| Drag interactions silently broken | Real-mouse Playwright spec, per repo convention |
| Examples auto-download burns mobile data | Auto-create rows (metadata only); fetch stems on first play or explicit pull |
| Re-pulling an example clobbers a user's lyric edits | Route re-pull through the existing `shouldSeedLyrics` stamp — never bypass it |
| CC attribution lost outside Karaoke Night | Attribution travels in the manifest; session list and mapper must both render it |
| R2 `lyrics` URL and inline `lyricsText` disagree | Re-sync the bucket on publish, or stop emitting the URL once `lyricsText` is set |
| Deriving demo slug from asset path (or vice versa) | They differ for the legacy entry; always route local ids through `demoSessionId()` |
| Resume-merge fix silently changes what a session holds | Pure restore function in `lrc-gen-engine.ts` with tests; `touchedLines` keeps session-vs-existing separable |
| Scope: eight phases is a lot | Each phase is its own PR and independently useful; stop anywhere |

## 10. Sequence

```
Phase A  fix mapper resume state       (live bug -- do this first)
Phase 0  split the controller          (no behaviour change)
Phase 1  lyricsfile native + offset_ms (unblocks precision storage)
Phase 2  full-screen mapper shell      (the space everything else needs)
Phase 3  waveform word markers         (pure mapping layer first)
Phase 4  sub-word split points         (DONE)
Phase 5  A/B differ, lab + mapper      (the measuring instrument)
Phase 6  start cue for sub-rest gaps   (tune against a real song)
Phase 7  Examples library              (DONE)
```

Phases 1 and 2 are independent of each other and can swap. Everything else in
0–6 is ordered by dependency.

**Phase A is first** — it is a live bug affecting mapping work right now, and
it is small. It lands before the refactor because waiting for Phase 0 would
leave the mapper broken for however long that takes.

**Phase 7 is independent** and can land any time after Phase 1 (so the shipped
mappings are already in the native format). There is a case for pulling it
*early*: it is mostly wiring over mechanisms that already exist, and it is what
lets anyone else reproduce a mapping claim. Doing it before Phase 5 means the
differ ships with real data on every device instead of a folder of audio only
one person has.
