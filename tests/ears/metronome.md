# Metronome Specification (EARS)

## 1. PURPOSE
Define the behavior of the metronome feature in the MercuryPitch application.

## 2. SCOPE
This specification covers:
- Metronome toggle control
- Metronome sound types
- Metronome volume control
- Metronome timing accuracy
- Metronome visual feedback

## 3. DEFINITIONS

### MetronomeSound
The type of sound produced by the metronome:
- `click`: Standard metronome tick
- `click-off`: Off-beat tick
- `syncopated`: Syncopated rhythm pattern

### BeatIndicator
Visual indicator showing current beat in a measure:
- Visual bar or dot that advances with each beat
- Synced with metronome timing

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Metronome Toggle

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-TOGGLE-01 | User shall be able to toggle metronome on/off via toggle button. | High |
| MET-TOGGLE-02 | Metronome enable state shall persist across sessions. | High |
| MET-TOGGLE-03 | Toggle button shall show visual state (on/off). | High |
| MET-TOGGLE-04 | Metronome shall only sound during playback. | High |
| MET-TOGGLE-05 | When metronome is off, visual indicator shall not advance. | High |
| MET-TOGGLE-06 | Clicking metronome toggle shall immediately start/stop metronome. | High |

### 4.2 Metronome Sound Types

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-SOUND-01 | User shall be able to select metronome sound type. | Medium |
| MET-SOUND-02 | Available sound types are: click, click-off, syncopated. | Medium |
| MET-SOUND-03 | Sound selection shall persist across sessions. | Medium |
| MET-SOUND-04 | Each sound type shall have distinct auditory characteristics. | Medium |
| MET-SOUND-05 | Click-off shall sound on weaker beats. | Medium |
| MET-SOUND-06 | Syncopated shall alternate between strong and weak beats. | Medium |

### 4.3 Metronome Volume Control

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-VOL-01 | User shall be able to adjust metronome volume independently. | Medium |
| MET-VOL-02 | Metronome volume shall be separate from main volume. | Medium |
| MET-VOL-03 | Default metronome volume shall be 50%. | Medium |
| MET-VOL-04 | Volume changes shall take effect immediately. | Medium |
| MET-VOL-05 | Volume range shall be 0-100%. | Medium |

### 4.4 Metronome Timing Accuracy

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-TIME-01 | Metronome shall be synchronized with BPM setting. | High |
| MET-TIME-02 | Metronome should not drift from BPM reference. | High |
| MET-TIME-03 | Metronome shall sound at precise BPM intervals. | High |
| MET-TIME-04 | Metronome shall work correctly at all BPM ranges (40-280). | High |
| MET-TIME-05 | Count-in beats shall use metronome. | High |

### 4.5 Metronome Visual Feedback

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-VIS-01 | Visual beat indicator shall advance with metronome. | High |
| MET-VIS-02 | Indicator shall show current beat number. | High |
| MET-VIS-03 | Indicator shall be synchronized with audio. | High |
| MET-VIS-04 | When metronome is off, indicator shall not update. | Medium |
| MET-VIS-05 | Indicator should be visible during playback. | Medium |

### 4.6 Metronome During Count-in

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MET-COUNT-01 | Metronome shall sound during count-in period. | High |
| MET-COUNT-02 | Count-in beats shall use metronome timing. | High |
| MET-COUNT-03 | Metronome shall stop after count-in completes. | High |
| MET-COUNT-04 | Metronome volume in count-in shall match main volume. | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Metronome timing is accurate across all BPM values.
2. Metronome sound is clearly audible without overwhelming main audio.
3. Visual indicator is perfectly synced with audio.
4. Metronome can be toggled on/off reliably.
5. Metronome settings persist correctly.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Metronome sound generation should have <5ms latency.
- Visual update rate should be 60fps.

### 6.2 Usability
- Toggle should be easily accessible.
- Volume slider should provide clear feedback.
- Sound selection should be simple.

### 6.3 Reliability
- Metronome should never drift from BPM.
- Metronome should stop cleanly when disabled.
- Metronome should work at all valid BPM settings.

---

## 7. ASSUMPTIONS

1. Metronome uses Web Audio API for sound generation.
2. Metronome timing is based on BPM reference.
3. Count-in uses same timing as playback.
4. Metronome volume is independent of master volume.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
