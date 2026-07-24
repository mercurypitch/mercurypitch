# Karaoke Night Pitch Cogwheel — EARS Requirements

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-07-24 | Scope: Surfacing the pitch settings cogwheel on the Karaoke Night (performance preset) stage

---

Implementation:
- Cogwheel button gate: `src/components/StemMixer.tsx` — the `sm-pitch-debug-btn` button.
- Panel mount gate: `src/components/StemMixer.tsx` — the `StemMixerPitchAnalysisPanel` `<Show>` wrapper.
- Karaoke render site: `src/features/karaoke-night/KaraokeStageHost.tsx` — `<StemMixer preset="performance">`.

Unit tests (`KPC-*`): `src/tests/karaoke-pitch-cogwheel.test.ts`.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Pitch Cogwheel Visibility — `KPC-*`

### REQ-KPC-001 — Cogwheel visible in performance preset
**Ubiquitous:** The pitch settings cogwheel button (`sm-pitch-debug-btn`) shall be rendered for all StemMixer presets, including `performance`. Verified by `KPC-1`.

### REQ-KPC-002 — Cogwheel toggles panel in performance preset
**WHEN** the user clicks the pitch settings cogwheel on the performance stage, the system shall toggle the `StemMixerPitchAnalysisPanel` open or closed, using the same `pitchAnalysis.setPanelOpen` mechanism as the studio preset. Verified by `KPC-2`.

### REQ-KPC-003 — Panel visible in performance preset
**WHILE** `pitchAnalysis.panelOpen()` is true and `pitchAnalysis.editMode()` is false, the `StemMixerPitchAnalysisPanel` shall be rendered regardless of the current preset. Verified by `KPC-3`.

### REQ-KPC-004 — Edit-mode toolbar remains studio-only
**Ubiquitous:** The `StemMixerEditToolbar` (note-editing UI) shall only render when `preset !== 'performance'`. The heavier edit-mode UI is inappropriate for the clean performance stage. Verified by `KPC-4`.

### REQ-KPC-006 — Edit-notes action suppressed on performance stage
**Ubiquitous:** The `canEdit` prop passed to `StemMixerPitchAnalysisPanel` shall be `false` when `preset === 'performance'`, so the "Edit notes" button is disabled. **IF** this gate were absent **THEN** clicking "Edit notes" on the performance stage would enable `editMode`, unmount the pitch panel (which requires `!editMode`), and leave the user stuck with no visible UI to exit edit mode. Verified by `KPC-5`.

### REQ-KPC-005 — No layout regression on clean stage
**WHILE** the pitch settings panel is closed on the performance stage, the stage layout shall remain uncluttered — the cogwheel button occupies only its standard `sm-btn` footprint and introduces no additional chrome. Verified by visual review.
