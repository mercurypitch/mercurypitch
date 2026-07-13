---
name: solidjs-component-pattern
description: "SolidJS component organization: signals first, effects/memos, functions, JSX at bottom"
type: reference
---
**Rule**: All signals at the top, then effects/memos, then functions, then JSX at bottom.

**Order**:
1. `createSignal` declarations (signals, reactive state)
2. `createMemo`, `createEffect` declarations
3. Regular functions and event handlers
4. JSX return statement

```tsx
export const MyComponent: Component<Props> = (props) => {
  // 1. Signals
  const [count, setCount] = createSignal(0)

  // 2. Memos and effects
  const doubleCount = createMemo(() => count() * 2)

  // 3. Functions
  const increment = () => setCount(count() + 1)

  // 4. JSX
  return <button onClick={increment}>Count: {doubleCount()}</button>
}
```
