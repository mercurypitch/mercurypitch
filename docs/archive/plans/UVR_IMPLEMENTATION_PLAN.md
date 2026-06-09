# UVR Workflow Implementation Plan

## Overview

This plan implements a complete UVR (Ultimate Vocal Remover) workflow in MercuryPitch:
1. **Import MP3/WAV** files ✅ DONE
2. **Process with UVR CLI** to separate vocals and instrumental stems ⏳ NEXT
3. **Generate MIDI** from vocal stem using pitch detection ⏳ TODO
4. **Practice with separated stems or MIDI** ✅ DONE (UI ready)

---

## Progress

### Phase 1: Setup ✅ COMPLETE
- Add UVR type definitions (modes, status, session, config)
- Create icons component for shared SVG icons
- Create file upload control with drag & drop
- Create processing control with progress indicator
- Create result viewer with practice mode options
- Create session result display component
- Add UVR session management to app-store
- Create UVR implementation plan document

### Phase 2: UVR Integration ⏳ IN PROGRESS
- Create UvrPanel component for unified UI
- Integrate with app tabs
- Add UvrSettings enhancement

### Phase 3: MIDI Generation ⏳ TODO
- Implement pitch detection to MIDI conversion
- Add MIDI export functionality

### Phase 4: Practice Integration ⏳ TODO
- Integrate UVR stems into practice sessions
- Add stem volume controls

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client UI                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Upload    │→ │   Process   │→ │    Result   │             │
│  │   Control   │  │   Control   │  │   Viewer    │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────┴───────────────────────────────────────────┐
│                    Backend API Server                          │
│  ┌──────────────────────────────────────────────────────┐     │
│  │            UVR Service (Node.js/Python)               │     │
│  │  • CLI Wrapper for UVR                                │     │
│  │  • File upload handling                               │     │
│  │  • Stem output management                             │     │
│  │  • MIDI generation                                   │     │
│  └──────────────────────────────────────────────────────┘     │
│                         ↓                                      │
│  ┌──────────────────────────────────────────────────────┐     │
│  │          Pitch Detection Service                     │     │
│  │  • Process audio to MIDI                             │     │
│  │  • Note quantization                                 │     │
│  │  • Tempo detection                                    │     │
│  └──────────────────────────────────────────────────────┘     │
└───────────────────────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ↓                         ↓
  ┌─────────────┐           ┌─────────────┐
  │  UVR CLI    │           │  External   │
  │  (installed)│           │    Server   │
  └─────────────┘           │             │
                             │  (fallback)  │
                             │  Server-side │
                             └─────────────┘
```

---

## Files to Create/Modify

### New Files

```
├── src/
│   ├── lib/
│   │   └── uvr-service.ts          # UVR CLI wrapper
│   │   └── midi-generator.ts       # MIDI creation from pitch data
│   ├── services/
│   │   └── uvr-backend.ts          # Node.js backend service
│   ├── uploads/                    # User upload directory
│   │   └── uvr/                    # UVR processed files
│   └── types/
│       └── uvr.ts                  # UVR-related types
├── uvr/
│   └── index.js                     # CLI wrapper entry point
├── package.json                      # Add UVR CLI dependency
└── deploy.sh                         # Update for UVR paths
```

### Modified Files

```
├── src/components/
│   ├── UvrGuide.tsx                  # Enhance with workflow steps
│   ├── UvrUploadControl.tsx          # NEW: File upload UI
│   ├── UvrProcessControl.tsx         # NEW: Processing status UI
│   ├── UvrResultViewer.tsx           # NEW: Stem/MIDI viewer
│   └── index.ts                      # Add new exports
├── src/stores/
│   ├── app-store.ts                  # Add UVR state: uploadedFile, stems, midi
│   └── settings-store.ts             # Add UVR processing settings
└── server/                           # Backend API routes
    ├── index.js                      # Add /api/uvr/* endpoints
    └── routes/uvr.js
```

---

## Step-by-Step Implementation

### Phase 1: Setup & File Upload

**1.1 Install UVR CLI**
- Install UVR5 (Ultimate Vocal Remover 5)
- Configure for headless/CLI operation
- Set up model paths

**1.2 File Upload UI**
```typescript
// UvrUploadControl.tsx
- Drag & drop zone
- File format validation (MP3, WAV)
- Preview audio player
- Progress indicator
```

**1.2 Backend Upload Handler**
```javascript
// server/routes/uvr.js
POST /api/uvr/upload
- Receive file
- Save to /uploads/uvr/temp/
- Return file ID
```

### Phase 2: Stem Separation

**2.1 UVR Processing Service**
```typescript
// lib/uvr-service.ts
interface UvrProcessOptions {
  inputFile: string
  mode: 'separate' | 'instrumental' | 'vocal'
  model: string
  outputDir: string
}

interface UvrProcessResult {
  vocalStem: string
  instrumentalStem: string
  processingTime: number
}

async function processUvr(input: UvrProcessOptions): Promise<UvrProcessResult>
```

**2.2 Processing UI**
```typescript
// UvrProcessControl.tsx
- Real-time progress
- Processing mode selection
- Model selection (optional)
- Cancel/Restart controls
```

**2.3 UVR CLI Integration**
```bash
# UVR CLI command structure
uvr5.exe --input "input.mp3" \
  --mode VR_architecture_abe \
  --model UVR_MDXNET_RVC_Model_v2 \
  --gpu_id 0 \
  --out_vocal "vocal_stem.wav" \
  --out_ins "instrumental_stem.wav"
```

### Phase 3: MIDI Generation

**3.1 Pitch Detection for MIDI**
```typescript
// lib/midi-generator.ts
interface MidiGenerationOptions {
  audioFile: string
  tempo?: number
  quantization?: number // 0.25 = eighth notes
  minNoteDuration?: number
}

interface MidiResult {
  tempo: number
  notes: Note[]
  duration: number
}

function generateMidi(options: MidiGenerationOptions): MidiResult
```

**3.2 MIDI File Export**
```typescript
// Using @tonejs/midi or custom
import { writeFileSync, writeMidi } from '@tonejs/midi'
function exportMidi(result: MidiResult, outputPath: string): void
```

### Phase 4: Practice Integration

**4.1 Practice Session with UVR Stems**
```typescript
// Modify PracticeEngine to support UVR audio
interface UvrPracticeOptions {
  useStems: 'vocal' | 'instrumental' | 'full' | 'midi'
  stemFile?: string
  midiFile?: string
}
```

**4.2 Practice UI Updates**
- Add stem selector in practice view
- Visual indication of which stem is active
- Volume control per stem

---

## Implementation Details

### UVR Model Options

Default models for different configurations:

```typescript
const UVR_MODELS = {
  separate: {
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2'
  },
  instrumental: {
    vrArchitecture: 'VR_architecture_abe',
    model: 'HTDemucs_2_htdemucs'
  },
  vocal: {
    vrArchitecture: 'VR_architecture_abe',
    model: 'UVR_MDXNET_RVC_Model_v2'
  }
}
```

### Processing Pipeline

```
1. User uploads MP3
   ↓
2. Backend saves to temp file
   ↓
3. UVR processes in background
   - 30-120 seconds depending on file size
   ↓
4. Return results (stems as WAV)
   ↓
5. Generate MIDI from vocal stem
   ↓
6. Save all files to user session
   ↓
7. User can practice with any combination
```

### File Structure

```
/uploads/uvr/
  └── {userId}/
       ├── {sessionId}/
       │   ├── original.mp3
       │   ├── vocal.wav
       │   ├── instrumental.wav
       │   ├── vocal_midi.mid
       │   └── instrumental_midi.mid
       └── .processing  # Lock file
```

---

## Dependencies

### Frontend

```json
{
  "@tonejs/midi": "^0.14.0",
  "solid-js": "^1.8.0"
}
```

### Backend (Node.js)

```json
{
  "express": "^4.18.0",
  "multer": "^1.4.5",
  "formidable": "^2.1.1",
  "wav-analysis": "^1.0.0"
}
```

### UVR CLI

- Download: https://github.com/Anjok07/ultimatevocalremovergui
- Models: Provided with UVR
- GPU support: Optional

---

## Testing Strategy

1. **Upload Tests**
   - Valid MP3 upload
   - Valid WAV upload
   - Invalid file types
   - Large file handling

2. **UVR Processing Tests**
   - Stem separation quality
   - Processing timeout handling
   - Error recovery

3. **MIDI Generation Tests**
   - Note accuracy
   - Tempo detection
   - File export

4. **Integration Tests**
   - Complete workflow
   - Practice session with stems
   - Multiple sessions

---

## Timeline

- **Week 1**: Setup UVR CLI, file upload, basic processing
- **Week 2**: MIDI generation, practice integration
- **Week 3**: UI polish, testing, deployment

---

## Success Criteria

✅ User can upload MP3/WAV files
✅ UVR successfully separates stems
✅ MIDI generated from vocal track
✅ Practice sessions work with stems/MIDI
✅ Processing completes in < 2 minutes for typical songs

---

## Open Questions

1. Should we provide multiple UVR models to choose from?
2. How to handle GPU requirements?
3. Should we cache processed results?
4. What's the maximum file size limit?
