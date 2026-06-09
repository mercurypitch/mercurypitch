# MercuryPitch SolidJS Refactoring Audit

This audit evaluates the codebase against the established SolidJS Refactoring Plan, focusing on anti-patterns, modularity, and adherence to reactive best practices.

## 1. Modularity & Architecture Constraints (Component Size)
The following components grossly exceed the 200-line strict limit, indicating a severe lack of separation of concerns between UI, State, and Core logic.

*   `src/components/StemMixer.tsx`: **8,278 lines** (Critical violation)
*   `src/App.tsx`: **1,862 lines** (Major violation)
*   `src/components/VocalChallenges.tsx`: **1,656 lines** (Major violation)
*   `src/components/PitchTestingTab.tsx`: **1,324 lines** (Major violation)
*   `src/components/LibraryModal.tsx`: **1,310 lines** (Major violation)

**Recommendation:**
Break down `StemMixer.tsx` immediately. Isolate API networking, UVR logic, UI components, and state into distinct feature-sliced modules (`/features/stem-mixer/*`). `App.tsx` should be reduced to root providers and layout routing.

## 2. SolidJS Best Practices & Anti-Pattern Discoveries

### A. Abuse of `createEffect`
Signal setters are being invoked inside reactive effect blocks, which triggers infinite loops and forces redundant recalculations.

**Instances Identified:**
1.  **`src/components/UvrSettings.tsx` (Lines 83-88)**
    ```typescript
    createEffect(() => {
      setUvrMode(mode())
      setUvrVocalIntensity(vocalIntensity())
      setUvrInstrumentalIntensity(instrumentalIntensity())
      setUvrSmoothing(smoothing())
    })
    ```
    *Fix:* This state synchronization is an anti-pattern. Local signals (`mode`, `vocalIntensity`) should directly update the store upon user interaction (`onChange`), removing the need for a reactive sync loop entirely.

2.  **`src/components/Walkthrough.tsx` (Lines 53-61)**
    ```typescript
    createEffect(() => {
      if (!walkthroughActive()) return
      const step = currentStep()
      if (step?.requiredTab && activeTab() !== step.requiredTab) {
        setActiveTab(step.requiredTab)
      }
    })
    ```
    *Fix:* `activeTab` manipulation should be derived or directly integrated into the logic responsible for advancing the walkthrough step (`nextWalkthroughStep`), not passively synced via `createEffect`.

3.  **`src/components/WalkthroughModal.tsx`**
    Syncs `setCurrentWalkthrough` and `setCurrentStepIndex` inside an effect reacting to route data.

### B. Improper Control Flow inside JSX
JSX elements contain standard JavaScript `.map` instances instead of SolidJS natively optimized `<For>` tags. While many `.map` usages are safely inside generic business logic, the following map patterns exist within UI context contexts:

*   **`src/components/StemMixer.tsx`**: Heavy reliance on nested mapping over `lines` arrays in UI layers (`lrc.map`, `lines.map`). This forces full DOM teardowns during updates.
*   **`src/components/LibraryTab.tsx`**: Legacy mapping references found around `item.data.tags`.

**Recommendation:**
Refactor all JS-native `.map()` loops inside JSX elements to utilize `<For each={...}>` (for mapped keys) and `<Index each={...}>` (for primitive strings/numbers).

### C. Prop Destructuring
No explicit instances of `const { something } = props;` were discovered! The codebase successfully adheres to the property-access paradigm (`props.value`), maintaining reactive integrity across prop boundaries.

### D. Run-Once Architecture Evaluation
The overall architecture struggles heavily with component over-inflation because reactive business logic (such as initializing audio engines and syncing state) is stuffed directly into component setup functions (e.g., `App.tsx`). This bloats initialization and creates lifecycle coupling. 

## 3. Recommended Action Plan
1.  **Phase 1:** Fix the `createEffect` anti-patterns inside `UvrSettings.tsx`, `Walkthrough.tsx`, and `WalkthroughModal.tsx`.
2.  **Phase 2:** Tackle `StemMixer.tsx`. Extract all non-UI logic (LRC parsing, UVR handling, UI state syncing) into a `/features/stem-mixer` slice.
3.  **Phase 3:** Audit JSX inside `StemMixer.tsx` and convert `.map` into `<For>`.
