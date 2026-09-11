// ============================================================
// Transport — what the rail's slot holds while a run is going
// ============================================================
//
// Elapsed · Stop (44 pt) · Pause/Play (60 pt) · Lock (44 pt), same outer size
// and glass as the rail, in the same band. The time is elapsed only and never
// a total: a practice run does not have one.
//
// Stop is always visible, always 44 pt, always inside the bottom quarter of
// the screen and never behind a tap (S1b brief §4, the rules that do not
// vary). Lock dims Stop and the primary and refuses their taps while the
// clock keeps running; it says so with `aria-pressed`.
//
// A locked control is `aria-disabled`, never `disabled`. `disabled` takes the
// button out of the accessibility tree entirely, so a screen-reader user
// sweeping the transport would find Stop simply gone with nothing to say why.
// This way it is still there, still named, and still announced as unavailable
// — and the refusal is enforced in the handler as well as in the CSS, because
// pointer-events stops a finger and not a keyboard.
//
// The count-in takes the primary's face while it runs: the beat is the only
// thing worth showing on the one button the singer is already looking at, and
// there is nowhere else on a 44 pt row to put it.

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { LockIcon, PauseIcon, PlayIcon, StopIcon } from './icons'
import { formatElapsed } from './run-shell-store'

export interface TransportProps {
  elapsedMs: () => number
  playing: () => boolean
  locked: () => boolean
  /** The bars before the first note, counted by the room. */
  countingIn?: () => boolean
  countInBeat?: () => number
  onStop: () => void
  onToggle: () => void
  onToggleLock: () => void
}

export const Transport: Component<TransportProps> = (props) => {
  const counting = (): boolean => props.countingIn?.() === true

  return (
    <div
      class="mp-transport"
      classList={{ 'is-locked': props.locked() }}
      data-testid="shell-transport"
    >
      <span class="mp-transport__time" data-testid="shell-transport-time">
        {formatElapsed(props.elapsedMs())}
      </span>
      <button
        type="button"
        class="mp-transport__btn"
        aria-label="Stop"
        aria-disabled={props.locked()}
        onClick={() => {
          if (props.locked()) return
          void hapticTap()
          props.onStop()
        }}
      >
        <StopIcon />
      </button>
      <button
        type="button"
        class="mp-transport__btn mp-transport__btn--primary"
        aria-label={
          counting()
            ? `Counting in, beat ${props.countInBeat?.() ?? 0}`
            : props.playing()
              ? 'Pause'
              : 'Play'
        }
        aria-disabled={props.locked()}
        onClick={() => {
          if (props.locked()) return
          void hapticTap()
          props.onToggle()
        }}
      >
        <span class="mp-transport__glyph">
          <Show
            when={counting()}
            fallback={
              <Show when={props.playing()} fallback={<PlayIcon />}>
                <PauseIcon />
              </Show>
            }
          >
            <span class="mp-transport__count" data-testid="shell-count-in">
              {props.countInBeat?.() ?? 0}
            </span>
          </Show>
        </span>
      </button>
      <button
        type="button"
        class="mp-transport__btn mp-transport__btn--lock"
        aria-label="Lock controls"
        aria-pressed={props.locked()}
        onClick={() => {
          void hapticTap()
          props.onToggleLock()
        }}
      >
        <LockIcon />
      </button>
    </div>
  )
}
