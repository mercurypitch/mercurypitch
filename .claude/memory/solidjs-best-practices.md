# SolidJS Best Practices

## Modal Props Pattern (GOTCHA - DO NOT DESTRUCTURE)

```tsx
// ✅ CORRECT:
interface LibraryModalProps {
  isOpen: () => boolean  // Signal getter - preserves reactivity
  close: () => void
}
<LibraryModal isOpen={props.isOpen} close={props.close} />

// ❌ WRONG - breaks reactivity:
const { isOpen, close } = props
```

## Recommended: createModalControl

```tsx
export function createModalControl() {
  const [isOpen, setIsOpen] = createSignal(false)
  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }
}
```

## Control-Flow
- Use `<Show when={condition()}>` not `condition() && <div>`
- Use `<For each={items()}>` for lists
