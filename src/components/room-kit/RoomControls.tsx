// ============================================================
// The room's controls: the mic button, a result's Again and Done, and the
// mic's blocked notice
// ============================================================
//
// The big round mic button under a premium room's stage starts a take and
// stops it. It shows one of four states (mic-state.ts), which the room
// names from its own phases: ready breathes and waits for the tap, wait is
// dimmed and still while the mic is open but it is not the singer's turn,
// sing lights up in the room's colour (--mic-lit) with a ring that follows
// the voice, and done is an outline. It nudges once after the demo's
// Try it. A room held still (the fixtures) shows the state with nothing
// moving. A result swaps it for Again and Done. A microphone that will not
// open swaps it for a notice and Try again, with Open Settings when the
// phone refused it and the shell can open the app's settings. The room says
// when each shows, and gives each its test id.
//
// The ring is the one part that moves every frame, so it is written
// straight to its own transform and opacity from a frame loop that runs
// only in sing: no signal, no layout, and no write at all while the level
// holds still. Held still, the ring is drawn once and the loop never
// starts.

import type { JSX } from 'solid-js'
import { createEffect, onCleanup, Show, untrack } from 'solid-js'
import { Mic, MicFilled } from '@/components/icons'
import { nativeShellApi } from '@/stores/native-shell-store'
import type { MicState } from './mic-state'
import { ringLevel, ringLook, smoothLevel } from './mic-state'
import { prefersReducedMotion } from './reduced-motion'
import styles from './RoomControls.module.css'
import type { CaptureFailure } from './useExerciseCapture'

export interface MicButtonProps {
  /** Ready, wait, sing or done (mic-state.ts): the room's phases say which. */
  state: MicState
  /**
   * How loud the singer is, 0..1 (levelFromRms of the newest frame). Read
   * once a frame while the state is sing; not reactive.
   */
  level: () => number
  /** One nudge, after the demo's Try it. */
  pulse: boolean
  /**
   * Nothing moves (a room's `still`, its fixtures): no glow breathing, no
   * pop, and the ring drawn once at the level it is given.
   */
  still?: boolean
  disabled: boolean
  label: string
  onClick: () => void
  testId: string
}

/** The ring's look is written again only when it moves this much. */
const SCALE_STEP = 0.002
const OPACITY_STEP = 0.01

export function MicButton(props: MicButtonProps): JSX.Element {
  let ring: HTMLSpanElement | undefined
  const reduced = prefersReducedMotion()

  // The ring follows the voice for as long as it is the singer's turn.
  createEffect(() => {
    if (props.state !== 'sing') return
    const level = props.level
    const still = props.still === true
    const el = ring
    if (el === undefined) return
    let shown = still ? ringLevel(untrack(level)) : 0
    let last = performance.now()
    let scale = -1
    let opacity = -1
    const draw = (): void => {
      const look = ringLook(shown, reduced)
      if (
        Math.abs(look.scale - scale) < SCALE_STEP &&
        Math.abs(look.opacity - opacity) < OPACITY_STEP
      ) {
        return
      }
      scale = look.scale
      opacity = look.opacity
      if (!reduced) el.style.transform = `scale(${scale.toFixed(3)})`
      el.style.opacity = opacity.toFixed(2)
    }
    let frame = 0
    let following = true
    const follow = (now: number): void => {
      if (!following) return
      shown = smoothLevel(shown, ringLevel(level()), now - last)
      last = now
      draw()
      frame = requestAnimationFrame(follow)
    }
    draw()
    if (!still) frame = requestAnimationFrame(follow)
    onCleanup(() => {
      following = false
      if (frame !== 0) cancelAnimationFrame(frame)
      el.style.removeProperty('transform')
      el.style.removeProperty('opacity')
    })
  })

  return (
    <button
      type="button"
      class={styles.mic}
      classList={{
        [styles.micPulse]: props.pulse,
        [styles.still]: props.still === true,
      }}
      disabled={props.disabled}
      aria-label={props.label}
      onClick={() => props.onClick()}
      data-state={props.state}
      data-testid={props.testId}
    >
      <span class={styles.halo} aria-hidden="true" />
      <span ref={ring} class={styles.ring} aria-hidden="true" />
      <span class={styles.disc} aria-hidden="true">
        <Show when={props.state === 'sing'} fallback={<Mic />}>
          <MicFilled />
        </Show>
      </span>
    </button>
  )
}

export interface ResultActionsProps {
  onAgain: () => void
  onDone: () => void
  againTestId: string
  doneTestId: string
}

/** A result's two ways on: the same again, or out of the room. */
export function ResultActions(props: ResultActionsProps): JSX.Element {
  return (
    <div class={styles.actions}>
      <button
        type="button"
        class={styles.again}
        onClick={() => props.onAgain()}
        data-testid={props.againTestId}
      >
        Again
      </button>
      <button
        type="button"
        class={styles.done}
        onClick={() => props.onDone()}
        data-testid={props.doneTestId}
      >
        Done
      </button>
    </div>
  )
}

export interface MicBlockedProps {
  /** Why the mic did not open. */
  block: CaptureFailure | null
  /** Try again: a new start, from the same tap. */
  onRetry: () => void
  retryTestId: string
  /**
   * Who says why: the notice itself (the default), or 'merc', whose own
   * line over it says it (the native onboarding), when the notice is only
   * its ways back.
   */
  saidBy?: 'notice' | 'merc'
}

/**
 * The mic would not open: why, and the way back. A refusal is not asked
 * about twice (iOS shows its prompt once, and Android after two refusals
 * no more), so a Try again alone changes nothing: where the app can open
 * its own Settings, Open Settings is the big button and Try again the
 * plain one beside it.
 */
export function MicBlocked(props: MicBlockedProps): JSX.Element {
  const settings = () =>
    props.block === 'denied' ? nativeShellApi()?.openAppSettings : undefined
  return (
    <>
      <Show when={props.saidBy !== 'merc'}>
        <p class={styles.blocked} role="alert">
          {props.block === 'denied'
            ? 'Merc needs the microphone to hear you. Allow it in Settings, then try again.'
            : 'The microphone did not open. Check that no other app is using it, then try again.'}
        </p>
      </Show>
      <div class={styles.actions}>
        <Show when={settings()}>
          {(open) => (
            <button
              type="button"
              class={styles.done}
              onClick={() => void open()()}
              data-testid="mic-open-settings"
            >
              Open Settings
            </button>
          )}
        </Show>
        <button
          type="button"
          class={settings() === undefined ? styles.done : styles.again}
          onClick={() => props.onRetry()}
          data-testid={props.retryTestId}
        >
          Try again
        </button>
      </div>
    </>
  )
}
