// ============================================================
// Keep, the account offer: when it is asked, and when it is not
// ============================================================
//
// S6 decision 02 and S7b §3.5: a sheet once, a beat after a take is kept in
// the Sing room, never before value (REQ-NAM-009) and one ask on this phone
// (010). Not now is quiet (014). A phone signed in, or signed out of the
// account it has, is not asked unprompted; the Save your progress row and
// the Cloud offer's free account open it for anyone signed out (S7b §5).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type * as AuthService from '@/db/services/auth-service'
import { setAuthToken } from '@/db/services/user-service'
import { TAB_HOME, TAB_SINGING } from '@/features/tabs/constants'
import { setPlaybackState } from '@/stores/playback-state-store'
import type { SingTake } from '@/stores/sing-takes-store'
import { clearSingTakes, keepSingTake, removeSingTake, SING_TAKES_KEPT, } from '@/stores/sing-takes-store'
import { setActiveTab } from '@/stores/ui-store'
import { openMore, resetRunShell, runState } from '../run-shell-store'
import { declineOffer, forgetAccountOffer, installAccountOffer, OFFER_BEAT_MS, offerOpen, openKeep, rangeFinder, registerRangeFinder, resetAccountOffer, } from './account-offer'
import { resetSignIn, signInOpen } from './sign-in-state'

const stand = vi.hoisted(() => ({ signedOutHere: false }))

vi.mock('@/db/services/auth-service', async (importOriginal) => ({
  ...(await importOriginal<typeof AuthService>()),
  needsSignIn: () => stand.signedOutHere,
}))

let serial = 0

function take(): SingTake {
  serial += 1
  return {
    id: `take-${serial}`,
    startedAt: 1_000,
    endedAt: 31_000,
    durationMs: 30_000,
    takeNumber: serial,
    lowNote: 'A3',
    highNote: 'E4',
    heldWithinCents: 18,
  }
}

function token(provider: string): string {
  const body = btoa(
    JSON.stringify({
      sub: 'user-1',
      provider,
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  )
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
  return `header.${body}.signature`
}

let uninstall: (() => void) | null = null

function install(): void {
  uninstall = installAccountOffer()
}

/** Keep a take in the room, then wait out the beat the sheet waits for. */
function keep(): void {
  keepSingTake(take())
  vi.advanceTimersByTime(OFFER_BEAT_MS)
}

function clean(): void {
  uninstall?.()
  uninstall = null
  clearSingTakes()
  setAuthToken(null)
  setPlaybackState('stopped')
  resetRunShell()
  resetSignIn()
  forgetAccountOffer()
  stand.signedOutHere = false
}

beforeEach(() => {
  vi.useFakeTimers()
  clean()
  setActiveTab(TAB_SINGING)
})

afterEach(() => {
  clean()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('the sheet', () => {
  it('rises a beat after a take is kept in the Sing room, on a phone with no account yet', () => {
    install()

    keepSingTake(take())
    const atOnce = offerOpen()
    vi.advanceTimersByTime(OFFER_BEAT_MS)

    expect(atOnce).toBe(false)
    expect(offerOpen()).toBe(true)
  })

  it('never comes before value: nothing kept, a take removed or all cleared ask nothing (REQ-NAM-009)', () => {
    const kept = [take(), take()]
    for (const one of kept) keepSingTake(one)
    install()

    vi.advanceTimersByTime(OFFER_BEAT_MS * 4)
    removeSingTake(kept[1]?.id ?? '')
    vi.advanceTimersByTime(OFFER_BEAT_MS)
    clearSingTakes()
    vi.advanceTimersByTime(OFFER_BEAT_MS)

    expect(offerOpen()).toBe(false)
  })

  it('comes once on this phone, and not again after a restart (REQ-NAM-010)', () => {
    install()
    keep()
    const first = offerOpen()
    declineOffer()

    keep()
    const again = offerOpen()
    resetAccountOffer()
    keep()

    expect(first).toBe(true)
    expect(again).toBe(false)
    expect(offerOpen()).toBe(false)
  })

  it('comes once in a session even where storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    install()
    keep()
    const first = offerOpen()
    declineOffer()

    keep()

    expect(first).toBe(true)
    expect(offerOpen()).toBe(false)
  })

  it('counts a take kept at the cap, where the list stays the same length', () => {
    for (let i = 0; i < SING_TAKES_KEPT; i += 1) keepSingTake(take())
    install()

    keep()

    expect(offerOpen()).toBe(true)
  })

  it('does not rise outside the Sing room, and waits for the next Keep in it', () => {
    install()

    keepSingTake(take())
    setActiveTab(TAB_HOME)
    vi.advanceTimersByTime(OFFER_BEAT_MS)
    const away = offerOpen()
    setActiveTab(TAB_SINGING)
    keep()

    expect(away).toBe(false)
    expect(offerOpen()).toBe(true)
  })

  it('rises after the Keep that closes a run, while the shell still holds the take as on screen', async () => {
    install()
    setPlaybackState('playing')
    setPlaybackState('stopped')
    // The shell settles a stopped run as ended a microtask later.
    await Promise.resolve()
    await Promise.resolve()
    const run = runState()

    keep()

    expect(run).toBe('ended')
    expect(offerOpen()).toBe(true)
  })

  it("does not rise over a run, or over anything of the shell's", () => {
    install()

    keepSingTake(take())
    setPlaybackState('playing')
    vi.advanceTimersByTime(OFFER_BEAT_MS)
    const overRun = offerOpen()
    setPlaybackState('paused')
    keep()
    const overPause = offerOpen()
    setPlaybackState('stopped')
    openMore()
    keep()
    const overMore = offerOpen()
    resetRunShell()
    keep()

    expect(overRun).toBe(false)
    expect(overPause).toBe(false)
    expect(overMore).toBe(false)
    expect(offerOpen()).toBe(true)
  })

  it('is not offered to a phone signed in to an account', () => {
    setAuthToken(token('apple'))
    install()

    keep()

    expect(offerOpen()).toBe(false)
  })

  it('is offered to a phone that holds only its own identity', () => {
    setAuthToken(token('anonymous'))
    install()

    keep()

    expect(offerOpen()).toBe(true)
  })

  it('is not offered to a phone that signed out of its account', () => {
    stand.signedOutHere = true
    install()

    keep()

    expect(offerOpen()).toBe(false)
  })

  it('stops watching once uninstalled', () => {
    install()
    uninstall?.()
    uninstall = null

    keep()

    expect(offerOpen()).toBe(false)
  })
})

describe('Not now, and the other ways in', () => {
  it('Not now is quiet: the sheet goes, and nothing opens in its place (REQ-NAM-014)', () => {
    install()
    keep()
    const up = offerOpen()

    declineOffer()

    expect(up).toBe(true)
    expect(offerOpen()).toBe(false)
    expect(signInOpen()).toBe(false)
  })

  it('opens from Settings and the Cloud offer for anyone signed out, a phone signed out of its account too', () => {
    stand.signedOutHere = true

    openKeep()

    expect(offerOpen()).toBe(true)
  })

  it('counts an ask from Settings as the one ask: no sheet after the next Keep', () => {
    openKeep()
    declineOffer()
    install()

    keep()

    expect(offerOpen()).toBe(false)
  })

  it('offers a range finder only while one is registered', () => {
    const none = rangeFinder()
    const run = vi.fn()
    const unregister = registerRangeFinder(run)
    const registered = rangeFinder()
    unregister()

    expect(none).toBeNull()
    expect(registered).toBe(run)
    expect(rangeFinder()).toBeNull()
  })
})
