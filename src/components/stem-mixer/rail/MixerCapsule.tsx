// MixerCapsule holds the stem mixer's playback controls in one capsule.
// ============================================================
//
// Modelled on the Jam room's control bar (JamControlBar): what a singer
// reaches for all the time, in groups split by a hairline, and a More
// button for what is set once and left.
//
//   Play Stop From-the-start | A B Loop | 1x Key | Mic Monitor | More
//
// Every control is always drawn. The loop toggle waits, disabled, until A
// and B make a loop, and Monitor waits until the mic is on. A control that
// appears with state moves everything after it, and the row under the
// singer's pointer should not move. Clear loop lives in More and in the
// waveform's right-click menu.
//
// It takes values and callbacks only, like the rest of the rail, so the
// mixer, the focus pill and the tests drive it the same way. The focus
// pill adds its dock handle and exit button through `leading` and
// `trailing`, and its stage toggles through `moreItems`.
//
// Sizes come from --mixer-control-size: 32 px, 28 px when MixerRail is
// short of width and in the focus pill, 44 px on a touch screen. The chips
// read the same property, so the capsule stays one height. Docked to a
// side edge (`vertical`), each group is a row and the groups stack.

import type { Component, JSX } from 'solid-js'
import { children, Show } from 'solid-js'
import { Headphones, Loop, Mic, Pause, Play, SkipBack, Square, } from '@/components/icons'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { OverflowMenu } from '@/components/OverflowMenu'
import { KeyChip } from './KeyChip'
import styles from './MixerCapsule.module.css'
import { SpeedChip } from './SpeedChip'

export interface MixerCapsuleProps {
  playing: boolean
  onPlay: () => void
  onPause: () => void
  onStop: () => void
  /** Plays the song again from 0:00. */
  onRestart: () => void

  loopStart: number | null
  loopEnd: number | null
  loopEnabled: boolean
  onSetLoopA: () => void
  onSetLoopB: () => void
  onToggleLoop: () => void
  onClearLoop: () => void

  speed: number
  onSpeedChange: (speed: number) => void
  /** The singer's key. A host without one gets no key chip. */
  keyControl?: KeyShiftBinding

  micActive: boolean
  /** Why the mic did not start; empty when it did. */
  micError: string
  onToggleMic: () => void
  micMonitorEnabled: boolean
  onToggleMicMonitor: () => void

  /** Rows the host adds to More, under Clear loop. */
  moreItems?: readonly OverflowMenuItem[]

  /** Stacks the groups, for a rail docked to the left or right edge. */
  vertical?: boolean
  /** No box of its own, inside a host that draws one (the focus pill). */
  bare?: boolean
  /** Drawn before the transport, with a divider after it. */
  leading?: JSX.Element
  /** Drawn after More, with a divider before it. */
  trailing?: JSX.Element
}

/** Whether A and B make a loop the toggle can turn on. */
export function hasPlayableLoop(
  start: number | null,
  end: number | null,
): boolean {
  // B without A loops from 0:00 (loop-points.ts sets A to 0 when it can).
  return end !== null && end > (start ?? 0)
}

type MicState = 'off' | 'on' | 'error'

export const MixerCapsule: Component<MixerCapsuleProps> = (props) => {
  const leading = children(() => props.leading)
  const trailing = children(() => props.trailing)

  const loopReady = (): boolean =>
    hasPlayableLoop(props.loopStart, props.loopEnd)
  // On stays reachable however it got there, so the singer can always turn
  // it off. The L key follows this rule too (StemMixer's shortcuts).
  const loopToggleDisabled = (): boolean => !props.loopEnabled && !loopReady()

  const micState = (): MicState => {
    if (props.micError !== '') return 'error'
    return props.micActive ? 'on' : 'off'
  }
  const micLabel = (): string => {
    const state = micState()
    if (state === 'error') return 'Retry microphone'
    return state === 'on' ? 'Disable microphone' : 'Enable microphone'
  }
  const micTitle = (): string => {
    const state = micState()
    if (state === 'error') return `${props.micError} Tap to try again.`
    return state === 'on'
      ? 'Disable microphone'
      : 'Enable microphone pitch comparison'
  }
  const monitorTitle = (): string => {
    if (!props.micActive) return 'Hear my voice: turn the mic on first'
    return props.micMonitorEnabled
      ? 'Stop hearing my voice'
      : 'Hear my voice over the track (use headphones)'
  }

  const moreRows = (): OverflowMenuItem[] => [
    {
      key: 'clear-loop',
      label: 'Clear loop',
      disabled: props.loopStart === null && props.loopEnd === null,
      onSelect: () => props.onClearLoop(),
    },
    ...(props.moreItems ?? []),
  ]

  return (
    <div
      class={styles.capsule}
      data-testid="mixer-capsule"
      data-vertical={props.vertical === true ? 'true' : 'false'}
      data-bare={props.bare === true ? 'true' : 'false'}
    >
      <Show when={leading()}>
        {leading()}
        <span class={styles.divider} aria-hidden="true" />
      </Show>

      <div class={styles.group} role="group" aria-label="Playback">
        <button
          type="button"
          class={`${styles.btn} ${styles.play}`}
          aria-label={props.playing ? 'Pause' : 'Play'}
          title={props.playing ? 'Pause' : 'Play'}
          onClick={() => (props.playing ? props.onPause() : props.onPlay())}
        >
          {props.playing ? <Pause /> : <Play />}
        </button>
        <button
          type="button"
          class={`${styles.btn} ${styles.stop}`}
          aria-label="Stop"
          title="Stop"
          onClick={() => props.onStop()}
        >
          <Square />
        </button>
        <button
          type="button"
          class={styles.btn}
          aria-label="Play from the start"
          title="Play from the start"
          onClick={() => props.onRestart()}
        >
          <SkipBack />
        </button>
      </div>

      <span class={styles.divider} aria-hidden="true" />

      <div
        class={styles.group}
        role="group"
        aria-label="Loop"
        data-tour="mixer.loop"
      >
        <button
          type="button"
          class={`${styles.btn} ${styles.mark}`}
          data-mark="a"
          data-set={props.loopStart !== null ? 'true' : 'false'}
          aria-label="Set loop start (A)"
          title="Set loop start (A) at the playhead"
          onClick={() => props.onSetLoopA()}
        >
          <span class={styles.markGlyph} aria-hidden="true">
            A
          </span>
        </button>
        <button
          type="button"
          class={`${styles.btn} ${styles.mark}`}
          data-mark="b"
          data-set={props.loopEnd !== null ? 'true' : 'false'}
          aria-label="Set loop end (B)"
          title="Set loop end (B) at the playhead"
          onClick={() => props.onSetLoopB()}
        >
          <span class={styles.markGlyph} aria-hidden="true">
            B
          </span>
        </button>
        <button
          type="button"
          class={`${styles.btn} ${styles.toggle}`}
          aria-label="Loop"
          aria-pressed={props.loopEnabled}
          disabled={loopToggleDisabled()}
          title={
            loopToggleDisabled()
              ? 'Set A and B to loop'
              : props.loopEnabled
                ? 'Stop looping'
                : 'Loop from A to B'
          }
          onClick={() => props.onToggleLoop()}
        >
          <Loop />
        </button>
      </div>

      <span class={styles.divider} aria-hidden="true" />

      <div
        class={`${styles.group} ${styles.chips}`}
        role="group"
        aria-label="Speed and key"
      >
        <span class={styles.slot} data-tour="mixer.speed">
          <SpeedChip speed={props.speed} onSpeedChange={props.onSpeedChange} />
        </span>
        <Show when={props.keyControl}>
          {(binding) => <KeyChip binding={binding()} />}
        </Show>
      </div>

      <span class={styles.divider} aria-hidden="true" />

      <div class={styles.group} role="group" aria-label="Microphone">
        <button
          type="button"
          class={`${styles.btn} ${styles.mic}`}
          data-state={micState()}
          data-tour="mixer.mic"
          aria-label={micLabel()}
          aria-pressed={props.micActive}
          title={micTitle()}
          onClick={() => props.onToggleMic()}
        >
          <Mic />
        </button>
        <button
          type="button"
          class={`${styles.btn} ${styles.toggle}`}
          aria-label="Hear my voice"
          aria-pressed={props.micMonitorEnabled}
          disabled={!props.micActive}
          title={monitorTitle()}
          onClick={() => props.onToggleMicMonitor()}
        >
          <Headphones />
        </button>
      </div>

      <span class={styles.divider} aria-hidden="true" />

      <OverflowMenu
        label="More playback options"
        testId="mixer-more"
        triggerClass={styles.more}
        panelClass="mp-dark-stage"
        items={moreRows()}
      />

      <Show when={trailing()}>
        <span class={styles.divider} aria-hidden="true" />
        {trailing()}
      </Show>
    </div>
  )
}
