# Original + HQ Re-run in View Results — EARS Requirements

Requirements for mirroring the Original download button and HQ re-run menu from session history cards (`UvrSessionResult`) into the result-viewer header (`UvrResultViewer`).

Implementation:

- Header UI: `src/components/UvrResultViewer.tsx`
- Parent integration: `src/components/UvrPanel.tsx`
- Styles: `src/styles/uvr.css`

Unit tests (`REQ-UVR-*`): `src/components/__tests__/UvrResultViewer.test.tsx`

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## Result Viewer Header Actions — `UVR-VIEW-RESULTS-*`

### REQ-UVR-001 — Download Original button in result-viewer header
**WHEN** a session has completed status and a stored original file (`session.originalFile != null`), **THEN** the system shall render an "Original" button in the `UvrResultViewer` header that triggers downloading the stored original audio file from IndexedDB. Verified in `UvrResultViewer.test.tsx`.

### REQ-UVR-002 — HQ re-run button and dropdown menu in result-viewer header
**WHEN** a completed browser-processed session (`processingMode === 'local'`, `provider !== 'manual'`, `session.originalFile != null`) has `onRerunHq` provided, **THEN** the system shall render an "HQ" button with a dropdown menu in the `UvrResultViewer` header offering:
- "Upgrade this session": triggers `onRerunHq(sessionId, 'same')`
- "New session to compare": triggers `onRerunHq(sessionId, 'new')`
Verified in `UvrResultViewer.test.tsx`.

### REQ-UVR-003 — Wire onRerunHq handler in UvrPanel
**Ubiquitous:** `UvrPanel` shall pass its `handleRerunHq` handler into `UvrResultViewer` as `onRerunHq` so users can trigger cloud GPU re-runs directly from the result viewer view.
