// ============================================================
// Stage 2's half of the shell: the import queue and the store
// ============================================================
//
// A build with Import (every dev-target build: TestFlight, the probe, the
// tests) runs the queue that sends imported songs for as long as the shell
// does, and hands the room a subscription that fails closed until the store
// is real. A build without it (the store build) gets neither. And the note
// of a purchase made signed out is settled on every change of session, so an
// account made of the phone in place keeps what it bought where it is.

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type * as NativeBuild from '@/lib/native-build'

const build = vi.hoisted(() => ({ importing: false }))
vi.mock('@/lib/native-build', async (importOriginal) => ({
  ...(await importOriginal<typeof NativeBuild>()),
  get KARAOKE_IMPORT() {
    return build.importing
  },
}))

const queue = vi.hoisted(() => ({ starts: 0, stops: 0 }))
vi.mock('@/features/karaoke-room/karaoke-import-queue', () => ({
  startKaraokeImportQueue: () => {
    queue.starts += 1
    return () => {
      queue.stops += 1
    }
  },
}))

/** The session the phone holds: its provider and its account's id. */
const auth = vi.hoisted(() => ({
  asked: 0,
  provider: null as string | null,
  account: null as string | null,
}))
vi.mock('@/db/services/auth-service', () => ({
  requireAuth: vi.fn(async () => {
    auth.asked += 1
    return Promise.resolve(true)
  }),
  isRegisteredProvider: (provider: string | null | undefined) =>
    provider != null && provider !== 'anonymous',
  storedTokenProvider: () => auth.provider,
  currentAccountId: () => auth.account,
}))

import { setAuthToken } from '@/db/services/user-service'
import { installKaraokeImport } from './karaoke-import-wiring'
import { SIGNED_OUT_PURCHASE_KEY } from './karaoke-subscription'

/** This phone's device id: its anonymous identity's id too. */
const PHONE = '0a0a0a0a-0000-4000-8000-00000000000a'
/** An account that already existed. */
const ACCOUNT = '0b0b0b0b-0000-4000-8000-00000000000b'

beforeEach(() => {
  build.importing = false
  queue.starts = 0
  queue.stops = 0
  auth.asked = 0
  auth.provider = 'anonymous'
  auth.account = PHONE
  localStorage.clear()
  localStorage.setItem('mp:userId', PHONE)
})

describe('the shell in a build without Import', () => {
  it('starts no queue and offers the room no subscription', () => {
    const wiring = installKaraokeImport()

    expect(wiring.api).toEqual({})
    expect(queue.starts).toBe(0)
    wiring.stop()
    expect(queue.stops).toBe(0)
  })
})

describe('the shell in a build with Import', () => {
  it('runs the queue for as long as the shell does', () => {
    build.importing = true

    const wiring = installKaraokeImport()

    expect(queue.starts).toBe(1)
    wiring.stop()
    expect(queue.stops).toBe(1)
  })

  it('hands the room a subscription that fails closed until the store is real', async () => {
    build.importing = true

    const subscription = installKaraokeImport().api.karaokeSubscription

    await expect(subscription?.subscribe()).resolves.toBe('unavailable')
    await expect(subscription?.restore()).resolves.toBe('unavailable')
    expect(subscription?.manage).toBeUndefined()
    // No identity is made for a store that is not there.
    expect(auth.asked).toBe(0)
  })
})

describe('the note of a purchase made signed out', () => {
  it('goes once the phone becomes an account itself, on the change of session', async () => {
    build.importing = true
    localStorage.setItem(SIGNED_OUT_PURCHASE_KEY, PHONE)
    const wiring = installKaraokeImport()
    await Promise.resolve()
    expect(localStorage.getItem(SIGNED_OUT_PURCHASE_KEY)).toBe(PHONE)

    // Made in place: the account keeps the phone's id, and already has
    // what it bought. No later sign-in may take it anywhere.
    auth.provider = 'apple'
    auth.account = PHONE
    setAuthToken('in-place')
    await Promise.resolve()

    expect(localStorage.getItem(SIGNED_OUT_PURCHASE_KEY)).toBeNull()
    wiring.stop()
  })

  it('stays for a sign-in to another account, whose carry it is', async () => {
    build.importing = true
    localStorage.setItem(SIGNED_OUT_PURCHASE_KEY, PHONE)
    const wiring = installKaraokeImport()

    auth.provider = 'apple'
    auth.account = ACCOUNT
    setAuthToken('existing')
    await Promise.resolve()

    expect(localStorage.getItem(SIGNED_OUT_PURCHASE_KEY)).toBe(PHONE)
    wiring.stop()
  })
})
