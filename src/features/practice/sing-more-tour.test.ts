// ============================================================
// "Show me more": the second Sing tour, and how the first offers it
// ============================================================
//
// The Sing tour's last stop offers it under its own key, and its steps load
// only on the tap (a dynamic import, so no page's first paint carries them).
// Each stop runs Merc's demo and rings the control it is about: Repeat on
// both screens, Spaced rest on a wide one, which alone has it. A wide
// screen's bubble keeps the top right corner, off his line.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { createCoachRunner } from '@/components/coach/runner'
import type { CoachStep } from '@/lib/coach-types'
import { TOUR_IDS } from '@/lib/tour-ids'
import { SING_MORE_TOUR } from './sing-more-tour'
import { SING_TOUR } from './sing-tour'

const { startSingDemo } = vi.hoisted(() => ({
  startSingDemo: vi.fn(() => ({
    pose: () => null,
    said: () => '',
    stop: () => undefined,
  })),
}))
vi.mock('./sing-demo', () => ({ startSingDemo }))

/** The steps one screen shows, in order. */
function stepsFor(phone: boolean): CoachStep[] {
  const runner = createCoachRunner(SING_MORE_TOUR, {
    phone,
    track: vi.fn(),
    on: () => () => undefined,
  })
  const steps: CoachStep[] = []
  for (let at = runner.snapshot(); at !== null; at = runner.snapshot()) {
    steps.push(at.step)
    runner.next()
  }
  runner.dispose()
  return steps
}

describe('the Sing tour offers it', () => {
  it('under its own key and number, beside Done', () => {
    expect(SING_TOUR.more?.label).toBe('Show me more')
    expect(SING_TOUR.more?.key).toBe('sing-more')
    expect(SING_MORE_TOUR.key).toBe('sing-more')
    expect(TOUR_IDS['sing-more']).toBe(19)
  })

  it('loading its steps only on the tap', async () => {
    const source = readFileSync(join(__dirname, 'sing-tour.ts'), 'utf8')
    expect(source).not.toMatch(/from '\.\/sing-more-tour'/)
    expect(source).toMatch(/import\('\.\/sing-more-tour'\)/)

    await expect(SING_TOUR.more?.load()).resolves.toBe(SING_MORE_TOUR)
  })
})

describe('SING_MORE_TOUR', () => {
  it('rings Repeat where each screen draws it, and Spaced rest on a wide screen', () => {
    const phone = stepsFor(true)
    const wide = stepsFor(false)

    expect(phone.map((step) => step.id)).toEqual(['repeat'])
    expect(wide.map((step) => step.id)).toEqual(['repeat', 'rests'])
    expect(wide[0]?.target).toContain('[data-tour="sing.mode"]')
    expect(wide[0]?.target).toContain('[data-tour="sing.repeat"]')
    expect(wide[1]?.target).toBe('[data-tour="sing.rest"]')
  })

  it("keeps a wide screen's bubble in the top right, off Merc's line", () => {
    for (const step of stepsFor(false)) {
      expect(step.keepCorner).toBe(true)
      expect(step.corner).toBe('top-right')
    }
  })

  it('runs Merc singing each stop', () => {
    const [repeat, rests] = stepsFor(false)
    repeat?.run?.()
    expect(startSingDemo).toHaveBeenLastCalledWith('repeat')
    rests?.run?.()
    expect(startSingDemo).toHaveBeenLastCalledWith('rests')
  })

  it('writes no em dash and keeps each line short', () => {
    for (const step of SING_MORE_TOUR.steps) {
      expect(`${step.title} ${step.body}`).not.toContain('—')
      expect(step.body.length).toBeLessThanOrEqual(110)
    }
  })
})
