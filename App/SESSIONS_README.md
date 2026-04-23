# Melody Library & Sessions — User Guide

## Overview

The Melody Library allows you to save, manage, and reuse custom melodies. Sessions let you create structured practice routines with multiple melody items.

---

## 🎵 Creating a New Melody

### Quick Create

1. **Open the Library** — Click the Library button in the sidebar (or use the "+" button in PresetSelector)
2. **Select "Melodies" tab** (if not already selected)
3. **Click "Create New Melody"**
4. **Fill in the form:**
   - **Name** — Give your melody a descriptive name
   - **BPM** — Tempo (40-280)
   - **Key** — Musical key (C, G, D, A, etc.)
   - **Scale** — Scale type (Major, Minor, Pentatonic, Blues, etc.)
   - **Tags** — Comma-separated tags for organization (e.g., "jazz, blues, beginner")
   - **Notes** — Add any notes about this melody

5. **Create the melody** — The melody is created with an empty piano roll
6. **Add notes** — Click on the piano roll to add notes, or record your voice
7. **Save** — The melody is automatically saved to your library

### Editing an Existing Melody

1. **Open Library** — Click the Library button
2. **Select the melody** you want to edit
3. **Click the Edit icon** (pencil icon)
4. **Make changes** to name, BPM, Key, Scale, Tags, or Notes
5. **Click Save** — Changes are updated in the library

### Deleting a Melody

1. **Open Library** — Click the Library button
2. **Select the melody** you want to delete
3. **Click the Delete icon** (trash icon)
4. **Confirm** the deletion

---

## 📝 Working with Melody Notes

### Manual Note Entry

- **Add a note:** Click anywhere on the piano roll to add a note
- **Remove a note:** Click the note to select it, then click the delete button
- **Edit a note:** Select a note and drag to change its position or duration

### Recording

1. **Go to Editor tab**
2. **Click Record** — A red recording button appears
3. **Speak the melody** — Your voice is captured and transcribed to notes
4. **Stop Recording** — Your recorded melody appears in the piano roll
5. **Edit as needed** — Refine timing, pitch, and duration

### Automation/Scripting

You can programmatically create melodies using the API:

```typescript
import { melodyStore } from '@/stores/melody-store'

// Create a new melody with specific settings
const newMelody = melodyStore.createNewMelody(
  'My Custom Melody',
  'MyName'
)

// Add notes programmatically
melodyStore.addMelodyNote(
  { midi: 60, name: 'C4', octave: 4, freq: 261.63 },
  0,
  0.5
)

// Update melody metadata
melodyStore.updateMelody(newMelody.id, {
  bpm: 100,
  key: 'C',
  scaleType: 'major',
  tags: ['custom', 'my-melody']
})
```

---

## 📋 Managing Playlists

### Creating a Playlist

1. **Open Library** — Click the Library button
2. **Select "Playlists" tab**
3. **Click "New Playlist"**
4. **Enter the playlist name**

### Adding Melodies to a Playlist

Playlists are managed in the Library Modal by adding melodies through the edit functions, or by creating a session that references multiple melodies.

---

## 🎯 Creating a Practice Session

### Manual Session Creation

1. **Open Session Library** — Click "Sessions" button in the toolbar
2. **Click "New Session"**
3. **Fill in session details:**
   - **Name** — Name your practice session
   - **Difficulty** — Beginner / Intermediate / Advanced
   - **Category** — Vocal / Instrumental / Ear Training / General
4. **Add items** — Select from available melodies or scales
5. **Save the session** — Your session is saved to the library

### Session Items

A session can contain:

- **Melodies** — Custom melodies from your library
- **Scales** — Scale-based practice (e.g., C Major scale patterns)
- **Rests** — Pauses between exercises

### Loading and Practicing a Session

1. **Open Session Library**
2. **Select a session** you want to practice
3. **Click Play** — The session starts
4. **Follow along** — Practice each item in sequence
5. **Results tracked** — Your accuracy and score are recorded

---

## 🔍 Searching and Filtering

### Search

- In Library Modal: Use the search box to filter melodies by name
- In Session Library: Use search to filter sessions by name or category

### Recent Melodies

The Library tab in the sidebar shows your 5 most recently played melodies for quick access.

---

## 💾 Data Storage

All data is stored locally in your browser:

- **Melody Library:** `pitchperfect_melody_library`
- **Sessions:** `pitchperfect_user_sessions`
- **Session History:** `pitchperfect_session_results`

---

## 🎹 Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Library | `Ctrl/Cmd + L` |
| Open Session Library | `Ctrl/Cmd + S` |
| Record | `R` |
| Play | `Space` |
| Pause | `P` |

---

## 🆘 Troubleshooting

**Melody not saving:**
- Ensure you have a name and at least one note
- Check browser localStorage is enabled

**Session won't load:**
- Verify session items aren't deleted
- Try re-creating the session

**Play count not incrementing:**
- The play count updates automatically when you load a melody via the Library

---

## 📚 API Reference

### MelodyStore Methods

```typescript
// Library operations
melodyStore.getAllMelodies()
melodyStore.getMelody(id)
melodyStore.getMelodyLibrary()
melodyStore.getMelodyCount()
melodyStore.getPlaylists()
melodyStore.getPlaylist(melodyKey)

// CRUD operations
melodyStore.createNewMelody(name?, author?)
melodyStore.loadMelody(id)
melodyStore.updateMelody(id, updates)
melodyStore.deleteMelody(id)
melodyStore.saveCurrentMelody(name?)

// Note operations
melodyStore.getCurrentMelody()
melodyStore.getCurrentItems()
melodyStore.addMelodyNote(note, startBeat, duration)
melodyStore.removeMelodyNote(id)
melodyStore.updateMelodyNote(id, updates)
melodyStore.setMelody(items[])

// Scale operations
melodyStore.currentScale
melodyStore.setCurrentScale(scale)
melodyStore.refreshScale(keyName, startOctave, scaleType)
melodyStore.setOctave(octave)
melodyStore.setNumOctaves(num)
melodyStore.currentOctave

// Playlist operations
melodyStore.createPlaylist(name)
melodyStore.addMelodyToPlaylist(playlistId, melodyKey)
melodyStore.removeMelodyFromPlaylist(playlistId, melodyKey)
melodyStore.deletePlaylist(playlistId)

// Session operations
melodyStore.getSessions()
melodyStore.saveSession(session)
melodyStore.updateSession(id, updates)
melodyStore.updateUserSession(session)
melodyStore.deleteSession(id)
melodyStore.getSession(id)
```

### Types

```typescript
// Melody data structure
interface MelodyData {
  id: string
  name: string
  author?: string
  bpm: number
  key: string
  scaleType: string
  octave?: number
  items: MelodyItem[]
  tags?: string[]
  notes?: string
  createdAt: number
  updatedAt: number
  playCount?: number
}

// Library structure
interface MelodyLibrary {
  meta: {
    author: string
    version: string
    lastUpdated: number
  }
  renderSettings: {
    gridlines: boolean
    showLabels: boolean
    showNumbers: boolean
    custom?: Record<string, unknown>
  }
  melodies: Record<string, MelodyData>
  playlists: Record<string, {
    name: string
    melodyKeys: string[]
    created: number
  }>
}

// Saved session
interface SavedUserSession {
  id: string
  name: string
  author: string
  items: SessionItem[]
  created: number
  lastPlayed?: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  category: 'vocal' | 'instrumental' | 'ear-training' | 'general'
}
```

---

## 🎨 Customization

### Custom Scales

Use the Custom scale builder in the sidebar to create custom scale patterns that are saved alongside your melodies.

### Render Settings

In the Melody Library, each melody can have custom render settings that affect how it's displayed (gridlines, labels, numbers).

---

**Version:** 1.0
**Last Updated:** 2026-04-23