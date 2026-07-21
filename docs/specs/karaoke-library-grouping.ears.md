# Karaoke Library Grouping — EARS Requirements

Requirements for the Karaoke Night "Your library" rail, which lists a user's
completed separations. When songs are organised into session groups, the rail
renders a group -> song-list hierarchy instead of one flat list.

Implementation:

- Pure folding helper: `src/features/karaoke-night/library-grouping.ts`
  (`groupLibrarySongs`).
- Rail rendering: `src/features/karaoke-night/KaraokeRailPanels.tsx`.

Unit tests (`LIB-GROUP-*`): `src/tests/karaoke-library-grouping.test.ts`.

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Library folding — `LIB-GROUP-*`

### REQ-KLG-001 — Flat list when no groups exist
**IF** no session group contains at least one library song, **THEN** the system
shall render the library as a single flat list of songs, newest first (unchanged
behaviour). Verified by `LIB-GROUP-1`.

### REQ-KLG-002 — Group -> song hierarchy when grouped
**WHEN** at least one session group contains a library song, the system shall
render the library as a group -> song-list hierarchy: each group is shown as a
header with its member songs nested/indented beneath it. Verified by
`LIB-GROUP-2`.

### REQ-KLG-003 — Curated member order
**Ubiquitous:** Within a group, the system shall order member songs by the
group's curated `sessionIds` order, resolving each id to an existing library
song only. Verified by `LIB-GROUP-2`.

### REQ-KLG-004 — Group display order preserved
**Ubiquitous:** The system shall render group headers in the store's group order
and shall list songs belonging to no group under a trailing "Ungrouped" section,
preserving their newest-first order. Verified by `LIB-GROUP-3`.

### REQ-KLG-005 — Drifted membership folded in
**WHERE** a library song is assigned to a group via its `groupId` but is absent
from that group's curated `sessionIds`, the system shall still place it in the
group, appended after the curated members in newest-first order. Verified by
`LIB-GROUP-4`.

### REQ-KLG-006 — Empty and stale groups
**IF** a group resolves to no existing library songs (empty, or referencing only
deleted sessions), **THEN** the system shall omit that group from the hierarchy.
Verified by `LIB-GROUP-5`.

### REQ-KLG-007 — Each song shown once
**Ubiquitous:** The system shall place each library song in at most one group
(the first group, in store order, that claims it), so no song appears twice
across the hierarchy. Verified by `LIB-GROUP-6`.

### REQ-KLG-008 — Row behaviour unchanged
**Ubiquitous:** A song row shall behave identically whether shown flat or nested
— same click-to-stage action, active/staging accents, spinner, and equalizer —
and the library count pill shall continue to report the total song count.

### REQ-KLG-009 — Confirmation modal for group deletion
**WHEN** a user triggers deletion of a session group (via clicking the delete x button on a group header or tab), **THEN** the system shall display an accessible confirmation modal naming the group and stating that its member songs will be removed, without performing any deletion until confirmed. Cancel shall preserve the group and songs unchanged.

### REQ-KLG-010 — Keyboard accessibility for deletion confirmation
**WHILE** the group deletion confirmation modal is displayed, **THEN** the system shall enforce a focus trap, close the modal on `Escape`, and prevent silent confirmation on default `Enter` keypresses without explicit user confirmation.

### REQ-KLG-011 — Durable deletion persistence
**WHEN** a group deletion is confirmed, **THEN** the system shall await DB deletion of the group record and its member sessions/references before updating UI state, ensuring that a full page reload or store rehydration does not restore the deleted group or leave dangling references.

