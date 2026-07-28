# Session Editor — EARS Requirements

Requirements for the drag-and-drop session timeline: composing an ordered
practice session from melodies, presets, scales, and rests.

Source:

- `src/stores/session-store.ts` — session items and persistence
- `src/components/SessionMiniTimeline.tsx` — timeline rendering
- `src/features/session/useSessionSequencer.ts` — playback of the composed session

Tests:

- `src/e2e/session-editor.spec.ts` (`REQ-SED-001..026`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Timeline — `REQ-SED-001..006`

### REQ-SED-001 — Ordered by start beat
The timeline **shall** display session items ordered by `startBeat`.

### REQ-SED-002 — Item cards
Each item **shall** render as a card carrying a type icon and a label.

### REQ-SED-003 — Rests are distinct
Rest items **shall** be visually distinguishable from active items.

### REQ-SED-004 — Horizontal overflow scrolls
**IF** items exceed the available width, **THEN** the timeline **shall** scroll
horizontally rather than wrap or clip.

### REQ-SED-005 — Empty state
**IF** the session has no items, **THEN** the timeline **shall** show an
empty-state prompt to drag melodies in, and **shall** still accept drops.

### REQ-SED-006 — Total duration
The timeline **shall** display the session's total duration and item count.

## Collapse — `REQ-SED-007..009`

### REQ-SED-007 — Collapsible
The session editor **shall** be collapsible from its header, and **shall**
default to expanded.

### REQ-SED-008 — Collapsed shows header only
**WHILE** collapsed, the editor **shall** show only its header row.

### REQ-SED-009 — Expanded shows library and timeline
**WHILE** expanded, the editor **shall** show the melody library above the
timeline.

## Melody source — `REQ-SED-010..013`

### REQ-SED-010 — Draggable pills
Melodies **shall** be presented as draggable pills showing name and BPM.

### REQ-SED-011 — Search
The user **shall** be able to search melodies by name; search **shall** be
case-insensitive and filter as the user types.

### REQ-SED-012 — Result order
Search results **shall** be sorted alphabetically.

### REQ-SED-013 — Selection highlight
**WHEN** a melody pill is clicked, it **shall** be visually marked as selected.

## Drag and drop — `REQ-SED-014..018`

### REQ-SED-014 — Drag carries identity
**WHEN** a drag starts, the transfer **shall** carry the melody's id.

### REQ-SED-015 — Timeline accepts drops
The timeline **shall** accept drops originating from the melody library.

### REQ-SED-016 — Drop inserts at position
**WHEN** a valid melody is dropped, the editor **shall** insert a SessionItem
at the position implied by the drop coordinates.

### REQ-SED-017 — Invalid drops are inert
**IF** a drop is not a valid melody transfer, **THEN** the editor **shall**
leave the session unchanged.

### REQ-SED-018 — Auto-scroll to the new item
**WHEN** an item is added outside the visible range, the timeline **shall**
scroll to reveal it.

> Drag-and-drop is pointer-driven. Per
> [CONVENTIONS.md](../agent/CONVENTIONS.md) §6, changes here need a real-mouse
> Playwright spec — synthetic events pass against broken code. Note also that
> `<For>` recreates rows on store commits, which can cancel an in-flight drag.

## Rests — `REQ-SED-019..021`

### REQ-SED-019 — Insert between items
The user **shall** be able to insert a rest between two items via the drop zone
separating them.

### REQ-SED-020 — Default rest length
**WHEN** a rest is inserted from a drop zone, it **shall** default to 4
seconds.

### REQ-SED-021 — Rests are deletable
The user **shall** be able to delete a rest, after which subsequent items
**shall** shift earlier to close the gap.

## Item management — `REQ-SED-022..024`

### REQ-SED-022 — Delete
Each item **shall** offer a delete control; deleting **shall** remove it and
shift subsequent items earlier.

### REQ-SED-023 — Save
**WHEN** the user saves, the editor **shall** persist the session.

### REQ-SED-024 — Load
**WHEN** the user loads a session, the editor **shall** replace the current
timeline with the stored one.

## Item types — `REQ-SED-025..026`

### REQ-SED-025 — Four types
The timeline **shall** support `melody`, `preset`, `scale`, and `rest` items.

### REQ-SED-026 — Type-specific display
Each type **shall** render its own icon and any type-specific detail — for a
`scale` item, its scale type.

Playback of these items is specified in
[playback-modes.ears.md](playback-modes.ears.md) `REQ-PLAY-014..021`.
