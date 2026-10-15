// MixerCapsule holds the stem mixer's playback controls, in two parts.
// ============================================================
//
// The rail is one glass bar: the controls a singer reaches for all the time
// on its left, the timeline in the middle, and the key and More on its
// right (MixerRail lays the three out).
//
//   Play Stop From-the-start | A B Loop | Mic Hear-my-voice | Speed
//   ............................................................ Key More
//
// The capsule draws both ends, the left part and the right part, and the
// rail's grid places them by their data-rail-part (MixerRail.module.css:
// the build scopes a grid area's name to its own sheet), so the two share
// one set of props.
//
// Every control is always drawn, and none changes width with its state, so
// the row under the singer's pointer never moves. Loop and Hear my voice
// wait for their A and B and for the mic: aria-disabled rather than
// disabled, so a press, a hover or focus shows why as text under them
// (ReasonHold). A blocked mic says how to unblock it the same way, and
// still takes the press that tries again.
//
// Short of width the rail folds Speed into More (`speedFolded`, see
// rail-fold.ts): More then lists the speeds, carries a dot while the speed
// is not 1x, and says the speed in its name.
//
// It takes values and callbacks only, like the rest of the rail, so the
// mixer, the focus pill and the tests drive it the same way. The focus pill
// adds its dock handle and exit button through `leading` and `trailing`,
// and its stage toggles through `moreItems`. Docked to a side edge
// (`vertical`), each group is a row and the groups stack.

import type { Component, JSX } from 'solid-js'
import { children, Show } from 'solid-js'
import { CheckSmall, Headphones, Loop, Mic, Pause, Play, SkipBack, Square, } from '@/components/icons'
import type { KeyShiftBinding } from '@/components/key-shift/KeyShiftControl'
import type { OverflowMenuItem } from '@/components/OverflowMenu'
import { OverflowMenu } from '@/components/OverflowMenu'
import { hasPlayableLoop } from '@/lib/loop-gap'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'
import { KeyChip } from './KeyChip'
import styles from './MixerCapsule.module.css'
import { ReasonHold } from './ReasonHold'
import { SpeedChip } from './SpeedChip'

/** Loop's reason while it waits for its marks. */
export const LOOP_NEEDS_MARKS = 'Set A and B to loop'
/** Loop's reason once A is set. */
export const LOOP_NEEDS_B = 'Set B to close the loop'
/** Hear my voice's reason while the mic is off. */
export const MONITOR_NEEDS_MIC = 'Turn the mic on to hear yourself'
/** A mic the browser refused, and how to get it back. */
export const MIC_BLOCKED =
  'Mic blocked. Allow it in the address bar, then press to try again.'

// The mic manager's words for a refusal (mic-manager.ts classifyError).
const MIC_DENIED = /denied|not allowed|blocked/i

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
  /** The rail is short of width: Speed lives in More (rail-fold.ts). */
  speedFolded?: boolean
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

type MicState = 'off' | 'on' | 'error'

const tick = (on: boolean) => (on ? <CheckSmall size={16} /> : null)

export const MixerCapsule: Component<MixerCapsuleProps> = (props) => {
  const leading = children(() => props.leading)
  const trailing = children(() => props.trailing)

  const loopReady = (): boolean =>
    hasPlayableLoop(props.loopStart, props.loopEnd)
  // On stays reachable however it got there, so the singer can always turn
  // it off. The L key follows this rule too (StemMixer's shortcuts).
  const loopWaits = (): boolean => !props.loopEnabled && !loopReady()
  const loopReason = (): string | null => {
    if (!loopWaits()) return null
    return props.loopStart !== null && props.loopEnd === null
      ? LOOP_NEEDS_B
      : LOOP_NEEDS_MARKS
  }

  const micState = (): MicState => {
    if (props.micError !== '') return 'error'
    return props.micActive ? 'on' : 'off'
  }
  const micReason = (): string | null => {
    const error = props.micError
    if (error === '') return null
    return MIC_DENIED.test(error) ? MIC_BLOCKED : `${error} Press to try again.`
  }
  const micTitle = (): string =>
    props.micActive
      ? 'Microphone on: your pitch is compared with the song'
      : 'Microphone: compare your pitch with the song'
  const monitorWaits = (): boolean => !props.micActive
  const monitorTitle = (): string =>
    props.micMonitorEnabled
      ? 'Stop hearing my voice'
      : 'Hear my voice over the track (use headphones)'

  const speedChanged = (): boolean => props.speed !== 1
  const folded = (): boolean => props.speedFolded === true

  const speedRows = (): OverflowMenuItem[] =>
    folded()
      ? STEM_MIXER_PLAYBACK_SPEEDS.map((speed, index) => ({
          key: `speed-${speed}`,
          label: `Speed ${formatPlaybackSpeed(speed)}`,
          checked: speed === props.speed,
          checkType: 'radio' as const,
          separatorBefore: index === 0,
          icon: () => tick(speed === props.speed),
          onSelect: () => props.onSpeedChange(speed),
        }))
      : []

  const moreRows = (): OverflowMenuItem[] => [
    {
      key: 'clear-loop',
      label: 'Clear loop',
      disabled: props.loopStart === null && props.loopEnd === null,
      onSelect: () => props.onClearLoop(),
    },
    ...speedRows(),
    ...(props.moreItems ?? []),
  ]
  const moreLabel = (): string =>
    folded() && speedChanged()
      ? `More playback options. Speed ${formatPlaybackSpeed(props.speed)}`
      : 'More playback options'

  return (
    <>
      <div
        class={styles.capsule}
        data-testid="mixer-capsule"
        data-rail-part="left"
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
          <ReasonHold reason={loopReason()} blocks={loopWaits()}>
            {(control) => (
              <button
                type="button"
                class={`${styles.btn} ${styles.toggle}`}
                aria-label="Loop"
                aria-pressed={props.loopEnabled}
                title={
                  loopWaits()
                    ? undefined
                    : props.loopEnabled
                      ? 'Stop looping'
                      : 'Loop from A to B'
                }
                {...control.attrs}
                onClick={() => {
                  if (control.refuse()) return
                  props.onToggleLoop()
                }}
              >
                <Loop />
              </button>
            )}
          </ReasonHold>
        </div>

        <span class={styles.divider} aria-hidden="true" />

        <div class={styles.group} role="group" aria-label="Microphone">
          <ReasonHold reason={micReason()} blocks={false} tone="warn">
            {(control) => (
              <button
                type="button"
                class={`${styles.btn} ${styles.mic}`}
                data-state={micState()}
                data-tour="mixer.mic"
                aria-label="Microphone"
                aria-pressed={props.micActive}
                title={micReason() === null ? micTitle() : undefined}
                {...control.attrs}
                onClick={() => {
                  control.refuse()
                  props.onToggleMic()
                }}
              >
                <Mic />
                <span class={styles.badge} aria-hidden="true">
                  !
                </span>
              </button>
            )}
          </ReasonHold>
          <ReasonHold
            reason={monitorWaits() ? MONITOR_NEEDS_MIC : null}
            blocks={monitorWaits()}
          >
            {(control) => (
              <button
                type="button"
                class={`${styles.btn} ${styles.toggle}`}
                aria-label="Hear my voice"
                aria-pressed={props.micMonitorEnabled}
                title={monitorWaits() ? undefined : monitorTitle()}
                {...control.attrs}
                onClick={() => {
                  if (control.refuse()) return
                  props.onToggleMicMonitor()
                }}
              >
                <Headphones />
              </button>
            )}
          </ReasonHold>
        </div>

        <Show when={!folded()}>
          <span class={styles.divider} aria-hidden="true" />
          <span class={styles.slot} data-tour="mixer.speed">
            <SpeedChip
              speed={props.speed}
              onSpeedChange={props.onSpeedChange}
            />
          </span>
        </Show>
      </div>

      <div
        class={`${styles.capsule} ${styles.right}`}
        data-testid="mixer-capsule-end"
        data-rail-part="right"
        data-vertical={props.vertical === true ? 'true' : 'false'}
        data-bare={props.bare === true ? 'true' : 'false'}
      >
        <Show when={props.keyControl}>
          {(binding) => <KeyChip binding={binding()} />}
        </Show>
        {/* The tour's speed step lands here while Speed is in More;
            Walkthrough spotlights whichever of the two is on screen. */}
        <span
          class={`${styles.slot} ${styles.moreSlot}`}
          data-tour={folded() ? 'mixer.speed' : undefined}
          data-dot={folded() && speedChanged() ? 'true' : 'false'}
        >
          <OverflowMenu
            label={moreLabel()}
            testId="mixer-more"
            triggerClass={styles.more}
            panelClass={`mp-dark-stage ${styles.morePanel}`}
            items={moreRows()}
          />
        </span>

        <Show when={trailing()}>
          <span class={styles.divider} aria-hidden="true" />
          {trailing()}
        </Show>
      </div>
    </>
  )
}
