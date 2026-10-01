// Adventure touch controls — stick, look and jump never steal each other's pointer.
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import { sampleFloatingStick } from './floating-stick'
import styles from './GlassAdventure.module.css'
import type { AdventureInput } from './input'

interface TouchControlsProps {
  input: AdventureInput
  disabled: boolean
  onActivity?(): void
}
export function TouchControls(props: TouchControlsProps) {
  const [pad, setPad] = createSignal({
    active: false,
    offsetX: 0,
    offsetY: 0,
  })
  let stickElement!: HTMLDivElement
  let jumpElement!: HTMLButtonElement
  let stickPointer: number | null = null
  let jumpPointer: number | null = null
  let stickOrigin = { x: 0, y: 0 }
  const releaseMovement = (): void => {
    stickPointer = null
    props.input.setStick(0, 0)
    setPad({ active: false, offsetX: 0, offsetY: 0 })
  }
  const resetContacts = (): void => {
    const heldStick = stickPointer
    const heldJump = jumpPointer
    stickPointer = null
    jumpPointer = null
    if (heldStick !== null && stickElement?.hasPointerCapture(heldStick))
      stickElement.releasePointerCapture(heldStick)
    if (heldJump !== null && jumpElement?.hasPointerCapture(heldJump))
      jumpElement.releasePointerCapture(heldJump)
    props.input.setStick(0, 0)
    props.input.setJump(false)
    setPad({ active: false, offsetX: 0, offsetY: 0 })
  }
  createEffect(() => {
    if (!props.disabled) return
    resetContacts()
  })
  onMount(() => {
    // WebKit's long-press selection/callout also follows native touch events;
    // cancelling pointerdown alone does not cancel that browser default.
    const preventControlSelection = (event: Event): void => {
      if (!props.disabled) event.preventDefault()
    }
    const controls = [stickElement, jumpElement]
    for (const control of controls) {
      control.addEventListener('touchstart', preventControlSelection, {
        passive: false,
      })
      control.addEventListener('selectstart', preventControlSelection)
    }
    window.addEventListener('blur', resetContacts)
    onCleanup(() => {
      resetContacts()
      for (const control of controls) {
        control.removeEventListener('touchstart', preventControlSelection)
        control.removeEventListener('selectstart', preventControlSelection)
      }
      window.removeEventListener('blur', resetContacts)
    })
  })

  function acquireStick(event: PointerEvent): void {
    if (event.pointerType !== 'touch' || props.disabled) return
    if (stickPointer !== null && !stickElement.hasPointerCapture(stickPointer))
      releaseMovement()
    if (stickPointer !== null) return
    props.onActivity?.()
    event.preventDefault()
    event.stopPropagation()
    stickPointer = event.pointerId
    stickOrigin = { x: event.clientX, y: event.clientY }
    setPad({ active: true, offsetX: 0, offsetY: 0 })
    props.input.setStick(0, 0)
    stickElement.setPointerCapture(event.pointerId)
  }

  function move(event: PointerEvent): void {
    if (props.disabled || event.pointerId !== stickPointer) return
    event.preventDefault()
    const sample = sampleFloatingStick(stickOrigin, {
      x: event.clientX,
      y: event.clientY,
    })
    setPad((current) => ({
      ...current,
      offsetX: sample.offsetX,
      offsetY: sample.offsetY,
    }))
    props.input.setStick(sample.inputX, sample.inputY)
  }

  function releaseStick(event: PointerEvent): void {
    if (event.type === 'lostpointercapture' && event.target !== stickElement)
      return
    if (event.pointerId !== stickPointer) return
    releaseMovement()
  }

  function releaseJump(event: PointerEvent): void {
    if (event.pointerId !== jumpPointer) return
    jumpPointer = null
    props.input.setJump(false)
  }
  return (
    <div
      class={styles.touchControls}
      aria-label="Movement controls"
      style={{ visibility: props.disabled ? 'hidden' : undefined }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <div
        ref={stickElement}
        class={styles.stick}
        role="group"
        aria-label="Move Merc"
        aria-disabled={props.disabled}
        onPointerDown={acquireStick}
        onPointerMove={move}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onLostPointerCapture={releaseStick}
      >
        <span
          class={styles.stickBase}
          data-testid="floating-stick-base"
          data-active={pad().active}
          aria-hidden="true"
        >
          <span class={styles.stickDirections}>+</span>
          <span
            class={styles.stickKnob}
            data-testid="floating-stick-knob"
            style={{
              transform: `translate(${pad().offsetX}px, ${pad().offsetY}px)`,
            }}
          />
        </span>
      </div>
      <button
        ref={jumpElement}
        class={styles.jump}
        type="button"
        aria-label="Jump"
        disabled={props.disabled}
        onPointerDown={(event) => {
          if (jumpPointer !== null) return
          props.onActivity?.()
          event.preventDefault()
          jumpPointer = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          props.input.setJump(true)
        }}
        onPointerUp={releaseJump}
        onPointerCancel={releaseJump}
        onLostPointerCapture={releaseJump}
      >
        <svg viewBox="0 0 32 32" aria-hidden="true">
          <path d="M16 25V7m-7 8 7-8 7 8M6 27h20" />
        </svg>
        <span>Jump</span>
      </button>
    </div>
  )
}
