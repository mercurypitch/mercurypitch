// Runner steering controls — a captured thumb pad and independent jump leave the centre of the track visible.

import { createEffect, createSignal, onCleanup, onMount, Show } from 'solid-js'
import type { RunnerContinuousInput } from './runner-continuous-input'
import { RUNNER_STEERING_TRAVEL_PX } from './runner-continuous-input'
import { RunnerSlideControl } from './RunnerSlideControl'
import styles from './RunnerSteeringControls.module.css'

interface RunnerSteeringControlsProps {
  input: RunnerContinuousInput
  disabled: boolean
  slideEnabled?: boolean
  sliding?: boolean
}

export function RunnerSteeringControls(props: RunnerSteeringControlsProps) {
  const [state, setState] = createSignal({
    axis: 0,
    pointerId: null as number | null,
    displacementPx: 0,
  })
  let pad!: HTMLDivElement
  let capturedId: number | null = null
  let capturedType: string | null = null
  let recoveryReports = 0

  function releaseCapture(): void {
    const id = capturedId
    capturedId = null
    capturedType = null
    if (id !== null && pad.hasPointerCapture(id)) pad.releasePointerCapture(id)
  }

  function recoverTouchOwner(
    event: 'primary-touch-replaced-owner' | 'touch-sequence-ended',
  ): void {
    if (capturedId === null || capturedType !== 'touch') return
    if (
      import.meta.env.VITE_PORTABLE_CONSOLE === 'true' &&
      recoveryReports < 4
    ) {
      recoveryReports++
      console.warn('[Glassworks runner input]', {
        event,
        steeringAxis: props.input.steeringState().axis,
      })
    }
    props.input.steeringEnd(capturedId)
    releaseCapture()
  }

  onMount(() => {
    const endTouchSequence = (event: TouchEvent) => {
      // Touch Events can still finish a sequence whose Pointer Event terminal
      // was lost. A remaining finger, keyboard or mouse keeps its own intent.
      if (event.isTrusted && event.touches.length === 0)
        recoverTouchOwner('touch-sequence-ended')
    }
    window.addEventListener('touchend', endTouchSequence, { passive: true })
    window.addEventListener('touchcancel', endTouchSequence, { passive: true })
    onCleanup(() => {
      window.removeEventListener('touchend', endTouchSequence)
      window.removeEventListener('touchcancel', endTouchSequence)
    })
  })

  createEffect(() => {
    const unsubscribe = props.input.subscribeSteering((next) => {
      setState(next)
      if (next.pointerId === null && pad !== undefined) releaseCapture()
    })
    onCleanup(unsubscribe)
  })
  createEffect(() => {
    if (props.disabled) releaseCapture()
  })
  onCleanup(() => {
    if (capturedId !== null) props.input.steeringEnd(capturedId)
    releaseCapture()
  })

  function endSteering(event: PointerEvent): void {
    if (event.pointerId !== capturedId) return
    props.input.steeringEnd(event.pointerId)
    releaseCapture()
  }

  return (
    <nav
      class={styles.controls}
      data-slide-enabled={props.slideEnabled === true}
      aria-label="Course controls"
    >
      <div
        ref={pad}
        class={styles.steering}
        role="slider"
        tabIndex={props.disabled ? -1 : 0}
        aria-label="Steer Merc"
        aria-keyshortcuts="ArrowLeft A ArrowRight D"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={Math.round(state().axis * 100)}
        aria-valuetext={
          state().axis === 0
            ? 'Centred'
            : `${state().axis < 0 ? 'Left' : 'Right'} ${Math.round(Math.abs(state().axis) * 100)}%`
        }
        aria-disabled={props.disabled}
        data-steering-active={state().pointerId !== null}
        onContextMenu={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (props.disabled || event.button !== 0) return
          // A new primary touch starts a fresh touch sequence. If a terminal
          // was lost, let it replace that old touch, including a reused ID.
          // Concurrent fingers and other pointer types retain their owners.
          if (
            event.isTrusted &&
            event.isPrimary &&
            event.pointerType === 'touch' &&
            capturedType === 'touch' &&
            capturedId !== null
          ) {
            recoverTouchOwner('primary-touch-replaced-owner')
          }
          const travelPx = Math.min(
            RUNNER_STEERING_TRAVEL_PX,
            event.currentTarget.clientWidth / 4,
          )
          if (
            !props.input.steeringDown(event.pointerId, event.clientX, travelPx)
          )
            return
          event.preventDefault()
          event.currentTarget.focus({ preventScroll: true })
          capturedId = event.pointerId
          capturedType = event.pointerType
          event.currentTarget.setPointerCapture(event.pointerId)
        }}
        onPointerMove={(event) =>
          props.input.steeringMove(event.pointerId, event.clientX)
        }
        onPointerUp={endSteering}
        onPointerCancel={endSteering}
        onLostPointerCapture={(event) => {
          if (event.target === event.currentTarget) endSteering(event)
        }}
      >
        <span class={styles.rail} aria-hidden="true">
          <svg viewBox="0 0 20 20">
            <path d="m12 5-5 5 5 5" />
          </svg>
          <span class={styles.centre} />
          <svg viewBox="0 0 20 20">
            <path d="m8 5 5 5-5 5" />
          </svg>
        </span>
        <span
          class={styles.thumb}
          style={{ transform: `translateX(${state().displacementPx}px)` }}
          aria-hidden="true"
        />
        <span class={styles.label}>Steer</span>
        <span class={styles.hint}>Hold and slide</span>
      </div>
      <div class={styles.actions}>
        <Show when={props.slideEnabled}>
          <RunnerSlideControl
            input={props.input}
            disabled={props.disabled}
            sliding={props.sliding}
            class={`${styles.jump} ${styles.slide}`}
          />
        </Show>
        <button
          type="button"
          class={styles.jump}
          disabled={props.disabled}
          aria-label="Jump"
          aria-keyshortcuts="Space ArrowUp W"
          data-action="jump"
          onContextMenu={(event) => event.preventDefault()}
          onPointerDown={(event) => {
            if (
              event.button !== 0 ||
              !props.input.pointerDown('jump', event.pointerId)
            )
              return
            event.preventDefault()
            event.currentTarget.setPointerCapture(event.pointerId)
          }}
          onPointerUp={(event) =>
            props.input.pointerEnd('jump', event.pointerId)
          }
          onPointerCancel={(event) =>
            props.input.pointerEnd('jump', event.pointerId)
          }
          onLostPointerCapture={(event) => {
            if (event.target === event.currentTarget)
              props.input.pointerEnd('jump', event.pointerId)
          }}
          onClick={(event) => {
            if (event.detail === 0) props.input.activate('jump')
          }}
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 25V7m-7 8 7-8 7 8M7 27h18" />
          </svg>
          <span>Jump</span>
        </button>
      </div>
    </nav>
  )
}
