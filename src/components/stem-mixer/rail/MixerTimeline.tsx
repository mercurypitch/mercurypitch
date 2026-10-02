// MixerTimeline is the playback rail's timeline: elapsed, the slider, total.
// ============================================================
//
// The slider is LoopRangeRail, the one Guitar Night uses: a real range
// input (a tab stop, read out as "0:15 of 0:30") with the A and B marks on
// it, each draggable and steppable with the arrow keys. A alone shows its
// mark; a loop that is off draws its region and marks dimmed.
//
// Moving the playhead is previewed and committed once. While a pointer
// drags, or an arrow key is held, the knob and the elapsed time follow it
// but the song does not: a seek restarts every stem, and one per input
// event stuttered. It lands when the pointer or the key comes up.
//
// The arrow keys step five seconds, Page Up and Page Down a tenth of the
// song, Home and End go to either end. A mark moves a tenth of a second per
// press. Every A and B goes through the host (placeLoopPoint), so a mark is
// never put where the loop rule would refuse it.
//
// A short loop gets the rail's close-up of A to B. It opens over the
// timeline, in its place, so it covers none of the controls around it.

import type { Component } from 'solid-js'
import { createSignal } from 'solid-js'
import { LoopRangeRail } from '@/components/shared/LoopRangeRail'
import styles from './MixerTimeline.module.css'

export interface MixerTimelineProps {
  elapsed: number
  duration: number
  formatTime: (seconds: number) => string
  onSeek: (seconds: number) => void
  loopStart: number | null
  loopEnd: number | null
  loopEnabled: boolean
  /** The least time between A and B the loop rule accepts. */
  minimumLoopGap: number
  onMoveLoopPoint: (which: 'A' | 'B', seconds: number) => void
  disabled?: boolean
}

/** An arrow key's step along the song, in seconds. */
export const TIMELINE_ARROW_STEP = 5
/** A loop mark's step, in seconds. */
const MARK_STEP = 0.1
/**
 * Kept between A and B on top of the loop rule's minimum. The rule refuses
 * a gap of exactly the minimum, so a mark dragged hard against the other one
 * stops just clear of it instead of being refused.
 */
const MARK_CLEARANCE = 0.01

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value))

export const MixerTimeline: Component<MixerTimelineProps> = (props) => {
  // A seek being previewed: set while a drag or a held key moves the knob.
  const [preview, setPreview] = createSignal<number | null>(null)
  let scrubbing = false

  const shown = (): number => preview() ?? props.elapsed
  const end = (): number => Math.max(0, props.duration)

  const commit = (): void => {
    const target = preview()
    scrubbing = false
    setPreview(null)
    if (target !== null) props.onSeek(target)
  }

  const onSeekInput = (seconds: number): void => {
    const target = clamp(seconds, 0, end())
    if (scrubbing) setPreview(target)
    else props.onSeek(target)
  }

  const stepFor = (key: string): number | null => {
    const page = Math.max(TIMELINE_ARROW_STEP, end() / 10)
    switch (key) {
      case 'ArrowRight':
      case 'ArrowUp':
        return TIMELINE_ARROW_STEP
      case 'ArrowLeft':
      case 'ArrowDown':
        return -TIMELINE_ARROW_STEP
      case 'PageUp':
        return page
      case 'PageDown':
        return -page
      default:
        return null
    }
  }

  // The seek input's own keys. LoopRangeRail has already opened a scrub on
  // keydown (and closes it on keyup), so this only moves the preview.
  const onKeyDown = (event: KeyboardEvent): void => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || target.type !== 'range') return
    let next: number | null = null
    if (event.key === 'Home') next = 0
    else if (event.key === 'End') next = end()
    else {
      const step = stepFor(event.key)
      if (step !== null) next = shown() + step
    }
    if (next === null) return
    event.preventDefault()
    scrubbing = true
    setPreview(clamp(next, 0, end()))
  }

  return (
    <div
      class={styles.timeline}
      data-testid="mixer-timeline"
      onKeyDown={onKeyDown}
    >
      <span class={styles.time} data-testid="mixer-time-elapsed">
        {props.formatTime(shown())}
      </span>
      <div class={styles.slider}>
        <LoopRangeRail
          class={styles.rail}
          axisDomain={() => ({ start: 0, end: end() })}
          axisValue={shown}
          markDomain={() => ({ start: 0, end: end() })}
          markA={() => props.loopStart}
          markB={() => props.loopEnd}
          toAxis={(seconds) => seconds}
          fromAxis={(seconds) => seconds}
          active={() => props.loopEnabled}
          disabled={() => props.disabled === true || end() <= 0}
          axisStep={() => MARK_STEP}
          markStep={() => MARK_STEP}
          minimumMarkGap={() => props.minimumLoopGap + MARK_CLEARANCE}
          formatAxisValue={(seconds) =>
            `${props.formatTime(seconds)} of ${props.formatTime(end())}`
          }
          formatMarkValue={(seconds) => props.formatTime(seconds)}
          seekLabel="Song position"
          onSeek={onSeekInput}
          onScrubStart={() => {
            scrubbing = true
          }}
          onScrubEnd={commit}
          onMoveMarkA={(seconds) => props.onMoveLoopPoint('A', seconds)}
          onMoveMarkB={(seconds) => props.onMoveLoopPoint('B', seconds)}
          testIdPrefix="mixer-timeline"
          lensSide="over"
        />
      </div>
      <span class={styles.time} data-testid="mixer-time-total">
        {props.formatTime(end())}
      </span>
    </div>
  )
}
