# Presets Library — EARS Requirements

Requirements for the presets browser: categorised starting points (scales,
rhythms, melodies, warm-ups) that load into the editor.

Source:

- `src/stores/ui-store.ts` — presets-library visibility (`showPresetsLibrary`)
- `src/components/LibraryTab.tsx` — quick-start entry point
- `src/data/` — preset definitions

Tests:

- `src/e2e/comprehensive.spec.ts` (`REQ-PRESET-001..016`) — partial coverage

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Access — `REQ-PRESET-001..003`

### REQ-PRESET-001 — Entry point
The user **shall** be able to open the presets library from the Library tab's
quick actions.

### REQ-PRESET-002 — Quick Start opens it
**WHEN** the user activates Quick Start, the app **shall** open the presets
library.

### REQ-PRESET-003 — Preset identity
Each preset **shall** display its name and a type icon.

## Categories — `REQ-PRESET-004..008`

### REQ-PRESET-004 — Categorised
Presets **shall** be grouped by type: scales, rhythms, melodies, and warm-ups.

### REQ-PRESET-005 — Category tabs
Category tabs **shall** be presented at the top of the presets library.

### REQ-PRESET-006 — Switching categories
**WHEN** the user selects a category tab, the library **shall** show only that
category's presets.

### REQ-PRESET-007 — Active category is visible
The selected category tab **shall** be visually highlighted.

### REQ-PRESET-008 — Per-category count
Each category **shall** display how many presets it contains.

## Display — `REQ-PRESET-009..011`

### REQ-PRESET-009 — Grid of cards
Presets **shall** be presented as cards in a grid.

### REQ-PRESET-010 — Empty category
**IF** a category contains no presets, **THEN** the library **shall** show an
empty-state message rather than a blank grid.

### REQ-PRESET-011 — Long names
**IF** a preset name exceeds its card width, **THEN** it **shall** truncate
with an ellipsis rather than wrap or overflow.

## Loading — `REQ-PRESET-012..016`

### REQ-PRESET-012 — Selecting loads
**WHEN** the user selects a preset, the app **shall** load it into the editor
and switch to the editor view.

### REQ-PRESET-013 — Replaces current melody
**WHEN** a preset loads, it **shall** replace the melody currently in the
editor, updating both name and notes.

### REQ-PRESET-014 — Notes rendered
**WHEN** a preset loads, the piano roll **shall** render its notes.

### REQ-PRESET-015 — No duplicate library entry
**WHEN** a preset loads, the app **shall** not create a duplicate melody in the
library.

### REQ-PRESET-016 — Unsaved changes are discarded
**WHEN** a preset loads, the app **shall** discard unsaved changes to the
melody previously in the editor.

> `REQ-PRESET-016` is a destructive step with no confirmation. If preset
> loading ever grows an undo, or a "you have unsaved changes" prompt, this
> requirement changes — see [MISTAKES.md](../agent/MISTAKES.md) before
> altering it.
