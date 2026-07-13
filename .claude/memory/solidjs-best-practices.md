---
name: solidjs-best-practices
description: "SolidJS props and control-flow conventions used in this codebase: never destructure props, plain value props, Show/For"
type: reference
---
# SolidJS Best Practices

## Props Pattern (GOTCHA - DO NOT DESTRUCTURE)

Props are reactive getters. Destructuring reads them once and breaks reactivity.

```tsx
// CORRECT - plain value props, read via props.* at the use site
interface LibraryModalProps {
  isOpen: boolean
  close: () => void
}
<LibraryModal isOpen={isModalOpen()} close={() => setModalOpen(false)} />
// inside the component:
<Show when={props.isOpen}>...</Show>

// WRONG - breaks reactivity:
const { isOpen, close } = props
```

Accessor props (`() => boolean`) are only for non-JSX boundaries such as hooks,
where there is no JSX getter wrapping the value:

```tsx
useFocusTrap(() => dialogRef, {
  isOpen: () => props.isOpen,
  onClose: () => props.close(),
})
```

## Modals

- Match the existing modal components (`LibraryModal`, `ScaleBuilder`, `WalkthroughModal`, ...):
  `isOpen: boolean` + `close: () => void` props, `useFocusTrap` for focus/escape handling.
- For "are you sure?" prompts reuse `ConfirmDialog` (`open`, `title`, `message`, `onConfirm`, `onCancel`).

## Derived State

- `createMemo` for computed values; `createEffect` only for DOM/external side effects.
- Signals for primitives; stores (`createStore`) for complex nested state.

## Control-Flow
- Use `<Show when={condition()}>` not `condition() && <div>`
- Use `<For each={items()}>` for lists
