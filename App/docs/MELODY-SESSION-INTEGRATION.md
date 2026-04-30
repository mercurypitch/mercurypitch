# Melody-Session Integration Plan

## Core Concept

**Session = Playlist of Melody IDs**

A session is a named collection (playlist) of melodies. The session holds references to melodies by ID — editing a melody immediately updates it everywhere it appears.

```
┌──────────────────────────────────────────────────────┐
│ Sessions                                              │
│                                                       │
│  [Default] ──────♩ G Major Scale (1 octave)           │
│  [My Session]──♪ My Cool Melody  ♩ C Major           │
│                ─♪ Another Tune   ♩ Chromatic         │
└──────────────────────────────────────────────────────┘
```

## Core Data Model

```typescript
// Session = playlist of melody IDs
interface UserSession {
  id: string
  name: string
  melodyIds: string[]           // Ordered list of melody references
  created: number
  lastPlayed?: number
  difficulty?: SessionDifficulty
  category?: SessionCategory
}

// Melody = stored in MelodyLibrary (unchanged)
interface MelodyData {
  id: string
  name: string
  bpm: number
  key: string
  scaleType: string             // 'major', 'minor', etc.
  items: MelodyItem[]
  createdAt: number
  updatedAt: number
  // ...
}
```

## Default Session

Pre-loaded on first launch, expandable:

```typescript
const DEFAULT_SESSION: UserSession = {
  id: 'default',
  name: 'Default',
  melodyIds: [
    'scale-major-c4',           // Pre-built major scale melody
    'scale-chromatic-c4',       // Pre-built chromatic scale
  ],
  created: 0,
}
```

These "scale" melodies are regular melodies with `scaleType` field set.

## User Interaction Modes

### 1. Browse / Select Mode (Default)

- Session pills are **selectable** (single or multi-select)
- **Click pill** → loads that melody into editor/playback, waits for user interaction
- Practice mode (once/repeat) determines what happens after user hits play
- No auto-playback of the session

### 2. Play Mode

- User selects one or more melodies (or "Play All")
- Click **Play** → plays selected melodies in order
- After each melody: next selected melody or end
- Practice mode determines repeat behavior

## User Flows

### Flow 1: Create Melody → Add to Session

```
Editor → Save Melody
         │
         ├─→ "Save" (default)
         │    Melody saved to library
         │
         └─→ "Save & Add to Session"
              │
              ├─→ "Current Session" (if one is selected)
              │    Adds melody ID to active session.melodyIds
              │
              └─→ Session Picker
                   [Default ▼] [My Favorites ▼] [+ New]
                   [Confirm]
```

### Flow 2: Select Session → Work with Melodies

```
Sessions Tab → Select "My Custom Session"
              │
              ├─→ Shows list of melodies as pills in sidebar
              │    ♩ G Major  ♪ My Cool  ♪ Another  ♩ Chromatic
              │
              ├─→ Click pill → loads into editor, awaits user input
              │
              ├─→ Multi-select: Ctrl+click pills (or "Select All")
              │    → Selected pills highlighted
              │    → "Play Selected" button enabled
              │
              └─→ "Add Melody" / "Add Scale" buttons
                   ├─→ "New Melody" → Editor → save → auto-add
                   └─→ "Existing" → Picker → adds ID
```

### Flow 3: Play Selected Melodies

```
Select session → Select pills (or "Play All")
                │
                Click "Play Selected" / "Play All"
                │
                ├─→ Playback loads each selected melody in order
                ├─→ After melody completes → next selected melody
                ├─→ After all → show session summary
                │
                └─→ Practice mode (once/repeat) applies per melody
                     - once: play once
                     - repeat: loop current melody
                     - practice: pitch detection + scoring
```

### Flow 4: Quick-Scale Generation

```
Session → "Add Scale" button
          │
          ├─→ Scale Type: [Major ▼] [Minor ▼] [Chromatic ▼] [Dorian ▼]
          ├─→ Key: [C ▼] [G ▼] [D ▼] ...
          ├─→ Octaves: [1] [2] [3]
          │
          └─→ "Generate & Add"
               │
               ├─→ Creates melody from scale data
               ├─→ Saves to library
               ├─→ Adds ID to current session
               └─→ Shows as pill immediately
```

## UI Components

### Session Pills (in Sidebar)

```
┌─────────────────────────────────────────────────────┐
│ Session: My Custom Session            [Play All ▶] │
│ Session Items (4)                       [✕ End]  │
├─────────────────────────────────────────────────────┤
│ [♩ G Major Scale] [♪ My Cool] [♪ Another] [♩ Chr] │
│     ↑ active    ↑ selected ↑ selected             │
│                                                     │
│ [Play Selected ▶]    ← enabled when 2+ selected   │
│                                                     │
│ [+ Add Melody] [+ Add Scale] [+ Reorder]           │
└─────────────────────────────────────────────────────┘
```

- **Single click**: Select/deselect (visual highlight)
- **Double click**: Load into editor (also selects it)
- **Drag**: Reorder (updates melodyIds array)
- **Right-click**: Context menu (Remove, Duplicate, Edit Name)

### Selection States

| State | Appearance |
|-------|------------|
| None selected | All pills neutral color |
| One selected | That pill highlighted |
| Multiple selected | All selected pills highlighted |
| All selected | "Play All" and "Play Selected" both enabled |
| None + "Play All" clicked | All played in session order |

### Playback Controls

| Control | Action |
|---------|--------|
| **Play Selected** | Plays selected melodies in order |
| **Play All** | Plays all session melodies in order |
| **Stop** | Stops current playback |
| **Practice Mode** | Determines once/repeat behavior per melody |

## Session Item Selection

### Single Select
- Click a pill → loads melody into editor
- Editor shows the melody, waits for user play/pause
- Practice mode runs when user starts playback

### Multi-Select
- **Ctrl+click** or **Shift+click** to add to selection
- **Click "Play Selected"** → plays selected in session order
- Selected pills highlighted with accent color

### Play All
- Click "Play All" button
- Plays all melodies in session order (ignoring selection)
- After each melody, advances to next

## Data Flow

```
User creates melody
       │
       ├─→ Saves to MelodyLibrary (pitchperfect_melody_library)
       │    └── melody.id = "melody-abc123"
       │
       └─→ Adds to session
            │
            └─→ Updates UserSession in localStorage (pitchperfect_sessions)
                 └── melodyIds: ["melody-abc123", "melody-def456", ...]
                      │
                      └─→ Session view reads melodyIds
                           │
                           ├─→ Loads each melody from library
                           └─→ Shows pills: [Melody A] [Melody B] [Scale] [Scale]

Selected melody → Loaded into melodyStore
                       │
                       ├─→ Piano Roll displays notes
                       ├─→ Playback Runtime ready to play
                       └─→ User hits play → practice mode runs
```

## File Changes

| File | Change |
|------|--------|
| `types/index.ts` | Add `UserSession` interface, keep `MelodyData` |
| `data/sessions.ts` | `DEFAULT_SESSION` with pre-built scale melodies |
| `stores/app-store.ts` | Session CRUD: `saveUserSession()`, `deleteUserSession()`, `getUserSessions()`, `addMelodyToSession()`, `removeMelodyFromSession()`, `reorderSessionMelodies()` |
| `stores/melody-store.ts` | `createMelodyFromScale()` for quick generation |
| `components/LibraryTab.tsx` | Show session pills with selection, play buttons |
| `components/SessionEditor.tsx` | Session name, melody list, add/remove/reorder |
| `components/MelodyEditor.tsx` | "Save & Add to Session" flow |
| `components/ScaleGenerator.tsx` (new) | Quick scale → melody → session |
| `components/MelodyPicker.tsx` (new) | Pick existing melodies to add to session |

## Implementation Phases

### Phase 1: Simplify Session Model ✅
- Refactor `UserSession` to hold `melodyIds: string[]`
- Remove complex `SessionItem` types
- Keep `SessionTemplate` for static practice templates (optional)

### Phase 2: Default Session with Scale Melodies ✅
- Create pre-built scale melodies (C Major, G Major, Chromatic, A Minor, C Pentatonic, D Dorian)
- Seed them into localStorage on first launch
- `DEFAULT_SESSION` references them by ID

### Phase 3: Save & Add to Session ✅
- MelodyEditor save button → dropdown
- "Save" vs "Save & Add to [Session Name]"
- Add to current session's melodyIds array

### Phase 4: Session UI with Selectable Pills ✅
- Update LibraryTab to show melody pills with selection
- Single click: select (highlight)
- Double click: load into editor
- Multi-select: Ctrl+click
- Play buttons: "Play Selected", "Play All"
- Drag to reorder (not implemented yet)

### Phase 5: Session Playback ✅
- Iterate over selected (or all) melodyIds
- Load each melody → play → advance
- Practice mode per melody (once/repeat/practice)
- Sequential playback with playSessionSequence()

### Phase 6: Scale Generator - TODO (future work)
- Modal: scale type, key, octave
- Generate melody from scale data
- Save to library → add to session

## Implementation Status

All phases 1-5 have been completed:
- Session model simplified to hold melodyIds array
- Default session with 6 scale melodies seeded on first launch
- Save & Add to Session dropdown in PresetSelector
- LibraryTab shows selectable melody pills with selection highlighting
- Session playback with sequential playback support

## LocalStorage Keys

```
pitchperfect_sessions        → { [sessionId]: UserSession }
pitchperfect_melody_library → MelodyLibrary
pitchperfect_default_session → string (active session ID)
```