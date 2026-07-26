# Shared Drag Gesture — EARS Requirements

Requirements for the shared pointer-drag and slider interaction primitive
(`src/components/shared/drag-gesture.ts`), written in EARS (Easy Approach to
Requirements Syntax).

Source:

- `src/components/shared/drag-gesture.ts` — pointer lifecycle, touch behavior,
  keyboard support, and slider semantics
- Migrated consumers: `AppNavTabs.tsx`,
  `StemMixerPitchAnalysisPanel.tsx`, `FallingNotesCanvas.tsx`,
  `jam/JamCameraWidget.tsx`, `MascotDock.tsx`, `shared/LoopSeekRail.tsx`,
  `mobile/Scrubber.tsx`, and `mobile/PillControl.tsx`

Tests:

- `src/tests/drag-gesture.test.tsx` (`REQ-DRAG-001..004`)
- `src/e2e/shared-drag-gesture.spec.ts` (`REQ-DRAG-005`)

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

### REQ-DRAG-001 — Pointer capture follows the active drag

**WHEN** an eligible pointer starts a drag, the primitive shall capture that
pointer so movement continues to reach the control outside its bounds.

### REQ-DRAG-002 — Every drag termination recovers cleanly

**WHEN** the active pointer ends, is cancelled, or loses capture, the primitive
shall clear the active gesture and shall release capture when it is still held,
allowing a subsequent pointer to start a new drag.

### REQ-DRAG-003 — Custom touch drags suppress native panning

**Ubiquitous:** The primitive shall apply `touch-action: none` by default.
**WHERE** a consumer intentionally retains native panning, it shall explicitly
select the permitted pan axis.

### REQ-DRAG-004 — Slider mode is keyboard and assistive-technology accessible

**WHERE** slider behavior is configured, the primitive shall expose the slider
role, accessible name, orientation, disabled state, and current/minimum/maximum
values. **WHEN** the focused slider receives an arrow, Page Up/Down, Home, or
End key, it shall clamp and publish the corresponding value change.

### REQ-DRAG-005 — Migrated surfaces work with mouse and touch

**WHEN** a user drags a migrated control with a mouse or touch pointer,
including a gesture that leaves the control before release, the control shall
update without sticking and shall accept the next gesture.
