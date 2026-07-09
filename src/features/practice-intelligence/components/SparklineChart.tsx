// ============================================================
// SparklineChart — Inline SVG sparkline (no dependencies)
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, Show } from 'solid-js'
import piStyles from '@/features/practice-intelligence/components/PracticeIntelligence.module.css'

interface SparklineChartProps {
  data: number[]
  width?: number
  height?: number
  lineColor?: string
  fillColor?: string
  strokeWidth?: number
}

export const SparklineChart: Component<SparklineChartProps> = (props) => {
  const w = () => props.width ?? 120
  const h = () => props.height ?? 32
  const stroke = () => props.lineColor ?? 'var(--accent-color, #6366f1)'
  const fill = () =>
    props.fillColor ?? 'var(--accent-color-translucent, rgba(99,102,241,0.15))'
  const sw = () => props.strokeWidth ?? 1.5
  const paddingX = 2
  const paddingY = 2

  const points = createMemo(
    (): { line: string; fillPolygon: string } | null => {
      const d = props.data
      if (d.length < 2) return null

      const maxVal = Math.max(...d, 1)
      const minVal = Math.min(...d, 0)
      const range = maxVal - minVal || 1
      const drawW = w() - paddingX * 2
      const drawH = h() - paddingY * 2
      const stepX = drawW / (d.length - 1)

      // Build polyline points
      let linePoints = ''
      for (let i = 0; i < d.length; i++) {
        const x = paddingX + i * stepX
        const y = paddingY + drawH - ((d[i] - minVal) / range) * drawH
        linePoints += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
      }

      const lastX = paddingX + (d.length - 1) * stepX

      return {
        line: linePoints.trim(),
        fillPolygon: `${linePoints.trim()} L${lastX.toFixed(1)},${(h() - paddingY).toFixed(1)} L${paddingX.toFixed(1)},${(h() - paddingY).toFixed(1)} Z`,
      }
    },
  )

  return (
    <Show
      when={points()}
      fallback={<div style={{ width: `${w()}px`, height: `${h()}px` }} />}
    >
      {(pts) => (
        <svg
          width={w()}
          height={h()}
          viewBox={`0 0 ${w()} ${h()}`}
          class={piStyles.sparklineChart}
          aria-label="Score trend sparkline"
          role="img"
        >
          <path d={pts().fillPolygon} fill={fill()} stroke="none" />
          <path
            d={pts().line}
            fill="none"
            stroke={stroke()}
            stroke-width={sw()}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      )}
    </Show>
  )
}
