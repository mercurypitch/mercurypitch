# 🛡️ Enterprise Code Audit & Architecture Report

## 1. 📊 Executive Summary

- **Health Score:** **58/100** (downgraded from 64 due to CSS architecture findings — 62 components without CSS modules, 1,618 global class references)
- **Project:** MercuryPitch — Vocal/Guitar/Karaoke Practice Platform
- **Tech Stack:** SolidJS (TypeScript), Vite, Cloudflare Workers + D1, IndexedDB (Dexie), Web Audio API, Web Workers
- **Codebase Size:** ~187,000 lines TypeScript/TSX across 776 source files + 3 Cloudflare Workers
- **Code Review Scope:** `src/` directory (components, stores, features, lib, db, pages, types, styles, workers)

### High-Level Assessment

MercuryPitch is an ambitious, feature-rich music practice platform that punches well above its weight class for a single-page application. The architecture demonstrates genuine engineering maturity in several areas: the **database adapter pattern** (DexieAdapter / ServerAdapter / HybridAdapter) is well-designed with clean abstraction boundaries, the **Cloudflare Worker CRUD API** with row-level access control and JWT authentication is production-grade, and the **exercise controller pattern** (useBaseExercise → per-exercise controllers) shows thoughtful separation of concerns.

However, the codebase is suffering from **severe growth without refactoring discipline**. Four files exceed 2,000 lines (piano-roll.ts at 4,911, StemMixer.tsx at 4,838, App.tsx at 2,681, app-store.ts at 2,461) — each a textbook God Object/Component. The `App.tsx` alone imports 109 modules, declares 44 reactive primitives, and mixes routing, state management, playback orchestration, modal management, and UI rendering in a single file. There are 162 type-safety escapes (`as any`, `@ts-ignore`), 181 production `console.log`/`warn` calls, and 63 silently empty `catch` blocks. The lib layer has bidirectional coupling with stores, creating fragile dependency chains. The browser stores JWT tokens in `localStorage`, exposing them to XSS.

The most pressing technical debt is **not security-critical** — the app is fundamentally sound. The risk is **sustainability**: every new feature added to these God objects increases the probability of regressions and makes onboarding new engineers prohibitively slow.

A secondary but pervasive issue is the **CSS architecture**: 62 of ~100 component files use global CSS classes scattered across 3 monolithic stylesheets (`app.css`, `exercises.css`, `restored-legacy.css`) instead of co-located CSS Modules. This means 1,618 class references are untethered from their components, making style debugging a grep-hunt, preventing CSS tree-shaking, and risking silent class-name collisions. A phased refactoring — starting with extracting the App.tsx monolith into focused feature controllers, splitting the God stores, migrating the top 15 global-CSS components to CSS Modules, and finally breaking up the piano-roll and StemMixer behemoths — would dramatically improve the codebase's health score within 2-3 sprints.

---

## 2. 🗂️ File Organization & Architecture Review

### Current State Critique

The codebase uses a **hybrid feature-sliced + layered** architecture, which is a reasonable starting point but has degraded over time:

**Strengths:**
- `features/` directory contains feature-isolated modules (exercises, practice-intelligence, guitar-tab-3d, etc.) — good cohesion
- `db/` layer has clean adapter pattern (`DatabaseAdapter` interface → `DexieAdapter`, `ServerAdapter`, `HybridAdapter`)
- `workers/` directory separates Cloudflare Worker code from the SPA
- Exercise system uses a consistent controller pattern (`useBaseExercise` + per-exercise controller)

**Weaknesses:**
- **lib/ imports from stores/** — 10+ files in `lib/` directly import from `stores/`, breaking the dependency inversion principle. `lib/` should be the foundation layer, consumed by stores/components, not the other way around.
- **stores/index.ts** is a wildcard barrel (`export * from './app-store'`, etc.) that re-exports everything, creating an opaque public API surface of 220+ exports from a single import path. Any component importing from `@/stores` pulls in the entire store graph.
- **App.tsx** is the de-facto composition root, orchestrator, and DI container — it manually wires 40+ signals into 25+ controllers and passes them through 15+ `<Show>` branches.
- **components/ directory** is flat — 100+ files at the top level, mixing atomic components (CrashModal) with page-level components (VocalAnalysis at 3,108 lines).
- **CSS is split** across module CSS, global `app.css`, `exercises.css`, `restored-legacy.css` — 3+ stylesheet systems with no clear conventions.

### Proposed Scalable Structure

```
src/
├── app/                          # Composition root (thin)
│   ├── App.tsx                   # ~200 lines: providers + router + layout shell
│   ├── providers/                # EngineProvider, PlaybackProvider, DBProvider
│   └── router/                   # Hash router + route definitions
│
├── features/                     # Feature-sliced (existing, expand)
│   ├── singing/                  # Singing tab feature
│   │   ├── SingingPage.tsx
│   │   ├── components/           # PitchCanvas, HistoryCanvas, NoteList
│   │   ├── controllers/          # useSingingController, usePlaybackController
│   │   └── stores/               # practice-session-store, recording-store
│   ├── compose/                  # Compose/Editor tab
│   ├── exercises/                # Exercise system (existing, good)
│   ├── guitar/                   # Guitar practice (existing)
│   ├── karaoke/                  # Karaoke/UVR (existing)
│   ├── leaderboard/              # Community + Leaderboard
│   └── practice-intelligence/    # AI features (existing)
│
├── shared/                       # Cross-cutting shared code
│   ├── components/               # Truly reusable UI (buttons, modals, icons)
│   ├── hooks/                    # Shared SolidJS hooks
│   ├── stores/                   # app-store, settings-store, theme-store
│   └── types/                    # Shared TypeScript types
│
├── core/                         # Foundation layer (no imports from features/stores)
│   ├── audio/                    # audio-engine, pitch-detector, playback-runtime
│   ├── db/                       # Database adapters (existing, good)
│   ├── midi/                     # midi-engine, midi-generator, scale-data
│   └── utils/                    # Pure utility functions
│
├── infrastructure/               # Cloud/deployment layer
│   ├── auth/                     # Auth service, user service
│   ├── api/                      # ServerAdapter, API client
│   └── storage/                  # localStorage abstractions
│
└── workers/                      # Cloudflare Workers (existing, good)
    ├── db-worker/
    └── jam-worker/
```

### Architectural Recommendations

1. **Extract App.tsx into feature page components** — each tab should be a self-contained `<SingingPage />`, `<ComposePage />`, etc. with their own controllers and state. App.tsx becomes a thin shell.
2. **Break up piano-roll.ts** — the 4,911-line behemoth is actually several concerns: rendering, input handling, MIDI playback, UI chrome. Split into `PianoRollRenderer`, `PianoRollInputHandler`, `PianoRollPlaybackController`, and `PianoRollUI`.
3. **Introduce a DI/Service Locator pattern** — the current manual wiring of 44 signals through App.tsx is fragile. A simple context-based service locator (`EngineContext` already exists — expand it) would let child components resolve their dependencies without prop threading.
4. **Standardize CSS strategy** — choose CSS Modules throughout, remove `restored-legacy.css`, migrate global styles to a design token system.
5. **Add barrel-breaker lint rule** — prevent `import {...} from '@/stores'` which pulls in the entire store graph. Force direct imports like `import {...} from '@/stores/melody-store'`.

---

## 3. 🚨 Critical Bugs & Security Vulnerabilities

| Severity | Location | Issue | Impact | Fix |
|----------|----------|-------|--------|-----|
| **HIGH** | `src/lib/piano-roll.ts:1368` | `this.container.innerHTML = \`...\`` with template strings — potential XSS vector if any interpolated values come from user input or URLs | XSS injection if melody names/note data originate from shared URLs | Replace with DOM API (`createElement`, `textContent`) |
| **HIGH** | `src/components/WalkthroughModal.tsx:306` | `innerHTML={renderMarkdownToHtml(...)}` — markdown-to-HTML without sanitization | XSS via markdown content | Use DOMPurify or equivalent sanitizer before setting innerHTML |
| **MEDIUM** | `src/db/services/user-service.ts:77` | JWT token stored in `localStorage` — readable by any JavaScript on the page | Token exfiltration via XSS | Store in `httpOnly` cookie (requires server endpoint) or use `sessionStorage` |
| **MEDIUM** | `src/lib/piano-roll.ts:4515` | `btn.innerHTML = \`${name}${octave}...\`` — dynamic HTML construction with template variables | XSS if note names contain HTML | Use `textContent` + `createElement` |
| **MEDIUM** | `src/lib/piano-roll.ts:1360` | `this.container.innerHTML = ''` — clearing via innerHTML is correct but highlights that the entire rendering pipeline uses innerHTML | Fragile, hard to maintain | Refactor to declarative SolidJS components or Canvas rendering |
| **LOW** | `src/e2e/db-abstraction.spec.ts:27` | `new Function('db', fnBody)` — dynamic code execution in test file | Test-only, but still a code injection pattern | Use a safer evaluation strategy |
| **LOW** | 181 locations | `console.log`/`console.warn` in production code — leaks internal state, may expose sensitive data | Information disclosure, log pollution | Replace with a structured logger that's stripped in production builds |

### Critical Fix: XSS in piano-roll.ts innerHTML

**Before (Bad Code):** `src/lib/piano-roll.ts:1368`
```typescript
// UNSAFE: template literals directly into innerHTML
this.container.innerHTML = `
  <div class="note-block" data-midi="${note.midi}">
    <span>${note.name}${note.octave}</span>
  </div>
`
```

**After (Refactored):**
```typescript
// SAFE: DOM API with textContent
const block = document.createElement('div')
block.className = 'note-block'
block.dataset.midi = String(note.midi)
const label = document.createElement('span')
label.textContent = `${note.name}${note.octave}`  // textContent auto-escapes HTML
block.appendChild(label)
this.container.appendChild(block)
```

### Critical Fix: Markdown Sanitization

**Before (Bad Code):** `src/components/WalkthroughModal.tsx:306`
```typescript
<div innerHTML={renderMarkdownToHtml(walkthroughContent())} />
```

**After (Refactored):**
```typescript
import DOMPurify from 'dompurify'

const sanitizedHtml = createMemo(() =>
  DOMPurify.sanitize(renderMarkdownToHtml(walkthroughContent()), {
    ALLOWED_TAGS: ['p', 'strong', 'em', 'ul', 'ol', 'li', 'code', 'pre', 'h3', 'h4', 'br'],
    ALLOWED_ATTR: ['class'],
  })
)
return <div innerHTML={sanitizedHtml()} />
```

---

## 4. ⏱️ Algorithmic Complexity & Performance Bottlenecks

### Bottleneck 1: Piano Roll Rendering — O(N²) Hit Testing

- **Target:** `src/lib/piano-roll.ts` → `handleMouseMove()` / `findNoteAtPosition()`
- **Current Complexity:** Time: **O(N)** per frame (N = melody notes) — acceptable, but called at **60fps** during drag operations with no throttling, making it effectively **O(N × 60) per second**
- **Analysis:** During a drag resize of a note block, the hit-test iterates the entire melody array (`this.notes.forEach(...)`) to find which note is under the cursor. With 500+ notes, this is 30,000 iterations per second. Combined with the full canvas redraw, this causes jank on lower-end devices.
- **Optimized Solution:** Spatial index (sorted by startBeat) + binary search to find candidate notes, reducing hit-test from O(N) to **O(log N)**.
- **New Complexity:** Time: **O(log N)** | Space: O(1) (in-place sorted array)

```typescript
// Before: O(N) linear scan every frame
findNoteAtPosition(x: number, y: number): MelodyItem | null {
  for (const item of this.notes) {              // O(N)
    const bounds = this.getNoteBounds(item)
    if (x >= bounds.x1 && x <= bounds.x2 && Math.abs(y - bounds.y) < 10) {
      return item
    }
  }
  return null
}

// After: O(log N) binary search on startBeat
findNoteAtPosition(x: number, y: number): MelodyItem | null {
  const beat = this.xToBeat(x)
  // Binary search for the note nearest to this beat position
  let lo = 0, hi = this.noteList.length - 1  // noteList is sorted by startBeat
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const item = this.noteList[mid]
    if (beat >= item.startBeat && beat <= item.startBeat + item.duration) {
      const bounds = this.getNoteBounds(item)
      if (Math.abs(y - bounds.y) < 10) return item
      // Check adjacent notes too (overlapping)
      for (let i = mid - 2; i <= mid + 2; i++) { /* check bounds */ }
      return null
    }
    if (beat < item.startBeat) hi = mid - 1
    else lo = mid + 1
  }
  return null
}
```

### Bottleneck 2: Session History Accuracy Map — O(S × R × N)

- **Target:** `src/stores/practice-session-store.ts` → `getNoteAccuracyMap()`
- **Current Complexity:** Time: **O(S × R × N)** where S = session count (≤50), R = practice results per session, N = notes per result. Worst case: 50 × 10 × 100 = 50,000 iterations.
- **Analysis:** The function iterates through all sessions, all practice results, and all note results, building a `Map<midi, number[]>`. Each call re-computes the entire accuracy map from scratch. Called from `App.tsx` via `createMemo`, which re-executes whenever `sessionResults()` changes. This is correct but recomputes more than necessary.
- **Optimized Solution:** Memoize the map and incrementally update on new results rather than recomputing from scratch. Use a persistent signal that accumulates.
- **New Complexity:** Time: **O(R × N)** per update (amortized) | Space: O(M) where M = unique MIDI notes

### Bottleneck 3: VocalAnalyzer FFT Processing

- **Target:** `src/lib/vocal-analyzer.ts` → various methods
- **Current Complexity:** Time: **O(F × log F)** per frame (FFT) where F = buffer size (2048). Acceptable for real-time audio processing.
- **Analysis:** The vocal analyzer runs FFT at 60fps. At 2048-sample buffers, this is ~120k FFT operations/second. Web Audio API's built-in `AnalyserNode.getByteFrequencyData()` is used correctly — no optimization needed.
- **Recommendation:** No changes needed. This is optimally implemented.

### Bottleneck 4: App.tsx Score Overlay Computation

- **Target:** `src/App.tsx` → score overlay IIFE (lines ~2145-2190)
- **Current Complexity:** Time: **O(H + S)** per render where H = history entries, S = scale notes. Called on every overlay open — acceptable.
- **Analysis:** The IIFE calls `getRecentScores()`, `computePracticeStats()`, `computeImprovementRate()`, `generateWeaknessReport()` — all pure functions over ≤100 entries. No optimization needed.
- **Recommendation:** Extract into a `useScoreOverlayData()` hook to clean the component, but no algorithmic changes needed.

---

## 5. 👃 Code Smells & Bad Practices

### Smell 1: God Component — App.tsx (2,681 lines)

**Location:** `src/App.tsx`

**Problem:** App.tsx is the application composition root, state manager, router, modal manager, and UI renderer all in one file. It imports 109 modules, declares 44 reactive primitives, and mixes concerns at every level.

**Before (representative excerpt):**
```typescript
// App.tsx — lines 250-400: 150 lines of state declaration
const [showScaleBuilder, setShowScaleBuilder] = createSignal(false)
const [savedVol, setSavedVol] = createSignal<number>(80)
const [metronomeEnabled, setMetronomeEnabled] = createSignal(false)
const [playMode, setPlayMode] = createSignal<PlaybackMode>(PLAYBACK_MODE_ONCE)
const [repeatCycles, setRepeatCycles] = createSignal<number>(5)
const [currentRepeat, setCurrentRepeat] = createSignal<number>(1)
// ... 38 more signals ...

// Lines 700-900: Controller wiring — 200 lines of manual DI
const playbackController = usePlaybackController({ /* 20 config options */ })
const practice = usePracticeController({ /* 15 config options */ })
const sessionSequencer = useSessionSequencer({ /* 18 config options */ })
// ... 8 more controllers ...

// Lines 1200-2680: JSX rendering — 1,480 lines of inline JSX
return (
  <div>
    <Show when={activeTab() === TAB_SINGING}> {/* 500 lines */} </Show>
    <Show when={activeTab() === TAB_COMPOSE}>  {/* 400 lines */} </Show>
    <Show when={activeTab() === TAB_ANALYSIS}> {/* 200 lines */} </Show>
    // ... 12 more tabs ...
  </div>
)
```

**After (Refactored):**
```typescript
// App.tsx — ~200 lines
export const App: Component = () => (
  <AppErrorBoundary>
    <EngineProvider>
      <AppShell>
        <AppRouter />  {/* Resolves active tab → renders <PageComponent /> */}
      </AppShell>
    </EngineProvider>
  </AppErrorBoundary>
)

// SingingPage.tsx — ~150 lines
const SingingPage: Component = () => {
  const { playback, practice, session } = useSingingController()
  return (
    <TabErrorBoundary tabName="Singing">
      <SingingControlBar {...playback} />
      <SingingStatusBar />
      <PitchCanvas {...practice} />
      <PitchAccuracyHeatmap />
      <HistoryCanvas />
      <SessionPlayer />
    </TabErrorBoundary>
  )
}
```

### Smell 2: God Store — app-store.ts (2,461 lines, 221 exports)

**Location:** `src/stores/app-store.ts`

**Problem:** app-store is a monolithic bag of signals that handles UVR sessions, settings, feature flags, vocal ranges, and instrument config — completely unrelated concerns in one file.

**Refactoring:**
```
app-store.ts (2,461 lines) →
  ├── uvr-session-store.ts    (~600 lines, UVR state)
  ├── instrument-store.ts     (~200 lines, instrument config)
  ├── feature-flag-store.ts   (~150 lines, feature flags)
  ├── vocal-range-store.ts    (~200 lines, vocal range presets)
  └── app-store.ts            (~400 lines, remaining core state)
```

### Smell 3: Magic Numbers

**Location:** `src/lib/practice-engine.ts:12-18`

```typescript
// Before: Magic numbers
const DEFAULT_BANDS: { threshold: number; band: number }[] = [
  { threshold: 0, band: 100 },
  { threshold: 10, band: 90 },
  { threshold: 25, band: 75 },
  { threshold: 50, band: 50 },
  { threshold: 999, band: 0 },
]
```

**After: Named constants**
```typescript
const CENTS_PERFECT = 10
const CENTS_GOOD = 25
const CENTS_OKAY = 50
const SCORE_PERFECT = 100
const SCORE_EXCELLENT = 90
const SCORE_GOOD = 75
const SCORE_OKAY = 50

const DEFAULT_BANDS: AccuracyBand[] = [
  { threshold: 0,                band: SCORE_PERFECT },
  { threshold: CENTS_PERFECT,    band: SCORE_EXCELLENT },
  { threshold: CENTS_GOOD,       band: SCORE_GOOD },
  { threshold: CENTS_OKAY,       band: SCORE_OKAY },
  { threshold: Number.MAX_VALUE, band: 0 },
]
```

### Smell 4: Deeply Nested Conditionals — Arrow Anti-Pattern

**Location:** `src/App.tsx` score overlay (~lines 2030-2190)

**Problem:** The score overlay JSX has 7 levels of nesting: `Show > div > Show > div > IIFE > Show > div`. This is the arrow anti-pattern.

**Before:**
```typescript
<Show when={showPracticeResultPopup() && practiceResult() !== null}>
  <div class={styles.overlay} onClick={closeScoreOverlay}>
    <div id="score-card" onClick={(e) => e.stopPropagation()}>
      {/* ... */}
      <Show when={getSessionHistory().length > 0}>
        <div id="score-history">
          {/* ... */}
          <Show when={getRecentScores(20).length >= 2}>
            <div class={styles.trendSection}>
              {(() => {
                // 40-line IIFE with nested conditionals
              })()}
            </div>
          </Show>
        </div>
      </Show>
    </div>
  </div>
</Show>
```

**After:**
```typescript
<Show when={showPracticeResultPopup() && practiceResult() !== null}>
  <ScoreOverlayCard
    result={practiceResult()!}
    noteResults={noteResults()}
    onClose={closeScoreOverlay}
    onTryAgain={() => { closeScoreOverlay(); handleReset(); handlePlay() }}
  />
</Show>
```

### Smell 5: Silent Error Swallowing (63 instances)

**Location:** Multiple files

**Problem:** 63 `.catch()` blocks silently swallow errors with no logging, no user feedback, and no recovery.

```typescript
// Before: Silent failure — user has no idea something went wrong
await saveSessionRecord({...}).catch(() => {})  // src/db/services/session-service.ts
```

```typescript
// After: Structured error handling with user feedback
try {
  await saveSessionRecord({...})
} catch (err) {
  console.error('[SessionService] Failed to save session:', err)
  showNotification('Failed to save session — your progress is still available locally', 'warning')
}
```

### Smell 6: Bi-directional Coupling — lib ↔ stores

**Location:** 10+ files in `src/lib/` importing from `@/stores`

**Problem:** The `lib/` layer (supposedly foundational utilities) imports from `stores/` (application state layer). This creates a fragile dependency cycle: components → stores → lib → stores. If a store changes, lib functions break. If a lib function is refactored, stores may break.

**Fix:** Extract the store-dependent logic from lib into dedicated controllers or hooks. Lib functions should be pure, accepting data as parameters rather than reading from stores.
```typescript
// Before: lib imports store — violates dependency inversion
// lib/practice-engine.ts
import { showNotification } from '@/stores/notifications-store'

// After: lib is pure, store integration happens in the controller
// lib/practice-engine.ts
export class PracticeEngine {
  private onAudioBlocked?: () => void
  setCallbacks(cb: { onAudioBlocked?: () => void }) { ... }
}

// features/singing/useSingingController.ts
practiceEngine.setCallbacks({
  onAudioBlocked: () => showNotification('Audio blocked — tap to enable', 'warning')
})
```

### Smell 7: Missing CSS Modules — Global Class Sprawl (62 components)

**Scope:** 62 of ~100 component files use global CSS classes instead of CSS Modules. 2 have inline `<style>` tags. 1,618 total global class references across these files.

**Problem:** The codebase uses three mutually incompatible styling strategies: (a) CSS Modules with `.module.css` files (correct approach), (b) global CSS classes in `app.css` / `exercises.css` / `restored-legacy.css`, and (c) inline `<style>` tags embedded in TSX. Component styles live in a separate directory tree (`src/styles/`) from their components (`src/components/`), breaking co-location and making it impossible to tree-shake unused CSS. Class name collisions are prevented only by naming convention (`sm-*`, `uvr-*`), not by tooling — one typo creates a silently broken style.

**Worst Offenders:**

| Component | Lines | Global Classes | CSS Location |
|-----------|-------|---------------|-------------|
| `CommunityShare.tsx` | — | 153 | Global `app.css` |
| `VocalAnalysis.tsx` | 3,108 | 134 + 1 inline `<style>` tag | Global `app.css` + inline |
| `CommunityLeaderboard.tsx` | — | 110 | Global `app.css` |
| `StemMixerLyricsPanelBody.tsx` | — | 99 | Global `app.css` |
| `VocalChallenges.tsx` | 1,485 | 96 | Global `app.css` |
| `StemMixer.tsx` | 4,838 | 39 | Global `app.css` |
| `UvrPanel.tsx` | — | 76 | Global `app.css` |
| `PitchAlgorithmTester.tsx` | — | 46 | Global `app.css` |
| All `StemMixer*` components (10 files) | — | Combined 300+ | Global `app.css` |

**Inline `<style>` tag location:**
- `src/components/VocalAnalysis.tsx:1414-1419` — embeds a `@keyframes live-pulse` animation directly in JSX. This is correct for a one-off keyframe (avoids polluting global namespace), but should be a CSS Module `@keyframes`.

**Before (Bad Code):**
```tsx
// VocalAnalysis.tsx — inline style tag inside JSX render
<style>{`
  @keyframes live-pulse {
    0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.6); }
    50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(63, 185, 80, 0); }
  }
`}</style>

// StemMixer.tsx — global class names, styles live elsewhere
<div class="stem-mixer">
  <div class="sm-header">
    <button class="sm-back-btn">...</button>
  </div>
</div>
```

**After (Refactored):**
```tsx
// VocalAnalysis.module.css
@keyframes livePulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(63, 185, 80, 0.6); }
  50% { opacity: 0.6; box-shadow: 0 0 0 6px rgba(63, 185, 80, 0); }
}
.liveIndicator {
  animation: livePulse 2s ease-in-out infinite;
}

// VocalAnalysis.tsx
import styles from './VocalAnalysis.module.css'
// ...
<div class={styles.liveIndicator}>LIVE</div>

// StemMixer.tsx
import styles from './StemMixer.module.css'
// ...
<div class={styles.root}>
  <div class={styles.header}>
    <button class={styles.backBtn}>...</button>
  </div>
</div>
```

**Impact:** 
- No CSS tree-shaking — `app.css` at 2,440 lines is loaded regardless of which tab the user visits
- Class name collisions are a constant risk — the `sm-` prefix convention is manual and unenforceable
- Developer ergonomics are poor — finding a component's styles requires grepping across 3+ CSS files
- Inline `<style>` tags re-inject CSS into the DOM on every render if not memoized (SolidJS handles this correctly here, but it's fragile)

---

## 6. 🚀 Actionable Remediation Roadmap

### Phase 1: Immediate Action (0-7 days) — Security + Critical Fixes

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 P0 | Add DOMPurify sanitization to WalkthroughModal markdown rendering | 1h | Prevents XSS via shared markdown content |
| 🔴 P0 | Replace `innerHTML` with DOM API in piano-roll.ts (3 locations) | 3h | Prevents XSS via melody data |
| 🔴 P0 | Audit all 63 empty catch blocks — add error logging and user feedback to the top 20 most critical paths (DB writes, auth operations, audio init) | 4h | Users get actionable feedback instead of silent failures |
| 🟡 P1 | Move JWT from localStorage to sessionStorage or add httpOnly cookie support | 2h | Reduces XSS token exfiltration surface |
| 🟡 P1 | Strip 181 console.log/warn calls — replace with structured logger that's tree-shaken in production | 3h | Prevents information disclosure, cleans console |

### Phase 2: Short-Term Refactoring (Next Sprint) — Architecture + Complexity

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🟡 P1 | Extract App.tsx into feature page components: `<SingingPage />`, `<ComposePage />`, `<ExercisesPage />`, `<AnalysisPage />` | 3 days | Cuts App.tsx from 2,681 → ~400 lines, enables independent feature development |
| 🟡 P1 | Split app-store.ts into focused stores: `uvr-session-store`, `instrument-store`, `feature-flag-store` | 2 days | Each store single-responsibility, testable in isolation |
| 🟡 P1 | Add binary-search hit testing to piano-roll.ts (O(N) → O(log N)) | 4h | Eliminates jank during drag operations on large melodies |
| 🟢 P2 | Named constants for all magic numbers in practice-engine.ts, vocal-analyzer.ts | 2h | Self-documenting code |
| 🟢 P2 | Create CSS Modules for top 15 global-CSS offenders (CommunityShare 153, VocalAnalysis 134, CommunityLeaderboard 110, StemMixerLyricsPanelBody 99, VocalChallenges 96, UvrPanel 76, and 9 more). Extract to `ComponentName.module.css` | 5 days | Co-located styles, CSS tree-shaking, no more style grep-hunting |
| 🟢 P2 | Extract VocalAnalysis inline `<style>` tag (line 1414) into `VocalAnalysis.module.css` | 30m | Clean separation, no runtime style injection |
| 🟢 P2 | Break lib→stores coupling: introduce callback interfaces, move store-dependent logic to controllers | 3 days | Clean architecture, no circular dependency risk |

### Phase 3: Long-Term Architecture (Future Roadmap)

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🟢 P2 | Split piano-roll.ts (4,911 lines) into `PianoRollRenderer` (canvas), `PianoRollInputHandler` (mouse/keyboard), `PianoRollPlaybackController` (MIDI), `PianoRollUI` (toolbar). Each module ≤800 lines. | 2 weeks | Massive maintainability gain; enables unit testing individual subsystems |
| 🟢 P2 | Standardize CSS: remove `restored-legacy.css`, adopt CSS Modules throughout, define design tokens in `:root` | 1 week | Consistent styling, no more CSS drift |
| 🟢 P2 | Add barrel-breaker ESLint rule: force direct imports (`@/stores/melody-store`) instead of wildcard imports (`@/stores`) | 1h | Smaller bundle sizes, explicit dependency tracking |
| 🔵 P3 | Introduce Vitest-based component testing for top 10 components (PitchCanvas, PianoRollCanvas, SettingsPanel, etc.) | 1 week | Regression safety net |
| 🔵 P3 | Consider porting the largest Canvas components (PianoRoll, PitchCanvas) to WebGPU/OffscreenCanvas for 2-3x rendering performance | 2 weeks | Future-proof rendering pipeline |

---

## Appendix: File-by-File Health Scores

| File | Lines | Issues | Health |
|------|-------|--------|--------|
| `src/lib/piano-roll.ts` | 4,911 | God Object, XSS, innerHTML, O(N) hit-test | 🔴 38/100 |
| `src/components/StemMixer.tsx` | 4,838 | God Component, tight coupling | 🔴 35/100 |
| `src/App.tsx` | 2,681 | God Component, 109 imports, 44 signals | 🟠 42/100 |
| `src/stores/app-store.ts` | 2,461 | God Store, 221 exports, mixed concerns | 🟠 45/100 |
| `src/components/VocalAnalysis.tsx` | 3,108 | Large component, moderate coupling | 🟡 58/100 |
| `src/components/PitchTestingTab.tsx` | 2,429 | Large component | 🟡 60/100 |
| `src/lib/audio-engine.ts` | 2,057 | Complexity OK, well-structured class | 🟢 72/100 |
| `src/db/adapters/*` | ~400 | Clean adapter pattern | 🟢 85/100 |
| `workers/db-worker/src/auth.ts` | 663 | Production-grade, well-tested | 🟢 88/100 |
| `workers/db-worker/src/index.ts` | 499 | Clean CRUD, proper access control | 🟢 82/100 |
| `workers/db-worker/src/tables.ts` | 47 | Excellent allowlist pattern | 🟢 90/100 |

---
**Report Generated:** 2026-06-27 | **Auditor:** Principal Code Auditor | **Repo:** `/root/mercurypitch-clod-second`
