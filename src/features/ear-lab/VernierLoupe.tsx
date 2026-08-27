// ============================================================
// VernierLoupe — Hairline's instrument.
//
// Two tones are two hairlines on a cents scale, seen through a
// loupe that magnifies the gap up to seven times so a half-cent
// still reads. The second hairline always sits to the RIGHT while
// the tones sound: showing which way it moved would answer the
// question for the eye. The reveal swings it to the true side.
// ============================================================

import type { JSX } from 'solid-js'
import { createMemo, For } from 'solid-js'
import styles from './EarInstruments.module.css'
import { useCompactStage } from './use-compact-stage'

interface VernierLoupeProps {
  /** The current gap, in cents (always positive). */
  gap: number
  /** Which hairline is sounding: 1, 2, or 0 for neither. */
  sounding: 0 | 1 | 2
  /** Which tone was higher, once told. */
  reveal: 'first' | 'second' | null
}

const CENTRE = 320
const PX_PER_CENT = 2.8
const SCALE_TICKS = Array.from({ length: 21 }, (_, i) => -100 + i * 10)

export function VernierLoupe(props: VernierLoupeProps): JSX.Element {
  const compact = useCompactStage()

  const signed = () =>
    props.reveal === 'first' ? -props.gap : Math.abs(props.gap)

  const hairBX = () =>
    CENTRE + Math.max(-280, Math.min(280, signed() * PX_PER_CENT))

  const loupeX = createMemo(() => {
    const raw = CENTRE + signed() * 1.4
    const [lo, hi] = compact() ? [200, 440] : [118, 522]
    return Math.max(lo, Math.min(hi, raw))
  })

  const magHalf = () => {
    const gap = Math.max(0, props.gap)
    const mag = Math.min(7, 120 / Math.max(gap, 1))
    const sign = signed() < 0 ? -1 : 1
    return (sign * gap * mag) / 2
  }

  const readout = () => `${Math.max(0, props.gap).toFixed(1)}¢`

  const label = () =>
    `Vernier scale under a loupe: two hairlines ${readout()} apart${
      props.reveal ? `, the ${props.reveal} tone higher` : ''
    }`

  return (
    <svg
      class={styles.instrument}
      viewBox={compact() ? '120 0 400 260' : '0 0 640 260'}
      role="img"
      aria-label={label()}
      data-instrument="vernier"
    >
      <defs>
        <radialGradient id="ear-loupe-glass" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stop-color="#ffffff" stop-opacity="0.06" />
          <stop offset="0.85" stop-color="#ffffff" stop-opacity="0.02" />
          <stop offset="1" stop-color="#ffffff" stop-opacity="0.16" />
        </radialGradient>
      </defs>

      <line
        x1="40"
        y1="200"
        x2="600"
        y2="200"
        class={styles.brassLine}
        stroke-width="2"
      />
      <For each={SCALE_TICKS}>
        {(cents) => (
          <line
            x1={CENTRE + cents * PX_PER_CENT}
            x2={CENTRE + cents * PX_PER_CENT}
            y1={cents % 50 === 0 ? 186 : 192}
            y2="200"
            class={styles.tick}
            classList={{ [styles.tickMajor]: cents % 50 === 0 }}
          />
        )}
      </For>
      <text x="180" y="232" class={styles.caption} text-anchor="middle">
        −50¢
      </text>
      <text x="320" y="232" class={styles.caption} text-anchor="middle">
        0
      </text>
      <text x="460" y="232" class={styles.caption} text-anchor="middle">
        +50¢
      </text>

      <line
        x1={CENTRE}
        x2={CENTRE}
        y1="178"
        y2="212"
        class={`${styles.hair} ${styles.hairA}`}
        classList={{ [styles.hairLit]: props.sounding === 1 }}
      />
      <line
        x1={hairBX()}
        x2={hairBX()}
        y1="178"
        y2="212"
        class={`${styles.hair} ${styles.hairB}`}
        classList={{ [styles.hairLit]: props.sounding === 2 }}
      />

      <g class={styles.loupe} transform={`translate(${loupeX()} 112)`}>
        <circle r="78" class={styles.loupeDisc} />
        <circle r="70" fill="url(#ear-loupe-glass)" class={styles.loupeGlass} />
        <line
          x1={-magHalf()}
          x2={-magHalf()}
          y1="-34"
          y2="58"
          class={`${styles.hair} ${styles.hairA} ${styles.hairMag}`}
          classList={{ [styles.hairLit]: props.sounding === 1 }}
        />
        <line
          x1={magHalf()}
          x2={magHalf()}
          y1="-34"
          y2="58"
          class={`${styles.hair} ${styles.hairB} ${styles.hairMag}`}
          classList={{ [styles.hairLit]: props.sounding === 2 }}
        />
        <text x="0" y="-46" class={styles.readout} text-anchor="middle">
          {readout()}
        </text>
      </g>
    </svg>
  )
}
