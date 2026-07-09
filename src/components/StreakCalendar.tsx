import type { Component } from 'solid-js'
import { createMemo, For } from 'solid-js'
import { sessionResults } from '@/stores'
import styles from './StreakCalendar.module.css'

interface StreakCalendarProps {
  days?: number
}

const DAY_MS = 86400000

export const StreakCalendar: Component<StreakCalendarProps> = (props) => {
  const activityMap = createMemo(() => {
    const map = new Map<string, number>()
    for (const entry of sessionResults()) {
      const date = new Date(entry.completedAt).toISOString().slice(0, 10)
      map.set(date, (map.get(date) ?? 0) + 1)
    }
    return map
  })

  const weeks = createMemo(() => {
    const totalDays = props.days ?? 91 // 13 weeks
    const today = new Date()
    const result: Array<Array<{ date: string; count: number }>> = []
    let currentWeek: Array<{ date: string; count: number }> = []

    for (let i = totalDays - 1; i >= 0; i--) {
      const d = new Date(today.getTime() - i * DAY_MS)
      const dateStr = d.toISOString().slice(0, 10)
      currentWeek.push({
        date: dateStr,
        count: activityMap().get(dateStr) ?? 0,
      })
      if (d.getDay() === 6 || i === 0) {
        // end of week (Saturday)
        result.push(currentWeek)
        currentWeek = []
      }
    }
    if (currentWeek.length > 0) result.push(currentWeek)
    return result
  })

  const maxCount = createMemo(() => {
    let max = 0
    for (const count of activityMap().values()) {
      if (count > max) max = count
    }
    return max
  })

  function cellClass(count: number): string {
    if (count === 0) return `${styles.cell} ${styles.empty}`
    const intensity = maxCount() > 0 ? count / maxCount() : 0
    if (intensity <= 0.25) return `${styles.cell} ${styles.low}`
    if (intensity <= 0.5) return `${styles.cell} ${styles.mid}`
    if (intensity <= 0.75) return `${styles.cell} ${styles.high}`
    return `${styles.cell} ${styles.max}`
  }

  function formatDate(dateStr: string): string {
    const d = new Date(`${dateStr}T00:00:00`)
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div class={styles.calendar}>
      <div class={styles.grid}>
        <For each={weeks()}>
          {(week) => (
            <div class={styles.week}>
              <For each={week}>
                {(day) => (
                  <div
                    class={cellClass(day.count)}
                    title={`${formatDate(day.date)}: ${day.count} session${day.count !== 1 ? 's' : ''}`}
                  />
                )}
              </For>
            </div>
          )}
        </For>
      </div>
      <div class={styles.legend}>
        <span class={styles.legendLabel}>Less</span>
        <div class={`${styles.cell} ${styles.empty}`} />
        <div class={`${styles.cell} ${styles.low}`} />
        <div class={`${styles.cell} ${styles.mid}`} />
        <div class={`${styles.cell} ${styles.high}`} />
        <div class={`${styles.cell} ${styles.max}`} />
        <span class={styles.legendLabel}>More</span>
      </div>
    </div>
  )
}
