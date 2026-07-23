# Stem Mixer Pitch Settings Sidebar — EARS Requirements

Requirements for the Stem Mixer Pitch & Denoising settings sidebar (`src/components/StemMixerPitchAnalysisPanel.tsx`),
written in EARS (Easy Approach to Requirements Syntax).

EARS keywords: **WHEN** (event), **WHILE** (state), **IF/THEN** (unwanted
behaviour), **WHERE** (optional feature), otherwise ubiquitous ("shall").

## 1. Sidebar Container & Navigation — `REQ-SMP-001` to `REQ-SMP-005`

### REQ-SMP-001 — Left Transparent Sidebar Presentation
**WHEN** the user clicks the "Pitch" button in the Stem Mixer header toolbar, the pitch settings panel shall open as a full-height transparent left sidebar using the same slide-in container pattern as the Karaoke Playlist sidebar.

### REQ-SMP-002 — Active Button State
**WHILE** the pitch settings sidebar is open, the Pitch button in the Stem Mixer header toolbar shall display an active visual state (`.sm-btn--active`).

### REQ-SMP-003 — Mutual Exclusion of Left Sidebars
**WHEN** the pitch settings sidebar is opened, the system shall automatically close the Karaoke Playlist sidebar if it is open, ensuring only one left sidebar is displayed at a time.

### REQ-SMP-004 — Sidebar Dismissal via Close Button and Escape Key
**WHEN** the user clicks the close icon button (X) in the sidebar header or presses the Escape key while the sidebar is open, the system shall close the pitch settings sidebar.

### REQ-SMP-005 — Edit Mode Collapsing
**WHEN** note edit mode is enabled, the system shall collapse the pitch settings sidebar to reveal the floating note edit toolbar.

## 2. Redesigned Content & Controls — `REQ-SMP-006` to `REQ-SMP-010`

### REQ-SMP-006 — Visual Styling & Glassmorphism Header
**Ubiquitous:** The pitch settings sidebar shall render a translucent dark background with a sticky glassmorphism header containing a Pitch settings icon, title, and close button.

### REQ-SMP-007 — Algorithm & Analysis Parameter Controls
**Ubiquitous:** The sidebar shall group pitch analysis parameters (Algorithm selector, Buffer Size, Sensitivity, Min Confidence, Min Amplitude) with formatted live values and provide a primary action button to trigger offline vocal denoising with progress state.

### REQ-SMP-008 — Vocal Cleanup & Key Snapping Section
**Ubiquitous:** The sidebar shall provide cleanup controls (Amount slider with live percentage, Key selector, Scale selector, Tempo/BPM input, and detected key badge when available) that update the vocal contour in real time when analysis data is available.

### REQ-SMP-009 — Cleanup Slider Drag Preview Opacity
**WHILE** dragging the cleanup amount slider, the sidebar opacity shall temporarily fade to 0.2 to allow unhindered visual inspection of the underlying pitch canvas.

### REQ-SMP-010 — Canvas Pitch Display Mode Toggle
**Ubiquitous:** The sidebar shall provide toggle buttons allowing the user to switch between Realtime and Offline Denoised pitch display modes on the canvas.
