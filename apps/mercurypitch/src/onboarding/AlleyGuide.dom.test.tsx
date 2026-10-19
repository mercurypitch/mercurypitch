// ============================================================
// Merc's welcome in the alley (S7b beat 1)
// ============================================================
//
// The guide on its own, over a stand-in stage: his drop, his hello, his
// point while the open doors light in turn, stepping aside for a picked
// door, reduced motion, no WebGL, and an install that is not new.

import { render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DoorKey } from '../alley/alley-plate'
import { alleyGreeted, resetAlleyGreetingForTests } from './alley-greeting'
import type { GuideInput } from './alley-guide-place'
import { AlleyGuide, DOORS_IN_TURN, GUIDE_TIMES, UNDRAWN_MS, } from './AlleyGuide'
import { ONBOARDING_COPY } from './onboarding-copy'
import { ONBOARDING_KEY, resetOnboardingFlagForTests } from './onboarding-flag'

const stage = vi.hoisted(() => ({ ok: true, states: [] as string[] }))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (_host: HTMLElement, options: { state: string }) => {
    stage.states.push(options.state)
    return {
      ok: stage.ok,
      setState: (state: string) => stage.states.push(state),
      setVoice: () => undefined,
      setPaused: () => undefined,
      setStill: () => undefined,
      destroy: () => undefined,
    }
  },
}))
vi.mock('./alley-guide.css', () => ({}))
const track = vi.hoisted(() => vi.fn())
vi.mock('@/features/onboarding/funnel', () => ({
  trackNativeOnboarding: track,
}))

/** A phone upright, the doors stepping down to the right. */
const INPUT: GuideInput = {
  w: 390,
  h: 844,
  landscape: false,
  floor: 746,
  top: 170,
  left: 16,
  right: 374,
  doors: [
    { x0: 0, x1: 30, y1: 503 },
    { x0: 225, x1: 278, y1: 601 },
  ],
}

let lights: (DoorKey | null)[] = []

function show({
  reduced = false,
  aside = () => false,
  opened = () => false,
}: {
  reduced?: boolean
  aside?: () => boolean
  opened?: () => boolean
} = {}): HTMLElement {
  const { container } = render(() => (
    <AlleyGuide
      input={() => INPUT}
      reduced={() => reduced}
      aside={aside}
      opened={opened}
      light={(door) => lights.push(door)}
    />
  ))
  return container
}

/** The onboarding's names sent, in order. */
const sent = (): string[] => track.mock.calls.map(([event]) => event as string)

const q = (root: HTMLElement, id: string): HTMLElement | null =>
  root.querySelector(`[data-testid="${id}"]`)
const mercState = (root: HTMLElement): string | null =>
  q(root, 'alley-merc')?.getAttribute('data-merc-state') ?? null

/** His stage loaded: the chunk's import settled and his first frame up. */
async function drawn(): Promise<void> {
  await vi.dynamicImportSettled()
  await Promise.resolve()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  localStorage.clear()
  localStorage.setItem(ONBOARDING_KEY, 'due')
  resetOnboardingFlagForTests()
  resetAlleyGreetingForTests()
  lights = []
  track.mockClear()
  stage.ok = true
  stage.states = []
})

afterEach(() => {
  vi.useRealTimers()
  localStorage.clear()
  resetOnboardingFlagForTests()
})

describe("Merc's welcome in the alley", () => {
  it('drops in, says hello, and points while the open doors light in turn', async () => {
    const root = show()
    await drawn()

    expect(mercState(root)).toBe('drop')
    expect(q(root, 'alley-guide-line')?.getAttribute('data-shown')).toBe('off')
    vi.advanceTimersByTime(GUIDE_TIMES.hello)
    expect(q(root, 'alley-guide-line')?.getAttribute('data-shown')).toBe('on')
    expect(q(root, 'alley-guide-line')?.textContent).toBe(ONBOARDING_COPY.hello)
    // Read once, politely, from its own live region; the line itself is hidden.
    expect(q(root, 'alley-guide-said')?.textContent).toBe(ONBOARDING_COPY.hello)
    expect(q(root, 'alley-guide')?.getAttribute('aria-hidden')).toBe('true')
    expect(alleyGreeted()).toBe(true)

    vi.advanceTimersByTime(GUIDE_TIMES.point - GUIDE_TIMES.hello)
    expect(mercState(root)).toBe('point')
    vi.advanceTimersByTime(
      GUIDE_TIMES.light -
        GUIDE_TIMES.point +
        DOORS_IN_TURN.length * GUIDE_TIMES.every,
    )
    expect(lights).toEqual(['ear', 'karaoke', 'sing', null])
    expect(mercState(root)).toBe('idle')
  })

  it('shows nothing on an install whose onboarding is done, and counts nothing', async () => {
    localStorage.setItem(ONBOARDING_KEY, 'done')
    resetOnboardingFlagForTests()
    const root = show()
    await drawn()
    vi.advanceTimersByTime(5000)

    expect(q(root, 'alley-guide')).toBeNull()
    expect(q(root, 'alley-merc')).toBeNull()
    expect(sent()).toEqual([])
  })

  it('counts the welcome once as it shows, and once more as a door opens from it', async () => {
    const [opened, setOpened] = createSignal(false)
    show({ opened })
    await drawn()
    expect(sent()).toEqual(['native_onboarding_welcome_view'])

    setOpened(true)
    setOpened(false)
    setOpened(true)

    expect(sent()).toEqual([
      'native_onboarding_welcome_view',
      'native_onboarding_welcome_complete',
    ])
  })

  it('steps aside while a door is picked, and lights nothing more', async () => {
    const [aside, setAside] = createSignal(false)
    const root = show({ aside })
    await drawn()
    vi.advanceTimersByTime(GUIDE_TIMES.light + 10)
    expect(lights).toEqual(['ear'])

    setAside(true)
    vi.advanceTimersByTime(5000)

    expect(q(root, 'alley-guide')?.getAttribute('data-aside')).toBe('on')
    expect(lights).toEqual(['ear', null])
    expect(mercState(root)).toBe('idle')
    setAside(false)
    expect(q(root, 'alley-guide')?.getAttribute('data-aside')).toBe('off')
  })

  it('under reduced motion: no drop, he is simply there and says hello at once', async () => {
    const root = show({ reduced: true })
    await drawn()

    expect(stage.states[0]).toBe('idle')
    vi.advanceTimersByTime(0)
    expect(q(root, 'alley-guide-line')?.getAttribute('data-shown')).toBe('on')
    expect(q(root, 'alley-guide')?.getAttribute('data-still')).toBe('on')
  })

  it('lights the doors all the same without WebGL, and says no hello', async () => {
    stage.ok = false
    const root = show()
    await drawn()

    vi.advanceTimersByTime(
      UNDRAWN_MS + DOORS_IN_TURN.length * GUIDE_TIMES.every,
    )

    expect(lights).toEqual(['ear', 'karaoke', 'sing', null])
    expect(q(root, 'alley-guide-line')?.getAttribute('data-shown')).toBe('off')
    expect(alleyGreeted()).toBe(false)
  })
})
