---
name: memory
description: Load project memory — git rules, deploy policy, and SolidJS patterns for this repo. Use when the user invokes /memory, or before work that touches git workflow, deployment, or SolidJS component conventions.
---

# Claude Memory Skill

Loads project-specific rules, preferences, and patterns on demand. Use `/memory` to invoke.

## User & Workflow

- **Deploy**: NEVER deploy to live site unless user explicitly asks

## Git Rules

- **Never `git reset --hard` to rebase** — use `git rebase origin/<branch>` (note the slash), then push with `--force-with-lease`
- **Never plain `--force` push** — `--force-with-lease` only, and only after a rebase; otherwise add commits on top and undo with `git revert`
- **Use `gh` CLI** for issues/PRs — project convention; never WebFetch for GitHub

## SolidJS Patterns

### Component Structure (top to bottom)
1. Signals (`createSignal`) at the very top
2. Memos and effects (`createMemo`, `createEffect`)
3. Regular functions and event handlers
4. JSX return at the bottom

### Props — NEVER Destructure
```tsx
// CORRECT — plain value props, read via props.* at the use site
interface ModalProps {
  isOpen: boolean
  close: () => void
}
<Modal isOpen={isModalOpen()} close={() => setModalOpen(false)} />
// inside the component:
<Show when={props.isOpen}>...</Show>

// WRONG — breaks the reactive getter
const { isOpen, close } = props
```

Accessor props (`() => boolean`) are only for non-JSX boundaries such as hooks:
`useFocusTrap(() => dialogRef, { isOpen: () => props.isOpen, onClose: () => props.close() })`

### Modals
- Match the existing modals (`LibraryModal`, `ScaleBuilder`, `WalkthroughModal`, ...): `isOpen: boolean` + `close: () => void` + `useFocusTrap`
- For "are you sure?" prompts reuse `ConfirmDialog`

### Control Flow
- `<Show when={condition()}>` not `condition() && <div>`
- `<For each={items()}>` for lists

### Derived State
- `createMemo` for computed values; `createEffect` only for DOM/external side effects
- Signals for primitives; stores (`createStore`) for complex nested state

---

See also: `.claude/memory/` for individual source files.
