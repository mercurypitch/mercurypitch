# Original + HQ Re-run in View Results — EARS Requirements

Requirements for the shared actions exposed by completed UVR session history cards
(`UvrSessionResult`) and the result-viewer header (`UvrResultViewer`).

**Source:** `src/components/UvrSessionActions.tsx` — shared actions;
`src/components/SessionExportDialog.tsx` — stem selector;
`src/components/UvrResultViewer.tsx` — header UI; `src/components/UvrPanel.tsx`
— parent integration; `src/db/services/session-export-service.ts` — restorable
archive construction; `src/styles/uvr.css` — shared styles
**Tests:** `src/components/__tests__/UvrSessionActions.test.tsx` and
`src/components/__tests__/UvrResultViewer.test.tsx` (`REQ-UVR-*`);
`src/tests/karaoke-playlist-import.test.ts` (archive contents and round-trip)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Result Viewer Header Actions — `UVR-VIEW-RESULTS-*`

### REQ-UVR-001 — Download Original button in result-viewer header

**WHEN** a session has completed status and a stored original file
(`session.originalFile != null && session.originalFile.size > 0`), **THEN** the
system shall render an "Original" button in the `UvrResultViewer` header that
triggers downloading the stored original audio file from IndexedDB. Verified
in `UvrResultViewer.test.tsx`.

### REQ-UVR-002 — HQ re-run button and dropdown menu in result-viewer header

**WHEN** a completed browser-processed session (`processingMode === 'local'`,
`provider !== 'manual'`, `session.originalFile != null`, and
`session.originalFile.size > 0`) has `onRerunHq` provided, **THEN** the system
shall render an "HQ" button with a dropdown menu in the `UvrResultViewer`
header offering:

- "Upgrade this session": triggers `onRerunHq(sessionId, 'same')`
- "New session to compare": triggers `onRerunHq(sessionId, 'new')`
  Verified in `UvrResultViewer.test.tsx`.

### REQ-UVR-003 — Wire onRerunHq handler in UvrPanel

**Ubiquitous:** `UvrPanel` shall pass its `handleRerunHq` handler into `UvrResultViewer` as `onRerunHq` so users can trigger cloud GPU re-runs directly from the result viewer view.

## Restorable session export — `UVR-EXPORT-*`

### REQ-UVR-004 — Export action on every completed-session surface

**WHEN** a UVR session has completed, **THEN** the system shall expose the same
"Export ZIP" action in both its history card and result-viewer header.

### REQ-UVR-005 — Direct export for classic two-stem sessions

**WHEN** the only stored audio stems are Vocal and/or Instrumental, **THEN** the
system shall export those available core stems immediately without opening a
selection dialog.

### REQ-UVR-006 — Full-band selection defaults and presets

**WHEN** a completed session contains any additional band stem, **THEN** the
system shall open a stem-selection dialog with every available stem selected
by default and shall offer All available stems, Vocal + Instrumental, and
Custom presets. **WHILE** Custom is selected, the system shall require at least
one Vocal or Instrumental stem so the resulting archive remains reopenable.

### REQ-UVR-007 — Complete restorable session data

**WHEN** a session archive is exported, **THEN** it shall contain every selected
stored stem plus the session details, lyrics, lyric timing/transcription and
pitch analysis and melody fingerprint that are available. **WHERE** the
original upload is stored, the archive shall contain it as well. **WHEN** a
subset of stems is exported, **THEN** its session metadata shall describe only
those packaged stems.

### REQ-UVR-008 — Missing-original disclosure

**WHEN** a session records original-file metadata but its original bytes are no
longer stored, **THEN** export shall continue with the selected restorable data
and include a human-readable notice instead of claiming that the original was
included.

### REQ-UVR-009 — Private and temporary data exclusion

**WHEN** an archive is exported, **THEN** it shall omit account credentials,
server capability handles, temporary output URLs and runtime-only output
references, while preserving product data needed to reopen the session.

### REQ-UVR-010 — Honest export failures

**IF** the selected stems or auxiliary session data cannot be read or packed,
**THEN** the system shall report the failure, shall not report a successful
download, and shall keep an open selector available for retry.

### REQ-UVR-011 — Accessible selection and progress

**WHILE** the export selector is open, **THEN** it shall behave as a modal dialog
with labelled preset and stem controls, keyboard focus containment, Escape and
Cancel dismissal while idle, focus restoration on close, disabled dismissal
while packing, and announced progress and error states.

### REQ-UVR-012 — One archive build at a time

**WHILE** any session, group, library or karaoke archive is being prepared,
**THEN** a second archive request shall fail with a user-facing busy message
instead of starting another memory-intensive archive build.

### REQ-UVR-013 — Restorable batch membership

**WHEN** all sessions or a group is exported, **THEN** only completed sessions
with a stored Vocal or Instrumental stem shall be packaged, and the completion
message shall disclose how many unfinished or incomplete sessions were skipped.
**IF** no restorable session remains, **THEN** no empty archive shall download
and the user shall receive an actionable error.

### REQ-UVR-014 — Imported stem metadata follows stored audio

**WHEN** a session archive is imported, **THEN** the restored stem metadata
shall be rebuilt only for recognized stem audio entries that were durably
stored, preserving archived duration data without creating controls for
omitted stems. **IF** the archive has no Vocal or Instrumental audio,
**THEN** the session shall not be restored. **WHEN** playable core audio is
restored, **THEN** stale queued, processing or error metadata shall be
normalized to a completed stored result, and any validated melody fingerprint
shall be remapped to the new session identity.

### REQ-UVR-015 — Confirm library-wide stem selection

**WHEN** the user requests Export all, **THEN** the system shall inspect the
restorable local library and open the same accessible stem-selection dialog
before archive construction begins, with All available stems selected by
default and Vocal + Instrumental and Custom presets available. **WHEN** the
user confirms, **THEN** the selected stem types shall be intersected with each
session's stored audio so optional parts missing from one session do not fail
the whole batch. **IF** the selection leaves a session without Vocal or
Instrumental audio, **THEN** that session shall be skipped and disclosed by the
completion summary.
