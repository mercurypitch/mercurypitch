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
import { alleyFit, layoutDoors } from '../alley/alley-geometry'
import type { DoorKey } from '../alley/alley-plate'
import { alleyScene } from '../alley/alley-plate'
import { alleyGreeted, resetAlleyGreetingForTests } from './alley-greeting'
import type { GuideInput } from './alley-guide-place'
import { AlleyGuide, ASIDE_MS, ASIDE_STILL_MS, DOORS_IN_TURN, GUIDE_TIMES, heldAfterColon, START_DOOR, UNDRAWN_MS, } from './AlleyGuide'
import { ONBOARDING_COPY } from './onboarding-copy'
import { markOnboardingDone, ONBOARDING_KEY, resetOnboardingFlagForTests, } from './onboarding-flag'

const stage = vi.hoisted(() => ({
  ok: true,
  states: [] as string[],
  paused: [] as boolean[],
  ready: [] as (() => void)[],
}))
vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: (
    _host: HTMLElement,
    options: { state: string; onReady?: () => void },
  ) => {
    stage.states.push(options.state)
    if (stage.ok && options.onReady) stage.ready.push(options.onReady)
    return {
      ok: stage.ok,
      setState: (state: string) => stage.states.push(state),
      setVoice: () => undefined,
      setPaused: (paused: boolean) => stage.paused.push(paused),
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

/** A phone upright: the alley as RoomsAlley draws it there. */
const INPUT: GuideInput = (() => {
  const scene = alleyScene(390, 844)
  const frame = { top: 170, bottom: 746 }
  const doors = layoutDoors(scene.plate, scene.doors, 390, 844, frame)
  return {
    w: 390,
    h: 844,
    landscape: false,
    floor: 746,
    top: 170,
    door: doors.find((door) => door.key === scene.guide.door) ?? doors[0],
    feet: alleyFit(scene.plate, scene.doors, 390, 844, frame).at(
      scene.guide.feet,
    ),
    doors,
  }
})()

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

/**
 * His stage loaded: the chunk's import settled and his first frame up, which
 * the stage says once his shader has linked (its onReady).
 */
async function drawn(): Promise<void> {
  await vi.dynamicImportSettled()
  await Promise.resolve()
  for (const ready of stage.ready) ready()
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
  stage.paused = []
  stage.ready = []
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
    // Then where to start: the Sing door stays lit, and he says so.
    expect(lights).toEqual(['ear', 'karaoke', 'sing', START_DOOR])
    expect(START_DOOR).toBe('sing')
    expect(mercState(root)).toBe('idle')
    // Drawn with "the Sing room." held together, read out plain.
    expect(q(root, 'alley-guide-line')?.textContent).toBe(
      'Start here: the\u00a0Sing\u00a0room.',
    )
    expect(q(root, 'alley-guide-said')?.textContent).toBe(
      ONBOARDING_COPY.startHere,
    )
    // Lit for as long as he is there.
    vi.advanceTimersByTime(60_000)
    expect(lights.at(-1)).toBe(START_DOOR)
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

  it('lights no door on an install whose onboarding is done, its welcome unseen', async () => {
    // Not now from the rail's Sing on a first run, then back to the alley:
    // no Merc, so no Sing door lit for good and nothing dimmed beside it.
    localStorage.setItem(ONBOARDING_KEY, 'done')
    resetOnboardingFlagForTests()
    const [aside, setAside] = createSignal(false)
    show({ aside })
    await drawn()
    vi.advanceTimersByTime(60_000)
    setAside(true)
    setAside(false)
    vi.advanceTimersByTime(60_000)

    expect(lights.filter((door) => door !== null)).toEqual([])
  })

  it('puts the lights out when the onboarding is done while the alley is up', async () => {
    const [aside, setAside] = createSignal(false)
    show({ aside })
    await drawn()
    vi.advanceTimersByTime(
      GUIDE_TIMES.light + DOORS_IN_TURN.length * GUIDE_TIMES.every,
    )
    expect(lights.at(-1)).toBe(START_DOOR)

    markOnboardingDone()
    vi.advanceTimersByTime(60_000)
    expect(lights.at(-1)).toBeNull()
    // A door picked and put back: the door to start at is not lit again.
    setAside(true)
    setAside(false)

    expect(lights.at(-1)).toBeNull()
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
    // Back from the door: where to start, lit again, in his words.
    setAside(false)
    expect(q(root, 'alley-guide')?.getAttribute('data-aside')).toBe('off')
    expect(lights).toEqual(['ear', null, START_DOOR])
    expect(q(root, 'alley-guide-line')?.textContent).toBe(
      heldAfterColon(ONBOARDING_COPY.startHere),
    )
  })

  it('stops drawing once he has faded out for a picked door, and draws again when it goes back', async () => {
    const [aside, setAside] = createSignal(false)
    show({ aside })
    await drawn()

    setAside(true)
    vi.advanceTimersByTime(ASIDE_MS - 1)
    // Still fading: still drawn.
    expect(stage.paused).toEqual([])
    vi.advanceTimersByTime(1)
    expect(stage.paused).toEqual([true])

    setAside(false)
    expect(stage.paused).toEqual([true, false])
  })

  it('never stops for a door put back before he has faded out', async () => {
    const [aside, setAside] = createSignal(false)
    show({ aside })
    await drawn()

    setAside(true)
    vi.advanceTimersByTime(ASIDE_MS - 40)
    setAside(false)
    vi.advanceTimersByTime(5000)

    expect(stage.paused).toEqual([])
  })

  it('under reduced motion: stops drawing after his shorter fade', async () => {
    const [aside, setAside] = createSignal(false)
    show({ reduced: true, aside })
    await drawn()

    setAside(true)
    vi.advanceTimersByTime(ASIDE_STILL_MS)

    expect(stage.paused).toEqual([true])
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

    expect(lights).toEqual(['ear', 'karaoke', 'sing', START_DOOR])
    expect(q(root, 'alley-guide-line')?.getAttribute('data-shown')).toBe('off')
    expect(alleyGreeted()).toBe(false)
  })
})

describe('his line as drawn', () => {
  it('holds the words after a colon together, and leaves a line without one', () => {
    expect(heldAfterColon('Start here: the Sing room.')).toBe(
      'Start here: the\u00a0Sing\u00a0room.',
    )
    expect(heldAfterColon("Hi, I'm Merc.")).toBe("Hi, I'm Merc.")
  })
})
