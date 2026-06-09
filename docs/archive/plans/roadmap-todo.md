# MercuryPitch — Roadmap / TODO

## Completed Recently

- [x] Polyphonic playback (multiple simultaneous notes)
- [x] Copy/paste notes in piano roll
- [x] Grid playhead scrubbing
- [x] Chord effect type — full stack (types, UI, audio engine, WAV export, Singing tab viz)
- [x] Tremolo, trill, staccato effects
- [x] Singing tab chord visualization (green blocks, chord dots, abbreviated labels)

## In Progress

- [ ] **Shareable URLs** — base64-encode melodies, exercises, and daily routines into URLs that auto-load on open. Branch: `feat/sharing-url-encode`

## Upcoming

### Sharing & Collaboration
- [ ] Share daily routines via URL (full voice routine link)
- [ ] Share exercises via URL
- [ ] Consume shared links — route handler for `#/share?type=...&id=...`
- [ ] "Copy share link" UX polish (toast notifications, shortened URLs)
- [ ] Public vs private sharing toggle
- [ ] Server-backed sharing (future — currently all local)

### Playback UX
- [ ] Loop points (A/B repeat in piano roll)
- [ ] Metronome with configurable sound/volume
- [ ] Tempo tap
- [ ] Playback speed control (0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x)
- [ ] Count-in before playback

### Melody Library
- [ ] Rename melodies
- [ ] Duplicate melodies
- [ ] Reorder melodies in library
- [ ] Folders / grouping for organization
- [ ] Search / filter by name, key, tags
- [ ] Bulk delete

### Export
- [ ] Stem export (individual tracks)
- [ ] Volume normalization on export
- [ ] MP3 export (currently WAV only)
- [ ] OGG export
- [ ] Export with effects baked in

### Undo/Redo
- [ ] Edge case testing for polyphonic notes
- [ ] Visual undo/redo history preview
- [ ] Keyboard shortcut hints in toolbar

### Performance
- [ ] Canvas rendering optimization for large melodies
- [ ] Audio engine CPU/memory profiling
- [ ] Virtual scrolling for melody list
- [ ] Lazy-load heavy components

### Mobile / Tablet
- [ ] Touch input for piano roll (note placement, selection, drag)
- [ ] Touch input for pitch canvas
- [ ] Responsive toolbar layout
- [ ] Portrait/landscape orientation handling
- [ ] On-screen keyboard for note input

### Community (longer-term)
- [ ] Community-shared melody browser (consume links from other users)
- [ ] Leaderboard integration with shared scores
- [ ] Weekly challenge automation
- [ ] User profiles with avatar
