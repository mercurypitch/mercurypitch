# Recording to Piano Roll Specification (EARS)

## 1. PURPOSE
Define the behavior for recording user-input melodies directly to the piano roll canvas.

## 2. SCOPE
This specification covers:
- Recording activation and deactivation
- Note input via keyboard/mic
- Recording playback
- Note visualization
- Recording playback controls

## 3. DEFINITIONS

### NoteInputType
The method for inputting notes:
- `keyboard`: Notes entered via computer keyboard
- `mic`: Notes detected via microphone pitch tracking

### RecordedNote
A note added via recording, containing:
- `frequency`: Note frequency
- `startTime`: When note began
- `duration`: How long note played
- `velocity`: Note intensity (0-1)
- `pitchIndex`: Index in the current scale

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Recording Activation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-START-01 | User shall be able to start recording via record button. | High |
| REC-START-02 | Recording state shall be persisted across sessions. | High |
| REC-START-03 | Record button shall show visual state (recording indicator). | High |
| REC-START-04 | Recording indicator shall be red when active. | High |
| REC-START-05 | Only one recording session shall be active at a time. | Medium |
| REC-START-06 | Starting new recording shall end previous recording. | Medium |

### 4.2 Note Input Methods

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-KB-01 | User shall be able to input notes via keyboard keys. | High |
| REC-KB-02 | Keyboard shall correspond to scale notes. | High |
| REC-KB-03 | Pressing key shall start note playback. | High |
| REC-KB-04 | Releasing key shall end note playback. | High |
| REC-KB-05 | Keyboard shortcuts shall be displayed on piano roll. | Medium |
| REC-MIC-01 | User shall be able to input notes via microphone pitch detection. | High |
| REC-MIC-02 | Microphone shall capture pitch of sung or hummed notes. | High |
| REC-MIC-03 | Detected notes shall be synchronized with recording. | High |
| REC-MIC-04 | Mic threshold shall be adjustable. | Medium |
| REC-MIC-05 | Mic input shall use selected instrument sound. | Medium |

### 4.3 Recording Playback

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-PLAY-01 | Recorded notes shall play back during playback. | High |
| REC-PLAY-02 | Playback shall use selected instrument. | High |
| REC-PLAY-03 | Playback shall respect BPM setting. | High |
| REC-PLAY-04 | Recorded notes shall be visible in piano roll during playback. | High |
| REC-PLAY-05 | Recording may be stopped, paused, or continued. | High |

### 4.4 Note Visualization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-VIS-01 | Recorded notes shall appear on piano roll as colored blocks. | High |
| REC-VIS-02 | Notes shall be synchronized with timeline. | High |
| REC-VIS-03 | Note boundaries shall be clearly visible. | High |
| REC-VIS-04 | Note velocity shall affect note brightness. | Medium |
| REC-VIS-05 | New notes shall be marked as "unlabeled" until named. | Medium |

### 4.5 Recording Controls

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-CTRL-01 | Recording shall be stoppable via stop button. | High |
| REC-CTRL-02 | Stopping shall end current note if playing. | High |
| REC-CTRL-03 | Recording shall be pausable via pause button. | High |
| REC-CTRL-04 | Pausing shall pause audio but preserve recording. | High |
| REC-CTRL-05 | Paused recording may be resumed via continue button. | High |
| REC-CTRL-06 | Stopping playback shall not delete recorded notes. | High |

### 4.6 Recording Persistence

| Requirement | Description | Priority |
|-------------|-------------|----------|
| REC-PERS-01 | Recorded notes shall persist across sessions. | High |
| REC-PERS-02 | Recorded notes may be saved as new melodies. | High |
| REC-PERS-03 | Unsaved recordings may be lost on page reload. | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can record melodies via keyboard or microphone.
2. Recorded notes are correctly visualized in the piano roll.
3. Recorded playback matches input timing.
4. Recording controls work reliably (start, stop, pause, continue).
5. Recorded notes persist correctly.
6. Microphone pitch detection works accurately.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Note input latency should be <50ms.
- Note visualization update rate should be 60fps.
- Microphone pitch detection should have <100ms latency.

### 6.2 Usability
- Keyboard shortcuts should be intuitive.
- Mic detection should adapt to background noise.
- Visual feedback should clearly indicate recording state.

### 6.3 Reliability
- Keyboard input should not create ghost notes.
- Mic detection should not produce false positives.
- Recording should not interfere with playback.

---

## 7. ASSUMPTIONS

1. Recording uses Web Audio API for sound generation.
2. Microphone access requires browser permissions.
3. Keyboard input is mapped to scale notes.
4. Notes are normalized to the selected scale.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
