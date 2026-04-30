# Melody Library Specification (EARS)

## 1. PURPOSE
Define the behavior for managing melodies in the Library module, including creation, editing, deletion, favorites, and session management.

## 2. SCOPE
This specification covers:
- Melody creation and editing
- Melody listing and filtering
- Favorites functionality
- Sessions management
- Searching and categorization

## 3. DEFINITIONS

### MelodyItem
A user-created melody, containing:
- `id`: Unique identifier
- `name`: Display name of the melody
- `author`: Creator name
- `notes`: Array of note data
- `tuning`: Array of tuning offsets
- `cycles`: Number of times to repeat

### Session
A collection of session items, containing:
- `id`: Unique identifier
- `name`: Display name
- `items`: Array of SessionItem objects
- `lastPlayed`: Timestamp of last access
- `created`: Creation timestamp
- `difficulty`: Difficulty level
- `category`: Category tag

### SessionItem
A unit within a session, containing:
- `id`: Unique identifier
- `type`: 'preset', 'melody', 'scale', or 'rest'
- `startBeat`: Position in timeline
- `label`: Display label
- Additional fields based on type (beats, melodyId, scaleType, restMs, etc.)

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Melody Creation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-CREATE-01 | User shall be able to create a new melody by clicking "New Melody" button in Editor tab. | High |
| ML-CREATE-02 | New melody shall have default name "New Melody" that user can rename. | High |
| ML-CREATE-03 | Empty melody shall be saved immediately when user clicks "Save" button. | High |
| ML-CREATE-04 | Saving a melody shall create a unique ID and store it in localStorage. | High |
| ML-CREATE-05 | Title field shall auto-focus when melody creation modal opens. | Medium |
| ML-CREATE-06 | Cancel button shall discard unsaved changes without saving. | Medium |

### 4.2 Melody Editing

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-EDIT-01 | User shall be able to edit existing melodies by clicking on a melody in Library tab. | High |
| ML-EDIT-02 | Editing shall populate Editor tab with melody's notes. | High |
| ML-EDIT-03 | Saving changes shall update the melody in localStorage. | High |
| ML-EDIT-04 | Canceling edit shall revert to saved version without changes. | Medium |
| ML-EDIT-05 | Deleting a melody while editing shall show confirmation dialog. | High |

### 4.3 Melody Listing and Display

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-LIST-01 | Melodies shall be displayed in a scrollable list in the Library tab. | High |
| ML-LIST-02 | List shall show melody name, author, and note count. | High |
| ML-LIST-03 | Recent melodies shall be shown first, followed by others. | Medium |
| ML-LIST-04 | Empty state shall show "No melodies found" when library is empty. | Medium |
| ML-LIST-05 | Clicking a melody shall open it in Editor tab. | High |
| ML-LIST-06 | Long melody names shall truncate with ellipsis if they exceed display width. | Low |
| ML-LIST-07 | Clicking on the star icon shall toggle favorite status. | High |

### 4.4 Melody Deletion

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-DEL-01 | User shall be able to delete melodies by clicking delete button. | High |
| ML-DEL-02 | Delete operation shall require confirmation dialog. | High |
| ML-DEL-03 | Canceling confirmation shall not delete the melody. | High |
| ML-DEL-04 | After deletion, the melody shall be removed from localStorage and list. | High |
| ML-DEL-05 | Deleting a melody used in sessions shall show warning message. | Medium |
| ML-DEL-06 | Once deleted, melody cannot be recovered. | High |

### 4.5 Favorites Functionality

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-FAV-01 | User shall be able to add a melody to favorites by clicking the star icon. | High |
| ML-FAV-02 | User shall be able to remove a melody from favorites by clicking the star icon again. | High |
| ML-FAV-03 | Favorites shall be visually indicated by a filled star icon. | High |
| ML-FAV-04 | Unfavorited melodies shall show an empty star icon. | Medium |
| ML-FAV-05 | Favorited melodies shall be accessible via a dedicated favorites view. | Medium |

### 4.6 Session Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-SES-01 | User shall be able to create a new session by clicking "New Session" button. | High |
| ML-SES-02 | Session creation shall prompt for name, difficulty, and category. | High |
| ML-SES-03 | User shall be able to add melodies to a session by dragging from Library. | High |
| ML-SES-04 | User shall be able to edit session items via Session Editor timeline. | High |
| ML-SES-05 | User shall be able to delete sessions by clicking delete button. | High |
| ML-SES-06 | Session deletion shall require confirmation dialog. | High |
| ML-SES-07 | Sessions shall be listed in Session Library Modal with metadata. | High |
| ML-SES-08 | Last played timestamp shall be updated each time a session is played. | Medium |
| ML-SES-09 | User shall be able to load and play a session from the library. | High |

### 4.7 Search and Filtering

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-SEARCH-01 | User shall be able to search melodies by name using search input. | High |
| ML-SEARCH-02 | Search shall be case-insensitive. | High |
| ML-SEARCH-03 | Search shall filter results in real-time as user types. | High |
| ML-SEARCH-04 | User shall be able to filter by session category using dropdown. | Medium |
| ML-SEARCH-05 | User shall be able to filter by difficulty using dropdown. | Medium |
| ML-SEARCH-06 | Empty search results shall show "No melodies found" message. | Medium |

### 4.8 Import and Export

| Requirement | Description | Priority |
|-------------|-------------|----------|
| ML-IMP-01 | User shall be able to import melodies via URL share functionality. | Medium |
| ML-IMP-02 | Imported melody shall be added to library with new ID. | Medium |
| ML-IMP-03 | User shall be able to share melodies via URL. | Medium |
| ML-IMP-04 | Shared URL shall encode melody data for preservation. | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can create, edit, and delete melodies without data loss.
2. Favorites system correctly identifies and displays favorite melodies.
3. Sessions can be created with multiple items and played back sequentially.
4. Search and filtering work efficiently for large libraries.
5. All CRUD operations show appropriate confirmation dialogs.
6. Empty states are clearly communicated to users.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Melody list rendering should complete within 100ms for 100+ melodies.
- Search filtering should complete within 50ms per keystroke.

### 6.2 Usability
- Confirmation dialogs must clearly explain consequences of action.
- Favorite toggle must be easily accessible (click same area as delete button).
- Delete operation must be irreversible (no undo available).

### 6.3 Reliability
- Failed saves must not corrupt existing data.
- Delete operations must fail with clear error if melody is in use by sessions.
- Search must handle special characters gracefully.

---

## 7. ASSUMPTIONS

1. Melody data is stored in localStorage and persists between sessions.
2. Session items reference melodies by ID, not by content.
3. User names are required for author attribution.
4. Search only covers melody names, not notes or metadata.
5. Session difficulty levels are: 'beginner', 'intermediate', 'advanced'.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
