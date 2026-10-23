// ============================================================
// plan-merc: Merc as the beat and the layer both draw him
// ============================================================
//
// BeatPlan.test.tsx and PlanLayer.test.tsx pin that each host puts his size
// and his still where the screens ask for them. What is pinned here is the
// module the two hosts share, so that neither can drift from the other: the
// sizes from the approved mock, which still goes with which pose, and that the
// phone is asked in the screens' own words, followed through a turn of the
// phone, and let go of when the host goes.

import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRoot, createSignal } from 'solid-js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { STATES } from '@/lib/merc/constants'
import { createMercSize, mercSizeFor, PHONE_QUERY, stillFor } from './plan-merc'
import type { PlanPhase } from './usePlanFlowController'

const repo = resolve(__dirname, '../../..')

const LISTEN = '/onboarding/coach/merc-listen.webp'
const CELEBRATE = '/onboarding/coach/merc-celebrate.webp'
const POINT = '/onboarding/coach/merc-point.webp'

/** The window's width as the browser reports it, and who is listening for a turn of the phone. */
const browser = {
  phone: false,
  listeners: new Set<() => void>(),
  asked: [] as string[],
}

function stubMatchMedia(): void {
  browser.phone = false
  browser.listeners.clear()
  browser.asked = []
  vi.stubGlobal('matchMedia', (query: string) => {
    browser.asked.push(query)
    return {
      get matches(): boolean {
        return query === PHONE_QUERY && browser.phone
      },
      addEventListener: (_type: string, listener: () => void) => {
        browser.listeners.add(listener)
      },
      removeEventListener: (_type: string, listener: () => void) => {
        browser.listeners.delete(listener)
      },
    }
  })
}

/** The person turns the phone: the window changes width and tells whoever asked. */
function turnPhone(phone: boolean): void {
  browser.phone = phone
  for (const listener of [...browser.listeners]) listener()
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('his size', () => {
  it.each<[string, PlanPhase, boolean, number]>([
    ['the questions, in a wide window', 'questions', false, 136],
    ['the questions, on a phone', 'questions', true, 96],
    ['the plan, in a wide window', 'plan', false, 92],
    ['the plan, on a phone', 'plan', true, 84],
  ])('over %s is %d px square', (_where, phase, phone, px) => {
    expect(mercSizeFor(phase, phone)).toBe(px)
  })

  it('is smaller on a phone than in a wide window, over the questions and over the plan', () => {
    for (const phase of ['questions', 'plan'] as const) {
      expect(mercSizeFor(phase, true)).toBeLessThan(mercSizeFor(phase, false))
    }
  })
})

describe('his still', () => {
  it('is the listening one on the third question and the cheering one on the plan', () => {
    expect(stillFor('listen')).toBe(LISTEN)
    expect(stillFor('celebrate')).toBe(CELEBRATE)
  })

  it('points the way in every other pose', () => {
    const others = STATES.filter(
      (pose) => pose !== 'listen' && pose !== 'celebrate',
    )

    expect(others.length).toBeGreaterThan(0)
    expect(others.map(stillFor)).toEqual(others.map(() => POINT))
  })

  it('is a picture the app serves, for every pose', () => {
    const served = new Set(STATES.map(stillFor))

    expect([...served].sort()).toEqual([CELEBRATE, LISTEN, POINT].sort())
    for (const still of served) {
      expect(existsSync(resolve(repo, `public${still}`))).toBe(true)
    }
  })
})

describe('the phone', () => {
  it("is asked in the screens' own breakpoint: the complement of their min-width", () => {
    const screens = readFileSync(
      resolve(repo, 'src/features/plan/PlanQuestions.module.css'),
      'utf8',
    )
    const wide = Number(/@media \(min-width: (\d+)px\)/u.exec(screens)?.[1])

    expect(wide).toBeGreaterThan(0)
    expect(PHONE_QUERY).toBe(`(max-width: ${(wide * 100 - 2) / 100}px)`)
  })

  it('is asked once, in those words, and follows a turn of the phone', () => {
    stubMatchMedia()
    const [phase, setPhase] = createSignal<PlanPhase>('questions')
    let size!: () => number
    const dispose = createRoot((end) => {
      size = createMercSize(phase)
      return end
    })

    expect(browser.asked).toEqual([PHONE_QUERY])
    expect(size()).toBe(136)

    turnPhone(true)
    expect(size()).toBe(96)

    setPhase('plan')
    expect(size()).toBe(84)

    turnPhone(false)
    expect(size()).toBe(92)
    dispose()
  })

  it('stops listening when the host goes', () => {
    stubMatchMedia()
    const dispose = createRoot((end) => {
      createMercSize(() => 'questions')
      return end
    })
    expect(browser.listeners.size).toBe(1)

    dispose()

    expect(browser.listeners.size).toBe(0)
  })
})
