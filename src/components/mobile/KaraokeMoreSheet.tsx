// ============================================================
// KaraokeMoreSheet: speed and the A/B loop on the phone stage
// ============================================================
//
// The desktop mixer's capsule has a speed chip and the A, B and loop
// buttons; the phone stage had neither (owner decision 1, 2 October 2026:
// both behind one More button). This is the stage's options sheet (D4: one
// per stage), opened from the header's More.
//
// The rules are the capsule's. A and B go where the song is playing, and B
// at least 0.1 s after A: the binding places them (StemMixer, with
// placeLoopPoint) and hands back why a point was refused, which shows here,
// in the sheet the singer is looking at, not in a toast over it. The loop
// switch stays off until A and B make a loop (hasPlayableLoop, the rule L
// and the voice commands follow), and stays reachable while it is on.
//
// Autoplay moved in here from the header, to make room for More at 44 px.

import type { Component, JSX } from 'solid-js'
import { createSignal, For, Show } from 'solid-js'
import { OptionsSheet } from '@/components/mobile/OptionsSheet'
import { hasPlayableLoop } from '@/components/stem-mixer/rail/MixerCapsule'
import { formatPlaybackSpeed, STEM_MIXER_PLAYBACK_SPEEDS, } from '@/lib/playback-speed-options'
import styles from './KaraokeMoreSheet.module.css'

/** What the sheet reads and changes. StemMixer builds it from its audio. */
export interface KaraokeMoreBinding {
  speed: () => number
  onSpeed: (speed: number) => void
  loopStart: () => number | null
  loopEnd: () => number | null
  loopOn: () => boolean
  /** Put A or B where the song is playing: why it was refused, or null. */
  onSetPoint: (which: 'A' | 'B') => string | null
  onToggleLoop: () => void
  onClearLoop: () => void
}

interface KaraokeMoreSheetProps {
  isOpen: boolean
  close: () => void
  binding: KaraokeMoreBinding
  /** Autoplay, where the stage has songs to go on to. */
  autoplay?: { on: () => boolean; toggle: () => void }
}

/** "0:12.3": a loop point to the tenth, the size of the gap rule. */
export function formatLoopPoint(seconds: number): string {
  const tenths = Math.round(Math.max(0, seconds) * 10)
  const m = Math.floor(tenths / 600)
  const s = Math.floor((tenths % 600) / 10)
  return `${m}:${String(s).padStart(2, '0')}.${tenths % 10}`
}

const Switch: Component<{
  on: boolean
  label: string
  disabled?: boolean
  onToggle: () => void
}> = (props) => (
  <button
    type="button"
    class={styles.switch}
    classList={{ [styles.switchOn]: props.on }}
    role="switch"
    aria-checked={props.on}
    aria-label={props.label}
    disabled={props.disabled}
    onClick={() => props.onToggle()}
  >
    <i />
  </button>
)

const Row: Component<{ label: string; sub?: string; children: JSX.Element }> = (
  props,
) => (
  <div class={styles.row}>
    <span class={styles.rowText}>
      <span class={styles.rowLabel}>{props.label}</span>
      <Show when={props.sub}>
        {(sub) => <span class={styles.rowSub}>{sub()}</span>}
      </Show>
    </span>
    {props.children}
  </div>
)

export const KaraokeMoreSheet: Component<KaraokeMoreSheetProps> = (props) => {
  // Why the last point was refused; cleared by the next one placed.
  const [refusal, setRefusal] = createSignal('')

  const setPoint = (which: 'A' | 'B'): void => {
    setRefusal(props.binding.onSetPoint(which) ?? '')
  }

  // A radio group: one stop in the tab order (the speed playing, or 1x when
  // it is none of these), and the arrow keys move the choice along.
  let speedGroup: HTMLDivElement | undefined
  const tabStop = (): number => {
    const current = props.binding.speed()
    return STEM_MIXER_PLAYBACK_SPEEDS.some((speed) => speed === current)
      ? current
      : 1
  }
  const stepSpeed = (event: KeyboardEvent): void => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0
    if (step === 0) return
    event.preventDefault()
    const speeds = STEM_MIXER_PLAYBACK_SPEEDS
    const at = speeds.findIndex((speed) => speed === tabStop())
    const next = (at + step + speeds.length) % speeds.length
    props.binding.onSpeed(speeds[next])
    speedGroup?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  const loopReady = (): boolean =>
    hasPlayableLoop(props.binding.loopStart(), props.binding.loopEnd())
  const switchDisabled = (): boolean => !props.binding.loopOn() && !loopReady()
  const nothingSet = (): boolean =>
    props.binding.loopStart() === null && props.binding.loopEnd() === null

  const point = (which: 'A' | 'B') => {
    const at =
      which === 'A' ? props.binding.loopStart() : props.binding.loopEnd()
    return (
      <div class={styles.point}>
        <span class={styles.pointName} aria-hidden="true">
          {which}
        </span>
        <span
          class={styles.pointTime}
          data-testid={`karaoke-more-point-${which.toLowerCase()}`}
        >
          {at === null ? 'Not set' : formatLoopPoint(at)}
        </span>
        <button
          type="button"
          class={styles.pointButton}
          onClick={() => setPoint(which)}
        >
          {`Set ${which}`}
        </button>
      </div>
    )
  }

  return (
    <OptionsSheet
      isOpen={props.isOpen}
      close={() => props.close()}
      ariaLabel="More"
    >
      <div class={styles.body} data-testid="karaoke-more-sheet">
        <p class={styles.kicker}>Speed</p>
        <div
          ref={speedGroup}
          class={styles.speeds}
          role="radiogroup"
          aria-label="Speed"
          onKeyDown={stepSpeed}
        >
          <For each={STEM_MIXER_PLAYBACK_SPEEDS}>
            {(speed) => (
              <button
                type="button"
                class={styles.speed}
                role="radio"
                aria-checked={props.binding.speed() === speed}
                tabIndex={tabStop() === speed ? 0 : -1}
                onClick={() => props.binding.onSpeed(speed)}
              >
                {formatPlaybackSpeed(speed)}
              </button>
            )}
          </For>
        </div>

        <p class={styles.kicker}>Loop</p>
        <p class={styles.hint}>
          Set A and B as the song reaches the part you want again.
        </p>
        <div class={styles.points}>
          {point('A')}
          {point('B')}
        </div>
        <p
          class={styles.refusal}
          role="status"
          data-testid="karaoke-more-loop-status"
        >
          {refusal()}
        </p>
        <Row
          label="Loop A to B"
          sub={switchDisabled() ? 'Set A and B to loop' : undefined}
        >
          <Switch
            on={props.binding.loopOn()}
            label="Loop A to B"
            disabled={switchDisabled()}
            onToggle={() => props.binding.onToggleLoop()}
          />
        </Row>
        <button
          type="button"
          class={styles.clear}
          disabled={nothingSet()}
          onClick={() => {
            setRefusal('')
            props.binding.onClearLoop()
          }}
        >
          Clear loop
        </button>

        <Show when={props.autoplay}>
          {(autoplay) => (
            <>
              <p class={styles.kicker}>Next song</p>
              <Row label="Play the next song automatically">
                <Switch
                  on={autoplay().on()}
                  label="Play the next song automatically"
                  onToggle={() => autoplay().toggle()}
                />
              </Row>
            </>
          )}
        </Show>
      </div>
    </OptionsSheet>
  )
}
