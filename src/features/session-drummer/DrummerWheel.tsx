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
  let origin: {
    x: number
    y: number
    index: number
    pointerId: number
    optionIndex: number | null
  } | null = null
  let dragged = false
  let lastWheel = -Infinity
  const [offset, setOffset] = createSignal(0)
  const resetNativeScroll = () => {
    // The wheel positions options with a transform. A focused option whose
    // untransformed box sits below the viewport must not make overflow:hidden
    // add a second, invisible scroll offset.
    if (viewport.scrollTop !== 0) viewport.scrollTop = 0
    if (viewport.scrollLeft !== 0) viewport.scrollLeft = 0
  }
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
    viewport.addEventListener('scroll', resetNativeScroll, { passive: true })
    onCleanup(() => {
      viewport.removeEventListener('wheel', scroll)
      viewport.removeEventListener('scroll', resetNativeScroll)
    })
  })
  const finish = (cancel = false, tapped: number | null = null) => {
    if (!origin) return
    if (!cancel && dragged) select(origin.index - Math.round(offset() / 44))
    else if (!cancel && tapped !== null) select(tapped)
    origin = null
    setOffset(0)
    resetNativeScroll()
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
          if (event.button !== 0 || !event.isPrimary || origin) return
          dragged = false
          const option = (event.target as Element).closest<HTMLButtonElement>(
            'button[data-option-index]',
          )
          origin = {
            x: event.clientX,
            y: event.clientY,
            index: index(),
            pointerId: event.pointerId,
            optionIndex: option ? Number(option.dataset.optionIndex) : null,
          }
          viewport.focus({ preventScroll: true })
        }}
        onPointerMove={(event) => {
          if (!origin || origin.pointerId !== event.pointerId) return
          const delta = event.clientY - origin.y
          if (!dragged && Math.abs(delta) > 7) {
            dragged = true
            viewport.setPointerCapture(event.pointerId)
          }
          if (dragged) setOffset(Math.max(-132, Math.min(132, delta)))
        }}
        onPointerUp={(event) => {
          if (event.pointerId !== origin?.pointerId) return
          const touch = event.pointerType !== 'mouse'
          const tapped =
            touch &&
            Math.hypot(event.clientX - origin.x, event.clientY - origin.y) <= 7
              ? origin.optionIndex
              : null
          finish(false, tapped)
          // Chrome can omit the compatibility click immediately after a swipe.
          // Commit a touch tap on release, and suppress any duplicate click.
          if (touch) dragged = true
        }}
        onPointerCancel={(event) => {
          if (event.pointerId === origin?.pointerId) finish(true)
        }}
        onLostPointerCapture={(event) => {
          // Touch initially captures the option button. Its loss bubbles when
          // the wheel takes over: that transfer is not a cancelled gesture.
          if (
            event.target === viewport &&
            event.pointerId === origin?.pointerId
          )
            finish(true)
        }}
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
                data-option-index={optionIndex()}
                aria-selected={props.value === option.value}
                title={option.label}
                onClick={(event) => {
                  if (!dragged || event.detail === 0) select(optionIndex())
                  dragged = false
                  viewport.focus({ preventScroll: true })
                  resetNativeScroll()
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
