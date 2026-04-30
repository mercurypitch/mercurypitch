# SolidJS Skills for This Project

## Signals

Access values with `()` function call:
```tsx
const [value, setValue] = createSignal<number>(0)
value()      // read
setValue(5)  // write
```

**Use when:** Simple reactive values, UI state, ephemeral data

## Signals vs Stores

**Signals:** Lightweight, direct access (`signal()`)
**Stores:** Batch updates, deep reactivity, undo/redo support
- Store setters return new reference → triggers reactivity automatically
- Better for complex nested state

## Context Providers

```tsx
export const MyContext = createContext<Type>()

export function MyProvider(props: ParentProps) {
  const [value, setValue] = createSignal<InitialType>()

  return (
    <MyContext.Provider value={{ value, setValue }}>
      {props.children}
    </MyContext.Provider>
  )
}
```

**Pattern:** Store common state at top of component tree, pass down via context

## Effects

Run side effects when dependencies change:
```tsx
createEffect(() => {
  console.log('When signal changes...')
})
```

**Common uses:**
- Update DOM from state
- Subscribe to external services
- Initialize resources

## ForEach

Iterate over signals:
```tsx
createSignal<Type[]>([])
// ... in JSX:
<For each={items()}>
  {(item) => <div>{item}</div>}
</ForEach>
```

## CSS Modules

Named classes with `.module.css` suffix:
```tsx
import styles from './Component.module.css'

<div class={styles.container}>content</div>
```

**Benefits:**
- Scoped styles
- Type-safe class names (with declarations file)

## Event Handlers

Use `on:event` for React-style event handlers:
```tsx
<button onClick={() => handleClick()}>Click</button>
<input onKeyDown={(e) => handleKey(e)} />
```

## Accessor Types

```tsx
import type { Accessor, Setter } from 'solid-js'

const [signal, setSignal] = createSignal<Value>()

// Accessor is a signal's getter function
type: Accessor<Value>

// Setter is a function
type: Setter<Value>
```

## onCleanup

Register cleanup when component unmounts:
```tsx
createEffect(() => {
  const handler = () => console.log('clean')
  document.addEventListener('click', handler)

  return () => document.removeEventListener('click', handler)
})
```

## createMemo

Computed derived values:
```tsx
const doubled = createMemo(() => value() * 2)

// Memoizes until dependencies (value) change
```

## History Pattern for Undo/Redo

```tsx
const [state, setState] = createStore<Type>(initial)
const [historyState, historySetState, controller] = createStoreHistory([
  state,
  setState,
])

// Changes with description
historySetState((draft) => {
  draft.prop = newValue
}, 'update title')

// Undo/Redo
controller.undo()  // One step back
controller.redo()  // One step forward
```

## Portal

Render component in different location:
```tsx
import { Portal } from 'solid-js/web'

<Portal mount={document.getElementById('modal-root')}>
  <Modal />
</Portal>
```

## startViewTransition

Smooth view transitions:
```tsx
document.startViewTransition(() => {
  setState(...changes)
})
```

## createPinchHandler

Two-finger touch pinch:
```tsx
const { pinch, stop } = createPinchHandler((scale) => {
  // Handle pinch
})

<div onPointerDown={startPinch} />
```

## Pointer Events Pattern

```tsx
const [isDragging, setIsDragging] = createSignal(false)
let startX = 0

const handlePointerDown = (e: PointerEvent) => {
  startX = e.clientX
  setIsDragging(true)
  e.target.setPointerCapture(e.pointerId)
}

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging()) return
  const dx = e.clientX - startX
  // Handle movement
}

const handlePointerUp = (e: PointerEvent) => {
  setIsDragging(false)
  e.target.releasePointerCapture(e.pointerId)
}
```

## Signal Equality

Disable signal batching:
```tsx
const [signal, setSignal] = createSignal(
  initial,
  { equals: false } // Always trigger reactivity
)
```

## ParentProps

Component that wraps children:
```tsx
export interface MyComponentProps extends ParentProps {
  title?: string
}

export function MyComponent(props: MyComponentProps) {
  // props.children contains wrapped elements
}
```

## Accessor Wrapping

Expose signal as Accessor in context:
```tsx
export const ThemeContext = createContext<{
  theme: Accessor<Theme>  // Instead of Theme
}>()
```