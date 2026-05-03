# UVR Stem Separation Feature - EARS Specification

## Feature: Vocal Separation and MIDI Generation

**Feature ID:** `FEATURE-UVR-001`
**Status:** Phase 2 Implementation
**Priority:** P1 - Critical Feature
**Owner:** Audio Engineering Team
**Version:** 1.0.0
**Last Updated:** 2026-05-03

---

## 1. Feature Summary

Unified Vocal Remover (UVR) integration for PitchPerfect that enables users to:
1. Upload audio files (MP3, WAV)
2. Separate vocals from instrumental audio
3. Generate MIDI files from vocals
4. Practice with isolated stems
5. View processing history

---

## 2. Acceptance Criteria

### AC-001: File Upload Flow
- **Requirement:** User can upload MP3 or WAV files up to 100MB
- **Priority:** High
- **Verification:** Drag-and-drop zone shows all audio files, file size validated, file type validated
- **Edge Cases:**
  - File larger than 100MB → Show error with max size
  - Unsupported file type → Show error with supported types
  - Upload interrupted → File remains in upload state

### AC-002: Processing Status Display
- **Requirement:** User sees real-time progress during UVR processing
- **Priority:** High
- **Verification:** Progress bar updates from 0-100%, shows processing time, status indicators
- **States:**
  - Idle → Waiting to start
  - Uploading → File transfer in progress
  - Processing → UVR separation in progress
  - Completed → Success with download options
  - Error → Error message with retry option
  - Cancelled → Cancelled with back to upload

### AC-003: Output Generation
- **Requirement:** Generate vocal stem (WAV), instrumental stem (WAV), and vocal MIDI
- **Priority:** High
- **Verification:** After processing completes, all three outputs available with buttons
- **Path:** Original Audio → Vocal Stem, Instrumental Stem, Vocal MIDI

### AC-004: Result Viewer
- **Requirement:** User can view, practice, or download separated stems
- **Priority:** High
- **Verification:** Result view shows all outputs, practice buttons, download buttons
- **Actions:**
  - Practice with Vocal → Start practice mode with vocal stem
  - Practice Instrumental → Start practice mode with instrumental
  - Practice MIDI → Start practice with MIDI
  - Practice Full Mix → Start with both stems
  - Download → Download specific output format

### AC-005: History Tracking
- **Requirement:** All processing sessions saved with metadata
- **Priority:** Medium
- **Verification:** History panel shows all sessions with date, file name, size, status
- **History Items:**
  - Session ID
  - Original file name and size
  - Creation timestamp
  - Processing time
  - Completion status

### AC-006: Session Export
- **Requirement:** Users can export completed sessions for backup
- **Priority:** Medium
- **Verification:** Export buttons in history and result views
- **Export Types:**
  - Vocal stem (WAV)
  - Instrumental stem (WAV)
  - Vocal MIDI

---

## 3. User Stories

### US-001: As a singer, I want to separate vocals from backing track so I can practice with just my vocal part

**User Flow:**
1. User opens Vocal Sep tab
2. Uploads MP3 file with backing track
3. Clicks "Process with UVR"
4. Waits for processing (30-120 seconds)
5. Sees "Vocal Stem" and "Instrumental" options
6. Clicks "Practice with Vocal"
7. Practice session starts with only vocal

**Acceptance:**
- Processing completes within 2 minutes for 3-minute song
- Vocal stem quality preserves pitch but removes background
- Practice session uses vocal-only audio

### US-002: As a music student, I want to export my processed stems for use in other applications

**User Flow:**
1. Process audio file
2. In results view, click "Download" button
3. File saves to default downloads location

**Acceptance:**
- WAV files are standard format
- Download completes successfully
- File metadata preserved

### US-003: As a user, I want to see my processing history so I can revisit previous sessions

**User Flow:**
1. Click "History" button in panel header
2. View list of all previous sessions
3. Click session to view details
4. Re-export or delete session

**Acceptance:**
- Sessions ordered by creation date (newest first)
- All metadata displayed
- Re-view button brings back the session

---

## 4. Technical Requirements

### TR-001: Component Architecture
```
UvrPanel (main container)
├── UvrUploadControl (file upload interface)
├── UvrProcessControl (progress and status)
├── UvrResultViewer (results display)
├── UvrSessionResult (history item)
└── UvrGuide (help content)
```

### TR-002: State Management
- Uses centralized `app-store.ts` for session state
- Session stored in localStorage for persistence across sessions
- Each session: `{ sessionId, originalFile, outputs, status, progress, processingTime, createdAt, error }`

### TR-003: File Storage Structure
```
pitch-perfect-repo/
├── public/
│   ├── stems/
│   │   └── {sessionId}/
│   │       ├── vocal.wav
│   │       ├── instrumental.wav
│   │       └── vocal.mid
│   └── midi/
│       └── {sessionId}/
│           └── vocal.mid
```

### TR-004: API Contract

```typescript
// Session Management
interface UvrStore {
  // Create new session
  startUvrSession: (name: string, size: number, type: string, mode: 'separate' | 'merge') => string
  // Get session by ID
  getUvrSession: (sessionId: string) => UvrSession | null
  // Update progress
  updateUvrSessionProgress: (sessionId: string, progress: number) => void
  // Complete session
  completeUvrSession: (sessionId: string, outputs: UvrOutputs) => void
  // Set error
  setErrorUvrSession: (sessionId: string, error: string) => void
  // Cancel session
  cancelUvrSession: (sessionId: string) => void
  // Get all sessions
  getAllUvrSessions: () => UvrSession[]
  // Delete session
  deleteUvrSession: (sessionId: string) => void
  // Get current processing session
  currentUvrSession: () => UvrSession | null
}

interface UvrSession {
  sessionId: string
  originalFile: { name: string; size: number; type: string }
  outputs?: UvrOutputs
  status: UvrStatus
  progress: number
  processingTime?: number
  error?: string
  createdAt: number
  updatedAt: number
}

type UvrStatus = 'idle' | 'uploading' | 'processing' | 'completed' | 'error' | 'cancelled'

interface UvrOutputs {
  vocal?: string
  instrumental?: string
  vocalMidi?: string
  instrumentalMidi?: string
}
```

### TR-005: CSS Architecture
- Single `src/styles/uvr.css` file for all UVR component styles
- CSS follows project naming convention: kebab-case classes
- Responsive design for mobile (400px) and desktop (700px+)
- Dark/light mode support via CSS variables

### TR-006: Performance Requirements
- Upload display within 100ms
- Progress bar updates at 500ms intervals
- History rendering under 200ms for 50 sessions
- Initial page load under 3 seconds

### TR-007: Error Handling
- File upload errors with user-friendly messages
- Processing errors captured and displayed
- Retry mechanism for failed sessions
- Session cleanup on unmount or cancel

---

## 5. Non-Functional Requirements

### NFR-001: Accessibility
- Keyboard navigation for all interactive elements
- ARIA labels for screen readers
- Color contrast ratio of 4.5:1 minimum
- Focus indicators for all buttons

### NFR-002: Browser Compatibility
- Chrome/Edge 90+ (Chromium-based)
- Firefox 88+
- Safari 14+

### NFR-003: Security
- File upload validation before processing
- CORS handling for file access
- No XSS risk from file names
- Same-origin policy for stem access

### NFR-004: Performance
- Upload indicator shows file transfer progress
- Progress bar smooth animation
- Lazy loading for history items

### NFR-005: Reliability
- Session state persisted on page reload
- Processing can resume after page reload (future enhancement)
- No data loss on processing error

---

## 6. Phase Breakdown

### Phase 1 (Completed)
- Component structure
- UI layout and CSS styling
- File upload interface
- Mock processing simulation
- Session state management

### Phase 2 (In Progress)
- Real UVR CLI integration
- MIDI generation via Vampir plugins
- File storage implementation
- Export functionality
- History persistence

### Phase 3 (Future)
- Practice mode integration
- Stem mixing controls
- Session comparison
- Advanced stem separation modes

### Phase 4 (Future)
- Cloud processing
- Batch processing
- Stem blending
- MIDI export customization

---

## 7. Testing Strategy

### Unit Tests
- Component prop handling
- Session state management
- File validation logic
- Time formatting

### Integration Tests
- File upload to session creation flow
- Processing status updates
- Export functionality

### E2E Tests
- Complete workflow: Upload → Process → Practice → Export

---

## 8. Success Metrics

### KPI-001: User Engagement
- Average sessions per active user per week

### KPI-002: Completion Rate
- Sessions completed vs. started

### KPI-003: Feature Usage
- Practice sessions started from UVR results

### KPI-004: Satisfaction
- User feedback score for stem quality

---

## 9. Risks and Mitigations

### Risk-001: Processing Performance
- **Risk:** UVR processing may exceed time limits
- **Mitigation:** Add progress estimates, processing time display

### Risk-002: File Size Limits
- **Risk:** Large files cause timeout
- **Mitigation:** Enforce 100MB limit, show clear error

### Risk-003: Quality Variance
- **Risk:** Different songs produce varying stem quality
- **Mitigation:** Document optimal use cases, allow manual overrides

### Risk-004: Storage Limits
- **Risk:** Unbounded storage consumption
- **Mitigation:** Implement cleanup policy for old sessions

---

## 10. Dependencies

### Technical Dependencies
- UVR (Unified Vocal Remover) CLI
- Vampir host plugins for MIDI generation
- SolidJS framework
- Vite build tool

### External Services
- None (local processing)

---

## 11. Definitions

### Acronyms
- **UVR**: Unified Vocal Remover
- **Stem**: Isolated audio channel (vocal, instrumental, bass, etc.)
- **MIDI**: Musical Instrument Digital Interface file format
- **WAV**: Waveform audio file format

### Key Terms
- **Vocal Stem**: Audio file containing only the vocal track
- **Instrumental Stem**: Audio file containing only instrumental tracks
- **Session**: Single processing job with input and outputs
- **Stem Quality**: Subjective measure of how well vocals/instruments are separated
