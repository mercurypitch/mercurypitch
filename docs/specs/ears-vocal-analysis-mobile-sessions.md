# EARS Specification — Vocal Analysis Mobile Session Picker

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-07-24 | Scope: Mobile vocal analysis inline UVR session selection

---

## 1. Session Gallery

### REQ-VAM-001 — Inline session list in empty state

**WHEN** no UVR session is loaded and the user opens the Analysis tab on a
mobile viewport,
the app **SHALL** display a scrollable list of all completed UVR sessions
(from `getAllUvrSessionsReactive()`) directly on the Analysis mobile overview,
instead of only showing a button that navigates away to the Karaoke tab.

### REQ-VAM-002 — Session card content

**Ubiquitous:** Each session entry in the gallery **SHALL** display the
original file name (truncated with ellipsis if overflow), the processing mode
label ("Server" / "On-device"), the session status badge, and a relative
timestamp (e.g. "2 hours ago").

### REQ-VAM-003 — Tap-to-load session

**WHEN** the user taps a session entry in the gallery,
the app **SHALL** set that session as the current UVR session
(`setCurrentUvrSession`) and the view **SHALL** update to show the loaded
session card and pitch analysis — all without navigating away from the
Analysis page.

### REQ-VAM-004 — Empty gallery fallback

**IF** no completed UVR sessions exist,
**THEN** the app **SHALL** display an informative empty state explaining that
the user needs to process a song in Karaoke first, with a button to navigate
to the Karaoke tab.

### REQ-VAM-005 — Change session action

**WHEN** a UVR session is already loaded and the user wants to switch to a
different session,
the app **SHALL** provide a "Change song" button that returns to the session
gallery view.

---

## Summary of Requirements

| ID | Category | Type | Description |
|----|----------|------|-------------|
| REQ-VAM-001 | Gallery | Event-driven | Inline session list replaces navigate-away flow |
| REQ-VAM-002 | Gallery | Ubiquitous | Session card shows file name, mode, status, time |
| REQ-VAM-003 | Gallery | Event-driven | Tap session to load without navigation |
| REQ-VAM-004 | Gallery | Conditional | Empty gallery fallback with Karaoke link |
| REQ-VAM-005 | Gallery | Event-driven | Change song button to re-show gallery |
