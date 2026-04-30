# Presets Library Specification (EARS)

## 1. PURPOSE
Define the behavior for managing and accessing predefined melodies (presets) in the Presets Library module.

## 2. SCOPE
This specification covers:
- Preset selection and loading
- Preset categorization
- Quick start functionality
- Preset visualization

## 3. DEFINITIONS

### PresetItem
A pre-defined melody configuration, containing:
- `id`: Unique identifier
- `name`: Display name
- `type`: Preset type (scale, rhythm, etc.)
- `beats`: Number of beats
- `data`: Preset-specific data (scale notes, rhythm pattern, etc.)
- `icon`: Visual icon for quick identification

### PresetLibrary
Collection of preset items organized by category:
- `scales`: Common musical scales
- `rhythms`: Rhythmic patterns
- `melodies`: Pre-composed melodies
- `warmups`: Warm-up exercises

---

## 4. BEHAVIOR REQUIREMENTS

### 4.1 Preset Access

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PRS-ACCESS-01 | User shall be able to access Presets Library from Library tab quick actions. | High |
| PRS-ACCESS-02 | Presets shall be organized by category tabs (Scales, Rhythms, etc.). | High |
| PRS-ACCESS-03 | User shall be able to switch between category tabs. | High |
| PRS-ACCESS-04 | Each preset shall display its name and icon. | High |
| PRS-ACCESS-05 | Clicking a preset shall load it into the Editor tab. | High |
| PRS-ACCESS-06 | Quick Start button in Library tab shall open Presets Library. | High |

### 4.2 Preset Categorization

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PRS-CAT-01 | Presets shall be categorized by type (scales, rhythms, melodies, warmups). | High |
| PRS-CAT-02 | Category tabs shall be visible at the top of the Presets Library. | High |
| PRS-CAT-03 | Each category shall have its own set of presets. | High |
| PRS-CAT-04 | Active category shall have visual highlighting. | Medium |
| PRS-CAT-05 | User shall be able to filter presets by category via dropdown. | Medium |

### 4.3 Preset Display

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PRS-DISP-01 | Presets shall be displayed as cards or tiles in a grid layout. | High |
| PRS-DISP-02 | Each preset card shall show preset name and type icon. | High |
| PRS-DISP-03 | Empty category shall show "No presets in this category" message. | Medium |
| PRS-DISP-04 | Long preset names shall truncate with ellipsis. | Low |
| PRS-DISP-05 | Preset count shall be visible per category. | Medium |

### 4.4 Preset Quick Start

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PRS-FAST-01 | Quick Start button shall open Presets Library modal. | High |
| PRS-FAST-02 | Quick Start shall select first preset by default. | Medium |
| PRS-FAST-03 | First preset load shall immediately transition to Editor tab. | Medium |

### 4.5 Preset Loading Behavior

| Requirement | Description | Priority |
|-------------|-------------|----------|
| PRS-LOAD-01 | Loading a preset shall replace current melody data in Editor. | High |
| PRS-LOAD-02 | Loading a preset shall update melody name and notes. | High |
| PRS-LOAD-03 | Loading a preset shall not create duplicate melody in library. | Medium |
| PRS-LOAD-04 | Preset notes shall be displayed in Piano Roll after loading. | High |
| PRS-LOAD-05 | Loading action shall clear any unsaved changes to current melody. | Medium |

---

## 5. SUCCESS CRITERIA

The specification is successful when:
1. Users can quickly access and load presets via Quick Start.
2. Presets are organized and easily browsable by category.
3. Loading a preset works seamlessly and replaces current melody data.
4. Empty categories are clearly communicated.
5. Preset names are readable and icons clearly indicate type.

---

## 6. NON-FUNCTIONAL REQUIREMENTS

### 6.1 Performance
- Preset list rendering should complete within 100ms.
- Preset loading should complete within 200ms.

### 6.2 Usability
- Preset cards should be large enough for touch targets.
- Category tabs should be clearly labeled.
- Icons should be universally recognized for preset types.

### 6.3 Reliability
- Loading a preset should not cause data corruption.
- Categories should always display correctly.
- Navigation between tabs should not lose state.

---

## 7. ASSUMPTIONS

1. Preset data is embedded in the application code (not external).
2. Presets are static and cannot be modified by users.
3. Preset categories are fixed and pre-defined.
4. Quick Start action loads the first preset in the first category.

---

## 8. CHANGE HISTORY

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-04-25 | Claude | Initial EARS specification |
