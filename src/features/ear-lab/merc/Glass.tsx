// ============================================================
// The glass — the Mercury Index as a tube with a scale. The sealed
// number is the solid fill and a brass notch, dated; practice draws
// only a faint dashed line, labelled as an estimate; an unmarked glass
// says so rather than sitting at zero. After a calibration the mercury
// rises from the old mark to the new one and the new line is engraved,
// the old one left faint beside it.
// ============================================================

import type { JSX } from 'solid-js'
import { createSignal, For, onMount, Show, untrack } from 'solid-js'
import { prefersReducedMotion } from '@/components/room-kit/reduced-motion'
import { practiceIndexEstimate } from '@/stores/ear-lab-store'
import styles from './bench.module.css'

export interface GlassProps {
  /** The sealed Index, or null before the first calibration. */
  sealed: number | null
  /** When it was sealed, said in the picture's words. */
  sealedOn?: string | null
  /** The practice estimate, or null. */
  estimate: number | null
  /** The mark a calibration just replaced: it stays faint, and the
   *  mercury rises from it. */
  previous?: number | null
  /** The drawing's width in px. */
  width?: number
}

/** The practice estimate, or null while no faculty has been measured:
 *  the Index of nothing reads 0, and the glass says unmarked instead. */
export function practiceEstimate(): number | null {
  const index = practiceIndexEstimate()
  return Object.keys(index.parts).length === 0 ? null : index.value
}

/** The window of the scale: a hundred points around what is drawn,
 *  widened in fifties until every mark fits. */
export function glassWindow(values: readonly number[]): {
  lo: number
  hi: number
} {
  if (values.length === 0) return { lo: 200, hi: 300 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  const lo = Math.max(0, Math.floor((min - 10) / 50) * 50)
  let hi = lo + 100
  while (max > hi - 5) hi += 50
  return { lo, hi }
}

export function Glass(props: GlassProps): JSX.Element {
  const width = (): number => props.width ?? 226
  const marks = (): number[] =>
    [props.sealed, props.estimate, props.previous ?? null].filter(
      (value): value is number => value !== null,
    )
  const scale = () => glassWindow(marks())
  const x = (value: number): number => {
    const { lo, hi } = scale()
    const inner = width() - 6
    return 3 + ((Math.min(hi, Math.max(lo, value)) - lo) / (hi - lo)) * inner
  }
  const ticks = (): number[] => {
    const { lo, hi } = scale()
    const out: number[] = []
    for (let v = lo; v <= hi; v += 25) out.push(v)
    return out
  }
  const labels = (): number[] => {
    const { lo, hi } = scale()
    const mid = lo + Math.round((hi - lo) / 2 / 25) * 25
    return [lo, mid, hi]
  }

  // The mercury rises from the old mark to the new one, once; after
  // that it follows the sealed number.
  const [rising, setRising] = createSignal(
    untrack(() => props.previous !== undefined && props.previous !== null),
  )
  const level = (): number | null =>
    rising() ? (props.previous ?? null) : props.sealed
  onMount(() => {
    if (!rising()) return
    if (prefersReducedMotion()) {
      setRising(false)
      return
    }
    requestAnimationFrame(() => setRising(false))
  })

  const label = (): string => {
    const { lo, hi } = scale()
    if (props.sealed === null && props.estimate === null) {
      return 'The glass, unmarked: no Mercury Index yet'
    }
    const parts: string[] = []
    if (props.sealed !== null) {
      parts.push(
        `sealed index ${props.sealed}${
          props.sealedOn === undefined || props.sealedOn === null
            ? ''
            : ` on ${props.sealedOn}`
        }`,
      )
    } else {
      parts.push('not yet sealed')
    }
    if (props.previous !== undefined && props.previous !== null) {
      parts.push(`the old mark at ${props.previous} left faint`)
    }
    if (props.estimate !== null) {
      parts.push(`practice estimate ${props.estimate}`)
    }
    return `The glass: ${parts.join(', ')}, on a scale from ${lo} to ${hi}`
  }

  return (
    <svg
      class={styles.glass}
      role="img"
      aria-label={label()}
      width={width()}
      height="46"
      viewBox={`0 0 ${width()} 46`}
      data-testid="merc-glass"
    >
      <rect
        x="1"
        y="9"
        width={width() - 2}
        height="12"
        rx="6"
        fill="rgba(197, 206, 216, 0.08)"
        stroke="rgba(197, 206, 216, 0.55)"
      />
      <Show
        when={props.sealed !== null || props.estimate !== null}
        fallback={
          // A tag on the tube, so the word does not sit on its outline.
          <>
            <rect
              x={width() / 2 - 48}
              y="5"
              width="96"
              height="20"
              rx="10"
              fill="#0a0b0d"
              stroke="rgba(197, 206, 216, 0.35)"
            />
            <text
              x={width() / 2}
              y="19.5"
              text-anchor="middle"
              class={styles.glassEmpty}
            >
              Unmarked
            </text>
          </>
        }
      >
        <Show when={level()}>
          {(value) => (
            <rect
              x="3"
              y="11"
              width={Math.max(0, x(value()) - 3)}
              height="8"
              rx="4"
              fill="#c5ced8"
              class={styles.mercury}
            />
          )}
        </Show>
        <Show when={props.previous ?? null}>
          {(old) => (
            <path
              d={`M${x(old())} 6v18`}
              stroke="#8d97a3"
              stroke-width="1.4"
              stroke-opacity="0.7"
            />
          )}
        </Show>
        <Show when={props.sealed}>
          {(sealed) => (
            <path
              d={`M${x(sealed())} 5v20`}
              stroke="#e7c67d"
              stroke-width="1.6"
              class={
                props.previous !== undefined && props.previous !== null
                  ? styles.engrave
                  : undefined
              }
            />
          )}
        </Show>
        <Show when={props.estimate}>
          {(estimate) => (
            <path
              d={`M${x(estimate())} 7v16`}
              stroke="#c5ced8"
              stroke-opacity="0.65"
              stroke-width="1.4"
              stroke-dasharray="2 2"
            />
          )}
        </Show>
      </Show>
      <path
        d={ticks()
          .map((v) => `M${x(v).toFixed(1)} 24v4`)
          .join('')}
        stroke="#8d97a3"
        stroke-width="1.2"
      />
      <For each={labels()}>
        {(v, i) => (
          <text
            x={x(v)}
            y="41"
            text-anchor={i() === 0 ? 'start' : i() === 2 ? 'end' : 'middle'}
            class={styles.glassScale}
          >
            {v}
          </text>
        )}
      </For>
    </svg>
  )
}
