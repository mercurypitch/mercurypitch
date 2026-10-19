// ============================================================
// WeekDots: seven days, the warmed-up ones filled, today ringed
// ============================================================

import { cleanup, render, screen } from '@solidjs/testing-library'
import { afterEach, describe, expect, it } from 'vitest'
import { weekDots } from '@/lib/warm-up-days'
import { WeekDots } from './WeekDots'

afterEach(cleanup)

describe('WeekDots', () => {
  it('draws the week Monday first, the days warmed up filled and today ringed', () => {
    // Thursday 1 Oct 2026; Monday and Wednesday were in September.
    const dots = weekDots(['2026-09-28', '2026-09-30'], '2026-10-01')!
    render(() => <WeekDots dots={dots} testId="week" />)
    const week = screen.getByTestId('week')
    const drawn = [...week.children].map((dot) => {
      const el = dot as HTMLElement
      return `${el.dataset.warmed === 'true' ? 'x' : '.'}${el.dataset.today === undefined ? '' : 'o'}`
    })
    expect(drawn).toEqual(['x', '.', 'x', '.o', '.', '.', '.'])
  })

  it('is one picture to a screen reader, named by the days warmed up', () => {
    const dots = weekDots(['2026-09-28', '2026-10-01'], '2026-10-01')!
    render(() => <WeekDots dots={dots} size="path" testId="week" />)
    const week = screen.getByRole('img')
    expect(week.getAttribute('aria-label')).toBe(
      'Warmed up this week: Monday and today',
    )
    expect(week.dataset.size).toBe('path')
  })
})
