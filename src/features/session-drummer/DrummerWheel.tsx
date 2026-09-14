// A real, accessible listbox provides the tactile wheel without making the background image interactive.
import { createSignal, createUniqueId, For, onCleanup, onMount } from 'solid-js'
import styles from './SessionDrummer.module.css'

export interface DrummerWheelOption {
  value: string
  label: string
}
export function DrummerWheel(props: {
  label: string
  options: readonly DrummerWheelOption[]
  value: string
  onChange(value: string): void
}) {
  const id = createUniqueId()
  let viewport!: HTMLDivElement
  let origin: { y: number; index: number; pointerId: number } | null = null
  let dragged = false
  let lastWheel = -Infinity
  const [offset, setOffset] = createSignal(0)
  const index = () =>
    Math.max(
      0,
      props.options.findIndex((option) => option.value === props.value),
    )
  const select = (next: number) => {
    if (props.options.length === 0) return
    const option =
      props.options[Math.max(0, Math.min(props.options.length - 1, next))]
    props.onChange(option.value)
  }
  onMount(() => {
    const scroll = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 3) return
      event.preventDefault()
      if (performance.now() - lastWheel < 120) return
      lastWheel = performance.now()
      select(index() + Math.sign(event.deltaY))
    }
    viewport.addEventListener('wheel', scroll, { passive: false })
    onCleanup(() => viewport.removeEventListener('wheel', scroll))
  })
  const finish = (cancel = false) => {
    if (!origin) return
    if (!cancel && dragged) select(origin.index - Math.round(offset() / 44))
    origin = null
    setOffset(0)
  }
  return (
    <div class={styles.wheelColumn}>
      <span id={`${id}-label`} class={styles.wheelLabel}>
        {props.label}
      </span>
      <div
        ref={viewport}
        class={styles.wheel}
        role="listbox"
        tabIndex={0}
        aria-labelledby={`${id}-label`}
        aria-activedescendant={`${id}-${index()}`}
        on:keydown={(event) => {
          const next =
            event.key === 'ArrowDown'
              ? index() + 1
              : event.key === 'ArrowUp'
                ? index() - 1
                : event.key === 'Home'
                  ? 0
                  : event.key === 'End'
                    ? props.options.length - 1
                    : null
          if (next === null) return
          event.preventDefault()
          select(next)
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return
          dragged = false
          origin = {
            y: event.clientY,
            index: index(),
            pointerId: event.pointerId,
          }
          viewport.focus({ preventScroll: true })
        }}
        onPointerMove={(event) => {
          if (!origin || origin.pointerId !== event.pointerId) return
          const delta = event.clientY - origin.y
          if (Math.abs(delta) > 7) {
            dragged = true
            viewport.setPointerCapture(event.pointerId)
          }
          if (dragged) setOffset(Math.max(-132, Math.min(132, delta)))
        }}
        onPointerUp={() => finish()}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => finish(true)}
      >
        <div class={styles.wheelSelection} aria-hidden="true" />
        <div
          class={styles.wheelTrack}
          style={{
            transform: `translateY(${44 - index() * 44 + offset()}px)`,
            transition: offset() === 0 ? undefined : 'none',
          }}
        >
          <For each={props.options}>
            {(option, optionIndex) => (
              <button
                type="button"
                role="option"
                tabIndex={-1}
                id={`${id}-${optionIndex()}`}
                aria-selected={props.value === option.value}
                title={option.label}
                onClick={() => {
                  if (!dragged) select(optionIndex())
                  dragged = false
                }}
              >
                {option.label}
              </button>
            )}
          </For>
        </div>
      </div>
    </div>
  )
}
