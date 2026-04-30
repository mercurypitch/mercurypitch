# Playback Modes Specification (EARS)

## 1. PURPOSE
Define the expected behavior of three distinct playback modes: 'once', 'repeat', and 'session' (formerly 'practice') in the Pitch Perfect application.

## 2. SCOPE
This specification covers:
- Playback mode selection and switching
- Playback execution for each mode
- Session item sequencing
- Cycle/iteration handling
- Completion handling for each mode

## 3. DEFINITIONS

### PlaybackMode
The enum value representing the current playback mode:
- `once`: Single-playback of a melody
- `repeat`: Repeated playback of a melody N times
- `session`: Sequential playback of multiple session items

### SessionItem
A unit of work in session mode, can be:
- `scale`: A scale to play (e.g., "C Major Scale")
- `rest`: A pause/rest period
- `preset`: A pre-defined melody from the library
- `melody`: A user-created melody from the library

### Cycle
A single iteration of playback in repeat mode, or a single item in session mode.

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Mode Selection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-PLAYBACK-01 | User shall be able to switch between 'once', 'repeat', and 'session' modes using the mode buttons in PracticeTabHeader. | High |
| PR-PLAYBACK-02 | 'once' mode shall play the current melody exactly once from start to finish. | High |
| PR-PLAYBACK-03 | 'repeat' mode shall play the current melody the specified number of times (default 5, range 1-20). | High |
| PR-PLAYBACK-04 | 'session' mode (formerly 'practice') shall playback a sequence of SessionItems defined in the current practice session. | High |
| PR-PLAYBACK-05 | The active mode button shall visually indicate which mode is currently selected. | High |

### 4.2 Once Mode Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-ONCE-01 | In 'once' mode, playback shall start with the first note of the melody. | High |
| PR-ONCE-02 | In 'once' mode, playback shall continue through all notes until the last note completes. | High |
| PR-ONCE-03 | In 'once' mode, playback shall not repeat after completion. | High |
| PR-ONCE-04 | In 'once' mode, completion shall trigger the `onComplete` handler once. | High |
| PR-ONCE-05 | The cycle counter display shall be empty (hidden) in 'once' mode. | Medium |

### 4.3 Repeat Mode Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-REP-01 | In 'repeat' mode, playback shall start with the first note of the melody. | High |
| PR-REP-02 | In 'repeat' mode, playback shall complete the full melody and then restart from the beginning. | High |
| PR-REP-03 | In 'repeat' mode, playback shall repeat N times as configured by the cycles input. | High |
| PR-REP-04 | In 'repeat' mode, the cycle counter shall display "↻" to indicate repeat mode. | Medium |
| PR-REP-05 | In 'repeat' mode, after N cycles complete, playback shall stop. | High |
| PR-REP-06 | In 'repeat' mode, completion events shall fire after each cycle completes. | High |
| PR-REP-07 | In 'repeat' mode, the final completion event shall be the Nth cycle completion. | High |

### 4.4 Session Mode Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-SES-01 | In 'session' mode, playback shall start with the first SessionItem in the practice session. | High |
| PR-SES-02 | Each SessionItem is played in sequence (first item, then second, etc.). | High |
| PR-SES-03 | After completing a SessionItem, playback shall immediately proceed to the next item. | High |
| PR-SES-04 | Completion of all SessionItems shall end the session. | High |
| PR-SES-05 | The cycle counter shall display "C{current}/{total}" to show item progression. | Medium |
| PR-SES-06 | SessionItems of type 'rest' shall insert a pause before the next item starts. | High |
| PR-SES-07 | SessionItems of type 'preset' or 'melody' shall load the specified melody for playback. | High |
| PR-SES-08 | SessionItems of type 'scale' shall generate a scale melody based on the scale type and beats. | High |
| PR-SES-09 | Session completion shall record results and show a summary. | High |
| PR-SES-10 | Session results shall include score, items completed, and name. | Medium |
| PR-SES-11 | The "Session mode" button in PracticeTabHeader shall be used to select this mode. | Medium |

### 4.5 Mode-Independent Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-COMMON-01 | All modes shall respect the same BPM setting. | High |
| PR-COMMON-02 | All modes shall respect the same count-in setting. | High |
| PR-COMMON-03 | All modes shall respect the same metronome setting. | High |
| PR-COMMON-04 | All modes shall respect the same volume setting. | High |
| PR-COMMON-05 | All modes shall respect the same note filtering options when mic is active. | Medium |
| PR-COMMON-06 | All modes shall support the same recording to piano roll functionality. | Medium |

### 4.6 Lifecycle State Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PR-LIFE-01 | Playback state (isPlaying, isPaused) shall be shared across all modes. | High |
| PR-LIFE-02 | The `onComplete` handler shall route to different logic based on current mode. | High |
| PR-LIFE-03 | Stopping playback shall reset all mode-specific state appropriately. | High |
| PR-LIFE-04 | Pausing playback shall pause audio and stop note playback but maintain state. | High |
| PR-LIFE-05 | Resuming playback shall continue from the paused point. | High |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can select 'once', 'repeat', and 'session' modes and see the correct behavior.
2. Each mode behaves independently without interfering with others.
3. Cycle counting is accurate for both repeat and session modes.
4. Completion handling is correct for all modes.
5. Session results are properly recorded and displayed.
6. UI updates correctly based on the selected mode.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- No more than 16ms latency between user action and audio playback start.
- State transitions between modes should complete within 50ms.

### 6.2 Usability
- Mode selection must be visually distinct (active button style).
- Cycle counter must be prominent and legible.

### 6.3 Reliability
- Playback must not skip notes or repeat prematurely.
- Session completion must handle edge cases (empty sessions, single-item sessions).

---

## 7. ASSUMPTIONS

1. The current melody in 'once' and 'repeat' modes is the melody defined in the MelodyEditor.
2. Session mode uses a session defined in the SessionLibraryModal.
3. BPM applies uniformly across all modes.
4. Recording to piano roll is available in all modes.
5. Focus mode works independently of playback mode.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
