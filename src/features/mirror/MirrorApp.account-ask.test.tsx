// ============================================================
// Voice Mirror results: where the account ask sits, and who sees it
// ============================================================
//
// The whole page, restored from a saved take the way /vocal-range-test#take-N
// restores it. The ask is the last thing under the shares, on the first
// voiceprint and on another one, never for an account holder, and tapping it
// is the only thing it adds to the funnel. Restoring a take is not a finished
// run, so `results_view` (the Ads `mirror_complete` conversion) stays quiet,
// exactly as before the ask existed.

import { cleanup, fireEvent, render, screen } from '@solidjs/testing-library'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi, } from 'vitest'
import { setAuthToken } from '@/db/services/user-service'
import { forgetSignInMethod } from '@/lib/last-sign-in'
import { resetAccountAskForTests } from './account-ask'
import type * as CardRenderer from './card-renderer'
import { trackFunnel } from './funnel'
import { MirrorApp } from './MirrorApp'

vi.mock('./funnel', () => ({ trackFunnel: vi.fn() }))
vi.mock('@/stores/promo-store', () => ({
  loadFeaturedPromo: async () => undefined,
  offeredPromo: () => null,
}))
// jsdom has no 2D canvas; the card's pixels are not what this file is about.
vi.mock('./card-renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof CardRenderer>()),
  renderCard: () => document.createElement('canvas'),
}))

const trackFunnelMock = vi.mocked(trackFunnel)

const midiToFreq = (midi: number): number => 440 * 2 ** ((midi - 69) / 12)

function glide(from: number, to: number) {
  return Array.from({ length: 25 }, (_, i) => ({
    t: i * 0.32,
    f0: midiToFreq(from + ((to - from) * i) / 24),
    conf: 0.95,
  }))
}

/** A saved take, as src/lib/mirror/attempts.ts stores one. */
function attempt(n: number) {
  return {
    n,
    savedAt: 1_700_000_000_000 + n,
    deltaLine: `TAKE-${n}`,
    glides: [glide(48, 74), glide(74, 48)],
    result: {
      range: {
        lowMidi: 48,
        highMidi: 74,
        lowNote: 'C3',
        highNote: 'D5',
        semitones: 26,
        qualifyingMidis: Array.from({ length: 27 }, (_, i) => 48 + i),
        voiceHint: 'Tenor',
      },
      accuracy: null,
      steadiness: null,
    },
  }
}

function accountToken(): string {
  const exp = Math.floor(Date.now() / 1000) + 3600
  const body = btoa(JSON.stringify({ sub: 'user-1', provider: 'google', exp }))
  return `h.${body}.s`
}

function openTake(n: number): HTMLElement {
  window.history.replaceState(null, '', `/vocal-range-test#take-${n}`)
  const { container } = render(() => <MirrorApp entryIntent="vocal-range" />)
  const results = container.querySelector<HTMLElement>('.mirror-results')
  if (results === null) throw new Error('the take did not restore')
  return results
}

// jsdom has no image decoding either; the twin's portrait preloads on restore.
beforeAll(() => {
  Object.defineProperty(HTMLImageElement.prototype, 'decode', {
    configurable: true,
    value: () => Promise.resolve(),
  })
})

afterAll(() => {
  Reflect.deleteProperty(HTMLImageElement.prototype, 'decode')
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(
    'mirror.attempts.v1',
    JSON.stringify([attempt(1), attempt(2)]),
  )
  setAuthToken(null)
  forgetSignInMethod()
  trackFunnelMock.mockClear()
})

afterEach(() => {
  cleanup()
  resetAccountAskForTests()
  window.history.replaceState(null, '', '/')
})

describe('the account ask on the results', () => {
  it('is the last thing under the shares on the first voiceprint', () => {
    const results = openTake(1)

    expect(screen.getByText('TAKE-1')).toHaveTextContent('TAKE-1')
    expect(results.lastElementChild?.getAttribute('data-testid')).toBe(
      'mirror-account-ask',
    )
  })

  it('is there again on another voiceprint', () => {
    const results = openTake(2)

    expect(screen.getByText('TAKE-2')).toHaveTextContent('TAKE-2')
    expect(results.lastElementChild?.getAttribute('data-testid')).toBe(
      'mirror-account-ask',
    )
  })

  it('is never there for an account holder', () => {
    setAuthToken(accountToken())
    const results = openTake(1)

    expect(screen.queryByTestId('mirror-account-ask')).toBeNull()
    expect(results.lastElementChild?.className).toBe('mirror-foot')
  })

  it('adds only its own tap to the funnel, and no results_view', () => {
    openTake(1)
    expect(trackFunnelMock.mock.calls.map(([event]) => event)).toEqual([
      'mirror_view',
    ])

    fireEvent.click(
      screen.getByRole('button', { name: 'Create my free account' }),
    )

    expect(trackFunnelMock.mock.calls.map(([event]) => event)).toEqual([
      'mirror_view',
      'cta_account_click',
    ])
  })
})
