# CSS Modularization & Cross-Browser Strategy

**Date:** 2026-05-07
**Status:** Draft — do not execute until approved

---

## Context

The app currently has a single 11,114-line `src/styles/app.css` containing all global styles. Some component-level CSS already uses CSS Modules (8 files), which Vite handles natively:

```
src/styles/
  app.css           ← 11,114 lines (monolith)
  characters.css
  Notifications.module.css
  PresetPillGallery.module.css
  TabControls.module.css

src/components/
  EditorTabHeader.module.css
  HeaderControls.module.css
  MetronomeButton.module.css
  MicButton.module.css
  Tooltip.module.css
```

Vite 6 is already configured for CSS Modules (`camelCaseOnly` convention) and ships with Lightning CSS as its default CSS transformer for minification. However, there is no `browserslist` config, no vendor-prefixing pipeline, and no responsive-design token system.

The immediate trigger: manual `-webkit-slider-thumb` and `-moz-range-thumb` duplication found in `app.css` — the kind of vendor-prefix boilerplate that tooling should handle automatically.

---

## Recommendation

**Two additions to the existing stack — zero process changes required:**

| What | Why | Effort |
|------|-----|--------|
| **Lightning CSS (explicit config)** | Already shipped in Vite 6 but currently passive — enable vendor-prefix auto-injection and modern CSS transpilation via a `browserslist` target | ~15 min |
| **Open Props** (`open-props` npm package) | Design tokens as CSS custom properties — fluid responsive sizing, consistent spacing/shadows/colors, 0 runtime cost. Just import and use `var(--size-fluid-3)`. Pairs with existing CSS and CSS Modules. | ~30 min setup, then use incrementally |

CSS Modules are already configured — no new dependency needed for scoping. The modularization itself uses the existing `*.module.css` pattern, extracting one component's styles at a time.

### What we do NOT recommend

- **Tailwind CSS / UnoCSS** — would require rewriting 11K+ lines of existing CSS into utility classes. Massive effort for uncertain payoff. Worse: it sits on top of existing styles as a second system, creating specificity wars.
- **Panda CSS / Vanilla Extract** — compile-time CSS-in-JS libraries. Require migrating all styles into TypeScript objects. Overly invasive for the stated goal.
- **Full rewrite** — the existing CSS works. We modularize and augment, not replace.

---

## Plan

### Phase 1: Build-tool hardening (one-time setup, ~45 min)

#### 1a. Add browserslist target

```
# package.json
"browserslist": [
  "last 2 Chrome versions",
  "last 2 Firefox versions",
  "last 2 Safari versions",
  "last 2 Edge versions"
]
```

Vite 6 + Lightning CSS reads this and automatically:
- Adds missing vendor prefixes (no more manual `-webkit-` / `-moz-` duplication)
- Downlevels modern CSS features that aren't yet supported in the target set
- Only outputs prefixes that are actually needed per the target list

#### 1b. Enable explicit Lightning CSS transformer

Vite 6 ships Lightning CSS but uses it primarily for minification. Adding `css.transformer: 'lightningcss'` in `vite.config.ts` enables it for preprocessing too — CSS nesting, custom media queries, and color functions get compiled down to target-compatible output:

```ts
// vite.config.ts additions
css: {
  transformer: 'lightningcss',   // ← use for preprocessing, not just minification
  lightningcss: {
    drafts: { nesting: true },    // enable CSS nesting (Stage 1)
  },
  modules: {
    localsConvention: 'camelCaseOnly',
  },
},
```

**Result after Phase 1:** All CSS (global + modules) gets automatic vendor prefixing based on actual browser targets. No more manual prefix management.

### Phase 2: Design tokens via Open Props (~30 min)

#### 2a. Install

```bash
npm install open-props
```

#### 2b. Import in the existing global CSS

```css
/* src/styles/app.css, at the very top after the reset */
@import 'open-props/style';
@import 'open-props/normalize';   /* optional: lightweight normalize */
```

Open Props provides ~380 CSS custom properties, zero runtime:
- `--size-fluid-1` through `--size-fluid-6` — fluid responsive sizing (scales with viewport)
- `--font-size-0` through `--font-size-8` — type scale
- `--gray-0` through `--gray-12` — grays
- `--shadow-1` through `--shadow-6` — shadows
- `--radius-1` through `--radius-6` — border radii
- `--ease-1` through `--ease-5` — easing curves

#### 2c. Map existing CSS custom properties to Open Props

Replace hardcoded values in `:root` with Open Props tokens where they make sense:

```css
/* Before */
:root {
  --bg-primary: #0d1117;
  --border: #30363d;
  --radius-default: 6px;
}

/* After */
:root {
  --bg-primary: var(--gray-12);     /* Open Props */
  --border: var(--gray-7);          /* Open Props */
  --radius-default: var(--radius-2); /* Open Props fluid */
}
```

This is optional — Open Props can also be used alongside existing custom properties. The key win is for spacing/sizing where fluid tokens give responsive behavior for free.

### Phase 3: Incremental CSS Modules migration (ongoing, per-component)

Split the monolithic `app.css` into component-scoped `.module.css` files, one component at a time. No flag day — both global CSS and CSS Modules coexist during migration.

#### Pattern (already established in the codebase)

```
// Before (global CSS in app.css)
.pitch-testing-controls input[type='range'] { ... }

// After (CSS Module)
// src/components/PitchTestingTab.module.css
.rangeInput { ... }
.label { ... }

// src/components/PitchTestingTab.tsx
import styles from './PitchTestingTab.module.css'
// usage: <input class={styles.rangeInput} type="range" />
```

#### Migration order (highest impact first)

1. **PitchTestingTab** (~200 lines) — has the slider bug that triggered this work
2. **PitchOverTimeCanvas** (~80 lines) — self-contained canvas component
3. **PitchPracticeTab** — largest single consumer of app.css styles
4. **Remaining tabs** — each tab is a natural CSS boundary
5. **Layout/chrome** — header, footer, shared chrome

Each migration step:
1. Create `ComponentName.module.css` next to the component
2. Move the component's styles from `app.css` to the module
3. Update the TSX to use `import styles from './ComponentName.module.css'`
4. Delete the moved section from `app.css`
5. `npm run build` — verify no CSS compilation errors
6. `npm run test:run` — verify all 508 tests pass

#### Constraints

- Shared variables (`:root` custom properties) stay in a global CSS file — only component-specific styles move to modules
- Keep the existing `camelCaseOnly` convention (already in Vite config)
- Components that already have `.module.css` files (Tooltip, Notifications, etc.) are already done — no changes needed

### Phase 4: Responsive audit (after Phase 3 reaches critical mass)

Once Open Props fluid tokens are in use and components are modularized:

1. Use Open Props `--size-fluid-*` for padding, gaps, and font sizes — these scale with viewport automatically
2. Add container queries or media queries where fluid sizing isn't enough
3. Test on mobile viewports (320px–428px) and tablets (768px–1024px)

---

## Dependencies added

| Package | Size | Reason |
|---------|------|--------|
| `open-props` | ~30 KB (treeshakable via PostCSS JIT plugin if needed) | Design tokens, fluid sizing, cross-browser tested |
| No other new packages | — | CSS Modules and Lightning CSS are already in Vite |

---

## Risk & rollback

- **Open Props is additive** — it adds new CSS variables. If it conflicts with an existing `:root` variable name (unlikely — they use namespaced names like `--gray-*`, `--size-*`), rename the project variable.
- **Lightning CSS is already bundled** — enabling its transformer mode just activates more features on the same binary. If it breaks a specific rule, set `css.transformer: undefined` to fall back to Vite's vanilla PostCSS pipeline.
- **CSS Modules migration is per-component** — if a module causes issues, delete it and keep that component's styles in `app.css` until the issue is resolved. No global regression possible.

---

## Verification

1. `npm run build` — no errors, CSS output size comparable to baseline
2. `npm run test:run` — all 508 tests pass
3. Visual: open the app in Chrome + Firefox, verify sliders and layout render identically
4. Visual: test at 375px viewport width — verify no horizontal overflow, controls reflow correctly
