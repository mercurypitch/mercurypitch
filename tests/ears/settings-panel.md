# Settings Panel Specification (EARS)

## 1. PURPOSE
Define the behavior for user preferences and configuration settings in the Settings panel.

## 2. SCOPE
This specification covers:
- Theme switching (dark/light mode)
- BPM settings
- Metronome settings
- Volume control
- Instrument selection
- Count-in settings
- User profile settings
- Reset functionality

## 3. DEFINITIONS

### ThemeMode
The UI appearance theme:
- `dark`: Dark background with light text
- `light`: Light background with dark text

### CountInOption
Count-in beat options for playback:
- `0`: No count-in
- `1`: 1-beat count-in
- `2`: 2-beat count-in
- `4`: 4-beat count-in

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Theme Switching

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-THEME-01 | User shall be able to switch between dark and light themes. | High |
| SET-THEME-02 | Theme selection shall persist across browser sessions. | High |
| SET-THEME-03 | Theme switch shall immediately update UI appearance. | High |
| SET-THEME-04 | Dark theme shall be the default on first load. | High |
| SET-THEME-05 | Theme preference shall be saved to localStorage. | High |
| SET-THEME-06 | Theme change shall trigger theme update event. | Medium |

### 4.2 BPM Settings

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-BPM-01 | User shall be able to set BPM value (40-280 range). | High |
| SET-BPM-02 | Default BPM shall be 120. | High |
| SET-BPM-03 | BPM setting shall persist across sessions. | High |
| SET-BPM-04 | BPM slider shall allow 1-unit increments. | High |
| SET-BPM-05 | BPM input field shall accept numeric values. | High |
| SET-BPM-06 | BPM changes shall affect all playback immediately. | High |
| SET-BPM-07 | Invalid BPM values (outside range) shall be clamped or rejected. | Medium |

### 4.3 Metronome Settings

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-METRO-01 | User shall be able to toggle metronome on/off. | High |
| SET-METRO-02 | Metronome enable state shall persist across sessions. | High |
| SET-METRO-03 | Metronome sound type shall be selectable (click, click-off, syncopated). | Medium |
| SET-METRO-04 | Metronome volume shall be adjustable (0-100%). | Medium |
| SET-METRO-05 | Metronome shall sound at BPM intervals during playback. | High |

### 4.4 Volume Control

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-VOL-01 | User shall be able to adjust global volume (0-100%). | High |
| SET-VOL-02 | Default volume shall be 80%. | Medium |
| SET-VOL-03 | Volume setting shall persist across sessions. | High |
| SET-VOL-04 | Volume slider shall provide visual feedback of current value. | Medium |
| SET-VOL-05 | Volume changes shall affect all audio output immediately. | High |

### 4.5 Instrument Selection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-INST-01 | User shall be able to select playback instrument (sine, piano, organ, strings, synth). | High |
| SET-INST-02 | Default instrument shall be 'sine'. | High |
| SET-INST-03 | Instrument selection shall persist across sessions. | High |
| SET-INST-04 | Each instrument shall have distinct audio characteristics. | Medium |
| SET-INST-05 | Instrument changes shall affect current playback immediately. | High |

### 4.6 Count-in Settings

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-CONT-01 | User shall be able to select count-in beats (0, 1, 2, 4). | High |
| SET-CONT-02 | Default count-in shall be 0 (no count-in). | High |
| SET-CONT-03 | Count-in setting shall affect all playback modes. | High |
| SET-CONT-04 | Count-in count shall be displayed during playback. | Medium |
| SET-CONT-05 | Metronome shall sound during count-in period. | High |

### 4.7 User Profile Settings

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-USER-01 | User name shall be editable in settings. | Medium |
| SET-USER-02 | User name shall be required for author attribution. | Medium |
| SET-USER-03 | User changes shall persist in localStorage. | Medium |
| SET-USER-04 | User name changes shall apply to new melodies created. | Medium |

### 4.8 Reset Functionality

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SET-RES-01 | Reset button shall clear all settings to defaults. | High |
| SET-RES-02 | Reset operation shall require confirmation dialog. | High |
| SET-RES-03 | Confirming reset shall restore all settings to defaults. | High |
| SET-RES-04 | Cancelling reset shall not apply changes. | High |
| SET-RES-05 | Reset shall restore theme to dark by default. | High |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can easily switch between themes with immediate visual feedback.
2. BPM changes are reflected immediately in playback.
3. Metronome settings work correctly during playback.
4. All settings persist across browser sessions.
5. Reset functionality provides clear confirmation and restores defaults.
6. Volume control is responsive and immediately affects audio.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Settings tab switching should complete within 100ms.
- All settings changes should reflect immediately (no latency > 16ms).

### 6.2 Usability
- BPM slider should have smooth interaction.
- Volume control should provide visual feedback.
- Theme switch should animate smoothly.
- All settings should be clearly labeled.

### 6.3 Reliability
- Settings persistence should work reliably across sessions.
- Invalid values should be handled gracefully.
- Reset should not cause data corruption.

---

## 7. ASSUMPTIONS

1. Settings are stored in localStorage and persist between sessions.
2. Instrument choices are limited to the defined enum values.
3. BPM range is limited to 40-280 based on safe audio parameters.
4. Count-in options are limited to 0, 1, 2, and 4 beats.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
