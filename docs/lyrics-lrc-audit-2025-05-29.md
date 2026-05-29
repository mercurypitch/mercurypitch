# LRC Gen & Lyrics Controller — Implementation Audit

**Date:** 2025-05-29
**File:** `src/features/stem-mixer/useStemMixerLyricsController.ts` (1996 lines)
**Tests:** 156 passing across 4 test files

---

## 1. CURRENT STATE

### 1.1 What Works Well

- **Canonical entry construction** (`canonicalLrcLines`, lines 1535-1588): Clean memo that inserts synthetic `~Rest~` for gaps > 20s. Well-understood and well-tested.
- **LRC↔canonical index mapping**: The fix in `startLrcGen` and `handleLrcGenFinish` correctly handles the two index spaces. The mapping logic is duplicated 3 times (lines 1083-1087, 1297-1305, and in tests) but each instance is correct.
- **Pure function extraction**: `lrc-generator.ts` already extracts `formatTimeLrc`, `buildLrcText`, `buildWordLevelLrc` — the right pattern.
- **Partial gen merge**: Correctly preserves untouched line timestamps and merges touched ones.
- **Cancel/restore**: Pre-gen snapshot correctly restores all state on cancel.
- **Test coverage**: 156 tests across 4 files covering parsing, generation, canonical mapping, scrolling.

### 1.2 Known Gaps (Pre-existing, Not From These Changes)

- **Whisper timeout in StemMixer** (Task #148): Model load works in ShazamListen but times out in StemMixer context. Unrelated to LRC gen.
- **Shazam debug prints** (Task #149): Need to verify they're dev-only.
- **No E2E tests** for the LRC gen flow (manual tap-along). Tested only at unit level.

---

## 2. SIMPLIFICATION OPPORTUNITIES

### 2.1 HIGH: Extract canonical index mapping utilities

**Problem:** The same LRC↔canonical index mapping logic appears 3 times in the controller (lines 1083-1087, 1297-1305, and implicitly in `canonicalLrcLines`) and is replicated in the test file.

**Recommendation:** Move `buildLrcToCanonicalMap` and `buildCanonicalToLrcMap` into a shared utility (e.g., `src/lib/canonical-lrc.ts`) alongside `buildCanonicalEntries`. The controller and tests would both import from this module.

**Estimated savings:** ~40 lines in controller, ~30 lines in tests.

```ts
// src/lib/canonical-lrc.ts
export function buildCanonicalEntries(lrcLines: LrcLine[]): CanonicalLrcEntry[] { ... }
export function buildLrcToCanonicalMap(entries: CanonicalLrcEntry[]): Map<number, number> { ... }
export function buildCanonicalToLrcMap(entries: CanonicalLrcEntry[]): Map<number, number> { ... }
```

### 2.2 HIGH: Extract duration helpers (windowDuration)

**Problem:** `deps.windowDuration` and `deps.setWindowStart` are deeply threaded through the controller but are only used in one place (line 576, seek after line click). They pollute the `StemMixerLyricsDeps` interface.

**Recommendation:** Either move the window adjustment logic into `handleLyricLineClick`'s caller, or pass a simpler `seekToWithWindow(t)` callback.

**Estimated savings:** 2 deps removed, ~5 lines.

### 2.3 MEDIUM: De-duplicate LRC text building logic

**Problem:** Similar LRC text assembly logic appears in 4 places:
1. `handleSaveEdits` (lines 726-760) — builds LRC text from canonical entries
2. `handleLrcGenFinish` (lines 1393-1405) — builds LRC text from canonical entries
3. `handleDownloadLrc` (lines 1436-1516) — builds LRC text from canonical/text/lyricsLines
4. `lrc-generator.ts:buildLrcText()` — pure function for text→LRC

**Recommendation:** Consolidate paths 1, 2, and 3 into a single `buildLrcTextFromCanonical(canonical, lineTimes, wordTimings)` function in `lrc-generator.ts`. This would handle all 3 call sites.

**Estimated savings:** ~60 lines in controller.

### 2.4 MEDIUM: Extract block auto-fill logic

**Problem:** `autoFillBlockInstance` (lines 950-998) and `expandAllBlockInstances` (lines 1000-1014) operate on gen state signals. They're ~65 lines of logic that could be pure functions operating on plain data, with signal updates at the call site.

**Recommendation:** Keep them as-is for now — the signal batching pattern is idiomatic SolidJS. But if the controller hits 2500 lines, this is the next extraction target.

### 2.5 LOW: `hasMultipleSections` as a memo

**Problem:** `hasMultipleSections` is a function (line 1728) that calls `lyricsSections()`. It should be a `createMemo` or derived inline from `lyricsSections`.

```ts
// Current:
const hasMultipleSections = () => lyricsSections().length >= 2

// Better:
const hasMultipleSections = createMemo(() => lyricsSections().length >= 2)
```

### 2.6 LOW: `rawLyricsText` vs `rawText` confusion

**Problem:** Two similarly-named concepts exist: `rawLyricsText` (the full text content) and `rawText` (persisted raw text in localStorage payload). They're separate but easy to confuse.

**Recommendation:** Rename the persisted field to `originalText` or keep `rawText` but add a short comment distinguishing them.

---

## 3. MODULARIZATION PLAN

### Proposed module structure after extraction:

```
src/lib/
  canonical-lrc.ts         # buildCanonicalEntries, buildLrcToCanonicalMap, buildCanonicalToLrcMap
  lrc-generator.ts         # formatTimeLrc, buildLrcText, buildWordLevelLrc, buildLrcTextFromCanonical
  lyrics-service.ts        # parseLrcFile, parseTextLyrics, parseLrcWordTimings, computeActiveWord, etc.

src/features/stem-mixer/
  useStemMixerLyricsController.ts  # ~1600 lines (down from 1996)
  types.ts                          # shared types (unchanged)
```

### Controller would keep:
- Signal declarations (all 30+ signals)
- localStorage persistence (persistLyrics, loadPersistedLyrics)
- Actions that compose signals + pure functions (startLrcGen, handleNextLine, etc.)
- Memos that react to signals (canonicalLrcLines, stableParsedLyrics, genViewData, etc.)
- DOM interaction (scroll listeners, click handlers)
- Block management (block mutations, instance detection)

### What moves out:
- `canonicalLrcLines` memo body → `canonical-lrc.ts:buildCanonicalEntries()` (pure function, already tested)
- LRC↔canonical map construction → `canonical-lrc.ts` (2 pure functions)
- LRC text assembly → `lrc-generator.ts:buildLrcTextFromCanonical()` (pure function)
- `detectBlockInstances` → candidate for `block-utils.ts` (already a pure function at lines 798-839)

---

## 4. EARS SPEC STATUS

**Created:** `tests/ears/lyrics-lrc-gen.md` — covers REQ-UV-025 through REQ-UV-057 (33 requirements).

**Coverage gaps in EARS:**
- REQ-UV-028 through REQ-UV-045 existed only as inline references in tests — now formalized.
- REQ-UV-046 through REQ-UV-057 for blocks, edit mode, playback — newly documented.

---

## 5. RECOMMENDED NEXT STEPS

1. **Extract `canonical-lrc.ts`** (Item 2.1) — lowest risk, highest clarity gain. The pure functions already exist in tests.
2. **Consolidate LRC text building** (Item 2.3) — reduces duplication, makes `lrc-generator.ts` the single source of truth.
3. **Fix `hasMultipleSections`** (Item 2.5) — one-line change.
4. **Consider `detectBlockInstances` extraction** — it's already a pure function, just sitting inline.

**Do NOT pursue:**
- Splitting the controller into separate files (e.g., one for blocks, one for gen, one for edit). The signal graph is tightly coupled and splitting would create circular dependency risks. A 1600-line controller after extraction is acceptable for SolidJS patterns.
- Adding a state machine or reducer pattern. The imperative signal updates with `touchedLines` set is readable and correct.

---

## 6. VERIFICATION

- `npx vitest run` — 156 tests pass (0 failures)
- `npx tsc --noEmit` — pre-existing errors only (unrelated to lyrics: `@huggingface/transformers`, `vite-plugin-qrcode`)
- EARS spec written at `tests/ears/lyrics-lrc-gen.md`
