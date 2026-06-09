# Cache Offline Pitch Analysis Data

We need to persist the offline pitch analysis results, lyrics mapping, and segmented notes into IndexedDB so the user doesn't have to wait for recalculation every time they load the same track or UVR stem.

## Proposed Changes

### 1. Database Schema (`src/db/entities.ts` & `src/db/adapters/dexie-adapter.ts`)
- Add a new entity `OfflinePitchAnalysisRecord` to `entities.ts`:
  ```typescript
  export interface OfflinePitchAnalysisRecord extends DbEntity {
    fileHash: string
    analysisResultsJson: string
    lrcLinesJson: string
    segmentedNotesJson: string
  }
  ```
- Update `dexie-adapter.ts` to include `offlinePitchAnalysis: 'id, fileHash'` in the schema. I will safely handle the Dexie version bumping so existing data isn't lost.

### 2. Database Service (`src/db/services/pitch-analysis-service.ts`)
- Create a new service with three functions:
  - `getOfflineAnalysis(fileHash)`
  - `saveOfflineAnalysis(fileHash, results, lrcLines, notes)`
  - `deleteOfflineAnalysis(fileHash)`

### 3. Pitch Testing Tab Integration (`src/components/PitchTestingTab.tsx`)
- **Automatic Loading**: Whenever a new file is added (either manually via "Load Audio File" or automatically synced from a completed UVR session), the component will compute the `fileHash`, query `getOfflineAnalysis(fileHash)`, and if found, automatically hydrate the `analysisResults`, `lrcLines`, and `segmentedNotes`.
- **Automatic Saving**: After the user successfully runs the "Analyze Pitch" processing and/or modifies the LRC mapping, the app will automatically save the state using `saveOfflineAnalysis`.
- **Clear Cache UI**: A "Clear Analysis Cache" button will appear if the current active track has cached data. Clicking it will delete the DB record and reset the local analysis state, allowing the user to force a fresh recalculation.

## User Review Required

Does this architecture look good? 
Specifically:
- I plan to tie the cached data to the **File Hash** (meaning the exact binary content of the vocal stem or uploaded file). This ensures the cache perfectly matches the audio file.
- Are you okay with the "Clear Analysis Cache" button completely removing the data for that specific file hash and resetting the view, or do you want a different behavior?
