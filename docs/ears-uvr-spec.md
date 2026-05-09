# EARS Specification — UVR (Ultimate Vocal Remover) Features

> **EARS** = Easy Approach to Requirements Syntax
> Version: 1.0 | Date: 2026-05-06 | Scope: All UVR features in PitchPerfect

---

## 1. Audio Upload

### REQ-UV-001 — File Selection
**Ubiquitous:** The UVR panel shall present an upload area that accepts audio files via drag-and-drop and a file-picker button.

### REQ-UV-002 — File Validation
**WHEN** a file is selected, the system shall validate that:
- The file extension matches one of the allowed extensions (`.mp3`, `.wav`, `.flac`).
- The file size does not exceed the configured maximum (default 100 MB).

**IF** validation fails, **THEN** the system shall display an error message and reject the file.

### REQ-UV-003 — Upload Progress
**WHEN** a valid file is selected, the system shall upload it to the server and display upload progress as a percentage bar.

### REQ-UV-004 — Upload Completion
**WHEN** the upload completes successfully, the system shall transition to the processing configuration view, allowing the user to choose model, output format, and stem types before starting processing.

---

## 2. UVR Processing

### REQ-UV-005 — Processing Start
**WHEN** the user confirms processing configuration and clicks "Start Processing", the system shall:
1. Send the file and options to `/api/uvr/process`.
2. Receive a `session_id` and transition to the processing-in-progress view.
3. Begin polling for status updates.

### REQ-UV-006 — Progress Tracking
**WHILE** processing is in progress, the system shall:
- Poll `/api/uvr/status/{session_id}` at regular intervals (default 1 s).
- Display a progress bar reflecting the server-reported progress percentage.
- Display elapsed processing time in `M:SS` format.
- Provide a "Cancel" button that aborts polling and notifies the server.

### REQ-UV-007 — Processing Completion
**WHEN** the server reports status `completed`, the system shall:
1. Store the session result including file paths for all generated stems.
2. Display the generated outputs (vocal stem, instrumental stem, vocal MIDI, instrumental MIDI) with metadata.
3. Show action buttons for each stem: Play, Download, View in Mixer.

### REQ-UV-008 — Processing Error
**WHEN** the server reports status `error`, the system shall display the error message and provide a "Retry" button that restarts processing with the same parameters.

### REQ-UV-009 — Processing Timeout
**IF** processing exceeds 10 minutes without completion, **THEN** the system shall:
1. Stop polling.
2. Display a timeout error message.
3. Mark the session as `error`.

### REQ-UV-010 — Polling Abort
**WHEN** the user navigates away from the processing view, the system shall abort in-progress polling via `AbortSignal` to prevent resource waste.

---

## 3. Session Management

### REQ-UV-011 — Session History
**Ubiquitous:** The UVR panel shall provide a History view that lists all past processing sessions in reverse chronological order, displayed in a 3-column responsive grid.

### REQ-UV-012 — Session Card
Each session card shall display:
- The original filename and file size.
- The processing model used.
- The session ID (local and API-side).
- Status badge (completed, error, processing).
- Stem pills for each generated output with duration metadata.
- Action buttons: View Results, Open Mixer, Delete.

### REQ-UV-013 — Multi-Stem Mix
**WHEN** the user selects one or more stem pills and clicks "Mix", the system shall open the StemMixer with the selected stems pre-loaded.

### REQ-UV-014 — Session Deletion
**WHEN** the user clicks "Delete" on a session card, the system shall show a styled confirmation dialog. Upon confirmation, the session and its associated files shall be deleted from the server, and the card shall be removed from the history list without navigating away from the history view.

### REQ-UV-015 — Delete All Sessions
**WHEN** the user clicks "Delete All", the system shall prompt for confirmation and, upon confirmation, delete all sessions and clear the history list.

### REQ-UV-016 — Session Restore on Reload
**WHEN** the page is reloaded, the system shall restore session history and re-query the API for current output file lists to keep displayed metadata current.

---

## 4. Stem Playback

### REQ-UV-017 — Stem Playback
**WHEN** the user clicks "Play" on a stem, the system shall load the stem audio file and play it using the Web Audio API, with a connected AnalyserNode for waveform visualization.

### REQ-UV-018 — Volume Control
**Ubiquitous:** Each stem in the mixer shall have an independent volume slider (0–100%) that adjusts the gain node in real time.

### REQ-UV-019 — MIDI Stem as Sub-Stem
**Ubiquitous:** When a vocal stem has an associated MIDI file, the MIDI stem shall appear as a visual sub-item beneath the vocal stem in the stem listing.

---

## 5. Stem Mixer Workspace

### REQ-UV-020 — Panel Layout
**Ubiquitous:** The StemMixer shall provide a workspace with 5 configurable panels: Overview, Live View, Pitch Display, Stem Controls, and Lyrics.

### REQ-UV-021 — Drag-to-Reorder
**WHEN** the user drags a panel header, the panel shall be reordered in the workspace. The new order shall persist to localStorage.

### REQ-UV-022 — Panel Resize
**WHEN** the user drags a resize handle between panels, adjacent panels shall resize proportionally within the workspace.

### REQ-UV-023 — Column Toggle
**WHEN** the user toggles a column visibility button, the corresponding panel shall show or hide with a CSS transition.

### REQ-UV-024 — Playback Transport
**Ubiquitous:** The mixer shall provide Play/Pause, Stop, and timeline seek controls synchronized across all loaded stems.

### REQ-UV-025 — Time Window / Zoom
**Ubiquitous:** The waveform and pitch visualizations shall display a configurable time window (10 s – 150 s) with auto-scroll during playback and zoom-in/zoom-out controls.

### REQ-UV-026 — Waveform Visualization
**WHILE** audio is playing, the Overview panel shall render a scrolling waveform using Canvas2D, with correct device-pixel-ratio (DPR) scaling to prevent blur or accumulation artifacts.

### REQ-UV-027 — Pitch Visualization
**WHILE** audio is playing, the Pitch panel shall render pitch detection data as a Melodyne-style note display, consolidating consecutive same-note detections into continuous note pills.

---

## 6. Lyrics Upload and Display

### REQ-UV-028 — Lyrics Upload
**WHEN** the user opens the Lyrics panel and uploads a `.txt` or `.lrc` file, the system shall parse the file and display the lyrics as synchronized or plain text lines.

### REQ-UV-029 — LRC Parsing
**WHEN** an LRC file with timestamp tags is uploaded, the system shall parse each `[MM:SS.xx]` tag to extract per-line timing and display synchronized lyrics.

### REQ-UV-030 — Plain Text Parsing
**WHEN** a plain `.txt` file is uploaded, the system shall split the content into lines, display them in order, and assign synthetic timings evenly distributed across the audio duration.

### REQ-UV-031 — Lyrics Fetching
**WHEN** no lyrics file is provided, the user may click "Search Lyrics". The system shall extract artist and title from the filename, query free lyrics APIs (Lyrics.ovh, then astrid.sh as fallback), and display the retrieved lyrics.

### REQ-UV-032 — Line Click Seeking
**WHEN** the user clicks a lyrics line during playback, the system shall seek the audio to that line's timestamp and highlight the line as active.

### REQ-UV-033 — Current Line Highlight
**WHILE** audio is playing, the system shall highlight the current lyrics line based on playback position and remove the highlight from previous lines.

---

## 7. Lyrics Editing

### REQ-UV-034 — Edit Mode Toggle
**WHEN** the user clicks the "Edit" button in the lyrics toolbar, the system shall enter edit mode, rendering each line's text and time as clickable labels.

### REQ-UV-035 — Line Text Editing
**WHEN** the user clicks a line's text label in edit mode, a popover with a text input shall appear, pre-filled with the current text. On save, the line text shall update and persist to localStorage.

### REQ-UV-036 — Line Time Editing
**WHEN** the user clicks a line's time label in edit mode, a popover with a time input (`M:SS.ms`) shall appear, pre-filled with the current time. On save, the line timing shall update and persist to localStorage.

### REQ-UV-037 — Edit Persistence
**WHEN** any edit is saved, the system shall immediately persist the updated lyrics data (text, timings, blocks, block instances) to localStorage under the key `lyrics_v1_{sessionId}`.

### REQ-UV-038 — Edit Cancel
**WHEN** the user clicks outside the popover or presses Escape while editing, the popover shall close without saving changes.

---

## 8. LRC Generation

### REQ-UV-039 — LRC Gen Mode Start
**WHEN** the user clicks "LRC Gen" in the lyrics toolbar, the system shall:
1. Parse the current lyrics into individual words.
2. Display a word-mapping interface with the first word highlighted.
3. Show "Next Word" and "Next Line" buttons in the toolbar.
4. Display progress as `{mapped}/{total} w{wordInLine}/{wordsInLine}`.

### REQ-UV-040 — Word Timing Mapping
**WHEN** the user clicks "Next Word" while audio is playing at the moment a word begins, the system shall record the current playback time as the start time for that word and advance the highlight to the next word.

### REQ-UV-041 — Line Advancement
**WHEN** all words in the current line are mapped, the system shall automatically advance to the first word of the next line.

### REQ-UV-042 — Manual Next Line
**WHEN** the user clicks "Next Line", the system shall skip any unmapped words in the current line and highlight the first word of the next line.

### REQ-UV-043 — LRC Gen Finish
**WHEN** all words are mapped or the user clicks "Finish", the system shall:
1. Generate LRC-formatted output using the recorded word timings.
2. Expand any block instances with computed timings.
3. Persist the generated LRC to localStorage.
4. Switch from gen mode back to display mode.

### REQ-UV-044 — LRC Gen Reset
**WHEN** the user clicks "Reset" during LRC generation, the system shall clear all mapped word timings and return to the first word of the first line.

### REQ-UV-045 — Gen Progress Persistence
**WHEN** the user exits LRC gen mode without finishing, the system shall persist the current mapping progress to localStorage. On re-entry, progress shall be restored.

---

## 9. Repeat Blocks

### REQ-UV-046 — Mark Blocks Mode Toggle
**WHEN** the user clicks "Mark Blocks" in the lyrics toolbar, the system shall toggle mark mode. While active, each lyrics line becomes clickable for range selection.

### REQ-UV-047 — Block Range Selection
**WHEN** the user clicks a line in mark mode, that line shall be highlighted as the selection start. When the user clicks a second line at or after the start, the range shall be highlighted and a "Mark as Block" button shall appear.

### REQ-UV-048 — Block Creation
**WHEN** the user clicks "Mark as Block" after selecting a range, a form popover shall appear with fields for block label (free text, with suggestions) and repeat count (default 1). On submit:
1. A `LyricsBlock` shall be created with a unique ID and the selected line indices as template.
2. Auto-detection shall run to find all identical text sequences in the lyrics that are not already assigned to another block.
3. The block and all detected instances shall be persisted to localStorage.

### REQ-UV-049 — Auto-Detection
**Ubiquitous:** The auto-detection algorithm shall compare the trimmed text of the template lines against every position in the lyrics, skipping lines already assigned to any block instance. Matching sequences shall be added as linked instances.

### REQ-UV-050 — Block Visualization
**Ubiquitous:** In normal (non-mark) mode, lines belonging to blocks shall display:
- A 3px colored left border (color assigned deterministically by block ID hash).
- A label badge above the first line of each instance (filled badge for template, outlined/dashed for linked instances).
- Repeat count shown on the template badge (e.g., "Chorus (x3)").
- Template instances: solid border. Linked instances: dashed border.

### REQ-UV-051 — Block-Aware LRC Gen
**WHILE** in LRC gen mode, template block instances shall render fully (all words visible for mapping). Linked block instances shall render as collapsed placeholders showing the block label and instance number.

### REQ-UV-052 — Auto-Fill Linked Instances
**WHEN** the user reaches a linked block instance whose template has been fully mapped, the system shall only require one "Next Line" tap to record the instance's start time. All word timings for that instance shall be auto-filled using relative offsets from the template's word timings.

### REQ-UV-053 — Block Instance Expansion in Output
**WHEN** LRC gen finishes, all block instances shall be expanded into the final LRC output with computed timestamps: `instanceStartTime + (templateWordTime[i] - templateBlockStartTime)`. Repeat counts shall be honored (duplicate block lines N times).

### REQ-UV-054 — Unlink Instance
**WHEN** the user hovers over a linked block instance and clicks the unlink (x) button, that instance shall be removed from the block's instances list. The lines shall revert to regular unmapped lines. This change shall persist immediately to localStorage.

### REQ-UV-055 — Edit Block
**WHEN** the user clicks a block badge (outside mark mode), an edit popover shall open allowing label text change, repeat count change, or block deletion. Deleting a block shall remove all its instances and revert all lines to unmapped.

### REQ-UV-056 — Block Persistence
**WHEN** any block-related change is made, the system shall immediately persist all blocks and block instances to localStorage as part of the lyrics data payload.

---

## 10. UVR Settings

### REQ-UV-057 — Settings Panel
**Ubiquitous:** The UVR Settings panel shall allow configuration of:
- Default processing model.
- Default output format (WAV, MP3, FLAC).
- Default stem types (vocal, instrumental).
- GPU acceleration toggle (GPU ID setting).

### REQ-UV-058 — Settings Persistence
**WHEN** settings are changed, the system shall persist them via the app-store's `createPersistedSignal` mechanism to localStorage. Settings shall be restored on page reload.

---

## 11. UVR Guide

### REQ-UV-059 — Guide Accessibility
**Ubiquitous:** A UVR Guide shall be accessible from the UVR panel header, presenting a multi-step tutorial with navigation arrows, step dots, and a progress bar.

### REQ-UV-060 — Guide Content
Each guide step shall display explanatory text and icon-based feature cards covering: What is Vocal Separation, Separation Modes, Intensity Controls, Smoothing & Transitions, When to Use Each Mode, and Quick Start Guide.

---

## 12. API Integration

### REQ-UV-061 — API Health Check
**WHEN** the UVR panel loads, the system may call `GET /api/uvr/health` to verify the UVR backend is reachable. If unavailable, an appropriate status indicator shall be shown.

### REQ-UV-062 — Stem File Retrieval
**WHEN** the system needs to load a stem audio file, it shall use `GET /api/uvr/output/{session_id}/{filename}`. The response shall be an audio blob played through the Web Audio API.

### REQ-UV-063 — Error Handling
**IF** any API call fails with a non-2xx response, **THEN** the system shall parse the error body and display it to the user. Network failures shall display a generic "Network error" message with a retry option.

---

## 13. Cross-Cutting Concerns

### REQ-UV-064 — State Isolation
**Ubiquitous:** Each UVR session shall have its own isolated state (session ID, processing status, outputs) independent of other sessions.

### REQ-UV-065 — Memory Management
**WHEN** a stem audio buffer is no longer needed (user navigates away, session deleted), the system shall release the associated `AudioBuffer` and disconnect `AudioNode` graph connections.

### REQ-UV-066 — Browser Compatibility
**Ubiquitous:** All CSS shall use syntax supported by the latest versions of Chrome, Firefox, and Safari. Functions from CSS Color Level 5 (e.g., `rgba(from var(...))`) shall not be used without a standards-compliant fallback.

### REQ-UV-067 — No Emoji in UI
**Ubiquitous:** The UVR UI shall use SVG icons from the project's icon library rather than Unicode emoji characters, for consistent rendering across platforms.

---

## 14. Mic Pitch Scoring

### REQ-UV-068 — Mic Input Activation
**WHEN** the user toggles the microphone button in the StemMixer, the system shall:
1. Request microphone access via `getUserMedia`.
2. Create a `PitchDetector` instance connected to the mic stream.
3. Display the live mic pitch as a waveform overlay on the pitch canvas.
4. Show an error message if microphone access is denied or unavailable.

### REQ-UV-069 — Pitch Comparison Collection
**WHILE** playback is active and the microphone is enabled, the system shall collect `ComparisonPoint` data at the RAF frame rate (~60fps). Each point shall record:
- `time`: elapsed playback time (seconds)
- `vocalNote`: the note from the vocal stem at that moment
- `micNote`: the note detected from the microphone
- `centsOff`: the cents deviation between mic and vocal pitch (positive = mic is sharp)
- `inTolerance`: whether the deviation is within the configured tolerance (default 50 cents)

### REQ-UV-070 — Score Computation
**WHEN** playback stops (via Stop button) while the microphone was active, the system shall compute a `MicScore` from all collected `ComparisonPoint` data. The computation shall be a pure function of the data array:

```ts
function computeScore(data: ComparisonPoint[]): MicScore
```

Grading thresholds:
- **S**: >= 95% of notes within tolerance
- **A**: >= 85%
- **B**: >= 70%
- **C**: >= 50%
- **D**: < 50%

### REQ-UV-071 — Score Display
**WHEN** a score is computed, the system shall display a score card showing:
1. Grade letter (S/A/B/C/D) with color coding.
2. Accuracy percentage.
3. Matched notes count out of total.
4. Average cents deviation.

### REQ-UV-072 — Score Reset
**WHEN** the user clicks Restart, the system shall clear all stored comparison data and hide the score card, allowing a fresh scoring session.

---

## Summary of Requirements

| ID | Category | Type | Description |
|----|----------|------|-------------|
| REQ-UV-001 | Upload | Ubiquitous | File selection via drag-and-drop and picker |
| REQ-UV-002 | Upload | Event-driven | File validation (type, size) |
| REQ-UV-003 | Upload | Event-driven | Upload progress display |
| REQ-UV-004 | Upload | Event-driven | Upload completion → config view |
| REQ-UV-005 | Process | Event-driven | Processing start with server call |
| REQ-UV-006 | Process | State-driven | Progress tracking with polling |
| REQ-UV-007 | Process | Event-driven | Completion handling |
| REQ-UV-008 | Process | Event-driven | Error display and retry |
| REQ-UV-009 | Process | Unwanted | Timeout after 10 minutes |
| REQ-UV-010 | Process | Event-driven | Polling abort on navigation |
| REQ-UV-011 | Session | Ubiquitous | History view with 3-column grid |
| REQ-UV-012 | Session | State-driven | Session card content |
| REQ-UV-013 | Session | Event-driven | Multi-stem selection → Mixer |
| REQ-UV-014 | Session | Event-driven | Session deletion with confirmation |
| REQ-UV-015 | Session | Event-driven | Delete all sessions |
| REQ-UV-016 | Session | Event-driven | Session restore on reload |
| REQ-UV-017 | Playback | Event-driven | Stem playback via Web Audio API |
| REQ-UV-018 | Playback | Ubiquitous | Per-stem volume slider |
| REQ-UV-019 | Playback | Ubiquitous | MIDI stem as sub-item |
| REQ-UV-020 | Mixer | Ubiquitous | 5-panel workspace |
| REQ-UV-021 | Mixer | Event-driven | Drag-to-reorder |
| REQ-UV-022 | Mixer | Event-driven | Panel resize |
| REQ-UV-023 | Mixer | Event-driven | Column visibility toggle |
| REQ-UV-024 | Mixer | Ubiquitous | Transport controls |
| REQ-UV-025 | Mixer | Ubiquitous | Time window and zoom |
| REQ-UV-026 | Mixer | State-driven | Waveform canvas rendering |
| REQ-UV-027 | Mixer | Ubiquitous | Pitch visualization |
| REQ-UV-028 | Lyrics | Event-driven | Lyrics file upload |
| REQ-UV-029 | Lyrics | Event-driven | LRC parsing with timestamps |
| REQ-UV-030 | Lyrics | Event-driven | Plain text parsing |
| REQ-UV-031 | Lyrics | Event-driven | Online lyrics fetching |
| REQ-UV-032 | Lyrics | Event-driven | Line click → seek |
| REQ-UV-033 | Lyrics | State-driven | Current line highlight |
| REQ-UV-034 | Lyrics | Event-driven | Edit mode toggle |
| REQ-UV-035 | Lyrics | Event-driven | Line text editing via popover |
| REQ-UV-036 | Lyrics | Event-driven | Line time editing via popover |
| REQ-UV-037 | Lyrics | Event-driven | Edit persistence to localStorage |
| REQ-UV-038 | Lyrics | Event-driven | Edit cancel on Escape/blur |
| REQ-UV-039 | LRC Gen | Event-driven | LRC gen mode start |
| REQ-UV-040 | LRC Gen | Event-driven | Word timing mapping |
| REQ-UV-041 | LRC Gen | Event-driven | Auto-advance to next line |
| REQ-UV-042 | LRC Gen | Event-driven | Manual next line skip |
| REQ-UV-043 | LRC Gen | Event-driven | LRC gen finish with output |
| REQ-UV-044 | LRC Gen | Event-driven | LRC gen reset |
| REQ-UV-045 | LRC Gen | Event-driven | Gen progress persistence |
| REQ-UV-046 | Blocks | Event-driven | Mark blocks mode toggle |
| REQ-UV-047 | Blocks | Event-driven | Block range selection |
| REQ-UV-048 | Blocks | Event-driven | Block creation with auto-detect |
| REQ-UV-049 | Blocks | Ubiquitous | Auto-detection algorithm |
| REQ-UV-050 | Blocks | Ubiquitous | Block visualization (border, badge) |
| REQ-UV-051 | Blocks | State-driven | Block-aware LRC gen rendering |
| REQ-UV-052 | Blocks | Event-driven | Auto-fill linked instances |
| REQ-UV-053 | Blocks | Event-driven | Block expansion in LRC output |
| REQ-UV-054 | Blocks | Event-driven | Unlink instance |
| REQ-UV-055 | Blocks | Event-driven | Edit block (label, count, delete) |
| REQ-UV-056 | Blocks | Event-driven | Block persistence |
| REQ-UV-057 | Settings | Ubiquitous | Settings panel configuration |
| REQ-UV-058 | Settings | Event-driven | Settings persistence |
| REQ-UV-059 | Guide | Ubiquitous | Multi-step tutorial guide |
| REQ-UV-060 | Guide | Ubiquitous | Guide content steps |
| REQ-UV-061 | API | Event-driven | Health check on load |
| REQ-UV-062 | API | Event-driven | Stem file retrieval |
| REQ-UV-063 | API | Unwanted | API error handling |
| REQ-UV-064 | Cross | Ubiquitous | Session state isolation |
| REQ-UV-065 | Cross | Event-driven | Memory management |
| REQ-UV-066 | Cross | Ubiquitous | Browser CSS compatibility |
| REQ-UV-067 | Cross | Ubiquitous | SVG icons, no emoji |
| REQ-UV-068 | Mic Score | Event-driven | Mic input activation |
| REQ-UV-069 | Mic Score | State-driven | Pitch comparison data collection |
| REQ-UV-070 | Mic Score | Event-driven | Score computation with grading |
| REQ-UV-071 | Mic Score | State-driven | Score card display |
| REQ-UV-072 | Mic Score | Event-driven | Score reset on restart |
