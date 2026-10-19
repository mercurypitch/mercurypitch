// ============================================================
// WeekDots: this week's seven days, warmed up or not, today ringed
// ============================================================
//
// The Warm-up's week (DESIGN-warm-up.md §5.9, the owner's pw-mark "dots",
// Codex's end frame F4 screen 2): Monday to Sunday, a filled dot for each
// day warmed up, a ring round today, every other day an outline. No count
// and no streak: a day without a warm-up looks like a day still to come.
//
// Two sizes: `line`, inside a line of text (the picker's Warm-up card, the
// Sing room's pill), in the theme's teal; and `path`, under the path's
// "Warmed up today" chip, in the night's own teal.
//
// A screen reader hears the days warmed up by name (weekSaid).

import type { JSX } from 'solid-js'
import { For } from 'solid-js'
import type { WeekDot } from '@/lib/warm-up-days'
import { weekSaid } from '@/lib/warm-up-days'
import styles from './WeekDots.module.css'

export interface WeekDotsProps {
  dots: readonly WeekDot[]
  /** Inside a line of text, or under the path's chip. Default: line. */
  size?: 'line' | 'path'
  testId?: string
}

export function WeekDots(props: WeekDotsProps): JSX.Element {
  return (
    <span
      class={styles.week}
      data-size={props.size ?? 'line'}
      role="img"
      aria-label={weekSaid(props.dots)}
      data-testid={props.testId}
    >
      <For each={props.dots}>
        {(dot) => (
          <span
            class={styles.dot}
            data-warmed={dot.warmed ? 'true' : 'false'}
            data-today={dot.today ? 'true' : undefined}
          />
        )}
      </For>
    </span>
  )
}
