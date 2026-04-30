# SolidJS Best Practices for PitchPerfect

## Control-Flow Components

- Use `<Show when={condition()}>` for conditional rendering (child only evaluates when truthy)
- Use `<For each={items()}>` for list rendering (preserves item identity, minimal DOM updates)
- Avoid inline JS conditionals like `&&` in JSX

## Props & Signal Usage (CRITICAL)

- **Call signal functions when passing to JSX**: `<User id={id()} />`
- **Access props directly**: `props.isOpen` (preserve getter/reactive connection)
- **DO NOT destructure props**: `const { isOpen } = props` breaks reactivity
- Signal functions become dependencies when read inside JSX or reactive scopes

## Reactivity Wrappers

- Wrap signal reads in functions when needed inside component bodies
- Execute inside reactive scope (createEffect or JSX)
- Use `createMemo` for derived computed values to avoid recalculation
- Use `createEffect` sparingly—only for DOM/external library interaction

## State Management

- Use signals for primitives/simple values
- Use stores for complex/nested objects with fine-grained reactivity
- Stores allow property-level updates (nested mutation without replacing entire object)
- Derive values declaratively with `createMemo` instead of syncing with `createEffect`

## Modal Pattern

Current pattern is actually correct for SolidJS:
```tsx
interface LibraryModalProps {
  isOpen: () => boolean  // Signal getter - calls signal to read
  close: () => void
}

// Inside component:
<Show when={props.isOpen()}>
  <div class="modal-overlay" style={{ display: props.isOpen() ? 'flex' : 'none' }}>
```

This is NOT "lunatic" — it's the recommended way to pass signals as props in SolidJS.

Why `isOpen: () => boolean`:
- Preserves the reactive connection
- When `isOpen` signal changes, Solid tracks the function call in JSX
- Destructuring `const { isOpen } = props` breaks the signal connection
- The function is called at render time to get the current value

## Recommended Abstraction Component

```tsx
// This is what "lunatic" might refer to - a controlled component wrapper
export function createModalControl() {
  const [isOpen, setIsOpen] = createSignal(false)

  return {
    isOpen,
    setIsOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((v) => !v)
  }
}

// Usage in parent:
const modalControl = createModalControl()

// Pass as getter:
<LibraryModal isOpen={modalControl.isOpen} close={modalControl.close} />
```

This pattern can be cleaner but the current getter pattern is also valid and commonly used.