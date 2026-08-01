# Media Library — EARS Requirements

Requirements for the session/melody hierarchy: which session is active, which
melody is loaded into the editor, and how new melodies attach to a session.

**Source:** `src/stores/session-store.ts` — active session and recent-session
list; `src/stores/melody-store.ts` — melody CRUD and the selected melody;
`src/components/LibraryModal.tsx` — the sidebar library surface
**Tests:** `src/e2e/sessions.spec.ts`, `src/e2e/melody-library.spec.ts`
(`REQ-MEDIA-001..014`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Related: [melody-library.ears.md](melody-library.ears.md) covers melody CRUD
and favourites in detail; this spec covers the session-to-melody relationship.

## Sessions — `REQ-MEDIA-001..005`

### REQ-MEDIA-001 — Default session on first launch
**WHEN** the app launches and no session exists, the app **shall** create a
session named "Default" and set it active.

### REQ-MEDIA-002 — Default session is not empty
The Default session **shall** contain one melody pre-populated with notes.

### REQ-MEDIA-003 — Create a session
The user **shall** be able to create a new session from the sidebar library.

### REQ-MEDIA-004 — New session becomes active
**WHEN** a session is created, the app **shall** set it as the active session.

### REQ-MEDIA-005 — Switch sessions
The user **shall** be able to select an active session from the recent-sessions
list in the sidebar.

## Melody selection — `REQ-MEDIA-006..010`

### REQ-MEDIA-006 — Sidebar lists the active session's melodies
**WHILE** a session is active, the sidebar **shall** list every melody
belonging to that session.

### REQ-MEDIA-007 — Sole melody auto-selects
**IF** the active session contains exactly one melody, **THEN** the app
**shall** select it automatically.

### REQ-MEDIA-008 — Manual selection
**WHERE** the active session contains more than one melody, the user **shall**
be able to select any of them.

### REQ-MEDIA-009 — Selection loads the editor
**WHEN** a melody is selected, the app **shall** load it into the editor.

### REQ-MEDIA-010 — Play one or all
The user **shall** be able to play back either the selected melody alone or the
whole session.

## Creation — `REQ-MEDIA-011..012`

### REQ-MEDIA-011 — New melodies join the active session
**WHEN** the user creates a melody, the app **shall** add it to the active
session and show it in the sidebar list.

### REQ-MEDIA-012 — New melody is selected
**WHEN** a melody is created, the app **shall** select it and load it into the
editor.

## Auto-save — `REQ-MEDIA-013..014`

### REQ-MEDIA-013 — Edits persist
**WHEN** the user edits notes in the piano roll, the app **shall** save those
changes to the selected melody.

### REQ-MEDIA-014 — Saving is invisible
**WHILE** auto-save runs, the app **shall** not interrupt editing, move the
cursor, or steal focus.

## Out of scope

Playlists that group multiple sessions were specified here historically but are
not implemented and are not planned in this form. Karaoke playlists are a
different feature — see
[karaoke-playlist.ears.md](karaoke-playlist.ears.md).
