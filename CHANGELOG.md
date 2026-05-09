# Changelog

All notable changes to this project will be documented in this file.

## [v0.2.0]
### Features
- Implement basic piano practice mode with black key visual feedback
- Integrate UVR (Ultimate Vocal Remover) for audio separation
- Integrate SwiftF0 for pitch detection improvements
- Add developer console log component
- Add changelog modal with "What's New" button
- Add score modal optional setting
- Optimize piano-roll move loop for better performance

### Fixes
- Fix BPM safe setter and audio timing at keyboard
- Fix dropdown reactivity and visual visibility for judged notes
- Fix whiteIndexToMidi octave offset
- Fix serving of ONNX Runtime WASM backend and dev mode MIME type
- Fix memory leak in useSessionSequencer (setTimeout cleanup)
- Fix Safari error handling
- Resolve silent errors and remove dead code
- Fix metronome icon alignment and remove duplicate divider

## [v0.1.2]
### Features
- Add perfect pitch deviance presets
- Add McLeod pitch detection algorithm and settings
- Redesign the note and accuracy score displays

### Fixes
- Fix Yin algorithm failure when McLeod is set to 4K buffer size
- Fix playback and stop behavior on ESC key
- Fix session play issues and sequence REST getting stuck
- Fix per-note accuracy percentage display
- Update and fix UI styles for dropdowns, sidebar, and header

## [v0.1.1]
### Features
- Initial PitchPerfect voice practice application release
- Extend BPM range to 280
- Organize sidebar notes by melody and add accuracy color-coding
- Support 1-3 octaves in piano roll based on available vertical space
- Implement multi-select and vocal technique effects
- Scrollable playhead with drag-to-seek and timeline
- Add shareable preset URLs and scale modes
- Add instrument sounds (piano, organ, strings, synth)
- Add Settings tab with configurable pitch detection parameters and adjustable accuracy bands
- Playhead drag resumes from position with audio effects (vibrato LFO, slides, ease)
- Sync layout, instrument sounds, octave/rows/mode controls, and effects
- Add pitch track canvas overlay on piano roll editor
- Add pitch accuracy heatmap to piano roll
- Add copy/cut/paste notes for piano roll editor
- Add snap-to-grid toggle for piano roll editor
- Add dark/light theme toggle with localStorage persistence
- Extract AppHeader and AppSidebar for shared layout shell
- Add playback speed control

### Fixes
- Fix default melody initialization in piano roll editor
- Clip pitch trail to visible canvas area during auto-scroll
- Fix z-index layering so grid stacks correctly and piano keys are positioned properly
- Apply saved volume and default volume on app start
- Stretch piano roll to fill viewport width and synchronize playhead triangle with grid line
- Reset playhead to beat 0 on Reset to fix playhead getting stuck
- Initialize audioCtx to fix editor playback having no sound
- Prevent flash of unstyled content on load
- Fix preset system saves, loading scale data, and reactivity
