# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.5] - 2026-05-19

### Added

- **Jam Session -- Session Persistence**: room ID and display name stored in `sessionStorage`; page reloads auto-rejoin the same room
- **Jam Session -- Server-side Host Tracking**: `ownerName` persisted in Durable Object `ctx.storage`; reconnecting with the original display name restores host privileges
- **Jam Session -- Activity Scoreboard**: per-user scoreboard overlay on the exercise canvas showing exercise name, timestamp, and individual accuracy badges
- **Jam Session -- Exercise History Persistence**: completed exercise scores survive page reloads via `sessionStorage`
- **Voice Type Detector**: vocal range analysis modal for determining singer classification (soprano, alto, tenor, bass)
- **Vocal Range Presets**: predefined singing range presets that auto-configure default octave and exercise selection
- **Mobile UI**: Drawer-based navigation for mobile devices and compact icon-only control toolbar

### Changed

- **Jam Session -- Default Camera Off**: video disabled by default to reduce WebRTC handshake latency on room join
- **Jam Session -- Random Codenames**: users who join without a display name receive a thematic one-word codename
- **Jam Session -- Camera Widget**: repositioned to bottom-right horizontal row layout alongside chat widget
- **Jam Session -- Signaling Protocol**: `room-created` and `room-joined` messages now include `isHost` flag from the server
- **Jam Session -- Badges**: Added beautiful glowing pill badges for peers next to the room title
- **Compose Tab**: removed melody count badge for cleaner, consistent navigation
- **Jam Panel**: replaced inspirational quote branding; cleaned up display name input UI

### Fixed

- **Jam Session**: WebRTC video stream renegotiation to ensure camera streams connect reliably
- **Jam Session**: Fixed "Cam off" state sync when joining a room by broadcasting video state over the WebRTC datachannel
- **Jam Session**: Prevented remote audio source duplication causing volume overlap
- **StemMixer Lyrics**: Prevented auto-loading incorrect lyrics for generic filenames; close picker after manual upload
- **UI**: Visual improvements to UVR Guide modal and restored fancy gradient divider in sidebar
- **Shazam**: processing spinner and error state display on stop/match flow
- **Shazam**: melody matching algorithm accuracy improvements
- **Pitch Canvas**: scroll mode rendering after CSS module refactor
- **Durable Object Hibernation**: `ownerName` lost after DO eviction -- now persisted in `ctx.storage`
- **UI / Mobile Layout**: Resolved overly large toolbar buttons by implementing strict CSS modules for consistent `.ctrlBtn` sizing across all controls
- **UI / Header**: Fixed mobile responsive navigation layout to properly wrap onto two compact rows instead of creating extra vertical space
- **UI / Sidebar**: Fixed missing "Expand sidebar" arrow button when sidebar is collapsed by removing a conflicting global rule and scoping CSS modules correctly
- **E2E Test**: removed assertion on deleted `.tab-badge` element

## [0.3.4] - 2026-05-19

### Added

- **Shazam Sing**: Real-time microphone listening for audio fingerprinting and identifying songs
- Speech Recognition real-time feedback in ShazamListen component
- E2E Test configuration allowing dynamic playwright timeouts via `.env.local`

### Changed

- Massive CSS Modules Refactoring (`.module.css`): transitioned global CSS legacy styles into isolated component-level styles
- Rebased branch workflow to perfectly stabilize features into main branch

### Fixed

- Playwright UI test suite timeout failures resulting from CSS module class hashing (fixed 100+ failing tests)
- Missing Walkthrough Tour markdown styles (restored correct kebab-case mapping for `:global()` classes)
- Pause and Stop button interaction desyncs in transport controls and test environments
- Playhead teleportation, starting position bugs, and audio quality scrub issues
- Dynamic vs static import Vite build warnings for `uvr-service` and Shazam components

## [0.3.3] - 2026-05-17

### Added

- **Jam Session (new feature)**: real-time P2P music practice rooms powered by WebRTC and a Cloudflare Worker signaling server
  - Create or join a room via room code; shareable `#/jam:ROOMID` deep links auto-join on load
  - Shared melody exercise canvas with scrolling piano-roll, peer pitch trails, and a live scoreboard
  - Live pitch monitor strip showing all participants' pitch over time with per-peer color coding
  - Video and audio streaming with per-peer camera thumbnails (expandable, draggable tray)
  - In-room text chat widget
  - Host transport controls: Play, Pause, Resume, Stop, Loop, exercise picker, and live BPM override
  - TURN server support for NAT traversal
  - Auto-preloads first melody when room becomes active
- **Vocal Analysis**: offline pitch tracking panel with denoised pitch data and a toggleable offline/real-time mode
- **Practice Mode**: click-to-play and trill feature (GH #230)
- **StemMixer**: fully modularized — main component reduced from 8,500 to 776 lines via 5 controllers and 5 sub-components

### Fixed

- **LRC / Lyrics**: canonical line ordering mismatches causing incorrect active-line tracking, LRC download timings, and lyric-click seeking
- **LRC / Lyrics**: per-word timing interpolation regex and `parseLrcWordTimings` integration fixed
- **MIDI Synthesis**: progress stall at 100% — added yielding loop to `synthesizeMidiBuffer` to avoid UI hang
- **Piano Roll**: drag/move behavior corrected
- **Pitch Debug Panel**: missing CSS causing layout collapse

### Changed

- Default workspace layout is now fixed 2-column
- StemMixer SolidJS reactivity warnings resolved across all controllers

## [0.3.2] - 2026-05-15

### Added

- Precount and Anchor Tone toggles directly inside the Focus Mode toolbar
- Dynamic negative-space runway rendering in PitchCanvas to visually support count-in phases

### Fixed

- Focus Mode playhead tracking sync and trajectory easing during count-in
- "Teleport-back" physics glitches in PitchCanvas ball animation
- Desynchronization of Focus Mode playhead speed when increasing melody size beyond screen constraints
- Double playhead rendering bug in Focus Mode by fully deferring to the standard PitchCanvas playhead
- Merge conflicts and duplicate unused logic in the StemMixer Lyrics controller

## [0.3.1] - 2026-05-13

### Fixed

- Piano practice precount synchronization and "teleporting" notes effect
- Analysis tab UI layout collapse and component shrinking
- Karaoke tab WAV file upload validation across different browsers
- Vocal separator state persistence and worker re-initialization during tab navigation
- E2E test reliability by switching to hash-based navigation
- Various lint and typecheck errors across the codebase

### Changed

- Production deployments now trigger only on git tags (`v*`) instead of every push to main
- Optimized vocal separator recovery after cancellation to avoid model reloads

## [0.3.0] - 2026-05-11

### Added

- Database abstraction layer for persistent storage using Dexie.js
- Dexie-based stem persistence for UVR results, ensuring separated audio survives page reloads
- Support for WASM-based ONNX inference as fallback for Firefox (WebGPU compatibility)
- Local browser-side processing mode as the default for UVR separation

### Fixed

- Lyric service stability and fallback handling for missing data
- Vocal stem instrumental bleed in client-side UVR using STFT-domain subtraction
- Audio playback issues in stem mixer when switching sessions
- Mic sensitivity option persistence in settings
- Playwright E2E test reliability and GitHub Actions workflow configuration
- Unit test failure for UVR session status display

### Changed

- Redesigned UVR user interface with better processing status indicators and progress bars
- Improved stem mixer MIDI integration for practice sessions
- Optimized local UVR processing pipeline for better performance

## [0.2.0] - 2026-05-09

### Added

- Basic piano practice mode with black key visual feedback
- UVR (Ultimate Vocal Remover) integration for audio separation
- SwiftF0 integration for pitch detection improvements
- Developer console log component
- Changelog modal with "What's New" button
- Score modal optional setting

### Changed

- Optimized piano-roll move loop for better performance

### Fixed

- BPM safe setter and audio timing at keyboard
- Dropdown reactivity and visual visibility for judged notes
- whiteIndexToMidi octave offset
- Serving of ONNX Runtime WASM backend and dev mode MIME type
- Memory leak in useSessionSequencer (setTimeout cleanup)
- Safari error handling
- Silent errors and removed dead code
- Metronome icon alignment and duplicate divider removed

## [0.1.2] - 2026-05-06

### Added

- Perfect pitch deviance presets
- McLeod pitch detection algorithm and settings

### Changed

- Redesigned the note and accuracy score displays

### Fixed

- Yin algorithm failure when McLeod is set to 4K buffer size
- Playback and stop behavior on ESC key
- Session play issues and sequence REST getting stuck
- Per-note accuracy percentage display
- UI styles for dropdowns, sidebar, and header

## [0.1.1] - 2026-05-03

### Added

- Initial MercuryPitch voice practice application release
- Extend BPM range to 280
- Organize sidebar notes by melody and add accuracy color-coding
- Support 1-3 octaves in piano roll based on available vertical space
- Multi-select and vocal technique effects
- Scrollable playhead with drag-to-seek and timeline
- Shareable preset URLs and scale modes
- Instrument sounds (piano, organ, strings, synth)
- Settings tab with configurable pitch detection parameters and adjustable accuracy bands
- Pitch track canvas overlay on piano roll editor
- Pitch accuracy heatmap to piano roll
- Copy/cut/paste notes for piano roll editor
- Snap-to-grid toggle for piano roll editor
- Dark/light theme toggle with localStorage persistence
- Playback speed control

### Changed

- Playhead drag resumes from position with audio effects (vibrato LFO, slides, ease)
- Sync layout, instrument sounds, octave/rows/mode controls, and effects
- Extract AppHeader and AppSidebar for shared layout shell

### Fixed

- Default melody initialization in piano roll editor
- Clip pitch trail to visible canvas area during auto-scroll
- z-index layering so grid stacks correctly and piano keys are positioned properly
- Apply saved volume and default volume on app start
- Stretch piano roll to fill viewport width and synchronize playhead triangle with grid line
- Reset playhead to beat 0 on Reset to fix playhead getting stuck
- Initialize audioCtx to fix editor playback having no sound
- Prevent flash of unstyled content on load
- Preset system saves, loading scale data, and reactivity
