# Media Library Specification (EARS)

## 1. PURPOSE
Define the behavior of the Media Library (Sidebar Library Tab) which handles the core data hierarchy, session selection, and melody management for editing and playback.

## 2. SCOPE
This specification covers:
- The data hierarchy: Playlists -> Sessions -> Melodies -> Notes
- Active session selection and display
- Melody listing within the active session
- Auto-selection and Editor integration
- Melody creation and auto-assignment to sessions
- Auto-saving of notes

## 3. DEFINITIONS

### Data Hierarchy
- **Playlist**: A collection of Sessions intended to be played sequentially.
- **Session**: A collection of Melodies (and rests/scales).
- **Melody**: A collection of musical notes.

### Active State
- **Active Session**: The session currently selected by the user. "Default" session is used if none is selected.
- **Selected Melody**: The melody currently selected from the Active Session, which is loaded into the Editor for modification or playback.

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Session Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MED-SES-01 | The "Default" session shall be loaded and set as active by default on first launch. | High |
| MED-SES-02 | The Default session shall contain a default melody pre-populated with notes. | High |
| MED-SES-03 | User shall be able to create a "New Session" from the Sidebar/Library Tab. | High |
| MED-SES-04 | Creating a New Session shall set it as the active session. | High |
| MED-SES-05 | User shall be able to select an active session from a list of Recent Sessions in the sidebar. | High |

### 4.2 Melody Listing & Selection

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MED-MEL-01 | The sidebar shall display a selection list of all melodies belonging to the active session. | High |
| MED-MEL-02 | If the active session contains only one melody, it shall be auto-selected. | High |
| MED-MEL-03 | If the active session contains multiple melodies, the user can click to select different ones. | High |
| MED-MEL-04 | The selected melody from the active session shall be automatically loaded into the Editor tab. | High |
| MED-MEL-05 | The user can play back the selected melody or the entire session. | High |

### 4.3 Melody Creation & Auto-Assignment

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MED-CREATE-01 | Creating a new Melody shall automatically add it to the currently active session. | High |
| MED-CREATE-02 | The newly created melody shall immediately appear in the sidebar's selection list for the active session. | High |
| MED-CREATE-03 | The newly created melody shall be automatically selected and loaded into the Editor. | High |

### 4.4 Editor Auto-Saving

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MED-EDIT-01 | When the user edits notes in the Piano Roll, changes shall automatically save to the currently selected melody. | High |
| MED-EDIT-02 | Auto-saving shall not interrupt the user's editing flow. | High |

### 4.5 Playlists (Future / High-Level)

| Requirement | Description | Priority |
|-------------|-------------|----------|
| MED-PLAY-01 | Playlists shall group multiple Sessions together. | Medium |
| MED-PLAY-02 | User shall be able to play a Playlist, which plays its Sessions sequentially. | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. The user clearly understands the hierarchy: Playlists -> Sessions -> Melodies.
2. The sidebar intuitively shows the Active Session and its Melodies.
3. Creating a melody seamlessly adds it to the session and opens it for editing.
4. Piano Roll edits are safely auto-saved to the correct melody.
5. "New Session" buttons work reliably and update the active state.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Usability
- Sidebar list must clearly highlight the currently selected melody.
- Transitioning between selected melodies should instantly update the Editor without page reloads.

### 6.2 Reliability
- Auto-save must reliably update the exact selected melody in localStorage.
- Active session state must be persisted across app restarts.
