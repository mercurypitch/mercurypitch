# PianoRollEditor Audit — 2026-05-15

## Bug Summary

| # | Severity | Status | Issue |
|---|----------|--------|-------|
| 1 | Medium | pending | Multi-note drag collapses all to same position |
| 2 | Medium | pending | `selectedEffect` is dead code — never wired up |
| 3 | Medium | pending | `addBeats` doesn't push history or emit change |
| 4 | Low-Med | pending | Off-screen note placement has one-frame visual lag |
| 5 | Low-Med | pending | Notes with MIDI not in current scale are invisible |
| 6 | Low | pending | `window.alert` for effect validation errors |
| 7 | Low | pending | History pushed on mousedown before any change occurs |
| 8 | Low | pending | Slide duration extension can overlap intervening notes |

## Detailed Findings

### 1. Multi-note drag collapses all notes to same position
**Location**: `onGridMouseMove`, drag handling ~line 2080
**Root cause**: `deltaBeat` computed once, every selected note moved to `dragStartBeat + deltaBeat` (same absolute position). Relative offsets between selected notes are discarded.
**Fix**: Store each note's offset from `dragStartBeat` at drag start, apply `note.startBeat = offset + dragStartBeat + deltaBeat`.

### 2. selectedEffect is dead code
**Location**: Line 547, check at line 2347
**Root cause**: `private selectedEffect: EffectType | null = null` declared and never assigned. No UI to set it exists. The `placeNote` code that checks it can never execute.
**Fix**: Add effect picker toolbar button that sets `selectedEffect`, allowing pre-select-then-place workflow.

### 3. addBeats doesn't push history or emit change
**Location**: Line 944-948
**Root cause**: `removeBeats` has a BUGFIX comment and pushes history + emits change. `addBeats` misses both. Undo doesn't work after adding bars.
**Fix**: Add `pushHistory()` and `emitMelodyChange()` to `addBeats`.

### 4. Off-screen note placement has one-frame lag
**Location**: Note placement flow, `totalBeats` propagation
**Root cause**: Editor doesn't auto-expand. Parent recomputes `totalBeats` from melody data reactively, causing round-trip delay. No `onTotalBeatsChange` callback.
**Fix**: In `placeNote`, if `snappedBeat + duration > totalBeats`, expand `totalBeats` immediately and call `draw()`.

### 5. Notes with MIDI not in current scale are invisible
**Location**: `drawNoteBlocks` ~line 3224
**Root cause**: `rowIdx < 0` check skips notes whose MIDI isn't in `this.scale`. Note exists in melody but can't be seen, selected, or erased.
**Fix**: Render off-scale notes at the top/bottom edge of the grid with a distinct visual treatment.

### 6. window.alert for effect validation
**Location**: Line 3502 in `_applyEffect`
**Root cause**: `window.alert('Select exactly 2 notes for this effect.')` blocks UI.
**Fix**: Use the existing `hintEl` element for non-blocking feedback.

### 7. History pushed on mousedown before change
**Location**: Line 1932-1937
**Root cause**: `pushHistory()` called eagerly on mousedown. Clicking a note without dragging wastes an undo level.
**Fix**: Defer `pushHistory()` to mouseup, only when an actual modification occurred.

### 8. Slide duration extension can overlap intervening notes
**Location**: Lines 3536-3540 in `_applyEffect`
**Root cause**: `first.duration = Math.max(...)` extends duration with no check for notes between the two linked notes.
**Fix**: Check for notes between `first.startBeat` and `second.startBeat` and warn or refuse if found.

## Architecture Notes

- **Reactive prop sync**: Parent passes state via `createEffect`; editor emits `onMelodyChange` upward.
- **Undo/redo**: Full melody snapshots (JSON deep copy) — O(n) but correct.
- **Tools**: `place`, `erase`, `select` are mutually exclusive toggle buttons. Switching clears selection.
- **Touch**: Mirrors mouse handlers at lines 1610-1643.
- **Ruler seek**: Uses `document`-level mousemove with `isSeeking` flag; emits `pitchperfect:seekToBeat` on event bus.
