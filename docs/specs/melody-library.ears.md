# Melody Library — EARS Requirements

Requirements for melody CRUD, favourites, search, sharing, and the session
library surface.

**Source:** `src/stores/melody-store.ts` — melody CRUD and favourites;
`src/stores/session-store.ts` — session records and metadata;
`src/components/LibraryModal.tsx` — the library UI; `src/lib/share-url.ts`,
`src/lib/share-codec.ts` — share encode/decode;
`src/components/ConfirmDialog.tsx` — destructive-action confirmation
**Tests:** `src/e2e/melody-library.spec.ts`, `src/e2e/sessions.spec.ts`
(`REQ-MEL-001..028`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

Related: [media-library.ears.md](media-library.ears.md) covers the
session-to-melody relationship and auto-save.

## Creation — `REQ-MEL-001..005`

### REQ-MEL-001 — Create
The user **shall** be able to create a melody from the editor.

### REQ-MEL-002 — Default name
A new melody **shall** receive a default name the user can change.

### REQ-MEL-003 — Title focus
**WHEN** the creation dialog opens, the title field **shall** receive focus.

### REQ-MEL-004 — Saving assigns an id
**WHEN** a melody is saved, the app **shall** assign it a unique id and persist
it.

### REQ-MEL-005 — Cancel discards
**WHEN** the user cancels creation, the app **shall** discard the draft without
persisting it.

## Editing — `REQ-MEL-006..009`

### REQ-MEL-006 — Open for editing
**WHEN** the user selects a melody in the library, the app **shall** load it
into the editor.

### REQ-MEL-007 — Save updates in place
**WHEN** the user saves an edited melody, the app **shall** update the existing
record in `localStorage` (key `STORAGE_KEY_LIBRARY`) rather than create a
second one.

### REQ-MEL-008 — Cancel reverts
**WHEN** the user cancels an edit, the app **shall** restore the last saved
version.

### REQ-MEL-009 — Delete while editing confirms
**IF** the user deletes the melody currently open in the editor, **THEN** the
app **shall** require confirmation first.

## Listing — `REQ-MEL-010..015`

### REQ-MEL-010 — Scrollable list
Melodies **shall** be presented in a scrollable list.

### REQ-MEL-011 — Metadata
Each row **shall** show the melody's name, author, and note count.

### REQ-MEL-012 — Recency order
Recently used melodies **shall** be listed before the rest.

### REQ-MEL-013 — Empty state
**IF** the library contains no melodies, **THEN** the list **shall** show an
empty-state message.

### REQ-MEL-014 — Long names truncate
**IF** a melody name exceeds the row width, **THEN** it **shall** truncate with
an ellipsis.

### REQ-MEL-015 — Row opens the melody
**WHEN** a row is activated, the app **shall** open that melody in the editor.

## Deletion — `REQ-MEL-016..019`

### REQ-MEL-016 — Confirmation required
**WHEN** the user deletes a melody, the app **shall** require confirmation via
`ConfirmDialog`.

### REQ-MEL-017 — Cancel is inert
**IF** the user cancels the confirmation, **THEN** the melody **shall** remain.

### REQ-MEL-018 — In-use warning
**IF** the melody is referenced by a session, **THEN** the confirmation
**shall** say so before proceeding.

### REQ-MEL-019 — Irreversible
**WHEN** deletion is confirmed, the melody **shall** be removed from both
`localStorage` and the rendered list. There is no undo.

## Favourites — `REQ-MEL-020..022`

### REQ-MEL-020 — Toggle
**WHEN** the user activates a melody's star control, the app **shall** toggle
its favourite state.

### REQ-MEL-021 — Visual state
Favourited melodies **shall** show a filled star and unfavourited an empty one.

### REQ-MEL-022 — Dedicated view
Favourited melodies **shall** be reachable from a favourites view.

## Search and filter — `REQ-MEL-023..025`

### REQ-MEL-023 — Name search
The user **shall** be able to search melodies by name; the search **shall** be
case-insensitive and filter as the user types.

### REQ-MEL-024 — Session filters
The user **shall** be able to filter sessions by category and by difficulty.

### REQ-MEL-025 — No results
**IF** a search returns nothing, **THEN** the list **shall** show a no-results
message rather than an empty list.

## Sessions in the library — `REQ-MEL-026..027`

### REQ-MEL-026 — Session records
Sessions **shall** be listed with their metadata, and **WHEN** a session is
played its last-played timestamp **shall** be updated.

### REQ-MEL-027 — Session deletion confirms
**WHEN** the user deletes a session, the app **shall** require confirmation.

## Sharing — `REQ-MEL-028`

### REQ-MEL-028 — Share and import by URL
The user **shall** be able to share a melody as a URL that encodes its data,
and **WHEN** such a URL is opened the app **shall** import the melody under a
new id, leaving any existing melody untouched.
