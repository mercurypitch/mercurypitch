# Codebase Audit & Phased Improvement Plan — PitchPerfect v0.3.0

**Branch:** `feat/codebase-audit-improvements` (from `dev`)
**Date:** 2026-05-12
**Tests:** 1013 passing, 0 failing

## Data Storage: localStorage vs IndexedDB

Both are used, appropriately:
- **Dexie/IndexedDB** (`src/db/`) — Repository pattern for sessions, melodies, presets (large/structured data)
- **localStorage** — 21 files, for small data: settings, theme, walkthrough state, UI preferences, UVR session IDs

The plan's Phase 2.3 (storage abstraction layer) remains valid — 94 direct `localStorage` calls across 16 non-test files warrant a typed wrapper.

---

## Phase 1: Safety & Stability

### 1.1 Gate `window.__pp` behind test utils
- **File:** `src/lib/e2e-bridge.ts:41`
- **Change:** Wrap `window.__pp` assignment in same `exposeForE2E`-compatible gate that individual exposures already use

### 1.2 Add per-tab ErrorBoundary wrappers
- **Files:** `src/components/AppErrorBoundary.tsx`, `src/App.tsx`
- **Approach:** Create `<TabErrorBoundary>` and wrap each `<Show when={activeTab() === TAB_X}>` block
- **Risk:** Low — Solid's built-in `ErrorBoundary`

### 1.3 Replace `window.dispatchEvent` with shared EventBus
- **Files:** `src/lib/piano-roll.ts` (4 dispatchEvent calls), `src/components/PitchCanvas.tsx` (1 call), `src/features/events/usePianoRollEvents.ts`, `src/lib/dom-utils.ts`
- **Approach:** Create a shared `EventBus` (EventTarget) exported from a new module. Replace `window.dispatchEvent`/`window.addEventListener` with bus methods. Remove dead `dispatchCustomEvent` from dom-utils.ts.
- **Risk:** Medium — piano-roll.ts is large; needs test verification
- **Events:** `pitchperfect:seekToBeat`, `pitchperfect:octaveChange`, `pitchperfect:modeChange`

---

## Phase 2: Architecture Cleanup

### 2.1 Extract hash routing from App.tsx
- **Files:** `src/App.tsx` → new `src/features/routing/useHashRouter.ts`

### 2.2 Replace production `window.__playSessionSequence` calls with Context
- **Files:** `LibraryTab.tsx`, `LibraryModal.tsx`, `SessionLibraryModal.tsx`

### 2.3 Create storage abstraction layer
- **File:** Expand `src/lib/storage.ts`

---

## Phase 3: Performance

### 3.1 Lazy-load large tab components
### 3.2 Memoize deeply nested signal access in App.tsx

---

## Phase 4: Testing & Type Hardening

### 4.1 Enable `noUnusedLocals` and `noUnusedParameters`
### 4.2 Add Zod validation for external API payloads
### 4.3 Convert remaining `any` casts to `unknown`

---

## Phase 5: StemMixer Decomposition

### 5.1 Separate audio processing from UI
### 5.2 Add component tests

---

## Verification

After each phase:
1. `pnpm test:run` — all 1013 tests must pass
2. `pnpm typecheck` — zero errors
3. `pnpm lint` — no new warnings
4. `pnpm build` — successful production build
