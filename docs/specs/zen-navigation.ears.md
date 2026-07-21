# Zen-mode Song Navigation + Autoplay — EARS Requirements

Requirements for the zen karaoke stage's transport: the back-to-beginning
control, the next-song button, and the autoplay toggle. Written in EARS (Easy
Approach to Requirements Syntax).

Source:

- `src/features/stem-mixer/zen-navigation.ts` — pure navigation decisions
- `src/components/KaraokeMobileStage.tsx` — the zen transport UI
- `src/components/StemMixer.tsx` — wires the controls to the audio engine,
  the playlist store, and library staging (`onPickSession`)

Tests:

- `src/tests/zen-navigation.test.ts` (`REQ-ZEN-001..006`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Scope note: navigation spans whichever context is active — an in-progress
playlist/group (the playlist store's queue) or free browsing of the whole
library (stepping through completed sessions by `createdAt` order via
`onPickSession`). Grouped/indented library lists, Voice Mirror, and the pitch
sidebar are out of scope.

## Back-to-beginning control — `REQ-ZEN-001..002`

### REQ-ZEN-001 — First press seeks to start
**WHEN** the back control is pressed WHILE the current song is past the first
few seconds (`> SEEK_TO_START_THRESHOLD_SEC`, default 3 s), the system shall
seek the current song to its start without changing the song.

### REQ-ZEN-002 — Second press near the start goes to the previous item
**WHEN** the back control is pressed WHILE the current song is at or within the
first few seconds (`<= SEEK_TO_START_THRESHOLD_SEC`) **and** a previous item
exists, the system shall step to the previous item. **IF** no previous item
exists, **THEN** the system shall seek to the start instead (a harmless re-seek).
The decision is purely a function of playback position, so a first press (which
seeks to ~0) naturally arms the second press to go back.

## Library ordering — `REQ-ZEN-003`

### REQ-ZEN-003 — Playable library order
**Ubiquitous:** The system shall order the library as completed sessions that
still have audio on the device (stem outputs or stem metadata), excluding the
built-in demo song, newest first (`createdAt` descending). The song sheet and
the prev/next controls shall share this one ordering.

## Previous / next neighbours — `REQ-ZEN-004..005`

### REQ-ZEN-004 — Previous neighbour
**Ubiquitous:** The system shall resolve the previous item as the entry before
the current one in the active order, or none when the current item is first or
unknown.

### REQ-ZEN-005 — Next neighbour and button enablement
**Ubiquitous:** The system shall resolve the next item as the entry after the
current one in the active order, or none at the end. **WHERE** a next item
exists, the next-song button shall be enabled and shall advance to it; otherwise
the button shall be disabled.

## Autoplay — `REQ-ZEN-006`

### REQ-ZEN-006 — Auto-advance at end-of-song
**WHILE** autoplay is on and no playlist is running, **WHEN** the current song
reaches its natural end, the system shall auto-advance to the next library item.
**IF** autoplay is off, or there is no next item, **THEN** the system shall not
auto-advance. (A running playlist advances through its own scoring/summary flow
regardless of this toggle.)

## Controls & reactivity — `REQ-ZEN-007..009`

Verified by the control wiring (`KaraokeMobileStage.tsx` / `StemMixer.tsx`) and
the driven end-to-end check; not unit-tested in isolation.

### REQ-ZEN-007 — Autoplay toggle is discoverable and reflects state
**WHERE** library staging is available, the zen header shall show a small
autoplay toggle whose pressed state (`aria-pressed`) and styling reflect whether
autoplay is on.

### REQ-ZEN-008 — Autoplay preference persists
**Ubiquitous:** The system shall persist the autoplay preference across sessions
(a per-user setting), defaulting to off.

### REQ-ZEN-009 — Uncluttered, leak-free controls
**Ubiquitous:** The added controls shall respect SolidJS reactivity — derived
from signals/props with no manually managed effects or timers — and shall keep
the zen stage uncluttered (the next button dims when disabled rather than
shifting layout).
