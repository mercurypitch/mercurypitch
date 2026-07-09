// ============================================================
// CalendarHeatmap — Practice frequency heatmap (like GitHub)
// ============================================================

import type { Component } from 'solid-js'
import { createMemo, For } from 'solid-js'
import piStyles from '@/features/practice-intelligence/components/PracticeIntelligence.module.css'
import { getSessionHistory } from '@/stores/practice-session-store'

interface CalendarHeatmapProps {
  weeks?: number
}

interface DayCell {
  date: string // "YYYY-MM-DD"
  count: number
  level: 0 | 1 | 2 | 3 | 4 // 0=no practice, 4=most
}

function dayLevel(count: number, maxCount: number): DayCell['level'] {
  if (count === 0) return 0
  if (maxCount <= 1) return 2
  const ratio = count / maxCount
  if (ratio <= 0.25) return 1
  if (ratio <= 0.5) return 2
  if (ratio <= 0.75) return 3
  return 4
}

export const CalendarHeatmap: Component<CalendarHeatmapProps> = (props) => {
  const weeks = () => props.weeks ?? 12

  const grid = createMemo(() => {
    const sessions = getSessionHistory()
    const countByDay = new Map<string, number>()

    for (const s of sessions) {
      const date = new Date(s.completedAt).toISOString().slice(0, 10)
      countByDay.set(date, (countByDay.get(date) ?? 0) + 1)
    }

    const maxCount = Math.max(1, ...countByDay.values())

    // Build last N weeks starting from today
    const cells: DayCell[] = []
    const now = new Date()
    const todayDay = now.getDay()
    // Go back to start of grid: current day + (weeks-1) weeks back + offset to Sunday
    const daysBack = (weeks() - 1) * 7 + todayDay
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - daysBack)

    for (let i = 0; i < weeks() * 7; i++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + i)
      const dateStr = d.toISOString().slice(0, 10)
      const count = countByDay.get(dateStr) ?? 0
      cells.push({
        date: dateStr,
        count,
        level: dayLevel(count, maxCount),
      })
    }

    return cells
  })

  const dayLabels = ['', 'Mon', '', 'Wed', '', 'Fri', '']
  const cellSize = 12
  const gap = 2

  const LEVEL_COLORS: Record<DayCell['level'], string> = {
    0: 'var(--bg-tertiary, #1e1e2e)',
    1: 'rgba(99, 102, 241, 0.15)',
    2: 'rgba(99, 102, 241, 0.35)',
    3: 'rgba(99, 102, 241, 0.6)',
    4: 'rgba(99, 102, 241, 0.9)',
  }

  // Group cells into weeks
  const weekChunks = createMemo(() => {
    const chunks: DayCell[][] = []
    const cells = grid()
    for (let i = 0; i < cells.length; i += 7) {
      chunks.push(cells.slice(i, i + 7))
    }
    return chunks
  })

  const svgWidth = () => weeks() * (cellSize + gap) + 28
  const svgHeight = () => 7 * (cellSize + gap) + 4

  return (
    <svg
      width={svgWidth()}
      height={svgHeight()}
      viewBox={`0 0 ${svgWidth()} ${svgHeight()}`}
      class={piStyles.calendarHeatmap}
      aria-label="Practice activity heatmap"
      role="img"
    >
      {/* Day labels */}
      <For each={dayLabels}>
        {(label, i) => (
          <text
            x={0}
            y={i() * (cellSize + gap) + cellSize - 1}
            font-size="8"
            fill="var(--text-secondary, #888)"
          >
            {label}
          </text>
        )}
      </For>

      {/* Cells */}
      <For each={weekChunks()}>
        {(week, wi) =>
          week.map((cell, di) => (
            <rect
              x={wi() * (cellSize + gap) + 24}
              y={di * (cellSize + gap)}
              width={cellSize}
              height={cellSize}
              rx={2}
              fill={LEVEL_COLORS[cell.level]}
            >
              <title>
                {cell.date}: {cell.count} session{cell.count !== 1 ? 's' : ''}
              </title>
            </rect>
          ))
        }
      </For>
    </svg>
  )
}
