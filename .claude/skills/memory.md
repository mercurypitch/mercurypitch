# Claude Memory Skill

Loads project-specific rules, preferences, and patterns on demand. Use `/memory` to invoke.

## User & Workflow

- **Deploy**: NEVER deploy to live site unless user explicitly asks

## Git Rules

- **Never `git reset --hard` to rebase** — use `git rebase origin <branch>`, then `--force-with-lease`
- **Never force push** — add commits on top, revert with `git revert` if needed
- **Use `gh` CLI** for issues/PRs — repos are private, WebFetch can't access



## SolidJS Patterns

### Component Structure (top to bottom)
1. Signals (`createSignal`) at the very top
2. Memos and effects (`createMemo`, `createEffect`)
3. Regular functions and event handlers
4. JSX return at the bottom

### Modal Props — NEVER Destructure
```tsx
// ✅ CORRECT — preserves reactivity
interface ModalProps {
  isOpen: () => boolean
  close: () => void
}
<Modal isOpen={props.isOpen} close={props.close} />

// ❌ WRONG — breaks signal connection
const { isOpen, close } = props
```

### createModalControl Pattern
```tsx
export function createModalControl() {
  const [isOpen, setIsOpen] = createSignal(false)
  return { isOpen, setIsOpen, open: () => setIsOpen(true), close: () => setIsOpen(false) }
}
```

### Control Flow
- `<Show when={condition()}>` not `condition() && <div>`
- `<For each={items()}>` for lists

---

See also: `.claude/memory/` for individual source files.
