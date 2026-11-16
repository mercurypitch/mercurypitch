// ============================================================
// BeatPulse: the beat, seen, under the staff
// ============================================================
//
// The click sounds in the count-in, and under the singing only where the
// singer asks for it; the beat is always seen (SEASON-2 § 5.2 item 11). Four
// dots for the bar's four beats, the one on now lit and swelling as its beat
// comes and easing off through it, and a small metronome whose arm swings
// to a side on every beat (kit/metronome-arm.ts, the lessons' swing). Both
// follow the beat clock as heard, so they keep time with the click.
//
// Hidden from a screen reader: Merc's line says the count.

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import { angleAtBeats } from './in-time-kit'
import styles from './SingInTime.module.css'
import { BAR_BEATS } from './tune-plan'

export interface BeatPulseProps {
  /** Beats from bar 1's first beat as heard; below 0 in the count-in; null before the run's first beat. */
  beat: number | null
  /** What the dots stand for now: the count-in's clicks, the click under the singing, or the beat alone. */
  word: 'count' | 'click' | 'beat'
}

const WORDS: Readonly<Record<BeatPulseProps['word'], string>> = {
  count: 'COUNT',
  click: 'CLICK',
  beat: 'BEAT',
}

export function BeatPulse(props: BeatPulseProps): JSX.Element {
  /** The beat in the bar, 0 to 3, and how far into it, 0 to 1. */
  const where = () => {
    const b = props.beat
    if (b === null) return null
    const whole = Math.floor(b)
    return {
      inBar: ((whole % BAR_BEATS) + BAR_BEATS) % BAR_BEATS,
      into: b - whole,
    }
  }
  const pulse = () => {
    const w = where()
    return w === null ? 0 : (1 - Math.min(1, w.into)) ** 3
  }
  const angle = () => {
    const b = props.beat
    return b === null ? 0 : angleAtBeats(b)
  }
  return (
    <div class={styles.pulse} aria-hidden="true" data-testid="beat-pulse">
      <span class={styles.pulseWord}>{WORDS[props.word]}</span>
      <div class={styles.dots}>
        <For each={[0, 1, 2, 3]}>
          {(k) => (
            <span
              class={styles.dot}
              data-one={k === 0}
              data-lit={where()?.inBar === k}
              data-past={(where()?.inBar ?? -1) > k}
              style={{
                '--pulse': where()?.inBar === k ? pulse().toFixed(3) : '0',
              }}
            />
          )}
        </For>
      </div>
      <svg class={styles.metronome} viewBox="0 0 26 34">
        <path d="M6 32h14L16 4h-6z" />
        <line
          class={styles.arm}
          x1={13}
          y1={27}
          x2={13}
          y2={7}
          transform={`rotate(${angle().toFixed(2)} 13 27)`}
        />
      </svg>
    </div>
  )
}
