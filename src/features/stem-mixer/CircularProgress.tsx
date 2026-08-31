// ============================================================
// CircularProgress — SVG Circular Progress indicator
// ============================================================

import { createMemo } from 'solid-js'

export interface CircularProgressProps {
  pct: number
  size?: number
}

export const CircularProgress = (props: CircularProgressProps) => {
  const m = createMemo(() => {
    const s = props.size ?? 24
    const r = (s - 4) / 2
    const circ = 2 * Math.PI * r
    const offset = circ * (1 - props.pct / 100)
    return { s, r, circ, offset }
  })

  return (
    <svg
      width={m().s}
      height={m().s}
      viewBox={`0 0 ${m().s} ${m().s}`}
      class="circular-progress"
    >
      <circle
        cx={m().s / 2}
        cy={m().s / 2}
        r={m().r}
        fill="none"
        stroke="var(--border, #30363d)"
        stroke-width="2"
      />
      <circle
        cx={m().s / 2}
        cy={m().s / 2}
        r={m().r}
        fill="none"
        stroke="var(--accent, #8b5cf6)"
        stroke-width="2"
        stroke-dasharray={String(m().circ)}
        stroke-dashoffset={String(m().offset)}
        stroke-linecap="round"
        transform={`rotate(-90 ${m().s / 2} ${m().s / 2})`}
      />
    </svg>
  )
}
