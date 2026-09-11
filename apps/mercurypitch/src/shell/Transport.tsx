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

import { hapticTap } from '@irchiinnuss/mobile-runtime/platform'
import type { Component } from 'solid-js'
import { Show } from 'solid-js'
import { LockIcon, PauseIcon, PlayIcon, StopIcon } from './icons'
import { formatElapsed } from './run-shell-store'

export interface TransportProps {
  elapsedMs: () => number
  playing: () => boolean
  locked: () => boolean
  onStop: () => void
  onToggle: () => void
  onToggleLock: () => void
}

export const Transport: Component<TransportProps> = (props) => {
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
        disabled={props.locked()}
        onClick={() => {
          void hapticTap()
          props.onStop()
        }}
      >
        <StopIcon />
      </button>
      <button
        type="button"
        class="mp-transport__btn mp-transport__btn--primary"
        aria-label={props.playing() ? 'Pause' : 'Play'}
        disabled={props.locked()}
        onClick={() => {
          void hapticTap()
          props.onToggle()
        }}
      >
        <span class="mp-transport__glyph">
          <Show when={props.playing()} fallback={<PlayIcon />}>
            <PauseIcon />
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
