# Session Editor Timeline Specification (EARS)

## 1. PURPOSE
Define the behavior for the Session Editor timeline feature, which allows users to create and manage practice sessions by dragging and dropping melodies and rests.

## 2. SCOPE
This specification covers:
- Timeline visualization
- Drag-and-drop functionality
- Melody library integration
- Rest item insertion
- Session item management
- Timeline scrolling
- Collapsible interface

## 3. DEFINITIONS

### Timeline
Visual representation of session items arranged by startBeat:
- Horizontal timeline showing item order
- Each item represented as a card or tile
- Rests shown as gaps or pause indicators

### SessionEditor
Container component containing:
- Collapsible header
- Melody library pill list
- Timeline visualization

### MelodyPillList
Draggable list of melodies for timeline:
- Searchable list of available melodies
- Each melody displayed as a pill
- Draggable with HTML5 DnD API

### SessionItem
Unit in a session:
- `type`: 'preset', 'melody', 'scale', or 'rest'
- `startBeat`: Position in timeline
- Additional fields based on type

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Timeline Visualization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-TIMELINE-01 | Timeline shall display session items in order of startBeat. | High |
| SED-TIMELINE-02 | Each item shall be rendered as a card with type icon and label. | High |
| SED-TIMELINE-03 | Timeline shall be horizontally scrollable when items exceed width. | High |
| SED-TIMELINE-04 | Rest items shall be visually distinct from active items. | High |
| SED-TIMELINE-05 | Item order shall be determined by startBeat value. | High |
| SED-TIMELINE-06 | Empty timeline shall show "No items - drag melodies to add" message. | Medium |
| SED-TIMELINE-07 | Timeline shall calculate and display total duration. | Medium |

### 4.2 Collapsible Interface

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-COLLAPSE-01 | Session Editor shall be collapsible via header toggle. | High |
| SED-COLLAPSE-02 | Default state shall be expanded. | High |
| SED-COLLAPSE-03 | Collapsed state shall show only header (height ~25-30px). | Medium |
| SED-COLLAPSE-04 | Expanded state shall show melody library and timeline. | High |
| SED-COLLAPSE-05 | Expand/Collapse animation shall be smooth (CSS transition). | Medium |
| SED-COLLAPSE-06 | Header shall display "Session Editor" title with chevron icon. | High |

### 4.3 Melody Library Integration

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-MEL-01 | Melody Library shall be displayed above timeline in expanded state. | High |
| SED-MEL-02 | Melodies shall be displayed as draggable pills. | High |
| SED-MEL-03 | Pills shall show melody name and BPM. | High |
| SED-MEL-04 | User shall be able to search melodies by name. | High |
| SED-MEL-05 | Search shall be case-insensitive and real-time. | High |
| SED-MEL-06 | Search results shall be sorted alphabetically. | Medium |
| SED-MEL-07 | Clicking a melody pill shall select it (visual highlight). | Medium |

### 4.4 Drag-and-Drop Functionality

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-DND-01 | Melody pills shall be draggable using HTML5 DnD API. | High |
| SED-DND-02 | Drag start shall set data transfer with melody ID. | High |
| SED-DND-03 | Timeline shall accept drop events from melody library. | High |
| SED-DND-04 | Dropping a melody shall insert a new SessionItem at drop position. | High |
| SED-DND-05 | Drop position shall be determined by timeline coordinates. | High |
| SED-DND-06 | Valid drop shall update session data with new item. | High |
| SED-DND-07 | Invalid drop shall reject item without changes. | Medium |

### 4.5 Rest Item Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-REST-01 | User shall be able to add rests between items. | High |
| SED-REST-02 | Drop zones between items shall be clearly indicated. | High |
| SED-REST-03 | Clicking drop zone shall add a 4-second rest item. | High |
| SED-REST-04 | Rest items shall have type 'rest' and appropriate duration. | High |
| SED-REST-05 | Rests shall be visible as gaps or pause indicators in timeline. | High |
| SED-REST-06 | User shall be able to delete rest items. | Medium |
| SED-REST-07 | Deleting a rest shall shift subsequent items left. | Medium |

### 4.6 Session Item Management

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-MANAGE-01 | Each item shall have a delete button. | High |
| SED-MANAGE-02 | Deleting an item shall remove it from the session. | High |
| SED-MANAGE-03 | Deleting an item shall shift subsequent items left. | High |
| SED-MANAGE-04 | Item count shall be displayed in header. | Medium |
| SED-MANAGE-05 | Save button shall persist changes to session. | High |
| SED-MANAGE-06 | Load button shall reload session from library. | Medium |

### 4.7 Timeline Navigation

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-NAV-01 | Timeline shall scroll horizontally on mouse wheel. | High |
| SED-NAV-02 | Piano roll scrolling shall sync with timeline scrolling. | High |
| SED-NAV-03 | Drag scrolling shall be smooth and responsive. | Medium |
| SED-NAV-04 | Timeline shall auto-scroll to show dropped items. | High |
| SED-NAV-05 | Empty timeline shall have scrollable area for drag-and-drop. | Medium |

### 4.8 Session Item Types

| Requirement | Description | Priority |
|-------------|-------------|----------|
| SED-TYPES-01 | Timeline shall support 'preset' items from library. | High |
| SED-TYPES-02 | Timeline shall support 'melody' items from library. | High |
| SED-TYPES-03 | Timeline shall support 'scale' items generated from settings. | High |
| SED-TYPES-04 | Timeline shall support 'rest' items for pauses. | High |
| SED-TYPES-05 | Each item type shall have appropriate icon and display. | High |
| SED-TYPES-06 | Type-specific information shall be displayed (e.g., scale type for scale items). | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can create complete sessions by dragging melodies into the timeline.
2. Rests can be easily added between items.
3. Items can be deleted and reordered without issues.
4. Timeline stays organized and scrollable.
5. Search works efficiently for large melody libraries.
6. Collapsible interface maintains a clean UI when not needed.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Timeline rendering should complete within 200ms.
- Drag-and-drop should provide immediate visual feedback.
- Search filtering should complete within 50ms.

### 6.2 Usability
- Draggable items should be clearly identifiable.
- Drop zones should be visually obvious.
- Icons should clearly indicate item types.
- Timeline should accommodate at least 20 items without performance degradation.

### 6.3 Reliability
- Dropped items should always land at correct position.
- Delete operations should not cause data corruption.
- Scroll sync should work consistently.

---

## 7. ASSUMPTIONS

1. SessionEditor is accessed via "Edit" button in Session Library Modal.
2. SessionEditor resides in Editor tab below Piano Roll.
3. Drop zones are positioned between existing items.
4. Rest duration is fixed at 4 seconds.
5. Sort order is determined by startBeat value.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
