---
name: solidjs-best-practices
description: 'SolidJS props and control-flow conventions used in this codebase: never destructure props, plain value props, Show/For'
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

### createMemo runs IMMEDIATELY (GOTCHA)

A memo's body executes the moment the memo is created, not on first read. So
every helper a memo calls must be **declared above it** in the component. A
`const` arrow declared further down is in its temporal dead zone, and the
memo dies with `ReferenceError: Cannot access 'x' before initialization`.

This hides brilliantly, because the crash needs data to reach the helper:

```tsx
// WRONG — threw on every device that had a song, and on none that did not
const pickable = createMemo(() => sendable().filter(fits))   // []  → fits never runs
const fits = (s: UvrSession) => !tooBigForPeer(estimate(s))
const tooBigForPeer = (bytes: number) => ...                 // ← declared below
```

An empty list means `.filter(fits)` never calls `fits`, so an empty library
mounts fine and a populated one throws. Worse, the FIRST failure is
swallowed: the memo keeps `undefined`, and what surfaces is a
`Cannot read properties of undefined` from whichever memo reads it next —
pointing at a line that is not the bug.

Real case: `SyncDevicesModal` (2026-08-13). Caught by `src/e2e-devices`, not
by any unit test, until `src/components/__tests__/SyncDevicesModal.test.tsx`
was written to mount the list **with songs in it**. Mount-with-data is the
test shape this needs; mount-empty proves nothing.

## Control-Flow

- Use `<Show when={condition()}>` not `condition() && <div>`
- Use `<For each={items()}>` for lists
