# SolidJS Project Conventions

Adopted from chaos-master monorepo analysis (Komediruzecki/chaos-master)

## Project Structure

```
src/
├── components/    # Reusable UI components
├── contexts/      # React Context providers
├── lib/           # Core business logic and utilities
├── styles/        # Modular CSS (preflight, design-system, index.css)
├── utils/         # Helper functions and custom hooks
└── types/         # TypeScript type definitions
```

## Component Architecture

### Directory Pattern
- Components organized by purpose, named in PascalCase (singular nouns)
- Each component directory contains:
  - `<Component>.tsx` - Main component
  - `<Component>.module.css` - Scoped styles (CSS modules)

### Component Structure
```tsx
export interface ComponentProps {
  // Props typed with explicit types
  prop: Type
}

export function Component(props: ComponentProps) {
  // Use SolidJS signals/memo/store for state
  const [signal, setSignal] = createSignal<Value>()

  return (
    <div class={styles.wrapper}>
      {/* JSX with CSS modules */}
    </div>
  )
}
```

## State Management Patterns

### Signals
For simple reactive values:
```tsx
const [theme, setTheme] = createSignal<Theme>('dark')

// Access with ()
const currentTheme = theme()
// Set with ()
setTheme('light')
```

### Context Providers
```tsx
export const ThemeContext = createContext<{
  theme: Accessor<Theme>
  setTheme: (value: Theme) => void
}>()

export function ThemeContextProvider(props: ParentProps) {
  const [theme, setTheme] = createSignal<Theme>('dark')

  createEffect(() => {
    document.body.dataset.theme = theme()
  })

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {props.children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContextSafe(ThemeContext, 'useTheme', 'ThemeContext')
}
```

### Safety Utility
```tsx
// Provides type-safe context access with helpful errors
export function useContextSafe<T>(
  context: Context<T>,
  hookName: string,
  providerComponentName: string,
)
```

### Styled Store (Complex State)
```tsx
import { createStore } from 'solid-js/store'
import { createStoreHistory } from '@/utils/createStoreHistory'

const [state, setState] = createStore({
  // nested state
})

const [historyState, historySetState, historyController] = createStoreHistory([
  state,
  setState,
])

// Undo/Redo
historyController.undo()
historyController.redo()
```

## CSS Modularity

### Design System (designSystem/)

**colors.css** - Color tokens using OKLCH
```css
:root {
  --neutral-50: oklch(0.985 0 0);
  --neutral-100: oklch(0.97 0 0);
  /* ... through 950 */
}
```

**layout.css** - Spacing tokens
```css
:root {
  --spacing: 0.25rem;
  --space-1: var(--spacing);
  --space-2: calc(var(--spacing) * 2);
  /* ... through 8 */
}
```

**dark-mode.css** - Theme overrides via data attribute
```css
body[data-theme='dark'] {
  background-color: black;
}
```

### Module Styles
```css
/* ComponentName.module.css */
.container {
  color: var(--text-primary);
}
```

### Global Entry (index.css)
- Imports design system
- Sets default fonts (Inter)
- Global body styles

## Custom Hooks

### Event Handlers
```tsx
// createDragHandler - Pointer event handling with capture
export function createDragHandler(
  createHandlers: CreateClickAndDragHandler,
  { deadZoneRadius = 0, preventDefault = true }: Options = {},
)
```

### Animation
```tsx
// createAnimationFrame - Throttled animation loop
export function createAnimationFrame(callback: FrameCallback)
```

## Utility Patterns

### History-Aware Updates
```tsx
// compose history setter with produce()
historySetState((draft) => {
  draft.prop = newValue
}, 'description')

// Preview changes before commit
historyController.startPreview()
// ... modifications
historyController.commit()
```

## Build Configuration

### Vite
- SolidJS plugin (`vite-plugin-solid`)
- SVG as components (`vite-plugin-solid-svg`)
- Path aliases (`@/*` → `./src/*`)
- CSS modules (camelCase naming)

### TypeScript
- Extends root tsconfig
- Path aliases
- Module resolution configured