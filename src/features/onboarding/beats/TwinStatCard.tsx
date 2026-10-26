// ============================================================
// The twin's stat card: the voiceprint in one piece
// ============================================================
//
// Owner testing, 11 Oct 2026: the twin's numbers sat in three loose
// boxes that wrapped to two rows on a phone. They are one card now: the
// singer's own glides drawn as a gold ridge, its lowest and highest notes
// named beside it, and the numbers in one row, each a big number over a
// small label. On a phone the ridge runs across the top; on a wider card it
// sits to the left of the numbers, so the card adds little height to a
// beat that already scrolls on a laptop. The reference images it was
// picked from are listed in the PR; the card itself is drawn from the take
// (../voice-strip.ts), never from a picture.
//
// Every number is optional. A run with no range has no ridge and no
// semitones, and so does a range read that is not clean (a steady tone reads
// "A3 to A3", 0 semitones: singer-match.ts `isCleanRange`), since the beat
// above the card has just said Merc could not read the range. A skipped
// match has no accuracy, and a run that measured nothing shows no card at
// all.

import type { Component } from 'solid-js'
import { createMemo, createSignal, createUniqueId, For, onCleanup, Show, } from 'solid-js'
import type { MirrorResult } from '@/lib/mirror/metrics'
import { cleanRange } from '@/lib/mirror/singer-match'
import type { RidgeBox } from '../voice-strip'
import { idealStrip, RIDGE_BOX, ridgeShape } from '../voice-strip'
import styles from './TwinStatCard.module.css'

interface StatCell {
  key: 'range' | 'steadiness' | 'accuracy'
  value: string
  label: string
}

/** The least room between the two note names, in percent of the ridge. */
const NOTE_GAP = 26

/**
 * Where the two note names sit, level with the ridge's highest and lowest
 * points, held apart so a narrow range never stacks one on the other, and
 * kept inside the ridge's height.
 */
export function noteTops(
  high: number,
  low: number,
): { high: number; low: number } {
  let top = high
  let bottom = low
  if (bottom - top < NOTE_GAP) {
    const middle = (top + bottom) / 2
    top = middle - NOTE_GAP / 2
    bottom = middle + NOTE_GAP / 2
  }
  const lift = Math.max(0, bottom - 92)
  const drop = Math.max(0, 8 - (top - lift))
  return { high: top - lift + drop, low: bottom - lift + drop }
}

export interface TwinStatCardProps {
  result: MirrorResult
  /**
   * The singer's glides as pitches (voice-strip.ts). Null draws the
   * range's own rise and fall, for a result that came without its glides.
   */
  strip: readonly number[] | null
}

export const TwinStatCard: Component<TwinStatCardProps> = (props) => {
  const id = createUniqueId()
  /** The range, when its read is clean: an unclean one is drawn as none. */
  const range = () => cleanRange(props.result.range)
  /** The ridge's own size, measured, so the line is drawn 1:1. */
  const [box, setBox] = createSignal<RidgeBox>(RIDGE_BOX)

  const measure = (art: HTMLDivElement): void => {
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        setBox({ width: Math.round(width), height: Math.round(height) })
      }
    })
    observer.observe(art)
    onCleanup(() => observer.disconnect())
  }

  const cells = createMemo((): StatCell[] => {
    const out: StatCell[] = []
    const measured = range()
    if (measured !== null) {
      out.push({
        key: 'range',
        value: String(measured.semitones),
        label: measured.semitones === 1 ? 'semitone' : 'semitones',
      })
    }
    const steadiness = props.result.steadiness
    if (steadiness !== null) {
      out.push({
        key: 'steadiness',
        value: String(Math.round(steadiness.score)),
        label: 'steadiness',
      })
    }
    const accuracy = props.result.accuracy
    if (accuracy !== null) {
      out.push({
        key: 'accuracy',
        value: String(Math.round(accuracy.score)),
        label: 'pitch accuracy',
      })
    }
    return out
  })

  const ridge = createMemo(() => {
    const measured = range()
    if (measured === null) return null
    const shape = ridgeShape(
      props.strip ?? idealStrip(measured),
      measured,
      box(),
    )
    return { shape, notes: noteTops(shape.high.y, shape.low.y) }
  })

  return (
    <Show when={cells().length > 0}>
      <div
        class={styles.card}
        role="group"
        aria-label="Your voiceprint"
        data-stat-card
      >
        <div class={styles.body}>
          <Show when={ridge()}>
            {(drawn) => (
              <div class={styles.ridge} aria-hidden="true" data-ridge>
                <span class={styles.notes}>
                  <span
                    class={styles.note}
                    data-note="high"
                    style={{ top: `${drawn().notes.high}%` }}
                  >
                    {range()?.highNote}
                  </span>
                  <span
                    class={styles.note}
                    data-note="low"
                    style={{ top: `${drawn().notes.low}%` }}
                  >
                    {range()?.lowNote}
                  </span>
                </span>
                <div class={styles.ridgeArt} ref={measure}>
                  <svg
                    viewBox={`0 0 ${box().width} ${box().height}`}
                    preserveAspectRatio="none"
                  >
                    <defs>
                      <linearGradient
                        id={`${id}-haze`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0"
                          stop-color="#ffd98f"
                          stop-opacity="0.3"
                        />
                        <stop
                          offset="1"
                          stop-color="#ffd98f"
                          stop-opacity="0"
                        />
                      </linearGradient>
                      <linearGradient
                        id={`${id}-gold`}
                        x1="0"
                        y1="0"
                        x2="1"
                        y2="0"
                      >
                        <stop offset="0" stop-color="#f0b45a" />
                        <stop offset="0.5" stop-color="#ffe9a8" />
                        <stop offset="1" stop-color="#f0b45a" />
                      </linearGradient>
                    </defs>
                    <path
                      class={styles.haze}
                      d={drawn().shape.area}
                      fill={`url(#${id}-haze)`}
                    />
                    <path
                      class={styles.glow}
                      d={drawn().shape.line}
                      pathLength="1"
                    />
                    <path
                      class={styles.line}
                      d={drawn().shape.line}
                      pathLength="1"
                      stroke={`url(#${id}-gold)`}
                      data-ridge-line
                    />
                  </svg>
                </div>
              </div>
            )}
          </Show>
          <div class={styles.row} data-stat-row data-cells={cells().length}>
            <For each={cells()}>
              {(cell) => (
                <div class={styles.cell} data-stat={cell.key}>
                  <span class={styles.value} data-value>
                    {cell.value}
                  </span>
                  <span class={styles.label} data-label>
                    {cell.label}
                  </span>
                  <Show when={cell.key === 'range'}>
                    <span class={styles.spoken}>
                      , from {range()?.lowNote} to {range()?.highNote}
                    </span>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default TwinStatCard
