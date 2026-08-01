# Focus Mode — EARS Requirements

Requirements for Focus Mode: the distraction-free practice view that hides app
chrome and expands the practice surface.

**Source:** `src/stores/ui-store.ts` — `focusMode` signal, `enterFocusMode` /
`exitFocusMode`; `src/App.tsx` — applies the focus layout and hides chrome
**Tests:** `src/e2e/focus-mode.spec.ts` (`REQ-FOCUS-001..015`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Activation — `REQ-FOCUS-001..004`

### REQ-FOCUS-001 — Toggle entry
**WHEN** the user activates the Focus Mode control, the app **shall** enter
focus mode.

### REQ-FOCUS-002 — Chrome hidden
**WHILE** focus mode is active, the app **shall** hide the sidebar navigation,
the practice header, the settings panel, and help/walkthrough affordances.

### REQ-FOCUS-003 — Practice area expands
**WHILE** focus mode is active, the piano roll **shall** expand to fill the
space released by the hidden chrome.

### REQ-FOCUS-004 — Active state is visible
**WHILE** focus mode is active, the Focus Mode control **shall** render in its
highlighted state.

## Exit — `REQ-FOCUS-005..008`

### REQ-FOCUS-005 — Toggle exit
**WHEN** the user activates the Focus Mode control **WHILE** focus mode is
active, the app **shall** exit focus mode.

### REQ-FOCUS-006 — Chrome restored
**WHEN** focus mode is exited, the app **shall** restore every element hidden
by `REQ-FOCUS-002` to its prior state.

### REQ-FOCUS-007 — Tab change exits
**WHEN** the user switches tabs **WHILE** focus mode is active, the app
**shall** exit focus mode.

### REQ-FOCUS-008 — State survives the round trip
**WHEN** focus mode is entered or exited, the app **shall** preserve the
current practice session state, including playback position and recorded notes.

## Non-interference — `REQ-FOCUS-009..013`

### REQ-FOCUS-009 — Playback unaffected
**WHILE** focus mode is active, playback controls **shall** behave exactly as
they do outside focus mode.

### REQ-FOCUS-010 — Metronome unaffected
**WHILE** focus mode is active, the metronome **shall** continue to sound and
advance per [metronome.ears.md](metronome.ears.md).

### REQ-FOCUS-011 — Recording permitted
**WHILE** focus mode is active, the user **shall** be able to record to the
piano roll.

### REQ-FOCUS-012 — Repeatable
The user **shall** be able to enter and exit focus mode any number of times
within a session.

### REQ-FOCUS-013 — No settings access
**IF** the user attempts to open the settings panel **WHILE** focus mode is
active, **THEN** the app **shall** not present it.

## Modals — `REQ-FOCUS-014..015`

### REQ-FOCUS-014 — Library modals suppressed
**WHILE** focus mode is active, library modals **shall** be hidden or
collapsed.

### REQ-FOCUS-015 — No stray overlays
**WHILE** focus mode is active, the app **shall** not raise non-essential
modals unprompted.
