// ============================================================
// Architecture Documentation
// ============================================================

// ### BPM State Architecture

// **Why BPM exists in both appStore and PlaybackRuntime:**

// 1. **appStore.bpm** - The single source of truth for BPM value
//    - Stored in localStorage for persistence
//    - Updated when preset is loaded (from URL or saved preset)
//    - Updated when slider is moved
//    - Used by appStore UI components (slider display)

// 2. **PlaybackRuntime** - Reads BPM from appStore via AudioEngine
//    - Does NOT store BPM independently
//    - Passes BPM to AudioEngine for timing calculations
//    - This design ensures UI (slider) and playback (timing) always sync

// **Data flow:**
// ```
// URL preset -> appStore.setBpm() -> localStorage
// App initialization -> loadBpmFromStorage() -> appStore.setBpmSignal()
// Slider change -> setBpm() -> _bpmValue -> setBpmSignal() -> localStorage
// Playback start -> appStore.bpm() -> AudioEngine.setBPM() -> timing
// ```

// **Why not pass appStore reference to PlaybackRuntime?**
// - Would create tighter coupling between AudioEngine and appStore
// - AudioEngine shouldn't depend on UI store
// - Current design keeps AudioEngine agnostic and testable

// ============================================================

// ### Count-in (Precount) Implementation

// **Where:** Implemented in PlaybackRuntime class
// **How:**
// 1. `PlaybackRuntime.start(countInBeats)` - accepts count-in beats (0-4)
// 2. During animation loop, if `countInBeats > 0`:
//    - Plays count-in beats with metronome sounds
//    - Emits 'countIn' events (1, 2, 3, 4)
//    - Emits 'countInComplete' event when done
// 3. After count-in completes, starts actual playback

// **Integration:**
// - `MelodyEngine` wraps `PlaybackRuntime` and exposes `setCountIn()`
// - `PrecCountButton` in UI toggles `appStore.countIn()` (0 or 4)
// - When melody starts, `MelodyEngine.start()` passes `appStore.countIn()`

// **Why separate from appStore?**
// - Count-in is purely for playback timing
// - User can toggle it independently of BPM changes
// - Keeps UI state (appStore) separate from timing logic

// ============================================================

// ### URL Encoding

// **Implemented in `src/lib/share-url.ts`:**
// - Uses `URLSearchParams` for proper URL encoding
// - Format: `?n=m60s0d2,m64s2d2&bpm=120&k=C&d=12`
// - All values are URL-encoded by browser when used

// **No manual encoding needed** - URLSearchParams handles it automatically.