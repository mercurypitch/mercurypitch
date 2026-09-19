// Adventure touch controls — stick, look and jump never steal each other's pointer.
import { createEffect, createSignal, onCleanup, onMount } from 'solid-js'
import styles from './GlassAdventure.module.css'
import type { AdventureInput } from './input'

interface TouchControlsProps {
  input: AdventureInput
  disabled: boolean
  onActivity?(): void
}
export function TouchControls(props: TouchControlsProps) {
  const [offset, setOffset] = createSignal({ x: 0, y: 0 })
  let stickElement!: HTMLDivElement
  let jumpElement!: HTMLButtonElement
  let stickPointer: number | null = null
  let jumpPointer: number | null = null
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
    setOffset({ x: 0, y: 0 })
  }
  createEffect(() => {
    if (!props.disabled) return
    resetContacts()
  })
  onMount(() => {
    window.addEventListener('blur', resetContacts)
    onCleanup(() => window.removeEventListener('blur', resetContacts))
  })
  const move = (event: PointerEvent): void => {
    if (props.disabled || event.pointerId !== stickPointer) return
    const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const radius = box.width * 0.32
    const x = event.clientX - box.left - box.width / 2
    const y = event.clientY - box.top - box.height / 2
    const length = Math.max(radius, Math.hypot(x, y))
    setOffset({ x: (x / length) * radius, y: (y / length) * radius })
    props.input.setStick(x / length, y / length)
  }
  const releaseStick = (event: PointerEvent): void => {
    if (event.pointerId !== stickPointer) return
    stickPointer = null
    props.input.setStick(0, 0)
    setOffset({ x: 0, y: 0 })
  }
  const releaseJump = (event: PointerEvent): void => {
    if (event.pointerId !== jumpPointer) return
    jumpPointer = null
    props.input.setJump(false)
  }
  return (
    <div class={styles.touchControls} aria-label="Movement controls">
      <div
        ref={stickElement}
        class={styles.stick}
        role="group"
        aria-label="Move Merc"
        aria-disabled={props.disabled}
        onPointerDown={(event) => {
          if (props.disabled || stickPointer !== null) return
          props.onActivity?.()
          event.preventDefault()
          stickPointer = event.pointerId
          event.currentTarget.setPointerCapture(event.pointerId)
          move(event)
        }}
        onPointerMove={move}
        onPointerUp={releaseStick}
        onPointerCancel={releaseStick}
        onLostPointerCapture={releaseStick}
      >
        <span class={styles.stickDirections} aria-hidden="true">
          +
        </span>
        <span
          class={styles.stickKnob}
          style={{ transform: `translate(${offset().x}px, ${offset().y}px)` }}
        />
        <span class={styles.controlCaption}>Move</span>
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
