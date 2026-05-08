# Changelog

All notable changes to PitchPerfect will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.3] — 2026-04-20

### Added
- Vite-based build pipeline with pnpm workspace support
- McLeod pitch detection algorithm option alongside YIN
- Pitch buffer size presets (256, 512, 1024, 2048, 4096) with descriptions
- Score popup optional visibility setting
- Perfect pitch deviance presets for accuracy bands

### Changed
- White/light theme restyled across dropdowns and controls
- Sidebar header redesigned for cleaner layout
- Note and accuracy score display redesigned
- Crash modal updated with improved UI

### Fixed
- Safari error handling for audio context
- YIN pitch detection when using 4K buffer size
- Various style consistency issues

## [0.1.2] — 2026-03-15

### Added
- Vocal separation (UVR) panel with upload and processing UI
- Yousician-style ball physics visualization for pitch tracking
- Community leaderboard for sharing practice results
- Vocal analysis and challenges modules
- Practice result popup with score overlay
- App error boundary with crash modal dialog
- Walkthrough tour system for onboarding

### Changed
- Piano roll canvas with improved rendering
- Session editor timeline refinements
- Transport controls unified and simplified

### Fixed
- Session sequence advance after rest notes
- Per-note accuracy percentage display
- Focus mode vertical playhead and pitch dot animation
- Release envelope on stopTone for smooth note transitions

## [0.1.1] — 2026-02-01

### Added
- Real-time pitch detection with YIN algorithm
- Piano roll editor for composing melodies
- Practice mode with accuracy tracking
- Session recording and playback
- MIDI import functionality
- Metronome with adjustable BPM
- Focus mode for distraction-free practice
- Welcome screen with tour introduction

### Changed
- TypeScript and SolidJS migration from vanilla JS
- Settings panel refactored with sections layout

### Fixed
- Audio engine initialization on mobile browsers
- Preset modal scale note playback
- Playback resume after pause edge cases

## [0.1.0] — 2025-12-10

### Added
- Initial release of PitchPerfect
- Basic pitch detection via microphone
- Simple melody playback engine
- Dark theme interface
- Session history storage
