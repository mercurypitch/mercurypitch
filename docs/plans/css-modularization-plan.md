# CSS Modularization Plan: Painless Transition to `.module.css`

## The Challenge
The project currently relies on a massive `src/styles/app.css` (over 12,000 lines). This monolithic structure causes global namespace collisions, makes dead-code elimination impossible, and degrades developer experience. 

## The Goal
Safely decompose `app.css` into co-located, component-scoped CSS Modules (e.g., `ComponentName.module.css`) iteratively, without causing visual regressions.

---

## The Strategy: "Bottom-Up Strangler Fig"
A massive rewrite will break the UI. Instead, we will use a gradual "strangler fig" approach—extracting one component's styles at a time while leaving the rest of the app untouched.

### Phase 1: Establish the Global Foundation
Before moving component styles, we must secure global tokens so modules can reference them.
1. **Isolate CSS Variables:** Ensure all `:root` CSS variables (colors, fonts, z-indexes) remain in `app.css` (or a new `theme.css`) so they act as the global source of truth.
2. **Leave Resets & Utilities Alone:** Keep global resets (`*, *::before`), base typography (`body`, `h1`), and generic utility classes (`.flex-center`) in the global stylesheet. Do not modularize global layouts yet.

### Phase 2: The Component Extraction Loop
For each target component, perform this strict, 4-step execution loop:

1. **Scaffold the Module:** 
   * Create a co-located file: `src/components/MyComponent.module.css`.
2. **Extract & Flatten:** 
   * Cut the specific CSS block for that component from `app.css` and paste it into the new module.
   * *Crucial Step:* Flatten the selectors. In `app.css`, you might have `.my-component .header .title`. In a CSS module, simplify this to just `.title`. The module bundler will automatically generate unique hashes to prevent collisions.
   * Convert dashed class names to camelCase if your Vite config uses `localsConvention: 'camelCaseOnly'` (e.g., `.submit-btn` -> `.submitBtn`).
3. **Wire the Component:**
   * In `MyComponent.tsx`, add: `import styles from './MyComponent.module.css'`
   * Replace static classes: `<div class="submit-btn">` becomes `<div class={styles.submitBtn}>`.
   * For conditional classes, use template literals: `<div class={`${styles.btn} ${isActive() ? styles.active : ''}`}>`
4. **Handle Exceptions with `:global()`:** 
   * If the component *must* override a third-party library or a child component's internal class, use the `:global(.target-class)` escape hatch within the module.

### Phase 3: Prioritized Execution Order
To minimize risk, execute the extraction in domains:
1. **Low-Hanging Fruit (UI Primitives):** Modals, Buttons, Toggles, Tooltips, Inputs. These have small, isolated styles.
2. **Mid-Level Panels:** `SettingsPanel`, `LibraryTab`, `CommunityShare`.
3. **Massive Canvases/Feature Slices:** `PianoRollCanvas`, `StemMixer`, `PitchCanvas`. By the time we reach these, the global CSS file will be much smaller and easier to untangle.
4. **App Shell:** `App.tsx`, `AppSidebar.tsx`.

### Phase 4: The Final Purge
Once all components have their own `.module.css` files, the monolithic `app.css` should be nearly empty.
1. **Dead Code Elimination:** Any specific class blocks left in `app.css` at this stage are orphaned/dead code. Delete them.
2. **Final Global Review:** Only CSS variables, resets, and core typography should remain in the global stylesheet.
