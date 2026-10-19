// ============================================================
// First Light's gate: a lesson's link steps it aside, nothing else does
// ============================================================
//
// Each `load` is a page load: fresh stores over whatever localStorage the
// last one left, then what index.tsx does before the render (the lesson
// step-aside), then what App does (the gate). Nothing under test is mocked
// but the build flag, for the native case.

import { cleanup, render } from '@solidjs/testing-library'
import { createSignal } from 'solid-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { releaseLine, WHATS_NEW_SEEN_KEY, } from '@/features/whats-new/whats-new-release'
import { APP_VERSION } from '@/lib/defaults'
import type * as NativeBuild from '@/lib/native-build'
import type { FirstLightGate } from './useFirstLight'

const build = vi.hoisted(() => ({ native: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get IS_NATIVE_BUILD() {
    return build.native
  },
}))

const WELCOME_KEY = 'pitchperfect_welcome_version'
const DONE_KEY = 'pitchperfect_onboarding_done'
const RESUME_KEY = 'pitchperfect_onboarding_resume'
const FUNNEL_KEY = 'onboarding.funnel.v1'

/** Every key this device holds, sorted. */
function storedKeys(): string[] {
  const keys: string[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key !== null) keys.push(key)
  }
  return keys.sort()
}

/**
 * Boot the app's first-run decision at `url`, as one page load does.
 * `held` starts the gate behind another surface; `setHeld` lifts it.
 */
async function load(url: string, options: { held?: boolean } = {}) {
  cleanup()
  window.history.replaceState(null, '', url)
  vi.resetModules()
  const onboarding = await import('@/stores/onboarding-store')
  const ui = await import('@/stores/ui-store')
  const { useFirstLight } = await import('./useFirstLight')
  const steppedAside = onboarding.stepAsideForLesson(window.location.search)
  const [held, setHeld] = createSignal(options.held ?? false)
  let gate: FirstLightGate | undefined
  render(() => {
    gate = useFirstLight(held)
    return null
  })
  if (gate === undefined) throw new Error('the gate did not mount')
  return { onboarding, ui, gate, steppedAside, setHeld }
}

beforeEach(() => {
  build.native = false
  localStorage.clear()
})

afterEach(() => {
  cleanup()
  window.history.replaceState(null, '', '/')
})

describe('a fresh visitor', () => {
  it('meets First Light on its welcome when no lesson sent them', async () => {
    const { onboarding, steppedAside } = await load('/ear-lab#/ear-lab')

    expect(steppedAside).toBeNull()
    expect(onboarding.flowOpen()).toBe(true)
    expect(onboarding.currentBeat()).toBe('sky')
  })

  it.each([
    ['/ear-lab?lesson=15#/ear-lab'],
    ['/ear-lab?lesson=2#/ear-lab'],
    ['/ear-lab?lesson=#/ear-lab'],
    ['/ear-lab?lessons=02#/ear-lab'],
    ['/#/ear-lab?lesson=02'],
  ])('meets it too behind a marker the app does not read: %s', async (url) => {
    const { onboarding, steppedAside } = await load(url)

    expect(steppedAside).toBeNull()
    expect(onboarding.flowOpen()).toBe(true)
    expect(localStorage.getItem(WELCOME_KEY)).toBeNull()
  })
})

describe('a fresh visitor a lesson sent', () => {
  it.each([
    ['/ear-lab?lesson=02#/ear-lab', 2],
    ['/pitch-training?lesson=04#/exercises', 4],
    ['/exercises/speed-scales?lesson=04', 4],
    ['/?lesson=09#/path', 9],
  ])('goes straight to the room at %s, with no intro', async (url, lesson) => {
    const { onboarding, ui, steppedAside } = await load(url)

    expect(steppedAside).toBe(lesson)
    expect(onboarding.lessonArrival()).toBe(lesson)
    expect(onboarding.flowOpen()).toBe(false)
    expect(ui.showWelcome()).toBe(false)
  })

  it('is not offered the intro on a later visit without the marker', async () => {
    await load('/ear-lab?lesson=02#/ear-lab')

    const later = await load('/#/home')

    expect(later.steppedAside).toBeNull()
    expect(later.onboarding.flowOpen()).toBe(false)
    expect(later.ui.showWelcome()).toBe(false)
  })

  it('leaves the device as the x would, and records nothing else', async () => {
    // The x spends both flags and drops any sign-in resume (finishOnboarding).
    // The lesson's number is not kept, and no funnel event is written: the
    // visitor skipped nothing they saw.
    localStorage.setItem(RESUME_KEY, 'map')

    const { onboarding } = await load('/ear-lab?lesson=02#/ear-lab')

    expect(onboarding.isFirstRun()).toBe(false)
    expect(localStorage.getItem(WELCOME_KEY)).toBe('1')
    expect(localStorage.getItem(DONE_KEY)).toBe('1')
    expect(localStorage.getItem(RESUME_KEY)).toBe('')
    expect(localStorage.getItem(FUNNEL_KEY)).toBeNull()
    expect(storedKeys()).toEqual([DONE_KEY, RESUME_KEY, WELCOME_KEY].sort())
  })

  it("still gets the intro, on its welcome, from Settings' Replay", async () => {
    const { onboarding, ui, gate } = await load('/ear-lab?lesson=02#/ear-lab')

    ui.setShowWelcome(true)

    expect(onboarding.flowOpen()).toBe(true)
    expect(onboarding.currentBeat()).toBe('sky')
    expect(gate.replay()).toBe(false)
  })

  it('still gets the Map on its own from #/map', async () => {
    const { onboarding, gate } = await load('/ear-lab?lesson=02#/ear-lab')

    gate.openMap()

    expect(onboarding.flowOpen()).toBe(true)
    expect(onboarding.currentBeat()).toBe('map')
    expect(gate.replay()).toBe(true)
  })

  it("is not announced What's New, and is caught up for the next release", async () => {
    const { onboarding } = await load('/ear-lab?lesson=02#/ear-lab')
    const { createWhatsNewController } =
      await import('@/features/whats-new/use-whats-new')
    const whatsNew = createWhatsNewController()

    whatsNew.announceIfNew(onboarding.returningVisitor())

    expect(whatsNew.open()).toBe(false)
    expect(window.location.hash).toBe('#/ear-lab')
    expect(localStorage.getItem(WHATS_NEW_SEEN_KEY)).toBe(
      releaseLine(APP_VERSION),
    )
  })
})

describe('a visitor who was offered the intro before', () => {
  it('finds a lesson marker changes nothing', async () => {
    localStorage.setItem(WELCOME_KEY, '1')

    const { onboarding, steppedAside } = await load(
      '/ear-lab?lesson=02#/ear-lab',
    )

    expect(steppedAside).toBeNull()
    expect(onboarding.lessonArrival()).toBeNull()
    expect(onboarding.flowOpen()).toBe(false)
    // A link spends the welcome flag alone (a jam room, say); the marker
    // does not finish a flow it did not step aside.
    expect(localStorage.getItem(DONE_KEY)).toBeNull()
    expect(onboarding.returningVisitor()).toBe(true)
  })

  it('is announced a new release line as before, lesson or no lesson', async () => {
    localStorage.setItem(WELCOME_KEY, '1')
    localStorage.setItem(WHATS_NEW_SEEN_KEY, '0.0')
    const { onboarding } = await load('/ear-lab?lesson=02#/ear-lab')
    const { createWhatsNewController } =
      await import('@/features/whats-new/use-whats-new')

    createWhatsNewController().announceIfNew(onboarding.returningVisitor())

    expect(window.location.hash).toBe('#/whats-new')
  })
})

describe('the gate itself', () => {
  it('waits while another surface holds the screen, then opens', async () => {
    const { onboarding, setHeld } = await load('/#/voice-constellation', {
      held: true,
    })
    const whileHeld = onboarding.flowOpen()

    setHeld(false)

    expect(whileHeld).toBe(false)
    expect(onboarding.flowOpen()).toBe(true)
  })

  it('comes back on the Map after a sign-in redirect left from it', async () => {
    // What armOnboardingResume left before a Google sign-in left the page.
    localStorage.setItem(RESUME_KEY, 'map')

    const { onboarding } = await load('/')

    expect(onboarding.flowOpen()).toBe(true)
    expect(onboarding.currentBeat()).toBe('map')
  })

  it('stays shut once the flow is finished, on this load and the next', async () => {
    const first = await load('/')
    first.onboarding.finishOnboarding()
    const reopenedAtOnce = first.onboarding.flowOpen()

    const next = await load('/')

    expect(reopenedAtOnce).toBe(false)
    expect(next.onboarding.flowOpen()).toBe(false)
  })
})

describe('under the native build', () => {
  it('never opens, and a lesson marker writes nothing', async () => {
    build.native = true

    const { onboarding, steppedAside } = await load(
      '/ear-lab?lesson=02#/ear-lab',
    )

    expect(steppedAside).toBeNull()
    expect(onboarding.flowOpen()).toBe(false)
    expect(storedKeys()).toEqual([])
  })
})
