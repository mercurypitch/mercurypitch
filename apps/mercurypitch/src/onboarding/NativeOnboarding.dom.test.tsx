// ============================================================
// The onboarding's layer: a dialog on a dark stage, and Not now
// ============================================================

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as MicSentinel from '@/lib/mic-sentinel'
import { resetRoomArrivalHolds } from '@/stores/native-shell-store'
import type { RenderedShell } from '../shell/render-for-test'
import { renderShell } from '../shell/render-for-test'
import { onboardingShown, setOnboardingShown } from '../shell/run-shell-store'
import { NativeOnboarding } from './NativeOnboarding'
import { ONBOARDING_COPY } from './onboarding-copy'
import { ONBOARDING_KEY, resetOnboardingFlagForTests, settleOnboarding, } from './onboarding-flag'
import { LEAVE_MS, onboardingExit, onboardingMounted, openOnboarding, } from './onboarding-layer'

vi.mock('@/lib/merc/stage', () => ({
  mountMercStage: () => ({
    ok: false,
    setState: () => undefined,
    setVoice: () => undefined,
    setPaused: () => undefined,
    setStill: () => undefined,
    destroy: () => undefined,
  }),
}))

vi.mock('@/lib/mic-sentinel', async (importOriginal) => ({
  ...(await importOriginal<typeof MicSentinel>()),
  registerMicIndicator: () => () => undefined,
}))

let view: RenderedShell | null = null

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  localStorage.clear()
  resetOnboardingFlagForTests()
  settleOnboarding(false)
  openOnboarding()
  view = renderShell(() => <NativeOnboarding />)
})

afterEach(() => {
  view?.unmount()
  view = null
  vi.advanceTimersByTime(LEAVE_MS)
  vi.useRealTimers()
  setOnboardingShown(false)
  resetRoomArrivalHolds()
  localStorage.clear()
  resetOnboardingFlagForTests()
})

const layer = (): HTMLElement | null =>
  view?.container.querySelector('[data-testid="native-onboarding"]') ?? null

describe('NativeOnboarding', () => {
  it('is a modal dialog on a dark stage, with Not now at its top', () => {
    const root = layer()
    expect(root?.getAttribute('role')).toBe('dialog')
    expect(root?.getAttribute('aria-modal')).toBe('true')
    expect(root?.getAttribute('aria-label')).toBe(ONBOARDING_COPY.title)
    expect(root?.classList.contains('mp-dark-stage')).toBe(true)
    expect(root?.getAttribute('data-leaving')).toBe('off')
    expect(root?.inert).not.toBe(true)
    const notNow = root?.querySelector('[data-testid="onboarding-not-now"]')
    expect(notNow?.textContent).toBe(ONBOARDING_COPY.notNow)
    // The first beat, Merc and all.
    expect(root?.getAttribute('data-beat')).toBe('first-note')
    expect(
      root?.querySelector('[data-testid="onboarding-merc"]'),
    ).not.toBeNull()
  })

  it('leaves on Not now: done for good, out of reach while it fades', () => {
    const notNow = layer()?.querySelector<HTMLButtonElement>(
      '[data-testid="onboarding-not-now"]',
    )
    notNow?.click()
    expect(onboardingShown()).toBe(false)
    expect(onboardingExit()).toBe('not-now')
    expect(localStorage.getItem(ONBOARDING_KEY)).toBe('done')
    expect(layer()?.getAttribute('data-leaving')).toBe('on')
    // A property in Solid; a browser reflects it to the attribute.
    expect(layer()?.inert).toBe(true)
    expect(onboardingMounted()).toBe(true)
    vi.advanceTimersByTime(LEAVE_MS)
    expect(onboardingMounted()).toBe(false)
  })
})
